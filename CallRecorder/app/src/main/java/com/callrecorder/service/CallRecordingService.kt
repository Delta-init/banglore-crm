package com.callrecorder.service

import android.app.Notification
import android.app.NotificationManager
import android.app.PendingIntent
import android.content.Context
import android.content.Intent
import android.media.AudioManager
import android.media.MediaRecorder
import android.os.Build
import android.util.Log
import androidx.core.app.NotificationCompat
import androidx.lifecycle.LifecycleService
import com.callrecorder.App
import com.callrecorder.R
import com.callrecorder.data.db.RecordingEntity
import com.callrecorder.data.repository.RecordingRepository
import com.callrecorder.ui.MainActivity
import com.callrecorder.utils.AppLogger
import com.callrecorder.utils.ContactHelper
import com.callrecorder.utils.PrefsHelper
import com.callrecorder.utils.StorageHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext

/**
 * ════════════════════════════════════════════════════════════════════
 *  Call Recording Service — God Mode
 * ════════════════════════════════════════════════════════════════════
 *
 *  Recording strategy by Android version:
 *
 *  Android < 9 (API < 28):
 *    Layer 1: VOICE_CALL → VOICE_DOWNLINK → VOICE_COMMUNICATION → UNPROCESSED → MIC
 *    Layer 2: Speaker-mode fallback (only if user enabled in Settings)
 *
 *  Android 9+ (API 28+):
 *    VOICE_CALL / VOICE_DOWNLINK are BLOCKED by the OS.
 *    VOICE_COMMUNICATION / UNPROCESSED / MIC only capture the LOCAL mic — no call audio.
 *    ✅ Speaker-route mode is the ONLY method:
 *       • Route call audio to the phone speaker via AudioManager
 *       • Record from MIC — physically picks up both sides through the speaker
 *       • Works on ALL Android 9+ devices without root
 *
 *  InCallService (Layer 3):
 *    When app is default dialer or Call Companion, InCallService starts this service
 *    directly at STATE_ACTIVE — best timing, same audio capture method.
 * ════════════════════════════════════════════════════════════════════
 */
class CallRecordingService : LifecycleService() {

    // ── State ─────────────────────────────────────────────────────────────────

    private var mediaRecorder: MediaRecorder? = null
    private var currentFilePath: String = ""
    private var currentPhoneNumber: String = ""
    private var currentCallType: String = "unknown"
    private var recordingStartTime: Long = 0L
    private var activeAudioSource: Int = MediaRecorder.AudioSource.MIC

    private var audioManager: AudioManager? = null
    private var savedSpeakerphoneOn: Boolean = false
    private var savedAudioMode: Int = AudioManager.MODE_NORMAL
    private var usedSpeakerMode: Boolean = false

    private val serviceScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    private lateinit var repository: RecordingRepository

    // ── Lifecycle ─────────────────────────────────────────────────────────────

    override fun onCreate() {
        super.onCreate()
        val db = (application as App).database
        repository = RecordingRepository(db.recordingDao())
        audioManager = getSystemService(Context.AUDIO_SERVICE) as AudioManager
    }

    override fun onStartCommand(intent: Intent?, flags: Int, startId: Int): Int {
        super.onStartCommand(intent, flags, startId)
        when (intent?.action) {
            ACTION_START_RECORDING -> {
                val phone = intent.getStringExtra(EXTRA_PHONE_NUMBER) ?: ""
                val type  = intent.getStringExtra(EXTRA_CALL_TYPE) ?: "unknown"
                startRecording(phone, type)
            }
            ACTION_STOP_RECORDING -> stopRecording()
        }
        return START_STICKY
    }

    override fun onDestroy() {
        restoreAudioMode()
        mediaRecorder?.let {
            try { it.stop() } catch (_: Exception) {}
            it.release()
            mediaRecorder = null
        }
        super.onDestroy()
    }

    // ── Recording start ───────────────────────────────────────────────────────

