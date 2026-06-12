package com.callrecorder.ui.calls

/**
 * CRM sync status for a call log entry.
 *
 * NOT_RECORDED — this call was not recorded by the app (missed/short/recording off).
 *                No sync badge shown.
 * SYNCED       — recording saved locally AND successfully POSTed to CRM.
 * NOT_SYNCED   — recording saved locally but CRM POST failed (no URL, no network, etc.)
 */
enum class CrmSyncStatus { NOT_RECORDED, SYNCED, NOT_SYNCED }

/**
 * A single entry from the system call log (CallLog.Calls content provider).
 * Not persisted in Room — always read live from the OS.
 * [crmSyncStatus] is enriched from our Room DB after load.
 */
data class CallLogEntry(
    val id: Long,
    val number: String,
    val contactName: String?,               // null if not in contacts
    val callType: Int,                      // CallLog.Calls.TYPE: 1=incoming, 2=outgoing, 3=missed, 5=rejected
    val date: Long,                         // epoch millis
    val duration: Long,                     // seconds
    val crmSyncStatus: CrmSyncStatus = CrmSyncStatus.NOT_RECORDED,
    val syncError: String? = null,          // HTTP response or exception when NOT_SYNCED
    val crmCallLogId: String? = null,       // CRM backend's call_log_id — shown under ✓ CRM Synced badge
    val recordingId: Int? = null,           // Room RecordingEntity.id — needed for manual resync
)
