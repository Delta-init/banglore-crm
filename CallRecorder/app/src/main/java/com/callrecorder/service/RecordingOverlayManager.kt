package com.callrecorder.service

import android.animation.ObjectAnimator
import android.content.Context
import android.content.Intent
import android.graphics.PixelFormat
import android.os.Build
import android.os.Handler
import android.os.Looper
import android.provider.Settings
import android.view.Gravity
import android.view.LayoutInflater
import android.view.View
import android.view.WindowManager
import android.widget.TextView
import com.callrecorder.R
import com.callrecorder.ui.MainActivity
import com.callrecorder.utils.AppLogger
import com.callrecorder.utils.PrefsHelper

/**
 * ════════════════════════════════════════════════════════════════════
 *  RecordingOverlayManager — Truecaller-style floating badge
 * ════════════════════════════════════════════════════════════════════
 *
 *  Shows a small pill overlay ("🔴 REC  Contact Name") over all apps
 *  while a call is being recorded. Requires SYSTEM_ALERT_WINDOW.
 *
 *  Usage:
 *    RecordingOverlayManager.show(context, phone, contactName)  ← call started
 *    RecordingOverlayManager.update(context, phone, contactName) ← contact name resolved
 *    RecordingOverlayManager.hide()                              ← call ended
 * ════════════════════════════════════════════════════════════════════
 */
object RecordingOverlayManager {

    private const val TAG = "OverlayManager"

    private var overlayView:    View?          = null
    private var windowManager:  WindowManager? = null
    private var pulseAnimator:  ObjectAnimator? = null
    private val mainHandler = Handler(Looper.getMainLooper())

    // ── Permission check ──────────────────────────────────────────────────────

    fun canShow(context: Context): Boolean =
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.M)
            Settings.canDrawOverlays(context)
        else true

    // ── Show ──────────────────────────────────────────────────────────────────

    fun show(context: Context, phone: String, contactName: String?) {
        if (!PrefsHelper.isShowOverlay(context)) return
        if (!canShow(context)) {
            AppLogger.w(context, TAG, "SYSTEM_ALERT_WINDOW not granted — overlay skipped")
            return
        }

        mainHandler.post {
            // If already visible, just update text
            if (overlayView != null) {
                updateLabel(phone, contactName)
                return@post
            }

            try {
                val appCtx = context.applicationContext
                val wm = appCtx.getSystemService(Context.WINDOW_SERVICE) as WindowManager
                windowManager = wm

                val view = LayoutInflater.from(appCtx).inflate(R.layout.overlay_recording, null)
                overlayView = view

                // Tap → open app
                view.setOnClickListener {
                    appCtx.startActivity(
                        Intent(appCtx, MainActivity::class.java).apply {
                            addFlags(Intent.FLAG_ACTIVITY_NEW_TASK or Intent.FLAG_ACTIVITY_SINGLE_TOP)
                        }
                    )
                }

                updateLabel(phone, contactName)
                startPulse(view.findViewById(R.id.recDot))

                val params = WindowManager.LayoutParams(
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    WindowManager.LayoutParams.WRAP_CONTENT,
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O)
                        WindowManager.LayoutParams.TYPE_APPLICATION_OVERLAY
                    else
                        @Suppress("DEPRECATION") WindowManager.LayoutParams.TYPE_PHONE,
                    WindowManager.LayoutParams.FLAG_NOT_FOCUSABLE or
                    WindowManager.LayoutParams.FLAG_NOT_TOUCH_MODAL,
                    PixelFormat.TRANSLUCENT,
                ).apply {
                    // Top-centre — clearly visible above all apps like Android's
                    // screen-recording indicator
                    gravity = Gravity.TOP or Gravity.CENTER_HORIZONTAL
                    x = 0
                    y = 72
                }

                wm.addView(view, params)
                AppLogger.i(context, TAG, "Overlay shown: ${contactName ?: phone}")
            } catch (e: Exception) {
                AppLogger.e(context, TAG, "Failed to show overlay: ${e.message}")
                overlayView = null
                windowManager = null
            }
        }
    }

    // ── Update label (after async contact name lookup) ────────────────────────

    fun update(context: Context, phone: String, contactName: String?) {
        if (!PrefsHelper.isShowOverlay(context)) return
        mainHandler.post { updateLabel(phone, contactName) }
    }

    // ── Hide ──────────────────────────────────────────────────────────────────

    fun hide() {
        mainHandler.post {
            pulseAnimator?.cancel()
            pulseAnimator = null
            try {
                overlayView?.let { windowManager?.removeView(it) }
            } catch (_: Exception) {}
            overlayView    = null
            windowManager  = null
        }
    }

    // ── Helpers ───────────────────────────────────────────────────────────────

    private fun updateLabel(phone: String, contactName: String?) {
        val label = contactName?.takeIf { it.isNotBlank() }
            ?: phone.ifBlank { "Unknown" }
        overlayView?.findViewById<TextView>(R.id.tvOverlayContact)?.text = "  $label"
    }

    private fun startPulse(dot: View) {
        pulseAnimator = ObjectAnimator.ofFloat(dot, "alpha", 1f, 0.15f, 1f).apply {
            duration       = 1200
            repeatCount    = ObjectAnimator.INFINITE
            start()
        }
    }
}
