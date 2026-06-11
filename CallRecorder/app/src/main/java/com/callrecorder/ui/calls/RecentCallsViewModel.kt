package com.callrecorder.ui.calls

import android.app.Application
import android.provider.CallLog
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.callrecorder.data.db.AppDatabase
import com.callrecorder.data.db.RecordingEntity
import com.callrecorder.utils.AppLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import kotlin.math.abs

class RecentCallsViewModel(app: Application) : AndroidViewModel(app) {

    private val db = AppDatabase.getInstance(app)

    private val _calls = MutableStateFlow<List<CallLogEntry>>(emptyList())
    val calls: StateFlow<List<CallLogEntry>> = _calls

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading

    fun loadCallLog() {
        viewModelScope.launch {
            _loading.value = true
            val systemCalls = fetchCallLog()
            val recordings  = withContext(Dispatchers.IO) { db.recordingDao().getAllRecordingsSnapshot() }
            _calls.value   = enrichWithCrmStatus(systemCalls, recordings)
            _loading.value  = false
        }
    }

    /**
     * For each system call log entry, find a matching RecordingEntity in our DB
     * (same phone number, within 90 seconds). Attach the CRM sync status.
     *
     * Match logic:
     *  • Normalize both numbers to last 10 digits (handles +91 prefix differences)
     *  • Call log date vs recording createdAt within MATCH_WINDOW_MS
     */
    private fun enrichWithCrmStatus(
        calls: List<CallLogEntry>,
        recordings: List<RecordingEntity>
    ): List<CallLogEntry> {
        if (recordings.isEmpty()) return calls
        return calls.map { call ->
            val match = recordings.firstOrNull { rec ->
                phoneLast10(call.number) == phoneLast10(rec.phoneNumber) &&
                abs(call.date - rec.createdAt) < MATCH_WINDOW_MS
            }
            when {
                match == null   -> call
                match.crmSynced -> call.copy(crmSyncStatus = CrmSyncStatus.SYNCED, syncError = null)
                else            -> call.copy(crmSyncStatus = CrmSyncStatus.NOT_SYNCED, syncError = match.syncError)
            }
        }
    }

    /** Strip all non-digits and take the last 10 characters. */
    private fun phoneLast10(number: String): String =
        number.replace(Regex("[^0-9]"), "").takeLast(10)

    private suspend fun fetchCallLog(): List<CallLogEntry> = withContext(Dispatchers.IO) {
        val list = mutableListOf<CallLogEntry>()
        val ctx = getApplication<Application>()

        val projection = arrayOf(
            CallLog.Calls._ID,
            CallLog.Calls.NUMBER,
            CallLog.Calls.CACHED_NAME,
            CallLog.Calls.TYPE,
            CallLog.Calls.DATE,
            CallLog.Calls.DURATION
        )

        try {
            ctx.contentResolver.query(
                CallLog.Calls.CONTENT_URI,
                projection,
                null, null,
                "${CallLog.Calls.DATE} DESC"   // newest first
            )?.use { cursor ->
                val idCol   = cursor.getColumnIndexOrThrow(CallLog.Calls._ID)
                val numCol  = cursor.getColumnIndexOrThrow(CallLog.Calls.NUMBER)
                val nameCol = cursor.getColumnIndexOrThrow(CallLog.Calls.CACHED_NAME)
                val typeCol = cursor.getColumnIndexOrThrow(CallLog.Calls.TYPE)
                val dateCol = cursor.getColumnIndexOrThrow(CallLog.Calls.DATE)
                val durCol  = cursor.getColumnIndexOrThrow(CallLog.Calls.DURATION)

                while (cursor.moveToNext()) {
                    list += CallLogEntry(
                        id          = cursor.getLong(idCol),
                        number      = cursor.getString(numCol) ?: "",
                        contactName = cursor.getString(nameCol)?.takeIf { it.isNotBlank() },
                        callType    = cursor.getInt(typeCol),
                        date        = cursor.getLong(dateCol),
                        duration    = cursor.getLong(durCol)
                    )
                    if (list.size >= MAX_ENTRIES) break
                }
            }
        } catch (e: SecurityException) {
            AppLogger.e(ctx, TAG, "READ_CALL_LOG denied: ${e.message}")
        } catch (e: Exception) {
            AppLogger.e(ctx, TAG, "fetchCallLog error: ${e.message}")
        }

        list
    }

    companion object {
        private const val TAG = "RecentCallsViewModel"
        private const val MAX_ENTRIES = 500
        private const val MATCH_WINDOW_MS = 90_000L   // ±90 s tolerance for call start vs createdAt
    }
}
