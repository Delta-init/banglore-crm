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
import kotlinx.coroutines.launch
import kotlinx.coroutines.delay
import java.time.Instant


/**
 * ════════════════════════════════════════════════════════════════════
 *  Call State Receiver — CRM sync + recording orchestration
 * ════════════════════════════════════════════════════════════════════
 *
 *  CRM sync strategy (v1.13):
 *    Every answered/missed call → wait 1.5 s → read system call log
 *    (phone + duration + type) → POST to CRM. Fully independent of
 *    audio recording success.
 *
 *  Process lifetime:
 *    goAsync() extends the BroadcastReceiver window so Android does not
 *    kill the process while the coroutine is pending.
 *
 *  RecordingEntity back-fill:
 *    After CRM sync succeeds, the most recent RecordingEntity is updated
 *    so the Recent Calls tab badge shows ✅ instead of "Not Synced".
 * ════════════════════════════════════════════════════════════════════
 */
class CallStateReceiver : BroadcastReceiver() {

    override fun onReceive(context: Context, intent: Intent) {
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
                                    // Preserve the dialed number NOW before clearing lastOutgoingNumber,
                                    // so the IDLE branch CRM sync has a phone number to work with.
                                    val num = lastOutgoingNumber.takeIf { it.isNotBlank() }
                                        ?: number.takeIf { it.isNotBlank() }
                                        ?: PrefsHelper.getLastDialedNumber(context)
                                    AppLogger.i(context, TAG,
                                        "Outgoing OFFHOOK — InCallService active, deferring recording to it ($num)")
                                    lastCallState    = STATE_OFFHOOK
                                    lastAnsweredPhone = num      // saved for the IDLE CRM sync
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
                        lastOutgoingNumber = ""

                        CallRecordingService.startRecording(context, phoneNumber, callType)
                    }

                    TelephonyManager.EXTRA_STATE_IDLE -> {
                        val wasRinging   = lastCallState == STATE_RINGING
                        val wasRecording = lastCallState == STATE_OFFHOOK

                        val missedPhone   = lastIncomingNumber
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
                                AppLogger.i(context, TAG, "Call ended — stopping recorder, syncing CRM")
                                CallRecordingService.stopRecording(context)

                                // goAsync() tells Android the receiver is still doing work —
                                // process is kept alive until pendingResult.finish() is called.
                                val pendingResult = goAsync()
                                val callDateIso = Instant.ofEpochMilli(answeredAtMs).toString()

                                receiverScope.launch {
                                    try {
                                        // 1 s: give system call log time to be written
                                        delay(1_000L)

                                        val entry = CallLogQueryHelper.getLastCall(
                                            context, withinMs = 120_000L
                                        )
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

                                        val db = AppDatabase.getInstance(context)

                                        // HTTP call (7 s timeout) — RecordingService is saving the
                                        // audio file concurrently. By the time this returns (~1–7 s)
                                        // the RecordingEntity is guaranteed to be in the DB.
                                        val (synced, crmCallLogId, syncErr) = CrmSyncService.logCallEvent(
                                            context         = context,
                                            phoneNumber     = phone,
                                            callType        = type,
                                            durationSecs    = durSecs,
                                            callDateIso     = callDateIso,
                                            systemCallLogId = entry?.id,
                                        )

                                        // Back-fill RecordingEntity now that HTTP is done.
                                        // Use -2 s window to avoid matching the previous call.
                                        // One 300 ms retry covers any slow file-write edge cases.
                                        var record = db.recordingDao()
                                            .getMostRecentAfter(answeredAtMs - 2_000L)
                                        if (record == null) {
                                            delay(300L)
                                            record = db.recordingDao()
                                                .getMostRecentAfter(answeredAtMs - 2_000L)
                                        }

                                        if (record != null) {
                                            db.recordingDao().updateSyncResult(
                                                id              = record.id,
                                                synced          = synced,
                                                error           = if (synced) null else syncErr,
                                                crmCallLogId    = crmCallLogId,
                                                systemCallLogId = entry?.id,
                                            )
                                            AppLogger.i(context, TAG,
                                                "Back-filled RecordingEntity #${record.id} — synced=$synced")
                                        } else {
                                            // RecordingService didn't create an entity (e.g. call too
                                            // short, service not started). Create one now so the
                                            // Recent Calls tab shows the correct sync badge.
                                            AppLogger.w(context, TAG,
                                                "No RecordingEntity found — creating fallback for $phone")
                                            val contactName = ContactHelper.getContactName(context, phone)
                                            db.recordingDao().insert(
                                                RecordingEntity(
                                                    phoneNumber     = phone,
                                                    contactName     = contactName,
                                                    filePath        = "",
                                                    duration        = durSecs * 1_000L,
                                                    fileSize        = 0L,
                                                    callType        = type,
                                                    crmSynced       = synced,
                                                    syncError       = if (synced) null else syncErr,
                                                    createdAt       = answeredAtMs,
                                                    systemCallLogId = entry?.id,
                                                    crmCallLogId    = crmCallLogId,
                                                )
                                            )
                                        }
                                    } finally {
                                        pendingResult.finish()
                                    }
                                }
                            }
                            wasRinging -> {
                                AppLogger.i(context, TAG, "Missed call from: $missedPhone")

                                val pendingResult = goAsync()
                                receiverScope.launch {
                                    try {
                                        delay(1_500L)
                                        val entry = CallLogQueryHelper.getLastCall(
                                            context, withinMs = 120_000L
                                        )
                                        val phone = entry?.number?.takeIf { it.isNotBlank() }
                                            ?: missedPhone.takeIf { it.isNotBlank() }
                                            ?: ""
                                        // Use the actual call time from the system log so the
                                        // CRM records when the call happened, not when we synced.
                                        val callDateIso = if (entry != null)
                                            Instant.ofEpochMilli(entry.date).toString()
                                        else
                                            Instant.now().toString()
                                        val (synced, crmCallLogId, syncErr) = CrmSyncService.logCallEvent(
                                            context         = context,
                                            phoneNumber     = phone,
                                            callType        = "missed",
                                            durationSecs    = 0L,
                                            callDateIso     = callDateIso,
                                            systemCallLogId = entry?.id,
                                        )
                                        val contactName = ContactHelper.getContactName(context, phone)
                                        AppDatabase.getInstance(context).recordingDao().insert(
                                            RecordingEntity(
                                                phoneNumber     = phone,
                                                contactName     = contactName,
                                                filePath        = "",
                                                duration        = 0L,
                                                fileSize        = 0L,
                                                callType        = "missed",
                                                crmSynced       = synced,
                                                syncError       = if (synced) null else syncErr,
                                                createdAt       = System.currentTimeMillis(),
                                                systemCallLogId = entry?.id,
                                                crmCallLogId    = crmCallLogId,
                                            )
                                        )
                                    } finally {
                                        pendingResult.finish()
                                    }
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

        // Captured at OFFHOOK; read by the IDLE CRM sync coroutine
        @Volatile private var lastAnsweredPhone  = ""
        @Volatile private var lastAnsweredType   = ""
        @Volatile private var callAnsweredAtMs   = 0L

        private val receiverScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)
    }
}
