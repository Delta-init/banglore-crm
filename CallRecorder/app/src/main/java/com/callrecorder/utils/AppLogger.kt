package com.callrecorder.utils

import android.content.Context
import android.util.Log
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

/**
 * Simple file-based logger — writes all recording events to a rotating log file
 * so users can see exactly what the app is doing on their device.
 *
 * File: <filesDir>/callrecorder_log.txt
 * Max size: 200 lines (older lines are trimmed)
 */
object AppLogger {

    private const val TAG       = "AppLogger"
    private const val LOG_FILE  = "callrecorder_log.txt"
    private const val MAX_LINES = 200

    private val timeFmt = SimpleDateFormat("MM-dd HH:mm:ss", Locale.getDefault())

    fun i(context: Context, tag: String, message: String) = write(context, "I", tag, message)
    fun w(context: Context, tag: String, message: String) = write(context, "W", tag, message)
    fun e(context: Context, tag: String, message: String) = write(context, "E", tag, message)

    private fun write(context: Context, level: String, tag: String, message: String) {
        val line = "${timeFmt.format(Date())} $level/$tag: $message"
        Log.println(
            when (level) { "W" -> Log.WARN; "E" -> Log.ERROR; else -> Log.INFO },
            tag, message
        )
        try {
            val file = logFile(context)
            val existing = if (file.exists()) file.readLines() else emptyList()
            val trimmed  = if (existing.size >= MAX_LINES)
                existing.drop(existing.size - MAX_LINES + 1) else existing
            file.writeText((trimmed + line).joinToString("\n"))
        } catch (ex: Exception) {
            Log.e(TAG, "Log write failed: ${ex.message}")
        }
    }

    /** Returns all log lines newest-first for display. */
    fun getLines(context: Context): List<String> = try {
        logFile(context).readLines().reversed()
    } catch (e: Exception) { emptyList() }

    fun clear(context: Context) = try { logFile(context).delete() } catch (_: Exception) {}

    private fun logFile(context: Context): File =
        File(context.filesDir, LOG_FILE)
}
