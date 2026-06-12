package com.callrecorder.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "recordings")
data class RecordingEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val phoneNumber: String,
    val contactName: String?,           // resolved from Contacts, nullable
    val filePath: String,               // absolute path to .m4a file
    val duration: Long,                 // milliseconds (filled after call ends)
    val fileSize: Long,                 // bytes
    val callType: String,               // "incoming" | "outgoing" | "unknown"
    val crmSynced: Boolean = false,     // true = successfully POSTed to CRM backend
    val syncError: String? = null,      // "HTTP 403: ..." when crmSynced=false; null on success
    val createdAt: Long = System.currentTimeMillis(),
    // ── ID-based matching fields (added v1.18) ────────────────────────────────
    val systemCallLogId: Long? = null,  // Android CallLog.Calls._ID — unique per call
    val crmCallLogId: String? = null,   // CRM backend's call_log_id returned on successful sync
)
