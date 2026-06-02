package com.callrecorder.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import android.util.Log
import com.callrecorder.utils.AppLogger
import com.callrecorder.utils.PrefsHelper

/**
 * ════════════════════════════════════════════════════════════════════
 *  Call State Receiver — both incoming and outgoing calls
 * ════════════════════════════════════════════════════════════════════
 *
 *  State machine:
 *
 *    IDLE ──→ RINGING ──→ OFFHOOK   =  INCOMING call answered
 *    IDLE ──→ OFFHOOK               =  OUTGOING call placed
 *    IDLE ──→ RINGING ──→ IDLE      =  Missed / rejected
 *    OFFHOOK ──→ IDLE               =  Call ended → stop recording
 *
 *  On Android 10+ (API 29+):
 *    • ACTION_NEW_OUTGOING_CALL is deprecated — may not fire on all devices
 *    • EXTRA_INCOMING_NUMBER is removed — number unavailable from this broadcast
 *    • We detect outgoing calls via the IDLE → OFFHOOK transition (no RINGING before)
 *    • Phone number for outgoing calls is captured via ACTION_NEW_OUTGOING_CALL when it fires,
 *      or left blank if it doesn't (recording still works, just without the number label)
 * ════════════════════════════════════════════════════════════════════
 */
class CallStateReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (!PrefsHelper.isAutoRecordEnabled(context)) return

        when (intent.action) {

            // ── Capture outgoing number before the call connects ──────────────
            // Deprecated in API 29 but still fires on many Android 10–13 devices.
            Intent.ACTION_NEW_OUTGOING_CALL -> {
                @Suppress("DEPRECATION")
                val number = intent.getStringExtra(Intent.EXTRA_PHONE_NUMBER)
                    ?.trim() ?: return
                if (number.isNotBlank()) {
                    lastOutgoingNumber = number
                    AppLogger.i(context, TAG, "Outgoing → $number")
                }
            }

            // ── Phone state changes ───────────────────────────────────────────
            TelephonyManager.ACTION_PHONE_STATE_CHANGED -> {
                val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return

                // EXTRA_INCOMING_NUMBER: available on ≤ API 28 or if READ_CALL_LOG granted
                @Suppress("DEPRECATION")
                val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)
                    ?.trim() ?: ""

                AppLogger.i(context, TAG, "PHONE_STATE: $state (number='$number', last='$lastCallState')")
                Log.d(TAG, "state=$state  prev=$lastCallState  number=$number")

                when (state) {

                    // ── Incoming call ringing ─────────────────────────────────
                    TelephonyManager.EXTRA_STATE_RINGING -> {
                        lastCallState = STATE_RINGING
                        if (number.isNotBlank()) lastIncomingNumber = number
                        AppLogger.i(context, TAG, "Ringing — incoming from: $lastIncomingNumber")
                    }

                    // ── Call answered / placed ────────────────────────────────
                    TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                        val wasIdle    = lastCallState == STATE_IDLE
                        val wasRinging = lastCallState == STATE_RINGING

                        val (phoneNumber, callType) = when {
                            wasRinging -> {
                                // RINGING → OFFHOOK = incoming call answered
                                val num = lastIncomingNumber
                                    .takeIf { it.isNotBlank() } ?: number
                                AppLogger.i(context, TAG, "Incoming answered: $num")
                                num to "incoming"
                            }
                            wasIdle -> {
                                // IDLE → OFFHOOK = outgoing call placed
                                // Number may come from ACTION_NEW_OUTGOING_CALL (fired earlier)
                                val num = lastOutgoingNumber
                                    .takeIf { it.isNotBlank() } ?: number
                                AppLogger.i(context, TAG, "Outgoing placed: $num")
                                num to "outgoing"
                            }
                            else -> {
                                // Already in OFFHOOK (e.g. call waiting) — ignore
                                AppLogger.i(context, TAG, "OFFHOOK while already off-hook — skipping")
                                return
                            }
                        }

                        lastCallState    = STATE_OFFHOOK
                        lastOutgoingNumber = ""   // consumed

                        CallRecordingService.startRecording(context, phoneNumber, callType)
                    }

                    // ── Call ended ────────────────────────────────────────────
                    TelephonyManager.EXTRA_STATE_IDLE -> {
                        val wasRecording = lastCallState == STATE_OFFHOOK
                        lastCallState      = STATE_IDLE
                        lastIncomingNumber = ""
                        lastOutgoingNumber = ""

                        if (wasRecording) {
                            AppLogger.i(context, TAG, "Call ended — stopping recorder")
                            CallRecordingService.stopRecording(context)
                        } else {
                            AppLogger.i(context, TAG, "IDLE (no active recording to stop)")
                        }
                    }
                }
            }
        }
    }

    // ── Companion (process-level state) ──────────────────────────────────────

    companion object {
        private const val TAG = "CallStateReceiver"

        // State constants — mirrors TelephonyManager EXTRA_STATE strings
        private const val STATE_IDLE    = "IDLE"
        private const val STATE_RINGING = "RINGING"
        private const val STATE_OFFHOOK = "OFFHOOK"

        /**
         * Tracks the previous call state so we can distinguish:
         *   IDLE → OFFHOOK  = outgoing
         *   RINGING → OFFHOOK = incoming
         *
         * Volatile: BroadcastReceiver instances are created fresh per broadcast
         * but share process memory.
         */
        @Volatile private var lastCallState      = STATE_IDLE
        @Volatile private var lastIncomingNumber = ""
        @Volatile private var lastOutgoingNumber = ""
    }
}
