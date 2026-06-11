package com.callrecorder.ui.crmlogs

import android.content.res.ColorStateList
import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.core.content.ContextCompat
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.callrecorder.R
import com.callrecorder.data.db.CrmLogEntity
import com.callrecorder.databinding.ItemCrmLogBinding
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.concurrent.TimeUnit

class CrmLogAdapter : ListAdapter<CrmLogEntity, CrmLogAdapter.VH>(DIFF) {

    inner class VH(private val b: ItemCrmLogBinding) : RecyclerView.ViewHolder(b.root) {

        fun bind(entry: CrmLogEntity) {
            val ctx = b.root.context

            // ── Status icon ───────────────────────────────────────────────────
            b.tvStatus.text = if (entry.synced) "✅" else "⚠️"

            // ── Phone number ──────────────────────────────────────────────────
            b.tvPhone.text = entry.phoneNumber.ifBlank { "Unknown number" }

            // ── Call type badge ───────────────────────────────────────────────
            val (badgeText, badgeBg, badgeFg) = when (entry.callType.lowercase()) {
                "incoming", "inbound"  -> Triple("↙ Inbound",  R.color.badge_inbound_bg,   R.color.badge_inbound_text)
                "outgoing", "outbound" -> Triple("↗ Outbound", R.color.badge_outbound_bg,  R.color.badge_outbound_text)
                "missed"               -> Triple("✗ Missed",   R.color.badge_missed_bg,    R.color.badge_missed_text)
                else                   -> Triple("• ${entry.callType}", R.color.badge_missed_bg, R.color.badge_missed_text)
            }
            b.tvCallType.text = badgeText
            b.tvCallType.setTextColor(ContextCompat.getColor(ctx, badgeFg))
            b.tvCallType.backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(ctx, badgeBg))

            // ── CRM ID or error ───────────────────────────────────────────────
            b.tvCallLogId.text = when {
                entry.synced && entry.callLogId != null -> "ID: ${entry.callLogId}"
                entry.synced                            -> "Synced"
                !entry.errorMessage.isNullOrBlank()     -> entry.errorMessage
                else                                    -> "Sync failed"
            }

            // ── Duration ──────────────────────────────────────────────────────
            b.tvDuration.text = if (entry.durationSecs > 0) formatDuration(entry.durationSecs) else "0s"

            // ── Timestamp ─────────────────────────────────────────────────────
            b.tvTimestamp.text = formatTime(entry.timestamp)
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val b = ItemCrmLogBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return VH(b)
    }

    override fun onBindViewHolder(holder: VH, position: Int) = holder.bind(getItem(position))

    private fun formatDuration(secs: Long): String {
        val m = TimeUnit.SECONDS.toMinutes(secs)
        val s = secs % 60
        return if (m > 0) "${m}m ${s}s" else "${s}s"
    }

    private fun formatTime(epochMs: Long): String {
        val fmt = SimpleDateFormat("dd MMM, hh:mm:ss a", Locale.getDefault())
        return fmt.format(Date(epochMs))
    }

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<CrmLogEntity>() {
            override fun areItemsTheSame(a: CrmLogEntity, b: CrmLogEntity) = a.id == b.id
            override fun areContentsTheSame(a: CrmLogEntity, b: CrmLogEntity) = a == b
        }
    }
}
