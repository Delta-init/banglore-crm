package com.callrecorder.service

import android.content.Context
import com.callrecorder.data.db.AppDatabase
import com.callrecorder.data.db.CrmLogEntity
import com.callrecorder.data.db.RecordingEntity
import com.callrecorder.utils.AppLogger
import com.callrecorder.utils.PrefsHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.MediaType.Companion.toMediaType
import okhttp3.MultipartBody
import okhttp3.OkHttpClient
import okhttp3.Request
import okhttp3.RequestBody.Companion.asRequestBody
import okhttp3.RequestBody.Companion.toRequestBody
import java.io.File
import java.time.Instant
import java.util.concurrent.TimeUnit

/**
 * ════════════════════════════════════════════════════════════════════
 *  CrmSyncService — logs every call to the CRM backend
 * ════════════════════════════════════════════════════════════════════
 *
 *  Two entry points:
 *
 *  1. sync()           — called after a CONNECTED call with a recording file.
 *                        Uploads the audio file + metadata as multipart POST.
 *                        Falls back to logCallEvent() if the file is missing/tiny.
 *
 *  2. logCallEvent()   — called for ANY call event (missed, not-answered,
 *                        recording failed, etc.).  Sends only metadata — no file.
 *                        The backend accepts calls without a recording file.
 *
 *  Both methods:
 *  - Send to POST <crmBaseUrl>/api/v1/calls/upload-recording
 *  - Save a CrmLogEntity to the local DB (audit trail for the CRM Logs tab)
 *  - Return Pair(synced, "ID: xxx" | error message)
 *
 *  Never throws — all errors are logged only.
 * ════════════════════════════════════════════════════════════════════
 */
object CrmSyncService {

    private const val TAG = "CrmSyncService"

    // Used for file uploads (sync() with recording attached) — long write timeout for large files
    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(180, TimeUnit.SECONDS)
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    // Used for metadata-only calls (logCallEvent, no file).
    // Short timeouts so we stay within the BroadcastReceiver goAsync() 10-second window.
    private val metadataClient = OkHttpClient.Builder()
        .connectTimeout(7, TimeUnit.SECONDS)
        .readTimeout(7, TimeUnit.SECONDS)
        .build()

    // ── Pre-flight check ──────────────────────────────────────────────────────

    private fun readyOrNull(context: Context): Pair<String, String>? {
        val baseUrl = PrefsHelper.getCrmBaseUrl(context).trimEnd('/')
        val apiKey  = PrefsHelper.getCrmApiKey(context).trim()
        if (baseUrl.isBlank()) {
            AppLogger.w(context, TAG, "CRM sync skipped — CRM URL not set (Settings → CRM Sync)")
            return null
        }
        if (apiKey.isBlank()) {
            AppLogger.w(context, TAG, "CRM sync skipped — CRM API key not set (Settings → CRM Sync)")
            return null
        }
        return baseUrl to apiKey
    }

    // ── Shared: parse call_log_id from JSON response body ─────────────────────

    private fun parseCallLogId(body: String): String? = try {
        org.json.JSONObject(body).optJSONObject("data")?.optString("call_log_id")
            ?.takeIf { it.isNotBlank() }
    } catch (_: Exception) { null }

    // ── Shared: persist audit entry to local DB ───────────────────────────────

    private suspend fun saveLog(
        context:         Context,
        phoneNumber:     String,
        callType:        String,
        durationSecs:    Long,
        synced:          Boolean,
        callLogId:       String?,
        errorMessage:    String?,
        systemCallLogId: Long? = null,
    ) {
        try {
            AppDatabase.getInstance(context).crmLogDao().insert(
                CrmLogEntity(
                    phoneNumber     = phoneNumber,
                    callType        = callType,
                    durationSecs    = durationSecs,
                    synced          = synced,
                    callLogId       = callLogId,
                    errorMessage    = errorMessage,
                    systemCallLogId = systemCallLogId,
                )
            )
        } catch (e: Exception) {
            AppLogger.w(context, TAG, "CrmLog DB write failed: ${e.message}")
        }
    }

    // ── sync() — connected call WITH recording file ───────────────────────────

