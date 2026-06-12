package com.callrecorder.ui.crmlogs

import android.content.res.ColorStateList
import android.view.LayoutInflater
import android.view.View
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

class CrmLogAdapter(
    private val onRetry: (CrmLogEntity) -> Unit,
) : ListAdapter<CrmLogEntity, CrmLogAdapter.VH>(DIFF) {

    inner class VH(private val b: ItemCrmLogBinding) : RecyclerView.ViewHolder(b.root) {

        fun bind(entry: CrmLogEntity) {
            val ctx = b.root.context

            // ── Phone number ──────────────────────────────────────────────────
            b.tvPhone.text = entry.phoneNumber.ifBlank { "Unknown number" }

            // ── Call type badge ───────────────────────────────────────────────
            val (badgeText, badgeBg, badgeFg) = when (entry.callType.lowercase()) {
                "incoming", "inbound"  -> Triple("↙ Inbound",  R.color.badge_inbound_bg,  R.color.badge_inbound_text)
                "outgoing", "outbound" -> Triple("↗ Outbound", R.color.badge_outbound_bg, R.color.badge_outbound_text)
                "missed"               -> Triple("✗ Missed",   R.color.badge_missed_bg,   R.color.badge_missed_text)
                else                   -> Triple("• ${entry.callType}", R.color.badge_missed_bg, R.color.badge_missed_text)
            }
            b.tvCallType.text = badgeText
            b.tvCallType.setTextColor(ContextCompat.getColor(ctx, badgeFg))
            b.tvCallType.backgroundTintList = ColorStateList.valueOf(ContextCompat.getColor(ctx, badgeBg))

            // ── Duration + timestamp ──────────────────────────────────────────
            b.tvDuration.text  = if (entry.durationSecs > 0) formatDuration(entry.durationSecs) else "0s"
            b.tvTimestamp.text = formatTime(entry.timestamp)

            // ── Status: synced / retrying / failed ────────────────────────────
            val isRetrying = entry.errorMessage == "⏳ Retrying…"

            when {
                isRetrying -> {
                    b.tvStatus.text = "⏳"
                    b.tvCallLogId.text = "⏳ Retrying…"
                    b.tvCallLogId.setTextColor(0xFF888888.toInt())
                    b.btnRetry.visibility = View.VISIBLE
                    b.btnRetry.isEnabled  = false
                    b.btnRetry.alpha      = 0.4f
                }
                entry.synced -> {
                    b.tvStatus.text = "✅"
                    b.tvCallLogId.text = if (!entry.callLogId.isNullOrBlank())
                        "ID: ${entry.callLogId}" else "Synced"
                    b.tvCallLogId.setTextColor(
                        ContextCompat.getColor(ctx, R.color.badge_synced_text)
                    )
                    b.btnRetry.visibility = View.GONE
                }
                else -> {
                    b.tvStatus.text = "⚠️"
                    b.tvCallLogId.text = formatError(entry.errorMessage)
                    b.tvCallLogId.setTextColor(
                        ContextCompat.getColor(ctx, R.color.badge_missed_text)
                    )
                    b.btnRetry.visibility = View.VISIBLE
                    b.btnRetry.isEnabled  = true
                    b.btnRetry.alpha      = 1f
                    b.btnRetry.setOnClickListener { onRetry(entry) }
                }
            }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): VH {
        val b = ItemCrmLogBinding.inflate(LayoutInflater.from(parent.context), parent, false)
        return VH(b)
    }

    override fun onBindViewHolder(holder: VH, position: Int) = holder.bind(getItem(position))

    // ── Error formatting ──────────────────────────────────────────────────────

    /**
     * Converts a raw error string from CrmSyncService into a short readable label.
     *
     * Examples:
     *   "HTTP 401: {"message":"Invalid API key"}"  →  "HTTP 401 — Invalid API key"
     *   "SocketTimeoutException: timeout"          →  "Network timeout"
     */
    private fun formatError(raw: String?): String {
        if (raw.isNullOrBlank()) return "Sync failed"
        if (raw == "⏳ Retrying…") return raw
        if (raw.startsWith("HTTP")) {
            val code = raw.substringAfter("HTTP ").substringBefore(":").trim()
            val body = raw.substringAfter(":", "").trim()
            val message = try {
                org.json.JSONObject(body).optString("message").ifBlank { null }
                    ?: org.json.JSONObject(body).optString("error").ifBlank { null }
                    ?: body.take(60)
            } catch (_: Exception) { body.take(60) }
            return "HTTP $code — $message"
        }
        return when {
            raw.contains("SocketTimeout", ignoreCase = true)    -> "Network timeout"
            raw.contains("UnknownHost", ignoreCase = true)      -> "No internet / DNS error"
            raw.contains("ConnectException", ignoreCase = true) -> "Cannot reach server"
            else -> raw.take(80)
        }
    }

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