    /**
     * Called from onStartCommand (main thread).
     *
     * startForeground() MUST be called immediately (within 5 s of startForegroundService).
     * The heavy work (waiting for audio, configuring MediaRecorder) is done in a coroutine.
     */
    private fun startRecording(phoneNumber: String, callType: String) {
        if (mediaRecorder != null) {
            AppLogger.w(this, TAG, "startRecording called but already recording — ignored")
            return
        }

        currentPhoneNumber = phoneNumber
        currentCallType    = callType
        currentFilePath    = StorageHelper.createRecordingFilePath(this, phoneNumber)
        recordingStartTime = System.currentTimeMillis()

        // ✅ Call startForeground immediately — Android requires it within 5 s
        startForeground(NOTIF_ID, buildNotification(phoneNumber))

        AppLogger.i(this, TAG,
            "startRecording [$callType] $phoneNumber  →  ${currentFilePath.substringAfterLast('/')}")

        // Launch the actual recording work in a background coroutine
        serviceScope.launch {
            val started = activateRecording(callType)
            if (!started) {
                AppLogger.e(this@CallRecordingService, TAG,
                    "All recording methods failed. Ensure Speaker Mode is on for Android 9+.")
                withContext(Dispatchers.Main) { stopSelf() }
            }
        }
    }

