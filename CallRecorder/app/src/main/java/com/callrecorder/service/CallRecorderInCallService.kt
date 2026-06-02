package com.callrecorder.service

import android.content.Intent
import android.os.Build
import android.telecom.Call
import android.telecom.InCallService
import android.telecom.VideoProfile
import com.callrecorder.ui.IncomingCallActivity
import com.callrecorder.utils.AppLogger
import com.callrecorder.utils.PrefsHelper

/**
 * InCallService — works in two modes:
 *
 * Mode A (Companion App, recommended):
 *   User grants "Call Companion" permission in Settings → Special App Access.
 *   This app observes and records calls without replacing the phone app.
 *   IN_CALL_SERVICE_UI = false → Android still shows the normal phone app UI.
 *
 * Mode B (Default Dialer):
 *   User set this app as the default phone app.
 *   IN_CALL_SERVICE_UI = false means we DON'T try to show the in-call UI —
 *   we launch IncomingCallActivity just for the incoming call screen (Answer/Decline),
 *   then the system handles the actual in-call controls.
 *
 * In both modes: recording starts automatically when the call becomes active.
 */
class CallRecorderInCallService : InCallService() {

    private val callbackMap = mutableMapOf<Call, Call.Callback>()

    override fun onCallAdded(call: Call) {
        super.onCallAdded(call)

        AppLogger.i(this, TAG, "Call added state=${call.state}")

        // Keep a static reference so IncomingCallActivity can answer/reject
        currentCall = call

        val callback = object : Call.Callback() {
            override fun onStateChanged(call: Call, state: Int) {
                AppLogger.i(this@CallRecorderInCallService, TAG, "State → $state")

                when (state) {
                    // ── Incoming call is ringing ─────────────────────────────
                    Call.STATE_RINGING -> {
                        currentCall = call
                        if (isDefaultDialer()) {
                            // We're the default dialer — show our incoming call screen
                            // so the user can answer/decline
                            launchIncomingCallActivity(call)
                        }
                        // If companion app: the normal phone app shows its own screen
                    }

                    // ── Call answered / connected ─────────────────────────────
                    Call.STATE_ACTIVE -> {
                        if (!PrefsHelper.isAutoRecordEnabled(this@CallRecorderInCallService)) return

                        val phoneNumber = call.details?.handle?.schemeSpecificPart
                            ?.removePrefix("+") ?: ""
                        val callType = resolveCallType(call)

                        AppLogger.i(
                            this@CallRecorderInCallService, TAG,
                            "Active: $phoneNumber ($callType) — starting recorder"
                        )
                        CallRecordingService.startRecording(
                            this@CallRecorderInCallService, phoneNumber, callType
                        )
                    }

                    // ── Call ended ────────────────────────────────────────────
                    Call.STATE_DISCONNECTED,
                    Call.STATE_DISCONNECTING -> {
                        AppLogger.i(this@CallRecorderInCallService, TAG, "Disconnected — stopping recorder")
                        call.unregisterCallback(this)
                        callbackMap.remove(call)
                        CallRecordingService.stopRecording(this@CallRecorderInCallService)
                        if (currentCall == call) currentCall = null
                    }
                }
            }
        }

        callbackMap[call] = callback
        call.registerCallback(callback)

        // Handle calls that are already ringing/active when service binds
        when (call.state) {
            Call.STATE_RINGING -> {
                currentCall = call
                if (isDefaultDialer()) launchIncomingCallActivity(call)
            }
            Call.STATE_ACTIVE -> {
                if (PrefsHelper.isAutoRecordEnabled(this)) {
                    val number = call.details?.handle?.schemeSpecificPart?.removePrefix("+") ?: ""
                    CallRecordingService.startRecording(this, number, resolveCallType(call))
                }
            }
        }
    }

    override fun onCallRemoved(call: Call) {
        super.onCallRemoved(call)
        AppLogger.i(this, TAG, "Call removed")
        callbackMap.remove(call)?.let { call.unregisterCallback(it) }
        if (currentCall == call) currentCall = null
        CallRecordingService.stopRecording(this)
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun launchIncomingCallActivity(call: Call) {
        val number = call.details?.handle?.schemeSpecificPart?.removePrefix("+") ?: ""
        AppLogger.i(this, TAG, "Launching IncomingCallActivity for: $number")
        startActivity(
            Intent(this, IncomingCallActivity::class.java).apply {
                addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_NO_USER_ACTION)
                putExtra(IncomingCallActivity.EXTRA_PHONE_NUMBER, number)
            }
        )
    }

    private fun isDefaultDialer(): Boolean = try {
        val tm = getSystemService(android.telecom.TelecomManager::class.java)
        tm?.defaultDialerPackage == packageName
    } catch (e: Exception) { false }

    private fun resolveCallType(call: Call): String =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            when (call.details?.callDirection) {
                Call.Details.DIRECTION_INCOMING -> "incoming"
                Call.Details.DIRECTION_OUTGOING -> "outgoing"
                else -> "unknown"
            }
        } else {
            val caps = call.details?.callCapabilities ?: 0
            if (caps and Call.Details.CAPABILITY_RESPOND_VIA_TEXT != 0) "incoming" else "outgoing"
        }

    companion object {
        private const val TAG = "CallRecorderInCallSvc"

        /** Active call reference used by IncomingCallActivity to answer/reject. */
        @Volatile var currentCall: Call? = null

        fun answerCurrentCall() {
            currentCall?.answer(VideoProfile.STATE_AUDIO_ONLY)
        }

        fun rejectCurrentCall() {
            currentCall?.reject(false, null)
        }
    }
}
