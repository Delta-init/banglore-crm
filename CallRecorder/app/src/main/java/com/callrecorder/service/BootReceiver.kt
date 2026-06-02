package com.callrecorder.service

import android.content.BroadcastReceiver
import android.content.Context
import android.content.Intent
import android.util.Log

/**
 * Receives BOOT_COMPLETED to ensure the app is ready to record calls
 * after the device restarts. No action needed beyond confirming the
 * receiver is registered — the CallStateReceiver is manifest-declared
 * and fires automatically for any incoming call.
 */
class BootReceiver : BroadcastReceiver() {
    override fun onReceive(context: Context, intent: Intent) {
        if (intent.action == Intent.ACTION_BOOT_COMPLETED ||
            intent.action == "android.intent.action.QUICKBOOT_POWERON"
        ) {
            Log.i("BootReceiver", "Device booted — call recording ready")
            // CallStateReceiver is manifest-declared, so it will fire automatically.
            // Nothing else to do here unless you need to restart a persistent service.
        }
    }
}
