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
    private var callStartTime: Long = 0L        // set at OFFHOOK/STATE_ACTIVE (when call begins)
    private var recordingStartTime: Long = 0L   // set AFTER waitForCallAudio + audio settle
    private var activeAudioSource: Int = MediaRecorder.AudioSource.MIC

    // Prevents activateRecording() from starting the recorder after the call has ended
    @Volatile private var stopRequested      = false
    // Prevents duplicate stop processing when stopRecording() is called more than once
    @Volatile private var stopAlreadyHandled = false

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

        stopRequested      = false
        stopAlreadyHandled = false

        // Final safety net: if phone is still blank, try the number saved by DialerFragment.
        // This catches any path (InCallService, BroadcastReceiver) that couldn't resolve it.
        val resolvedPhone = phoneNumber.ifBlank {
            PrefsHelper.getLastDialedNumber(this).also { fallback ->
                if (fallback.isNotBlank())
                    AppLogger.i(this, TAG, "startRecording: phone was blank, resolved from PrefsHelper: $fallback")
                else
                    AppLogger.w(this, TAG, "startRecording: phone number unknown for this call")
            }
        }

        currentPhoneNumber = resolvedPhone
        currentCallType    = callType
        currentFilePath    = StorageHelper.createRecordingFilePath(this, resolvedPhone)
        callStartTime      = System.currentTimeMillis()  // call began (OFFHOOK / STATE_ACTIVE)
        recordingStartTime = 0L                          // will be set after audio settles

        // ✅ Call startForeground immediately — Android requires it within 5 s
        startForeground(NOTIF_ID, buildNotification(resolvedPhone))

        // Show recording overlay badge immediately, then update with contact name
        RecordingOverlayManager.show(this, resolvedPhone, null)

        AppLogger.i(this, TAG,
            "startRecording [$callType] $resolvedPhone  →  ${currentFilePath.substringAfterLast('/')}")

        // Launch the actual recording work in a background coroutine
        serviceScope.launch {
            // Async contact name lookup → update overlay label
            val contactName = ContactHelper.getContactName(this@CallRecordingService, resolvedPhone)
            if (!contactName.isNullOrBlank()) {
                RecordingOverlayManager.update(this@CallRecordingService, resolvedPhone, contactName)
            }

            val started = activateRecording(callType)
            if (!started) {
                if (!stopRequested) {
                    AppLogger.e(this@CallRecordingService, TAG,
                        "All recording methods failed. Ensure Speaker Mode is on for Android 9+.")
                }
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

        // If stop was called while we were waiting for audio, abort before touching hardware
        if (stopRequested) {
            AppLogger.w(this@CallRecordingService, TAG, "Call ended during audio wait — aborting recorder start")
            return false
        }

        // ✅ Set recordingStartTime AFTER call connects and audio is ready.
        // This gives accurate wallClock duration (excludes ringing/dial wait time).
        recordingStartTime = System.currentTimeMillis()

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
        stopRequested = true
        if (stopAlreadyHandled) return   // duplicate stop — InCallService + CallStateReceiver both fire
        stopAlreadyHandled = true

        RecordingOverlayManager.hide()
        restoreAudioMode()

        val recorder = mediaRecorder ?: run {
            // Call ended before recording could start (very short call / audio wait timed out).
            // Still log to CRM and save a tombstone so the Recent Calls badge shows.
            AppLogger.w(this, TAG, "stopRecording: no active recorder — logging zero-duration call event")
            val phone   = currentPhoneNumber
            val type    = currentCallType
            val startMs = if (callStartTime > 0L) callStartTime else System.currentTimeMillis()
            if (phone.isNotBlank()) {
                serviceScope.launch {
                    val callDateIso = java.time.Instant.ofEpochMilli(startMs).toString()
                    val (synced, syncErr) = CrmSyncService.logCallEvent(
                        context      = this@CallRecordingService,
                        phoneNumber  = phone,
                        callType     = type.ifBlank { "unknown" },
                        durationSecs = 0L,
                        callDateIso  = callDateIso,
                    )
                    val contactName = ContactHelper.getContactName(this@CallRecordingService, phone)
                    repository.insert(RecordingEntity(
                        phoneNumber = phone,
                        contactName = contactName,
                        filePath    = "",
                        duration    = 0L,
                        fileSize    = 0L,
                        callType    = type.ifBlank { "unknown" },
                        crmSynced   = synced,
                        syncError   = syncErr,
                        createdAt   = startMs,
                    ))
                }
            }
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

        val filePath      = currentFilePath
        val phone         = currentPhoneNumber
        val type          = currentCallType
        val stopTimeMs    = System.currentTimeMillis()
        val callDateIso   = java.time.Instant.ofEpochMilli(
            if (callStartTime > 0L) callStartTime else stopTimeMs
        ).toString()

        // wallClock = time from when audio actually settled to when call ended.
        // recordingStartTime is set AFTER waitForCallAudio() so this is accurate.
        val wallClock = if (recordingStartTime > 0L) stopTimeMs - recordingStartTime else 0L

        serviceScope.launch {
            // Wait for the OS to finish writing the audio file
            delay(500)

            val fileSize = StorageHelper.getFileSize(filePath)

            // Try file metadata first (most accurate).
            // If not available yet, retry once after a short wait.
            var fileDuration = StorageHelper.getFileDuration(filePath)
            if (fileDuration <= 0L && fileSize > 1_024L) {
                delay(600)
                fileDuration = StorageHelper.getFileDuration(filePath)
            }

            // Clamp wallClock to a sane range (1 s – 2 h) to avoid bad values
            val safeWallClock = wallClock.takeIf { it in 1_000L..7_200_000L } ?: 0L

            val duration = when {
                fileDuration > 0L  -> fileDuration   // best — actual audio length (ms)
                safeWallClock > 0L -> safeWallClock  // good — post-connect wallClock (ms)
                else               -> 0L             // unknown
            }
            val durationSecs = duration / 1000L

            AppLogger.i(this@CallRecordingService, TAG,
                "Duration: file=${fileDuration}ms  wall=${wallClock}ms  used=${duration}ms (${durationSecs}s)")

            val contactName = ContactHelper.getContactName(this@CallRecordingService, phone)

            if (fileSize > 1_024L) {
                // ── Real recording exists — save locally and upload with file ─
                val entity = RecordingEntity(
                    phoneNumber = phone,
                    contactName = contactName,
                    filePath    = filePath,
                    duration    = duration,
                    fileSize    = fileSize,
                    callType    = type,
                    crmSynced   = false,
                    // Use call START time so the Recent Calls matcher can correlate
                    // with the system call log (which also uses call start time).
                    // Without this, long calls (> 90 s) would never match because
                    // the default is System.currentTimeMillis() at END of call.
                    createdAt   = if (callStartTime > 0L) callStartTime else System.currentTimeMillis(),
                )
                val savedId = repository.insert(entity).toInt()
                AppLogger.i(this@CallRecordingService, TAG,
                    "Saved ✅  id=$savedId  ${durationSecs}s  ${fileSize / 1024}KB  " +
                    "src=${audioSourceName(activeAudioSource)} speaker=$usedSpeakerMode")

                // Notify user: recording saved locally (sync in progress)
                showSavedNotification(
                    phone      = contactName ?: phone,
                    durationMs = duration,
                    crmSynced  = null,
                )

                // Upload file + metadata to CRM — returns (synced, errorMessage)
                val (synced, syncError) = CrmSyncService.sync(this@CallRecordingService, entity)

                // Persist CRM sync result so the Recent Calls list can show it
                if (savedId > 0) {
                    repository.updateSyncResult(savedId, synced, syncError)
                }

                showSavedNotification(
                    phone      = contactName ?: phone,
                    durationMs = duration,
                    crmSynced  = synced,
                )

            } else {
                // ── Recording failed / too small — log to CRM + save tombstone to DB ───
                StorageHelper.deleteFile(filePath)
                AppLogger.w(this@CallRecordingService, TAG,
                    "Recording too small (${fileSize}B) — deleted. Logging call event to CRM.")

                val (synced, syncErr) = CrmSyncService.logCallEvent(
                    context      = this@CallRecordingService,
                    phoneNumber  = phone,
                    callType     = type,
                    durationSecs = durationSecs,
                    callDateIso  = callDateIso,
                )

                // Tombstone — no audio file, but we know the call happened and the CRM result
                repository.insert(RecordingEntity(
                    phoneNumber = phone,
                    contactName = contactName,
                    filePath    = "",
                    duration    = duration,
                    fileSize    = 0L,
                    callType    = type,
                    crmSynced   = synced,
                    syncError   = syncErr,
                    createdAt   = if (callStartTime > 0L) callStartTime else stopTimeMs,
                ))

                showSavedNotification(
                    phone      = contactName ?: phone,
                    durationMs = duration,
                    crmSynced  = synced,
                )
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
