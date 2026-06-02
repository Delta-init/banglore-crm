package com.callrecorder.service

import android.content.Context
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
 *  CrmSyncService — uploads call log + recording to the CRM backend
 * ════════════════════════════════════════════════════════════════════
 *
 *  Called from CallRecordingService after every completed recording.
 *  Sends a single multipart POST to:
 *    POST <crmBaseUrl>/api/v1/calls/upload-recording
 *
 *  Headers:
 *    x-api-key: <CALL_RECORDER_API_KEY from CRM Settings>
 *
 *  Fields:
 *    recording        — .m4a audio file
 *    phone_number     — lead's phone
 *    call_type        — "incoming" | "outgoing" | "unknown"
 *    duration         — call duration in SECONDS
 *    call_date        — ISO 8601 UTC timestamp
 *    agent_extension  — agent's extension number
 *
 *  Never throws — all errors are logged only.
 *  Configure in CallRecorder Settings → CRM Sync.
 * ════════════════════════════════════════════════════════════════════
 */
object CrmSyncService {

    private const val TAG = "CrmSyncService"

    private val client = OkHttpClient.Builder()
        .connectTimeout(30, TimeUnit.SECONDS)
        .writeTimeout(180, TimeUnit.SECONDS)   // long calls = large files
        .readTimeout(30, TimeUnit.SECONDS)
        .build()

    /**
     * Post call log + recording file to the CRM.
     *
     * Must be called from a coroutine (uses Dispatchers.IO internally).
     * Silently skips if CRM URL or API key is not configured.
     *
     * @return true  = successfully synced to CRM
     *         false = skipped (not configured) or network/server error
     */
    suspend fun sync(context: Context, recording: RecordingEntity): Boolean {
        val baseUrl   = PrefsHelper.getCrmBaseUrl(context).trimEnd('/')
        val apiKey    = PrefsHelper.getCrmApiKey(context).trim()
        val extension = PrefsHelper.getAgentExtension(context).trim()

        // ── Pre-flight checks ─────────────────────────────────────────────────
        if (baseUrl.isBlank()) {
            AppLogger.w(context, TAG, "CRM sync skipped — CRM URL not set (Settings → CRM Sync)")
            return false
        }
        if (apiKey.isBlank()) {
            AppLogger.w(context, TAG, "CRM sync skipped — CRM API key not set (Settings → CRM Sync)")
            return false
        }

        val file = File(recording.filePath)
        if (!file.exists() || file.length() == 0L) {
            AppLogger.w(context, TAG, "CRM sync skipped — file missing: ${recording.filePath}")
            return false
        }

        val durationSecs = recording.duration / 1000L
        val callDateIso  = Instant.ofEpochMilli(recording.createdAt).toString()

        AppLogger.i(
            context, TAG,
            "Syncing to CRM: ${recording.phoneNumber} " +
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
                    AppLogger.i(context, TAG, "CRM sync ✅ HTTP ${response.code}: $responseBody")
                    true
                } else {
                    AppLogger.e(context, TAG, "CRM sync failed HTTP ${response.code}: $responseBody")
                    false
                }
            }
        } catch (e: Exception) {
            // Network error, timeout, etc. — non-fatal, just log
            AppLogger.e(context, TAG, "CRM sync error: ${e.javaClass.simpleName}: ${e.message}")
            false
        }
    }
}
