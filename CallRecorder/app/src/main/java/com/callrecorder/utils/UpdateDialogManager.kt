package com.callrecorder.utils

import android.app.Activity
import android.content.Intent
import android.net.Uri
import android.view.LayoutInflater
import android.widget.TextView
import com.callrecorder.R
import com.google.android.material.dialog.MaterialAlertDialogBuilder

/**
 * ════════════════════════════════════════════════════════════════════
 *  UpdateDialogManager — shows the "New version available" popup
 * ════════════════════════════════════════════════════════════════════
 *
 *  Design:
 *   ┌──────────────────────────────────────┐
 *   │  🔄  Update Available                │
 *   │  Version 1.1  •  2026-06-03          │
 *   │                                      │
 *   │  What's new:                         │
 *   │  • Better recording quality          │
 *   │  • CRM sync improvements             │
 *   │                                      │
 *   │            [Later]  [Update Now]     │
 *   └──────────────────────────────────────┘
 *
 *  Force update:  "Later" is hidden; dialog is not cancelable.
 *
 *  "Update Now" → opens the APK download URL in the browser.
 *    The user taps Install once the download finishes.
 *    (Full in-app PackageInstaller flow requires a FileProvider
 *     and extra permissions — browser download is simpler and
 *     works on all devices.)
 * ════════════════════════════════════════════════════════════════════
 */
object UpdateDialogManager {

    fun show(activity: Activity, update: AppUpdateChecker.UpdateInfo) {
        if (activity.isFinishing || activity.isDestroyed) return

        // Inflate custom body view (version + changelog)
        val view = LayoutInflater.from(activity)
            .inflate(R.layout.dialog_update, null)

        view.findViewById<TextView>(R.id.tvUpdateVersion).text =
            "Version ${update.versionName}  •  ${update.releaseDate}"

        view.findViewById<TextView>(R.id.tvUpdateChangelog).text =
            update.changelog.ifBlank { "Bug fixes and performance improvements." }

        val dialog = MaterialAlertDialogBuilder(activity)
            .setTitle("🔄  Update Available")
            .setView(view)
            .setCancelable(!update.forceUpdate)  // can't dismiss by back-tap if forced
            .setPositiveButton("Update Now") { _, _ ->
                openDownloadUrl(activity, update.downloadUrl)
            }
            .apply {
                if (!update.forceUpdate) {
                    setNegativeButton("Later", null)
                }
            }
            .create()

        dialog.show()
    }

    private fun openDownloadUrl(activity: Activity, url: String) {
        if (url.isBlank()) return
        try {
            activity.startActivity(
                Intent(Intent.ACTION_VIEW, Uri.parse(url)).apply {
                    addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
                }
            )
        } catch (e: Exception) {
            AppLogger.e(activity, "UpdateDialog", "Failed to open download URL: ${e.message}")
        }
    }
}
