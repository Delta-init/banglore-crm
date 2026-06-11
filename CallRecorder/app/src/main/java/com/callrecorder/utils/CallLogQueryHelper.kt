package com.callrecorder.utils

import android.content.Context
import android.provider.CallLog

/**
 * Queries the system call log to recover a phone number and duration
 * when they are unavailable from broadcast intents (Android 10+).
 *
 * Requires READ_CALL_LOG permission (already declared in manifest).
 */
object CallLogQueryHelper {

    data class SysCallEntry(
        val number: String,   // raw number from system log
        val durationSec: Long, // call duration in SECONDS (0 for missed)
        val type: Int,        // CallLog.Calls.*_TYPE
        val date: Long        // epoch ms
    )

    /**
     * Returns the most recent call log entry within [withinMs] milliseconds.
     * Returns null if nothing found or permission denied.
     */
    fun getLastCall(context: Context, withinMs: Long = 60_000L): SysCallEntry? {
        val minDate = System.currentTimeMillis() - withinMs
        return try {
            context.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                arrayOf(
                    CallLog.Calls.NUMBER,
                    CallLog.Calls.DURATION,
                    CallLog.Calls.TYPE,
                    CallLog.Calls.DATE
                ),
                "${CallLog.Calls.DATE} > ?",
                arrayOf(minDate.toString()),
                "${CallLog.Calls.DATE} DESC"
            )?.use { cursor ->
                if (cursor.moveToFirst()) {
                    SysCallEntry(
                        number      = cursor.getString(0) ?: "",
                        durationSec = cursor.getLong(1),
                        type        = cursor.getInt(2),
                        date        = cursor.getLong(3)
                    )
                } else null
            }
        } catch (e: SecurityException) {
            null  // READ_CALL_LOG denied
        } catch (e: Exception) {
            null
        }
    }
}
