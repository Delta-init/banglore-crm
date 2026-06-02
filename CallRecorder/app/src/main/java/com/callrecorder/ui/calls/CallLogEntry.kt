package com.callrecorder.ui.calls

/**
 * A single entry from the system call log (CallLog.Calls content provider).
 * Not persisted in Room — always read live from the OS.
 */
data class CallLogEntry(
    val id: Long,
    val number: String,
    val contactName: String?,   // null if not in contacts
    val callType: Int,          // CallLog.Calls.TYPE: 1=incoming, 2=outgoing, 3=missed, 5=rejected
    val date: Long,             // epoch millis
    val duration: Long          // seconds
)
