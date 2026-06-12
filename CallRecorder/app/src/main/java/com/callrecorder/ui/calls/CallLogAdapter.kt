package com.callrecorder.ui.calls

import android.app.AlertDialog
import android.content.res.ColorStateList
import android.provider.CallLog
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.callrecorder.R
import com.callrecorder.databinding.ItemCallLogBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

class CallLogAdapter(
    private val onCall: (CallLogEntry) -> Unit,
    private val onResync: ((CallLogEntry) -> Unit)? = null,
) : ListAdapter<CallLogEntry, CallLogAdapter.VH>(DIFF) {

    inner class VH(private val b: ItemCallLogBinding) : RecyclerView.ViewHolder(b.root) {

        fun bind(entry: CallLogEntry) {
            val ctx = b.root.context

            // ── Display name / number ─────────────────────────────────────────
            b.tvName.text   = entry.contactName ?: entry.number.ifBlank { "Unknown" }
            b.tvNumber.text = if (entry.contactName != null) entry.number else ""

            // ── Call type icon (in the circle) ────────────────────────────────
            b.tvCallType.text = when (entry.callType) {
                CallLog.Calls.INCOMING_TYPE  -> "↙"
                CallLog.Calls.OUTGOING_TYPE  -> "↗"
                CallLog.Calls.MISSED_TYPE    -> "✗"
                CallLog.Calls.REJECTED_TYPE  -> "⊘"
                else                         -> "•"
            }

            // ── Date + Duration ───────────────────────────────────────────────
            b.tvDate.text     = formatDate(entry.date)
            b.tvDuration.text = if (entry.duration > 0) formatDuration(entry.duration) else ""

            // ── Direction badge (always visible) ──────────────────────────────
            val (dirBg, dirText, dirTextColor) = when (entry.callType) {
                CallLog.Calls.INCOMING_TYPE -> Triple(
                    R.color.badge_inbound_bg, "↙ Inbound",  R.color.badge_inbound_text)
                CallLog.Calls.OUTGOING_TYPE -> Triple(
                    R.color.badge_outbound_bg, "↗ Outbound", R.color.badge_outbound_text)
                CallLog.Calls.MISSED_TYPE   -> Triple(
                    R.color.badge_missed_bg,  "✗ Missed",   R.color.badge_missed_text)
                CallLog.Calls.REJECTED_TYPE -> Triple(
                    R.color.badge_missed_bg,  "⊘ Rejected", R.color.badge_missed_text)
                else -> Triple(
                    R.color.badge_missed_bg,  "• Unknown",  R.color.badge_missed_text)
            }
            b.tvDirection.text             = dirText
            b.tvDirection.setTextColor(ContextCompat.getColor(ctx, dirTextColor))
            b.tvDirection.backgroundTintList =
                ColorStateList.valueOf(ContextCompat.getColor(ctx, dirBg))

            // ── CRM sync badge + error detail ─────────────────────────────────
            when (entry.crmSyncStatus) {
                CrmSyncStatus.SYNCED -> {
                    b.tvCrmSync.visibility  = View.VISIBLE
                    b.tvCrmSync.text        = "✓ CRM Synced"
                    b.tvCrmSync.isClickable = false
                    b.tvCrmSync.setOnClickListener(null)
                    b.tvCrmSync.setTextColor(ContextCompat.getColor(ctx, R.color.badge_synced_text))
                    b.tvCrmSync.backgroundTintList =
                        ColorStateList.valueOf(ContextCompat.getColor(ctx, R.color.badge_synced_bg))
                    // Show CRM call log ID so the user can verify the exact CRM record
                    if (!entry.crmCallLogId.isNullOrBlank()) {
                        b.tvSyncError.visibility = View.VISIBLE
                        b.tvSyncError.setTextColor(0xFF888888.toInt())
                        b.tvSyncError.text = "ID: ${entry.crmCallLogId}"
                    } else {
                        b.tvSyncError.visibility = View.GONE
                    }
                }
                CrmSyncStatus.NOT_SYNCED -> {
                    b.tvCrmSync.visibility = View.VISIBLE
                    b.tvCrmSync.text       = "⚠ Not Synced — Tap to retry"
                    b.tvCrmSync.setTextColor(ContextCompat.getColor(ctx, R.color.badge_not_synced_text))
                    b.tvCrmSync.backgroundTintList =
                        ColorStateList.valueOf(ContextCompat.getColor(ctx, R.color.badge_not_synced_bg))
                    b.tvCrmSync.isClickable  = true
                    b.tvCrmSync.isFocusable  = true
                    b.tvCrmSync.setOnClickListener {
                        val errDetail = entry.syncError?.takeIf { it.isNotBlank() } ?: "Unknown error"
                        AlertDialog.Builder(ctx)
                            .setTitle("⚠ Sync Failed")
                            .setMessage("Error: $errDetail\n\nRetry syncing this call to the CRM?")
                            .setPositiveButton("Retry Sync") { _, _ -> onResync?.invoke(entry) }
                            .setNegativeButton("Cancel", null)
                            .show()
                    }
                    // Show the actual API error inline so the user sees it without tapping
                    if (!entry.syncError.isNullOrBlank()) {
                        b.tvSyncError.visibility = View.VISIBLE
                        b.tvSyncError.text       = entry.syncError
                    } else {
                        b.tvSyncError.visibility = View.GONE
                    }
                }
                CrmSyncStatus.NOT_RECORDED -> {
                    // Show a "Sync to CRM" button so the user can manually trigger a sync
                    // for calls the automatic system missed.
                    b.tvCrmSync.visibility  = View.VISIBLE
                    b.tvCrmSync.text        = "↑ Sync to CRM"
                    b.tvCrmSync.isClickable = true
                    b.tvCrmSync.isFocusable = true
                    b.tvCrmSync.setTextColor(ContextCompat.getColor(ctx, R.color.badge_not_synced_text))
                    b.tvCrmSync.backgroundTintList =
                        ColorStateList.valueOf(ContextCompat.getColor(ctx, R.color.badge_not_synced_bg))
                    b.tvCrmSync.setOnClickListener {
                        AlertDialog.Builder(ctx)
                            .setTitle("Sync call to CRM")
                            .setMessage("This call hasn't been synced yet. Sync it now?")
                            .setPositiveButton("Sync Now") { _, _ -> onResync?.invoke(entry) }
                            .setNegativeButton("Cancel", null)
                            .show()
                    }
                    b.tvSyncError.visibility = View.GONE
                }
            }

            // ── Call back button ──────────────────────────────────────────────
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
