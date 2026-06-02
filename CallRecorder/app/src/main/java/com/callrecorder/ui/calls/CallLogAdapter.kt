package com.callrecorder.ui.calls

import android.provider.CallLog
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.callrecorder.databinding.ItemCallLogBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

class CallLogAdapter(
    private val onCall: (CallLogEntry) -> Unit
) : ListAdapter<CallLogEntry, CallLogAdapter.VH>(DIFF) {

    inner class VH(private val b: ItemCallLogBinding) : RecyclerView.ViewHolder(b.root) {

        fun bind(entry: CallLogEntry) {
            // Display name
            b.tvName.text = entry.contactName ?: entry.number.ifBlank { "Unknown" }
            b.tvNumber.text = if (entry.contactName != null) entry.number else ""

            // Call type icon + label
            val (typeIcon, typeLabel) = when (entry.callType) {
                CallLog.Calls.INCOMING_TYPE  -> "↙" to "Incoming"
                CallLog.Calls.OUTGOING_TYPE  -> "↗" to "Outgoing"
                CallLog.Calls.MISSED_TYPE    -> "✗" to "Missed"
                CallLog.Calls.REJECTED_TYPE  -> "⊘" to "Rejected"
                else                         -> "•" to "Unknown"
            }
            b.tvCallType.text = "$typeIcon $typeLabel"

            // Date
            b.tvDate.text = formatDate(entry.date)

            // Duration
            b.tvDuration.text = if (entry.duration > 0) formatDuration(entry.duration) else ""

            // Call back button
            b.btnCallback.setOnClickListener { onCall(entry) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val b = ItemCallLogBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return VH(b)
    }

    override fun onBindViewHolder(holder: VH, position: Int) = holder.bind(getItem(position))

    private fun formatDate(epochMs: Long): String {
        val fmt = SimpleDateFormat("dd MMM, hh:mm a", Locale.getDefault())
        return fmt.format(Date(epochMs))
    }

    private fun formatDuration(seconds: Long): String {
        val m = TimeUnit.SECONDS.toMinutes(seconds)
        val s = seconds % 60
        return if (m > 0) "${m}m ${s}s" else "${s}s"
    }

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<CallLogEntry>() {
            override fun areItemsTheSame(a: CallLogEntry, b: CallLogEntry) = a.id == b.id
            override fun areContentsTheSame(a: CallLogEntry, b: CallLogEntry) = a == b
        }
    }
}