    /**
     * Upload recording file + call metadata to the CRM.
     * If the file is missing or too small, falls back to logCallEvent().
     *
     * @return Pair(synced, "ID: xxx" | errorMessage)
     */
    suspend fun sync(context: Context, recording: RecordingEntity): Pair<Boolean, String?> {
        val cfg = readyOrNull(context)
        if (cfg == null) {
            val err = "CRM not configured (Settings → CRM Sync)"
            saveLog(context, recording.phoneNumber, recording.callType,
                    recording.duration / 1000L, false, null, err)
            return false to err
        }
        val (baseUrl, apiKey) = cfg
        val extension    = PrefsHelper.getAgentExtension(context).trim()
        val file         = File(recording.filePath)
        val durationSecs = recording.duration / 1000L
        val callDateIso  = Instant.ofEpochMilli(recording.createdAt).toString()

        // If recording file is missing or empty, log as metadata-only
        if (!file.exists() || file.length() < 1024L) {
            AppLogger.w(
                context, TAG,
                "Recording file missing/tiny (${file.length()}B) — logging call without file"
            )
            val (synced, callLogId, errMsg) = logCallEvent(
                context         = context,
                phoneNumber     = recording.phoneNumber,
                callType        = recording.callType,
                durationSecs    = durationSecs,
                callDateIso     = callDateIso,
                systemCallLogId = recording.systemCallLogId,
            )
            return synced to if (synced) "ID: $callLogId" else errMsg
        }

        AppLogger.i(
            context, TAG,
            "Syncing to CRM with recording: ${recording.phoneNumber} " +
            "(${recording.callType}, ${durationSecs}s, ${file.length() / 1024}KB)"
        )

        return try {
            withContext(Dispatchers.IO) {
                val body = MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("phone_number",    recording.phoneNumber)
                    .addFormDataPart("call_type",       recording.callType)
                    .addFormDataPart("duration",        durationSecs.toString())
                    .addFormDataPart("call_date",       callDateIso)
                    .addFormDataPart("agent_extension", extension)
                    .addFormDataPart(
                        "recording",
                        file.name,
                        file.asRequestBody("audio/mp4".toMediaType()),
                    )
                    .build()

                val request = Request.Builder()
                    .url("$baseUrl/api/v1/calls/upload-recording")
                    .header("x-api-key", apiKey)
                    .post(body)
                    .build()

                val response     = client.newCall(request).execute()
                val responseBody = response.body?.string() ?: ""

                if (response.isSuccessful) {
                    val callLogId  = parseCallLogId(responseBody)
                    val successMsg = if (callLogId != null) "ID: $callLogId" else "HTTP ${response.code}"
                    AppLogger.i(context, TAG, "CRM sync ✅ $successMsg")
                    saveLog(context, recording.phoneNumber, recording.callType,
                            durationSecs, true, callLogId, null, recording.systemCallLogId)
                    true to successMsg
                } else {
                    val errMsg = "HTTP ${response.code}: ${responseBody.take(200)}"
                    AppLogger.e(context, TAG, "CRM sync failed $errMsg")
                    saveLog(context, recording.phoneNumber, recording.callType,
                            durationSecs, false, null, errMsg, recording.systemCallLogId)
                    false to errMsg
                }
            }
        } catch (e: Exception) {
            val msg = "${e.javaClass.simpleName}: ${e.message?.take(100)}"
            AppLogger.e(context, TAG, "CRM sync error: $msg")
            saveLog(context, recording.phoneNumber, recording.callType,
                    durationSecs, false, null, msg, recording.systemCallLogId)
            false to msg
        }
    }

    // ── logCallEvent() — any call WITHOUT a recording file ───────────────────

    /**
     * Logs a call event to the CRM without uploading a recording file.
     * Inserts a new CrmLogEntity row in the local DB on every call.
     *
     * @return Triple(synced, callLogId, errorMessage)
     *         callLogId is non-null only on success; errorMessage is non-null only on failure.
     */
    suspend fun logCallEvent(
        context:         Context,
        phoneNumber:     String,
        callType:        String,
        durationSecs:    Long   = 0L,
        callDateIso:     String = Instant.now().toString(),
        systemCallLogId: Long?  = null,
    ): Triple<Boolean, String?, String?> {
        val cfg = readyOrNull(context)
        if (cfg == null) {
            val err = "CRM not configured (Settings → CRM Sync)"
            saveLog(context, phoneNumber, callType, durationSecs, false, null, err, systemCallLogId)
            return Triple(false, null, err)
        }

        if (phoneNumber.isBlank()) {
            val err = "Phone number blank"
            AppLogger.w(context, TAG, "logCallEvent skipped — phone number is blank")
            saveLog(context, phoneNumber, callType, durationSecs, false, null, err, systemCallLogId)
            return Triple(false, null, err)
        }

        AppLogger.i(context, TAG,
            "Logging call event to CRM: $phoneNumber ($callType, ${durationSecs}s)")

        val (synced, callLogId, errMsg) = executeCallEvent(
            context, cfg, phoneNumber, callType, durationSecs, callDateIso
        )
        saveLog(context, phoneNumber, callType, durationSecs, synced, callLogId, errMsg, systemCallLogId)
        return Triple(synced, callLogId, errMsg)
    }

    // ── executeCallEvent() — shared HTTP call (no DB write) ───────────────────