    /**
     * Runs on Dispatchers.IO.
     * Waits for call audio to be active, then starts the recorder.
     */
    private suspend fun activateRecording(callType: String): Boolean {
        // Wait until the phone's audio system switches to in-call mode.
        // This is essential for outgoing calls (not yet connected at OFFHOOK time).
        waitForCallAudio(callType)

        return if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P) {
            // ─────────────────────────────────────────────────────────────────
            // Android 9+: VOICE_CALL is OS-blocked. Other sources only capture
            // the local mic — NOT the call audio. Speaker mode is the only
            // reliable approach regardless of OEM.
            // ─────────────────────────────────────────────────────────────────
            AppLogger.i(this@CallRecordingService, TAG, "Android 9+ — using speaker-route mode")
            trySpeakerMode()
        } else {
            // ─────────────────────────────────────────────────────────────────
            // Android 8.1 and below: try privileged audio sources first.
            // Speaker mode is only used if all sources fail AND user enabled it.
            // ─────────────────────────────────────────────────────────────────
            tryPrivilegedSources() || trySpeakerMode()
        }
    }

    /**
     * Polls AudioManager.mode until the phone is in an active call state.
     * For outgoing calls the call isn't yet connected at OFFHOOK, so we wait.
     *
     * Max wait: 10 s for outgoing, 4 s for incoming (it's already active).
     */
    private suspend fun waitForCallAudio(callType: String) {
        val am = audioManager ?: return
        val maxWaitMs = if (callType == "outgoing" || callType == "unknown") 10_000L else 4_000L
        val intervalMs = 250L
        var waited = 0L

        while (waited < maxWaitMs) {
            val mode = am.mode
            if (mode == AudioManager.MODE_IN_CALL || mode == AudioManager.MODE_IN_COMMUNICATION) {
                AppLogger.i(this@CallRecordingService, TAG,
                    "Call audio active (mode=$mode) after ${waited}ms")
                return
            }
            delay(intervalMs)
            waited += intervalMs
        }

        // Timed out — force in-call mode anyway (handles edge cases on some ROMs)
        AppLogger.w(this@CallRecordingService, TAG,
            "waitForCallAudio timed out after ${maxWaitMs}ms (mode=${am.mode}) — forcing in-call")
    }

    // ── Layer 1: Privileged sources (Android 8.1 and below) ──────────────────

    /**
     * Tries audio sources from most-privileged to least.
     * Only used on Android < 9.
     *
     * ⚠️ Original bug fix: the old `return try { } catch { null }` exited the
     * function on the first failure. Now we correctly continue to the next source.
     */
    private fun tryPrivilegedSources(): Boolean {
        val sources = listOf(
            MediaRecorder.AudioSource.VOICE_CALL,           // Both sides (Android ≤ 8.1)
            MediaRecorder.AudioSource.VOICE_DOWNLINK,       // Remote party only
            MediaRecorder.AudioSource.VOICE_COMMUNICATION,  // VoIP
            MediaRecorder.AudioSource.UNPROCESSED,          // Raw audio bus
            MediaRecorder.AudioSource.DEFAULT,
            MediaRecorder.AudioSource.MIC
        )

        for (source in sources) {
            val recorder = buildRecorder(source) ?: continue
            try {
                recorder.prepare()
                recorder.start()
                mediaRecorder = recorder
                activeAudioSource = source
                AppLogger.i(this, TAG, "Layer-1 recording started (source=$source)")
                return true
            } catch (e: Exception) {
                AppLogger.w(this, TAG, "Source $source failed: ${e.javaClass.simpleName}")
                try { recorder.reset() } catch (_: Exception) {}
                recorder.release()
                // ← continue to next source (do NOT return here)
            }
        }
        return false
    }

    // ── Layer 2: Speaker-route mode ───────────────────────────────────────────

    /**
     * Routes call audio to the phone speaker, then records from MIC.
     * The MIC physically picks up both sides of the conversation.
     *
     * On Android 9+ this is called unconditionally.
     * On older Android it is only called if the user enabled it in Settings.
     */
    private fun trySpeakerMode(): Boolean {
        val am = audioManager ?: return false

        // On older Android, respect the user's preference
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.P && !PrefsHelper.forceSpeakerMode(this)) {
            AppLogger.i(this, TAG, "Speaker mode disabled by user preference")
            return false
        }

        return try {
            // Save current audio state so we can restore it later
            @Suppress("DEPRECATION")
            savedSpeakerphoneOn = am.isSpeakerphoneOn
            savedAudioMode      = am.mode

            // Activate in-call mode + route audio to speaker
            am.mode = AudioManager.MODE_IN_CALL
            @Suppress("DEPRECATION")
            am.isSpeakerphoneOn = true
            usedSpeakerMode = true

            // Allow audio routing to settle before we open the mic
            Thread.sleep(600)

            val recorder = buildRecorder(MediaRecorder.AudioSource.MIC) ?: run {
                AppLogger.e(this, TAG, "buildRecorder(MIC) returned null")
                restoreAudioMode()
                return false
            }
            recorder.prepare()
            recorder.start()
            mediaRecorder = recorder
            activeAudioSource = MediaRecorder.AudioSource.MIC

            AppLogger.i(this, TAG, "Speaker-route recording active ✅")
            true
        } catch (e: Exception) {
            AppLogger.e(this, TAG, "Speaker mode failed: ${e.message}")
            restoreAudioMode()
            false
        }
    }

    // ── MediaRecorder builder ─────────────────────────────────────────────────

    private fun buildRecorder(source: Int): MediaRecorder? {
        return try {
            val r = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S)
                MediaRecorder(this)
            else
                @Suppress("DEPRECATION") MediaRecorder()

            r.apply {
                setAudioSource(source)
                setOutputFormat(MediaRecorder.OutputFormat.MPEG_4)
                setAudioEncoder(MediaRecorder.AudioEncoder.AAC)
                setAudioChannels(1)            // mono — smaller file, fine for voice
                setAudioSamplingRate(44_100)
                setAudioEncodingBitRate(128_000)
                setOutputFile(currentFilePath)
            }
        } catch (e: Exception) {
            Log.w(TAG, "buildRecorder(source=$source) threw: ${e.message}")
            null
        }
    }

    private fun restoreAudioMode() {
        if (!usedSpeakerMode) return
        try {
            audioManager?.apply {
                @Suppress("DEPRECATION")
                isSpeakerphoneOn = savedSpeakerphoneOn
                mode             = savedAudioMode
            }
        } catch (e: Exception) {
            Log.w(TAG, "restoreAudioMode failed: ${e.message}")
        }
        usedSpeakerMode = false
    }

    // ── Recording stop ────────────────────────────────────────────────────────

    private fun stopRecording() {
        restoreAudioMode()

        val recorder = mediaRecorder ?: run {
            AppLogger.w(this, TAG, "stopRecording: no active recorder")
            stopForeground(STOP_FOREGROUND_REMOVE)
            stopSelf()
            return
        }

        try {
            recorder.stop()
        } catch (e: Exception) {
            Log.w(TAG, "recorder.stop() threw (possibly very short call): ${e.message}")
        } finally {
            recorder.release()
            mediaRecorder = null
        }

        val filePath    = currentFilePath
        val phone       = currentPhoneNumber
        val type        = currentCallType
        val wallClock   = System.currentTimeMillis() - recordingStartTime

        serviceScope.launch {
            // Give the file system a moment to flush
            delay(400)

            val fileSize = StorageHelper.getFileSize(filePath)
            val duration = StorageHelper.getFileDuration(filePath)
                .takeIf { it > 0L } ?: wallClock

            if (fileSize > 1_024L) {   // > 1 KB = real recording
                val contactName = ContactHelper.getContactName(this@CallRecordingService, phone)
                val entity = RecordingEntity(
                    phoneNumber = phone,
                    contactName = contactName,
                    filePath    = filePath,
                    duration    = duration,
                    fileSize    = fileSize,
                    callType    = type
                )
                repository.insert(entity)
                AppLogger.i(this@CallRecordingService, TAG,
                    "Saved ✅  ${duration / 1000}s  ${fileSize / 1024}KB  " +
                    "src=${audioSourceName(activeAudioSource)} speaker=$usedSpeakerMode")

                // ── Notify user: recording saved locally ───────────────────
                showSavedNotification(
                    phone       = contactName ?: phone,
                    durationMs  = duration,
                    crmSynced   = null,   // null = syncing in progress
                )

                // ── Upload to CRM, then update notification with result ────
                val synced = CrmSyncService.sync(this@CallRecordingService, entity)
                showSavedNotification(
                    phone       = contactName ?: phone,
                    durationMs  = duration,
                    crmSynced   = synced,
                )
            } else {
                StorageHelper.deleteFile(filePath)
                AppLogger.w(this@CallRecordingService, TAG,
                    "Recording too small (${fileSize}B) — deleted. " +
                    "Check: is the app the default dialer or Call Companion?")
            }
        }

        stopForeground(STOP_FOREGROUND_REMOVE)
        stopSelf()
    }

    // ── Saved recording notification ──────────────────────────────────────────

    /**
     * Shows (or updates) the "Recording saved" notification.
     * Uses NOTIF_ID_SAVED so it replaces itself on update without creating a new one.
     *
     * @param crmSynced null = still syncing | true = synced OK | false = sync failed / not configured
     */
    private fun showSavedNotification(phone: String, durationMs: Long, crmSynced: Boolean?) {
        val durationStr = StorageHelper.formatDuration(durationMs)
        val display     = phone.ifBlank { "Unknown caller" }

        val body = when (crmSynced) {
            null  -> "$durationStr  •  $display"
            true  -> "$durationStr  •  $display  ✅ Synced to CRM"
            false -> "$durationStr  •  $display  ⚠️ Saved locally"
        }

        val tap = PendingIntent.getActivity(
            this, NOTIF_ID_SAVED,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )

        val notification = NotificationCompat.Builder(this, App.CHANNEL_GENERAL)
            .setContentTitle("📼 Call recorded")
            .setContentText(body)
            .setStyle(NotificationCompat.BigTextStyle().bigText(body))
            .setSmallIcon(R.drawable.ic_mic)
            .setContentIntent(tap)
            .setAutoCancel(true)
            .setPriority(NotificationCompat.PRIORITY_DEFAULT)
            .build()

        getSystemService(NotificationManager::class.java)
            ?.notify(NOTIF_ID_SAVED, notification)
    }

    // ── Foreground (in-progress) notification ─────────────────────────────────

    private fun buildNotification(phoneNumber: String): Notification {
        val tap = PendingIntent.getActivity(
            this, 0,
            Intent(this, MainActivity::class.java),
            PendingIntent.FLAG_UPDATE_CURRENT or PendingIntent.FLAG_IMMUTABLE
        )
        val display = phoneNumber.ifBlank { "Unknown" }
        val label   = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.P)
            "Speaker+Mic" else audioSourceName(activeAudioSource)

        return NotificationCompat.Builder(this, App.CHANNEL_RECORDING)
            .setContentTitle("🔴 Recording call…")
            .setContentText("$display  [$label]")
            .setSmallIcon(R.drawable.ic_mic)
            .setContentIntent(tap)
            .setOngoing(true)
            .setSilent(true)
            .build()
    }

    private fun audioSourceName(source: Int) = when (source) {
        MediaRecorder.AudioSource.VOICE_CALL         -> "VoiceCall"
        MediaRecorder.AudioSource.VOICE_DOWNLINK     -> "Downlink"
        MediaRecorder.AudioSource.VOICE_COMMUNICATION -> "VoIP"
        MediaRecorder.AudioSource.UNPROCESSED        -> "Raw"
        MediaRecorder.AudioSource.MIC                -> if (usedSpeakerMode) "Speaker+Mic" else "Mic"
        else                                         -> "Default"
    }

    // ── Companion ─────────────────────────────────────────────────────────────

    companion object {
        private const val TAG           = "CallRecordingService"
        private const val NOTIF_ID      = 1001   // foreground recording notification
        private const val NOTIF_ID_SAVED = 1002  // "recording saved" notification

        const val ACTION_START_RECORDING = "com.callrecorder.START_RECORDING"
        const val ACTION_STOP_RECORDING  = "com.callrecorder.STOP_RECORDING"
        const val EXTRA_PHONE_NUMBER     = "extra_phone_number"
        const val EXTRA_CALL_TYPE        = "extra_call_type"

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
