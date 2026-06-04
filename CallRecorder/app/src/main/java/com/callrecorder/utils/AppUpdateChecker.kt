package com.callrecorder.utils

import android.content.Context
import android.os.Build
import com.callrecorder.BuildConfig
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.withContext
import okhttp3.OkHttpClient
import okhttp3.Request
import org.json.JSONObject
import java.util.concurrent.TimeUnit

/**
 * ════════════════════════════════════════════════════════════════════
 *  AppUpdateChecker — checks if a newer APK is available on the CRM
 * ════════════════════════════════════════════════════════════════════
 *
 *  Calls GET <CRM_BASE_URL>/api/v1/app/version (x-api-key auth).
 *  Compares server versionCode vs BuildConfig.VERSION_CODE.
 *  If server > local → returns UpdateInfo, else returns null.
 *
 *  Usage (from a coroutine scope):
 *    val update = AppUpdateChecker.check(context)
 *    if (update != null) UpdateDialogManager.show(activity, update)
 * ════════════════════════════════════════════════════════════════════
 */
object AppUpdateChecker {

    private const val TAG = "AppUpdateChecker"

    private val client = OkHttpClient.Builder()
        .connectTimeout(10, TimeUnit.SECONDS)
        .readTimeout(10, TimeUnit.SECONDS)
        .build()

    data class UpdateInfo(
        val versionCode:  Int,
        val versionName:  String,
        val downloadUrl:  String,
        val changelog:    String,
        val forceUpdate:  Boolean,
        val releaseDate:  String,
    )

    /**
     * Checks the CRM server for a newer version.
     *
     * @return UpdateInfo if an update is available, null otherwise.
     *         Silently returns null on network errors or if CRM is not configured.
     */
    suspend fun check(context: Context): UpdateInfo? = withContext(Dispatchers.IO) {
        val baseUrl = PrefsHelper.getCrmBaseUrl(context).trimEnd('/')
        val apiKey  = PrefsHelper.getCrmApiKey(context).trim()

        if (baseUrl.isBlank() || apiKey.isBlank()) {
            AppLogger.w(context, TAG, "Update check skipped — CRM not configured")
            return@withContext null
        }

        try {
            val request = Request.Builder()
                .url("$baseUrl/api/v1/app/version")
                .header("x-api-key", apiKey)
                .get()
                .build()

            val response = client.newCall(request).execute()
            if (!response.isSuccessful) {
                AppLogger.w(context, TAG, "Update check HTTP ${response.code}")
                return@withContext null
            }

            val body = response.body?.string() ?: return@withContext null
            val json = JSONObject(body)

            if (!json.optBoolean("success", false)) return@withContext null

            val data        = json.getJSONObject("data")
            val serverCode  = data.getInt("versionCode")
            val localCode   = BuildConfig.VERSION_CODE

            AppLogger.i(
                context, TAG,
                "Version check: local=$localCode server=$serverCode"
            )

            if (serverCode <= localCode) {
                AppLogger.i(context, TAG, "App is up to date ✅")
                return@withContext null
            }

            // Newer version available!
            UpdateInfo(
                versionCode = serverCode,
                versionName = data.optString("versionName", ""),
                downloadUrl = data.optString("downloadUrl", ""),
                changelog   = data.optString("changelog", ""),
                forceUpdate = data.optBoolean("forceUpdate", false),
                releaseDate = data.optString("releaseDate", ""),
            )

        } catch (e: Exception) {
            AppLogger.e(context, TAG, "Update check error: ${e.javaClass.simpleName}: ${e.message}")
            null
        }
    }
}
