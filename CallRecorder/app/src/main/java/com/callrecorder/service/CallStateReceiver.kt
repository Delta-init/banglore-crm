package com.callrecorder.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.telephony.TelephonyManager
import android.util.Log
import com.callrecorder.data.db.AppDatabase
import com.callrecorder.data.db.RecordingEntity
import com.callrecorder.utils.AppLogger
import com.callrecorder.utils.ContactHelper
import com.callrecorder.utils.PrefsHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.launch


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
                                // IDLE → OFFHOOK = outgoing call placed.
                                //
                                // If InCallService is active (companion or default dialer mode),
                                // let it handle the recording — it has the real phone number
                                // from call.details.handle and fires at STATE_ACTIVE (answered).
                                // CallStateReceiver fires at OFFHOOK (dialling) which on Android
                                // 10+ has no reliable phone number because ACTION_NEW_OUTGOING_CALL
                                // is deprecated. Starting here would record with a blank number.
                                if (CallRecorderInCallService.isActive) {
                                    AppLogger.i(context, TAG,
                                        "Outgoing OFFHOOK — InCallService active, deferring to it")
                                    lastCallState = STATE_OFFHOOK
                                    lastOutgoingNumber = ""
                                    return
                                }

                                // On Android 10+, ACTION_NEW_OUTGOING_CALL is deprecated and may
                                // not fire — fall back to the number saved by DialerFragment.
                                val num = lastOutgoingNumber.takeIf { it.isNotBlank() }
                                    ?: number.takeIf { it.isNotBlank() }
                                    ?: PrefsHelper.getLastDialedNumber(context)
                                AppLogger.i(context, TAG, "Outgoing placed (legacy path): $num")
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
                        val wasRinging   = lastCallState == STATE_RINGING
                        val wasRecording = lastCallState == STATE_OFFHOOK

                        // Capture phone before resetting state
                        val missedPhone = lastIncomingNumber

                        lastCallState      = STATE_IDLE
                        lastIncomingNumber = ""
                        lastOutgoingNumber = ""

                        when {
                            wasRecording -> {
                                // Connected call ended normally — stop recorder (CRM log handled inside)
                                AppLogger.i(context, TAG, "Call ended — stopping recorder")
                                CallRecordingService.stopRecording(context)
                            }
                            wasRinging -> {
                                // RINGING → IDLE = missed / rejected incoming call
                                AppLogger.i(context, TAG, "Missed call from: $missedPhone — logging to CRM")
                                if (missedPhone.isNotBlank()) {
                                    receiverScope.launch {
                                        val (synced, syncErr) = CrmSyncService.logCallEvent(
                                            context      = context,
                                            phoneNumber  = missedPhone,
                                            callType     = "missed",
                                            durationSecs = 0L,
                                        )
                                        // Save tombstone so Recent Calls badge shows CRM result
                                        val contactName = ContactHelper.getContactName(context, missedPhone)
                                        AppDatabase.getInstance(context).recordingDao().insert(
                                            RecordingEntity(
                                                phoneNumber = missedPhone,
                                                contactName = contactName,
                                                filePath    = "",
                                                duration    = 0L,
                                                fileSize    = 0L,
                                                callType    = "missed",
                                                crmSynced   = synced,
                                                syncError   = syncErr,
                                                createdAt   = System.currentTimeMillis(),
                                            )
                                        )
                                    }
                                }
                            }
                            else -> {
                                AppLogger.i(context, TAG, "IDLE (no active recording to stop)")
                            }
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
         *   IDLE → OFFHOOK      = outgoing call placed
         *   RINGING → OFFHOOK   = incoming call answered
         *   RINGING → IDLE      = missed / rejected
         *
         * Volatile: BroadcastReceiver instances are created fresh per broadcast
         * but share process memory.
         */
        @Volatile private var lastCallState      = STATE_IDLE
        @Volatile private var lastIncomingNumber = ""
        @Volatile private var lastOutgoingNumber = ""

        // Coroutine scope for CRM log calls from the receiver (no lifecycle host)
        private val receiverScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    }
}
