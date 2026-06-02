package com.callrecorder.ui

import android.os.Build
import android.os.Bundle
import android.view.WindowManager
import androidx.appcompat.app.AppCompatActivity
import com.callrecorder.databinding.ActivityIncomingCallBinding
import com.callrecorder.service.CallRecorderInCallService
import com.callrecorder.utils.ContactHelper

/**
 * Incoming call screen — shown when this app is the default dialer and a call arrives.
 *
 * Displayed over the lock screen so the user can answer without unlocking first.
 * After answering or declining, the normal phone UI takes over.
 */
class IncomingCallActivity : AppCompatActivity() {

    private lateinit var binding: ActivityIncomingCallBinding

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)

        // Show over lock screen
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O_MR1) {
            setShowWhenLocked(true)
            setTurnScreenOn(true)
        } else {
            @Suppress("DEPRECATION")
            window.addFlags(
                WindowManager.LayoutParams.FLAG_SHOW_WHEN_LOCKED or
                WindowManager.LayoutParams.FLAG_TURN_SCREEN_ON or
                WindowManager.LayoutParams.FLAG_KEEP_SCREEN_ON
            )
        }

        binding = ActivityIncomingCallBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val phoneNumber = intent.getStringExtra(EXTRA_PHONE_NUMBER) ?: "Unknown"

        // Resolve contact name in background
        Thread {
            val name = ContactHelper.getContactName(this, phoneNumber)
            runOnUiThread {
                binding.tvCallerName.text = name ?: phoneNumber
                binding.tvCallerNumber.text = if (name != null) phoneNumber else ""
            }
        }.start()

        binding.tvCallerName.text = phoneNumber

        // ── Answer ────────────────────────────────────────────────────────────
        binding.btnAnswer.setOnClickListener {
            CallRecorderInCallService.answerCurrentCall()
            finish()
        }

        // ── Decline ───────────────────────────────────────────────────────────
        binding.btnDecline.setOnClickListener {
            CallRecorderInCallService.rejectCurrentCall()
            finish()
        }
    }

    override fun onBackPressed() {
        // Prevent accidentally dismissing without answering/declining
    }

    companion object {
        const val EXTRA_PHONE_NUMBER = "extra_phone_number"
    }
}
