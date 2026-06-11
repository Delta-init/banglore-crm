package com.callrecorder.ui

import android.media.AudioManager
import android.os.Build
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.telecom.Call
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import com.callrecorder.databinding.ActivityInCallBinding
import com.callrecorder.service.CallRecorderInCallService
import com.callrecorder.utils.ContactHelper

/**
 * Ongoing call screen — shown when this app is the default dialer and a call is active.
 *
 * Required because IN_CALL_SERVICE_UI = true means the OS won't show its own
 * in-call UI; our activity must provide Mute, Speaker, and End Call controls.
 *
 * Auto-finishes when the call disconnects (via the Call.Callback).
 */
class InCallActivity : AppCompatActivity() {

    private lateinit var binding: ActivityInCallBinding
    private val handler = Handler(Looper.getMainLooper())
    private var durationSecs = 0L
    private var isMuted   = false
    private var isSpeaker = false
    private var audioManager: AudioManager? = null

    private var callCallback: Call.Callback? = null

    // Increments every second while the call is active
    private val timerRunnable = object : Runnable {
        override fun run() {
            durationSecs++
            binding.tvDuration.text = formatDuration(durationSecs)
            handler.postDelayed(this, 1_000)
        }
    }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Keep screen on and show over the lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON
            )
        }
        window.addFlags(WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON)

        binding = ActivityInCallBinding.inflate(layoutInflater)
        setContentView(binding.root)

        audioManager = getSystemService(AudioManager::class.java)

        // If no active call, there's nothing to show
        val call = CallRecorderInCallService.currentCall
        if (call == null) {
            finish()
            return
        }

        // ── Caller info ────────────────────────────────────────────────────────
        val number = call.details?.handle?.schemeSpecificPart
            ?.removePrefix("+")
            ?.ifBlank { null }
            ?: "Unknown"

        binding.tvCallerName.text   = number
        binding.tvCallerNumber.text = ""
        binding.tvCallerInitial.text = number.filter { it.isLetter() }.firstOrNull()?.uppercaseChar()?.toString()
            ?: number.lastOrNull()?.toString() ?: "?"

        // Async contact name resolve
        Thread {
            val name = ContactHelper.getContactName(this, number)
            if (!name.isNullOrBlank()) {
                runOnUiThread {
                    binding.tvCallerName.text   = name
                    binding.tvCallerNumber.text = number
                    binding.tvCallerInitial.text = name.firstOrNull()?.uppercaseChar()?.toString() ?: "?"
                }
            }
        }.start()

        // ── Duration timer ─────────────────────────────────────────────────────
        handler.post(timerRunnable)

        // ── Mute button ────────────────────────────────────────────────────────
        binding.btnMute.setOnClickListener {
            isMuted = !isMuted
            audioManager?.isMicrophoneMute = isMuted
            binding.btnMute.backgroundTintList =
                if (isMuted) android.content.res.ColorStateList.valueOf(0xFF1565C0.toInt())
                else         android.content.res.ColorStateList.valueOf(0xFF2A2A2A.toInt())
            binding.tvMuteLabel.text = if (isMuted) "Unmute" else "Mute"
        }

        // ── Speaker button ─────────────────────────────────────────────────────
        binding.btnSpeaker.setOnClickListener {
            isSpeaker = !isSpeaker
            @Suppress("DEPRECATION")
            audioManager?.isSpeakerphoneOn = isSpeaker
            binding.btnSpeaker.backgroundTintList =
                if (isSpeaker) android.content.res.ColorStateList.valueOf(0xFF1565C0.toInt())
                else           android.content.res.ColorStateList.valueOf(0xFF2A2A2A.toInt())
            binding.tvSpeakerLabel.text = if (isSpeaker) "Earpiece" else "Speaker"
        }

        // ── End call button ────────────────────────────────────────────────────
        binding.btnEndCall.setOnClickListener {
            CallRecorderInCallService.rejectCurrentCall()
            finish()
        }

        // ── Auto-finish when call disconnects ─────────────────────────────────
        callCallback = object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                if (state == Call.STATE_DISCONNECTED || state == Call.STATE_DISCONNECTING) {
                    runOnUiThread { finish() }
                }
            }
        }
        call.registerCallback(callCallback!!)
    }

    override fun onBackPressed() {
        // Block back press — user must use End Call button
    }

    override fun onDestroy() {
        handler.removeCallbacks(timerRunnable)
        callCallback?.let {
            CallRecorderInCallService.currentCall?.unregisterCallback(it)
        }
        super.onDestroy()
    }

    private fun formatDuration(secs: Long): String {
        val m = secs / 60
        val s = secs % 60
        return "%02d:%02d".format(m, s)
    }
}
