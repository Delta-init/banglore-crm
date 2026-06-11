package com.callrecorder.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "crm_logs")
data class CrmLogEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val timestamp: Long = System.currentTimeMillis(),
    val phoneNumber: String,
    val callType: String,       // "incoming" | "outgoing" | "missed"
    val durationSecs: Long,     // 0 for missed/failed
    val synced: Boolean,        // true = HTTP 2xx and call_log_id returned
    val callLogId: String?,     // "6a2a96e1..." — from CRM response data.call_log_id
    val errorMessage: String?,  // HTTP error or exception on failure; null on success
)