    /**
     * Makes the actual HTTP POST. Returns Triple(synced, callLogId, errorMessage).
     * Does NOT write to the local DB — callers decide whether to insert or update.
     */
    private suspend fun executeCallEvent(
        context:      Context,
        cfg:          Pair<String, String>,
        phoneNumber:  String,
        callType:     String,
        durationSecs: Long,
        callDateIso:  String,
    ): Triple<Boolean, String?, String?> {
        val (baseUrl, apiKey) = cfg
        val extension = PrefsHelper.getAgentExtension(context).trim()

        return try {
            withContext(Dispatchers.IO) {
                val body = MultipartBody.Builder()
                    .setType(MultipartBody.FORM)
                    .addFormDataPart("phone_number",    phoneNumber)
                    .addFormDataPart("call_type",       callType)
                    .addFormDataPart("duration",        durationSecs.toString())
                    .addFormDataPart("call_date",       callDateIso)
                    .addFormDataPart("agent_extension", extension)
                    .build()

                val request = Request.Builder()
                    .url("$baseUrl/api/v1/calls/upload-recording")
                    .header("x-api-key", apiKey)
                    .post(body)
                    .build()

                val response     = metadataClient.newCall(request).execute()
                val responseBody = response.body?.string() ?: ""

                if (response.isSuccessful) {
                    val callLogId = parseCallLogId(responseBody)
                    AppLogger.i(context, TAG, "CRM ✅ ID: $callLogId")
                    Triple(true, callLogId, null)
                } else {
                    val err = "HTTP ${response.code}: ${responseBody.take(300)}"
                    AppLogger.e(context, TAG, "CRM failed: $err")
                    Triple(false, null, err)
                }
            }
        } catch (e: Exception) {
            val err = "${e.javaClass.simpleName}: ${e.message?.take(100)}"
            AppLogger.e(context, TAG, "CRM error: $err")
            Triple(false, null, err)
        }
    }

    // ── Retry helpers ─────────────────────────────────────────────────────────

    /**
     * Retry a single failed CrmLogEntity.
     * Updates the EXISTING row in-place (no new insert) so the UI reflects
     * the live retry state via the DB Flow.
     *
     * State machine:
     *   row.errorMessage = "⏳ Retrying…"  → HTTP call in progress (button disabled)
     *   row.synced = true                  → success (green)
     *   row.synced = false + real error    → failure (red, button re-enabled)
     */
    suspend fun retrySingle(context: Context, log: CrmLogEntity) {
        val dao = AppDatabase.getInstance(context).crmLogDao()

        // 1. Mark as in-progress so UI disables the retry button immediately
        dao.updateSyncResult(log.id, false, null, "⏳ Retrying…")

        val cfg = readyOrNull(context)
        if (cfg == null) {
            dao.updateSyncResult(log.id, false, null, "CRM not configured (Settings → CRM Sync)")
            return
        }
        if (log.phoneNumber.isBlank()) {
            dao.updateSyncResult(log.id, false, null, "Phone number blank")
            return
        }

        val callDateIso = Instant.ofEpochMilli(log.timestamp).toString()
        val (synced, callLogId, errMsg) = executeCallEvent(
            context, cfg, log.phoneNumber, log.callType, log.durationSecs, callDateIso
        )

        // 2. Write real result back — Flow emits → UI refreshes automatically
        dao.updateSyncResult(
            id           = log.id,
            synced       = synced,
            callLogId    = callLogId,
            errorMessage = if (synced) null else errMsg,
        )

        // 3. If retry succeeded and this log has a system call log link, back-fill
        //    the matching RecordingEntity so the Recent Calls badge shows ✅.
        if (synced && callLogId != null && log.systemCallLogId != null) {
            try {
                val recDao = AppDatabase.getInstance(context).recordingDao()
                val rec = recDao.getBySystemCallLogId(log.systemCallLogId)
                if (rec != null) {
                    recDao.updateSyncResult(
                        id              = rec.id,
                        synced          = true,
                        error           = null,
                        crmCallLogId    = callLogId,
                        systemCallLogId = log.systemCallLogId,
                    )
                }
            } catch (e: Exception) {
                AppLogger.w(context, TAG, "Back-fill RecordingEntity after retry failed: ${e.message}")
            }
        }
    }

    /**
     * Retry every failed CrmLogEntry that is not already retrying.
     * Called automatically on app launch and by the "Retry All" button.
     *
     * @return number of entries that succeeded this round
     */
    suspend fun retryAllFailed(context: Context): Int {
        val dao = AppDatabase.getInstance(context).crmLogDao()
        val failed = dao.getFailedLogs()
        if (failed.isEmpty()) return 0

        AppLogger.i(context, TAG, "Auto-retry: ${failed.size} failed entries")
        var successCount = 0
        for (log in failed) {
            retrySingle(context, log)
            // Read back updated row to count successes
            if (dao.getAllLogsSnapshot().firstOrNull { it.id == log.id }?.synced == true) {
                successCount++
            }
        }
        AppLogger.i(context, TAG, "Auto-retry done: $successCount/${failed.size} succeeded")
        return successCount
    }
}
