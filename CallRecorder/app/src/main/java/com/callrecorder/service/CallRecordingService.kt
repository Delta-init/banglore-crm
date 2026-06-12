package com.callrecorder.service

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import com.callrecorder.App
import com.callrecorder.R
import com.callrecorder.data.db.RecordingEntity
import com.callrecorder.data.repository.RecordingRepository
import com.callrecorder.ui.MainActivity
import com.callrecorder.utils.AppLogger
import com.callrecorder.utils.ContactHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch

/**
 * ════════════════════════════════════════════════════════════════════
 *  CallRecordingService — Mock / Log-only mode
 * ════════════════════════════════════════════════════════════════════
 *
 *  Does NOT capture audio. Responsibilities:
 *    1. Post a foreground notification while the call is active so the
 *       process stays alive (required by Android for foreground services).
 *    2. On stopRecording(): create a RecordingEntity in Room so the
 *       Recent Calls tab can show a CRM sync badge for every call.
 *    3. Show a "📼 Recording stored" mock notification after the call.
 *
 *  CRM sync is handled entirely by CallStateReceiver (IDLE branch)
 *  after it reads the system call log — no double-sync risk.
 * ════════════════════════════════════════════════════════════════════
 */
class CallRecordingService : LifecycleService() {

    // ── State ─────────────────────────────────────────────────────────────────

    @Volatile private var callInProgress   = false
    private var currentPhone               = ""
    private var currentCallType            = "unknown"
    private var callStartTime              = 0L

    private val serviceScope               = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var repository: RecordingRepository

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        repository = RecordingRepository((application as App).database.recordingDao())
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        when (intent?.action) {
            ACTION_START_RECORDING -> {
                val phone = intent.getStringExtra(EXTRA_PHONE_NUMBER) ?: ""
                val type  = intent.getStringExtra(EXTRA_CALL_TYPE)   ?: "unknown"
                startRecording(phone, type)
            }
            ACTION_STOP_RECORDING -> stopRecording()
        }
        return START_STICKY
    }

    // ── Start ─────────────────────────────────────────────────────────────────

    private fun startRecording(phoneNumber: String, callType: String) {
        if (callInProgress) {
            AppLogger.w(this, TAG, "startRecording called while already in a call — ignored")
            return
        }
        callInProgress  = true
        currentPhone    = phoneNumber
        currentCallType = callType
        callStartTime   = System.currentTimeMillis()

        // startForeground must be called within 5 s of startForegroundService()
        startForeground(NOTIF_ID, buildActiveNotification(phoneNumber))
        AppLogger.i(this, TAG, "Call started [$callType] $phoneNumber")
    }

    // ── Stop ──────────────────────────────────────────────────────────────────

    private fun stopRecording() {
        if (!callInProgress) {
            AppLogger.w(this, TAG, "stopRecording: no active call — ignoring duplicate stop")
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }

        val phone     = currentPhone
        val type      = currentCallType
        val startedAt = callStartTime
        val durationMs = System.currentTimeMillis() - startedAt.coerceAtLeast(
            System.currentTimeMillis() - 3_600_000L   // clamp to ≤ 1 h
        )

        // Reset state so a second stopRecording() call is a no-op
        callInProgress  = false
        currentPhone    = ""
        currentCallType = "unknown"
        callStartTime   = 0L

        AppLogger.i(this, TAG, "Call ended [$type] $phone (${durationMs / 1000}s)")

        // Show mock notification immediately
        showStoredNotification(phone, durationMs)

        // Create RecordingEntity in background.
        // CallStateReceiver delays 1 s before it back-fills crmSynced / crmCallLogId,
        // so the entity will be in DB before the receiver looks.
        serviceScope.launch {
            val contactName = ContactHelper.getContactName(this@CallRecordingService, phone)
            repository.insert(
                RecordingEntity(
                    phoneNumber = phone,
                    contactName = contactName,
                    filePath    = "",
                    duration    = durationMs,
                    fileSize    = 0L,
                    callType    = type,
                    crmSynced   = false,   // back-filled by CallStateReceiver
                    createdAt   = startedAt.takeIf { it > 0L } ?: System.currentTimeMillis(),
                )
            )
            AppLogger.i(this@CallRecordingService, TAG, "RecordingEntity inserted for $phone")
        }

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    // ── Notifications ─────────────────────────────────────────────────────────

    private fun buildActiveNotification(phone: String): Notification {
        val tap = PendingIntent.getActivity(
            this, 0, Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        return NotificationCompat.Builder(this, App.CHANNEL_RECORDING)
            .setContentTitle("🔴 Recording call…")
            .setContentText(phone.ifBlank { "Unknown" })
            .setSmallIcon(R.drawable.ic_mic)
            .setContentIntent(tap)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    private fun showStoredNotification(phone: String, durationMs: Long) {
        val mins = durationMs / 60_000L
        val secs = (durationMs % 60_000L) / 1000L
        val dur  = if (mins > 0) "${mins}m ${secs}s" else "${secs}s"
        val body = "$dur  •  ${phone.ifBlank { "Unknown" }}  ✅ Saved"

        val tap = PendingIntent.getActivity(
            this, NOTIF_ID_SAVED,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        getSystemService(NotificationManager::class.java)?.notify(
            NOTIF_ID_SAVED,
            NotificationCompat.Builder(this, App.CHANNEL_GENERAL)
                .setContentTitle("📼 Call recorded")
                .setContentText(body)
                .setStyle(NotificationCompat.BigTextStyle().bigText(body))
                .setSmallIcon(R.drawable.ic_mic)
                .setContentIntent(tap)
                .setAutoCancel(true)
                .setPriority(NotificationCompat.PRIORITY_DEFAULT)
                .build()
        )
    }

    // ── Companion ─────────────────────────────────────────────────────────────

    companion object {
        private const val TAG             = "CallRecordingService"
        private const val NOTIF_ID        = 1001
        private const val NOTIF_ID_SAVED  = 1002

        const val ACTION_START_RECORDING  = "com.callrecorder.START_RECORDING"
        const val ACTION_STOP_RECORDING   = "com.callrecorder.STOP_RECORDING"
        const val EXTRA_PHONE_NUMBER      = "extra_phone_number"
        const val EXTRA_CALL_TYPE         = "extra_call_type"

        fun startRecording(context: Context, phoneNumber: String, callType: String) {
            context.startForegroundService(
                Intent(context, CallRecordingService::class.java).apply {
                    action = ACTION_START_RECORDING
                    putExtra(EXTRA_PHONE_NUMBER, phoneNumber)
                    putExtra(EXTRA_CALL_TYPE, callType)
                }
            )
        }

        fun stopRecording(context: Context) {
            context.startService(
                Intent(context, CallRecordingService::class.java).apply {
                    action = ACTION_STOP_RECORDING
                }
            )
        }
    }
}
