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

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(180, TimeUnit.SECONDS)   // long calls = large files
        .readTimeout(30, TimeUnit.SECONDS)
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
        context:      Context,
        phoneNumber:  String,
        callType:     String,
        durationSecs: Long,
        synced:       Boolean,
        callLogId:    String?,
        errorMessage: String?,
    ) {
        try {
            AppDatabase.getInstance(context).crmLogDao().insert(
                CrmLogEntity(
                    phoneNumber  = phoneNumber,
                    callType     = callType,
                    durationSecs = durationSecs,
                    synced       = synced,
                    callLogId    = callLogId,
                    errorMessage = errorMessage,
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
            return logCallEvent(
                context      = context,
                phoneNumber  = recording.phoneNumber,
                callType     = recording.callType,
                durationSecs = durationSecs,
                callDateIso  = callDateIso,
            )
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
                            durationSecs, true, callLogId, null)
                    true to successMsg
                } else {
                    val errMsg = "HTTP ${response.code}: ${responseBody.take(200)}"
                    AppLogger.e(context, TAG, "CRM sync failed $errMsg")
                    saveLog(context, recording.phoneNumber, recording.callType,
                            durationSecs, false, null, errMsg)
                    false to errMsg
                }
            }
        } catch (e: Exception) {
            val msg = "${e.javaClass.simpleName}: ${e.message?.take(100)}"
            AppLogger.e(context, TAG, "CRM sync error: $msg")
            saveLog(context, recording.phoneNumber, recording.callType,
                    durationSecs, false, null, msg)
            false to msg
        }
    }

    // ── logCallEvent() — any call WITHOUT a recording file ───────────────────

    /**
     * Logs a call event to the CRM without uploading a recording file.
     *
     * Use for:
     *   • Missed / not-answered calls        (callType = "missed" | "notanswered")
     *   • Connected calls where recording failed (callType = "incoming" | "outgoing")
     *
     * @param phoneNumber  Raw phone number (may include + and country code)
     * @param callType     "incoming" | "outgoing" | "missed" | "notanswered"
     * @param durationSecs Call duration in SECONDS. 0 for missed/not-answered.
     * @param callDateIso  ISO 8601 UTC timestamp (defaults to now)
     *
     * @return Pair(synced, "ID: xxx" | errorMessage)
     */
    suspend fun logCallEvent(
        context:      Context,
        phoneNumber:  String,
        callType:     String,
        durationSecs: Long   = 0L,
        callDateIso:  String = Instant.now().toString(),
    ): Pair<Boolean, String?> {
        val cfg = readyOrNull(context)
        if (cfg == null) {
            val err = "CRM not configured (Settings → CRM Sync)"
            saveLog(context, phoneNumber, callType, durationSecs, false, null, err)
            return false to err
        }
        val (baseUrl, apiKey) = cfg
        val extension = PrefsHelper.getAgentExtension(context).trim()

        if (phoneNumber.isBlank()) {
            val err = "Phone number blank"
            AppLogger.w(context, TAG, "logCallEvent skipped — phone number is blank")
            saveLog(context, phoneNumber, callType, durationSecs, false, null, err)
            return false to err
        }

        AppLogger.i(
            context, TAG,
            "Logging call event to CRM: $phoneNumber ($callType, ${durationSecs}s)"
        )

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

                val response     = client.newCall(request).execute()
                val responseBody = response.body?.string() ?: ""

                if (response.isSuccessful) {
                    val callLogId  = parseCallLogId(responseBody)
                    val successMsg = if (callLogId != null) "ID: $callLogId" else "HTTP ${response.code}"
                    AppLogger.i(context, TAG, "Call event logged ✅ $successMsg")
                    saveLog(context, phoneNumber, callType, durationSecs,
                            true, callLogId, null)
                    true to successMsg
                } else {
                    val errMsg = "HTTP ${response.code}: ${responseBody.take(200)}"
                    AppLogger.e(context, TAG, "Call event log failed $errMsg")
                    saveLog(context, phoneNumber, callType, durationSecs,
                            false, null, errMsg)
                    false to errMsg
                }
            }
        } catch (e: Exception) {
            val msg = "${e.javaClass.simpleName}: ${e.message?.take(100)}"
            AppLogger.e(context, TAG, "logCallEvent error: $msg")
            saveLog(context, phoneNumber, callType, durationSecs, false, null, msg)
            false to msg
        }
    }
}
