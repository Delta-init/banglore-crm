package com.callrecorder.utils

import android.content.Context
import android.media.MediaMetadataRetriever
import android.os.Environment
import java.io.File
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

object StorageHelper {

    private const val RECORDING_DIR = "CallRecorder"
    private val dateFormat = SimpleDateFormat("yyyyMMdd_HHmmss", Locale.US)

    /**
     * Returns an absolute file path for a new recording.
     *
     * Storage strategy (in priority order):
     * 1. App-specific external directory — visible to user in Files app, no WRITE permission needed
     * 2. Internal files directory — always available, private to app
     *
     * We avoid the public Music directory because it requires WRITE_EXTERNAL_STORAGE
     * on Android 9 and below and MediaStore APIs on Android 10+ (adds complexity).
     */
    fun createRecordingFilePath(context: Context, phoneNumber: String): String {
        val safeNumber = phoneNumber.replace(Regex("[^\\d+]"), "").take(20)
        val timestamp  = dateFormat.format(Date())
        val fileName   = "REC_${timestamp}_${safeNumber}.m4a"

        // Option 1: App-specific external storage (no permissions needed on any API)
        val externalBase = context.getExternalFilesDir(Environment.DIRECTORY_MUSIC)
        if (externalBase != null) {
            val dir = File(externalBase, RECORDING_DIR)
            if (dir.mkdirs() || dir.exists()) {
                return File(dir, fileName).absolutePath
            }
        }

        // Option 2: Internal storage fallback (always works, private to app)
        val internalDir = File(context.filesDir, RECORDING_DIR)
        internalDir.mkdirs()
        return File(internalDir, fileName).absolutePath
    }

    /**
     * Returns the audio duration in milliseconds using MediaMetadataRetriever.
     * Returns 0 on error or if the file doesn't exist.
     */
    fun getFileDuration(filePath: String): Long {
        return try {
            val file = File(filePath)
            if (!file.exists() || file.length() == 0L) return 0L

            MediaMetadataRetriever().use { retriever ->
                retriever.setDataSource(filePath)
                retriever.extractMetadata(MediaMetadataRetriever.METADATA_KEY_DURATION)
                    ?.toLongOrNull() ?: 0L
            }
        } catch (e: Exception) {
            0L
        }
    }

    /** Returns the file size in bytes, or 0 if file doesn't exist. */
    fun getFileSize(filePath: String): Long = File(filePath).length()

    /** Deletes the audio file. Returns true if deleted or already gone. */
    fun deleteFile(filePath: String): Boolean {
        val file = File(filePath)
        return if (file.exists()) file.delete() else true
    }

    /** Formats milliseconds into mm:ss. */
    fun formatDuration(millis: Long): String {
        if (millis <= 0) return "0:00"
        val totalSeconds = millis / 1000
        val minutes = totalSeconds / 60
        val seconds = totalSeconds % 60
        return "%d:%02d".format(minutes, seconds)
    }

    /** Formats bytes into human-readable size (KB / MB). */
    fun formatFileSize(bytes: Long): String {
        return when {
            bytes >= 1_048_576 -> "%.1f MB".format(bytes / 1_048_576.0)
            bytes >= 1024      -> "%d KB".format(bytes / 1024)
            else               -> "$bytes B"
        }
    }
}
