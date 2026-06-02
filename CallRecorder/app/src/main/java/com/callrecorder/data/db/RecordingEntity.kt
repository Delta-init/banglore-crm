package com.callrecorder.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

@Entity(tableName = "recordings")
data class RecordingEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val phoneNumber: String,
    val contactName: String?,          // resolved from Contacts, nullable
    val filePath: String,              // absolute path to .m4a file
    val duration: Long,                // milliseconds (filled after call ends)
    val fileSize: Long,                // bytes
    val callType: String,              // "incoming" | "outgoing" | "unknown"
    val createdAt: Long = System.currentTimeMillis()
)
