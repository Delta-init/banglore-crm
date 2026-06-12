package com.callrecorder.ui.calls

import android.app.Application
import android.provider.CallLog
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.callrecorder.data.db.AppDatabase
import com.callrecorder.data.db.RecordingEntity
import com.callrecorder.service.CrmSyncService
import com.callrecorder.utils.AppLogger
import com.callrecorder.utils.ContactHelper
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.MutableSharedFlow
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.SharedFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.time.Instant
import kotlin.math.abs

class RecentCallsViewModel(app: Application) : AndroidViewModel(app) {

    private val db = AppDatabase.getInstance(app)

    private val _calls = MutableStateFlow<List<CallLogEntry>>(emptyList())
    val calls: StateFlow<List<CallLogEntry>> = _calls

    private val _loading = MutableStateFlow(false)
    val loading: StateFlow<Boolean> = _loading

    // Emits successCount after resyncAll() finishes
    private val _syncAllResult = MutableSharedFlow<Int>(extraBufferCapacity = 1)
    val syncAllResult: SharedFlow<Int> = _syncAllResult

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
     * For each system call log entry, find a matching RecordingEntity in our DB.
     *
     * Match logic (v1.18):
     *  1. Exact match by Android system call log _ID (recordings saved since v1.18)
     *  2. Fallback: closest-timestamp within MATCH_WINDOW_MS for pre-v1.18 rows
     *     where systemCallLogId is null.  Numbers normalised to last 10 digits.
     */
    private fun enrichWithCrmStatus(
        calls: List<CallLogEntry>,
        recordings: List<RecordingEntity>
    ): List<CallLogEntry> {
        if (recordings.isEmpty()) return calls

        // Build O(1) lookup for recordings that carry a system call log ID
        val bySystemId = recordings
            .filter { it.systemCallLogId != null }
            .associateBy { it.systemCallLogId!! }

        return calls.map { call ->
            val match = bySystemId[call.id]
                ?: recordings
                    .filter { rec ->
                        rec.systemCallLogId == null &&
                        phoneLast10(call.number) == phoneLast10(rec.phoneNumber) &&
                        abs(call.date - rec.createdAt) < MATCH_WINDOW_MS
                    }
                    .minByOrNull { abs(call.date - it.createdAt) }

            when {
                match == null   -> call
                match.crmSynced -> call.copy(
                    crmSyncStatus = CrmSyncStatus.SYNCED,
                    syncError     = match.syncError,
                    crmCallLogId  = match.crmCallLogId,
                    recordingId   = match.id,
                )
                else            -> call.copy(
                    crmSyncStatus = CrmSyncStatus.NOT_SYNCED,
                    syncError     = match.syncError,
                    crmCallLogId  = null,
                    recordingId   = match.id,
                )
            }
        }
    }

    /**
     * Manually sync a single call to CRM.
     *
     * Two paths:
     *  • recordingId != null — existing RecordingEntity in Room; update it in-place.
     *  • recordingId == null — call was NOT_RECORDED (no entity yet); create one now
     *    from the CallLogEntry data, then sync.
     */
    fun resync(entry: CallLogEntry) {
        viewModelScope.launch(Dispatchers.IO) {
            val ctx = getApplication<Application>()
            val params = buildSyncParams(ctx, entry) ?: return@launch
            val (synced, crmCallLogId, errMsg) = CrmSyncService.logCallEvent(
                context         = ctx,
                phoneNumber     = params.phone,
                callType        = params.type,
                durationSecs    = params.durSecs,
                callDateIso     = params.dateIso,
                systemCallLogId = params.sysCallLogId,
            )
            db.recordingDao().updateSyncResult(
                id              = params.entityId,
                synced          = synced,
                error           = if (synced) null else errMsg,
                crmCallLogId    = crmCallLogId,
                systemCallLogId = params.sysCallLogId,
            )
            AppLogger.i(ctx, TAG, "Resync #${params.entityId} → synced=$synced err=$errMsg")
            withContext(Dispatchers.Main) { loadCallLog() }
        }
    }

    /** Resync all unsynced calls (both NOT_SYNCED and NOT_RECORDED) in one batch. */
    fun resyncAll() {
        val toSync = _calls.value.filter { it.crmSyncStatus != CrmSyncStatus.SYNCED }
        if (toSync.isEmpty()) {
            _syncAllResult.tryEmit(0)
            return
        }
        viewModelScope.launch(Dispatchers.IO) {
            val ctx = getApplication<Application>()
            var successCount = 0
            for (entry in toSync) {
                val params = buildSyncParams(ctx, entry) ?: continue
                val (synced, crmCallLogId, errMsg) = CrmSyncService.logCallEvent(
                    context         = ctx,
                    phoneNumber     = params.phone,
                    callType        = params.type,
                    durationSecs    = params.durSecs,
                    callDateIso     = params.dateIso,
                    systemCallLogId = params.sysCallLogId,
                )
                db.recordingDao().updateSyncResult(
                    id              = params.entityId,
                    synced          = synced,
                    error           = if (synced) null else errMsg,
                    crmCallLogId    = crmCallLogId,
                    systemCallLogId = params.sysCallLogId,
                )
                if (synced) successCount++
            }
            withContext(Dispatchers.Main) {
                loadCallLog()
                _syncAllResult.tryEmit(successCount)
            }
        }
    }

    /** Builds the parameters needed for a CRM sync call from a [CallLogEntry]. */
    private suspend fun buildSyncParams(ctx: Application, entry: CallLogEntry): SyncParams? {
        return if (entry.recordingId != null) {
            // Path A — existing entity
            val rec = db.recordingDao().getById(entry.recordingId) ?: return null
            SyncParams(
                phone        = rec.phoneNumber,
                type         = rec.callType,
                durSecs      = rec.duration / 1_000L,
                dateIso      = Instant.ofEpochMilli(rec.createdAt).toString(),
                sysCallLogId = rec.systemCallLogId,
                entityId     = rec.id,
            )
        } else {
            // Path B — NOT_RECORDED: create entity first, then sync
            val type = when (entry.callType) {
                CallLog.Calls.INCOMING_TYPE -> "incoming"
                CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                CallLog.Calls.MISSED_TYPE   -> "missed"
                else                        -> "unknown"
            }
            val contactName = ContactHelper.getContactName(ctx, entry.number)
            val newId = db.recordingDao().insert(
                RecordingEntity(
                    phoneNumber = entry.number,
                    contactName = contactName,
                    filePath    = "",
                    duration    = entry.duration * 1_000L,
                    fileSize    = 0L,
                    callType    = type,
                    crmSynced   = false,
                    createdAt   = entry.date,
                )
            ).toInt()
            SyncParams(
                phone        = entry.number,
                type         = type,
                durSecs      = entry.duration,
                dateIso      = Instant.ofEpochMilli(entry.date).toString(),
                sysCallLogId = null,
                entityId     = newId,
            )
        }
    }

    private data class SyncParams(
        val phone: String,
        val type: String,
        val durSecs: Long,
        val dateIso: String,
        val sysCallLogId: Long?,
        val entityId: Int,
    )

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
        private const val MATCH_WINDOW_MS = 60_000L   // ±60 s — call start times are within seconds of each other
    }
}
