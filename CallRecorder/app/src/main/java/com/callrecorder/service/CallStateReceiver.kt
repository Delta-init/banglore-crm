package com.callrecorder.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.provider.CallLog
import android.telephony.TelephonyManager
import android.util.Log
import com.callrecorder.data.db.AppDatabase
import com.callrecorder.data.db.RecordingEntity
import com.callrecorder.utils.AppLogger
import com.callrecorder.utils.CallLogQueryHelper
import com.callrecorder.utils.ContactHelper
import com.callrecorder.utils.PrefsHelper
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import java.time.Instant


/**
 * ════════════════════════════════════════════════════════════════════
 *  Call State Receiver — CRM sync + recording orchestration
 * ════════════════════════════════════════════════════════════════════
 *
 *  State machine:
 *    IDLE → RINGING → OFFHOOK  =  Incoming call answered
 *    IDLE → OFFHOOK            =  Outgoing call placed
 *    RINGING → IDLE            =  Missed / rejected
 *    OFFHOOK → IDLE            =  Call ended
 *
 *  CRM sync strategy (v1.12):
 *    CRM sync happens here, NOT inside CallRecordingService.
 *    After every call end (answered or missed), we wait 3 s for the OS
 *    to write the system call log entry, then read phone + duration + type
 *    directly from CallLog.Calls. This is 100% reliable regardless of
 *    whether the audio recording succeeded or failed.
 *
 *  CallRecordingService is still started/stopped for audio recording,
 *  but it no longer calls CrmSyncService — it only saves the audio file.
 * ════════════════════════════════════════════════════════════════════
 */
class CallStateReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
        if (!PrefsHelper.isAutoRecordEnabled(context)) return

        when (intent.action) {

            // ── Capture outgoing number before the call connects ──────────────
            Intent.ACTION_NEW_OUTGOING_CALL -> {
                @Suppress("DEPRECATION")
                val number = intent.getStringExtra(Intent.EXTRA_PHONE_NUMBER)?.trim() ?: return
                if (number.isNotBlank()) {
                    lastOutgoingNumber = number
                    AppLogger.i(context, TAG, "Outgoing → $number")
                }
            }

            // ── Phone state changes ───────────────────────────────────────────
            TelephonyManager.ACTION_PHONE_STATE_CHANGED -> {
                val state = intent.getStringExtra(TelephonyManager.EXTRA_STATE) ?: return

                @Suppress("DEPRECATION")
                val number = intent.getStringExtra(TelephonyManager.EXTRA_INCOMING_NUMBER)?.trim() ?: ""

                AppLogger.i(context, TAG, "PHONE_STATE: $state (number='$number', last='$lastCallState')")
                Log.d(TAG, "state=$state  prev=$lastCallState  number=$number")

                when (state) {

                    TelephonyManager.EXTRA_STATE_RINGING -> {
                        lastCallState = STATE_RINGING
                        if (number.isNotBlank()) lastIncomingNumber = number
                        AppLogger.i(context, TAG, "Ringing — incoming from: $lastIncomingNumber")
                    }

                    TelephonyManager.EXTRA_STATE_OFFHOOK -> {
                        val wasIdle    = lastCallState == STATE_IDLE
                        val wasRinging = lastCallState == STATE_RINGING

                        val (phoneNumber, callType) = when {
                            wasRinging -> {
                                val num = lastIncomingNumber.takeIf { it.isNotBlank() } ?: number
                                AppLogger.i(context, TAG, "Incoming answered: $num")
                                num to "incoming"
                            }
                            wasIdle -> {
                                if (CallRecorderInCallService.isActive) {
                                    // InCallService active — it will start the recording service.
                                    // We still track state so IDLE handler can sync CRM.
                                    AppLogger.i(context, TAG,
                                        "Outgoing OFFHOOK — InCallService active, deferring recording to it")
                                    lastCallState    = STATE_OFFHOOK
                                    lastAnsweredPhone = ""        // system call log will resolve it
                                    lastAnsweredType  = "outgoing"
                                    callAnsweredAtMs  = System.currentTimeMillis()
                                    lastOutgoingNumber = ""
                                    return
                                }
                                val num = lastOutgoingNumber.takeIf { it.isNotBlank() }
                                    ?: number.takeIf { it.isNotBlank() }
                                    ?: PrefsHelper.getLastDialedNumber(context)
                                AppLogger.i(context, TAG, "Outgoing placed: $num")
                                num to "outgoing"
                            }
                            else -> {
                                AppLogger.i(context, TAG, "OFFHOOK while already off-hook — skipping")
                                return
                            }
                        }

                        lastCallState     = STATE_OFFHOOK
                        lastAnsweredPhone = phoneNumber
                        lastAnsweredType  = callType
                        callAnsweredAtMs  = System.currentTimeMillis()
                        lastOutgoingNumber = ""   // consumed

                        CallRecordingService.startRecording(context, phoneNumber, callType)
                    }

                    TelephonyManager.EXTRA_STATE_IDLE -> {
                        val wasRinging   = lastCallState == STATE_RINGING
                        val wasRecording = lastCallState == STATE_OFFHOOK

                        // Capture before resetting state
                        val missedPhone  = lastIncomingNumber
                        val answeredPhone = lastAnsweredPhone
                        val answeredType  = lastAnsweredType
                        val answeredAtMs  = if (callAnsweredAtMs > 0L) callAnsweredAtMs
                                            else System.currentTimeMillis()

                        lastCallState      = STATE_IDLE
                        lastIncomingNumber = ""
                        lastOutgoingNumber = ""
                        lastAnsweredPhone  = ""
                        lastAnsweredType   = ""
                        callAnsweredAtMs   = 0L

                        when {
                            wasRecording -> {
                                // Stop recording service — it handles audio file saving only
                                AppLogger.i(context, TAG, "Call ended — stopping recorder")
                                CallRecordingService.stopRecording(context)

                                // CRM sync: always runs from here, independent of recording success.
                                // Wait 3 s for the OS to write the system call log entry.
                                val callDateIso = Instant.ofEpochMilli(answeredAtMs).toString()
                                receiverScope.launch {
                                    delay(3_000L)
                                    val entry = CallLogQueryHelper.getLastCall(
                                        context, withinMs = 120_000L
                                    )
                                    // System call log is authoritative for phone + duration + type.
                                    // Fall back to what we captured at OFFHOOK time if entry is null.
                                    val phone = entry?.number?.takeIf { it.isNotBlank() }
                                        ?: answeredPhone.takeIf { it.isNotBlank() }
                                        ?: ""
                                    val durSecs = entry?.durationSec ?: 0L
                                    val type = when (entry?.type) {
                                        CallLog.Calls.INCOMING_TYPE -> "incoming"
                                        CallLog.Calls.OUTGOING_TYPE -> "outgoing"
                                        CallLog.Calls.MISSED_TYPE   -> "missed"
                                        else -> answeredType.ifBlank { "outgoing" }
                                    }
                                    AppLogger.i(context, TAG,
                                        "CRM sync ($type): phone=$phone dur=${durSecs}s")
                                    CrmSyncService.logCallEvent(
                                        context      = context,
                                        phoneNumber  = phone,
                                        callType     = type,
                                        durationSecs = durSecs,
                                        callDateIso  = callDateIso,
                                    )
                                }
                            }
                            wasRinging -> {
                                // Missed / rejected — no recording service was started
                                AppLogger.i(context, TAG, "Missed call from: $missedPhone")
                                receiverScope.launch {
                                    delay(3_000L)
                                    val entry = CallLogQueryHelper.getLastCall(
                                        context, withinMs = 120_000L
                                    )
                                    val phone = entry?.number?.takeIf { it.isNotBlank() }
                                        ?: missedPhone.takeIf { it.isNotBlank() }
                                        ?: ""
                                    val (synced, syncErr) = CrmSyncService.logCallEvent(
                                        context      = context,
                                        phoneNumber  = phone,
                                        callType     = "missed",
                                        durationSecs = 0L,
                                    )
                                    val contactName = ContactHelper.getContactName(context, phone)
                                    AppDatabase.getInstance(context).recordingDao().insert(
                                        RecordingEntity(
                                            phoneNumber = phone,
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
                            else -> {
                                AppLogger.i(context, TAG, "IDLE (no active call to handle)")
                            }
                        }
                    }
                }
            }
        }
    }

    companion object {
        private const val TAG = "CallStateReceiver"

        private const val STATE_IDLE    = "IDLE"
        private const val STATE_RINGING = "RINGING"
        private const val STATE_OFFHOOK = "OFFHOOK"

        @Volatile private var lastCallState      = STATE_IDLE
        @Volatile private var lastIncomingNumber = ""
        @Volatile private var lastOutgoingNumber = ""

        // Captured at OFFHOOK time; read by the IDLE CRM sync coroutine
        @Volatile private var lastAnsweredPhone  = ""
        @Volatile private var lastAnsweredType   = ""
        @Volatile private var callAnsweredAtMs   = 0L

        private val receiverScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    }
}
