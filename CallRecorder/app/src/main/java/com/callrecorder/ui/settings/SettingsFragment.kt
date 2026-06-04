package com.callrecorder.ui.settings

import android.app.role.RoleManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.provider.Settings
import android.telecom.TelecomManager
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.viewModels
import androidx.lifecycle.lifecycleScope
import androidx.navigation.fragment.findNavController
import androidx.preference.Preference
import androidx.preference.PreferenceFragmentCompat
import androidx.preference.SwitchPreferenceCompat
import android.net.Uri
import android.text.InputType
import android.widget.EditText
import android.widget.LinearLayout
import com.callrecorder.R
import com.callrecorder.service.RecordingOverlayManager
import com.callrecorder.ui.recordings.RecordingsViewModel
import com.callrecorder.utils.AppLogger
import com.callrecorder.utils.AppUpdateChecker
import com.callrecorder.utils.PrefsHelper
import com.callrecorder.utils.UpdateDialogManager
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar
import kotlinx.coroutines.launch

class SettingsFragment : PreferenceFragmentCompat() {

    private val recordingsViewModel: RecordingsViewModel by viewModels()

    private val defaultDialerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { updateDefaultDialerPref() }

    override fun onCreatePreferences(savedInstanceState: Bundle?, rootKey: String?) {
        setPreferencesFromResource(R.xml.preferences, rootKey)
        setupPreferences()
    }

    override fun onResume() {
        super.onResume()
        updateDefaultDialerPref()
        // Refresh overlay permission summary when returning from system settings
        findPreference<Preference>("grant_overlay_permission")?.let { updateOverlaySummary(it) }
    }

    private fun updateOverlaySummary(pref: Preference) {
        pref.summary = if (RecordingOverlayManager.canShow(requireContext()))
            "✅ Permission granted — badge will appear during calls"
        else
            "Tap to grant — required to show the recording badge over other apps"
    }

    /** Opens the system overlay permission page directly — no manufacturer blocking. */
    private fun openOverlaySettings() {
        try {
            startActivity(
                Intent(
                    Settings.ACTION_MANAGE_OVERLAY_PERMISSION,
                    Uri.parse("package:${requireContext().packageName}")
                )
            )
        } catch (e: Exception) {
            // Fallback: open app's full permission page
            try {
                startActivity(
                    Intent(Settings.ACTION_APPLICATION_DETAILS_SETTINGS).apply {
                        data = Uri.parse("package:${requireContext().packageName}")
                    }
                )
            } catch (e2: Exception) {
                snack("Go to Settings → Apps → Call Recorder → Permissions → Display over other apps")
            }
        }
    }

    private fun setupPreferences() {

        // ── Auto-record ────────────────────────────────────────────────────
        findPreference<SwitchPreferenceCompat>("auto_record_enabled")?.apply {
            isChecked = PrefsHelper.isAutoRecordEnabled(requireContext())
            setOnPreferenceChangeListener { _, newValue ->
                PrefsHelper.setAutoRecordEnabled(requireContext(), newValue as Boolean)
                true
            }
        }

        // ── Speaker mode ───────────────────────────────────────────────────
        findPreference<SwitchPreferenceCompat>("force_speaker_mode")?.apply {
            isChecked = PrefsHelper.forceSpeakerMode(requireContext())
            setOnPreferenceChangeListener { _, newValue ->
                val enabled = newValue as Boolean
                if (enabled) {
                    MaterialAlertDialogBuilder(requireContext())
                        .setTitle("Force Speaker Mode")
                        .setMessage(
                            "✅ Captures BOTH sides on ALL Android versions.\n\n" +
                            "⚠️ The other person's voice will be audible from your speaker. " +
                            "Use in a private location."
                        )
                        .setPositiveButton("Enable") { _, _ ->
                            PrefsHelper.setForceSpeakerMode(requireContext(), true)
                            isChecked = true
                        }
                        .setNegativeButton("Cancel") { _, _ -> isChecked = false }
                        .show()
                    false
                } else {
                    PrefsHelper.setForceSpeakerMode(requireContext(), false)
                    true
                }
            }
        }

        // ── Grant Companion Access ─────────────────────────────────────────
        findPreference<Preference>("grant_companion_access")?.setOnPreferenceClickListener {
            openCompanionAccess()
            true
        }

        // ── Set as Default Dialer ──────────────────────────────────────────
        findPreference<Preference>("set_default_dialer")?.setOnPreferenceClickListener {
            if (isCurrentDefaultDialer()) {
                snack("✅ Already the default dialer — InCallService is active")
            } else {
                promptSetDefaultDialer()
            }
            true
        }

        // ── Restore system phone app ───────────────────────────────────────
        findPreference<Preference>("restore_default_dialer")?.setOnPreferenceClickListener {
            restoreSystemDialer()
            true
        }

        // ── View logs ─────────────────────────────────────────────────────
        findPreference<Preference>("view_logs")?.setOnPreferenceClickListener {
            findNavController().navigate(R.id.action_settingsFragment_to_logsFragment)
            true
        }

        // ── Clear logs ────────────────────────────────────────────────────
        findPreference<Preference>("clear_logs")?.setOnPreferenceClickListener {
            AppLogger.clear(requireContext())
            snack("Logs cleared")
            true
        }

        // ── Clear all recordings ───────────────────────────────────────────
        findPreference<Preference>("clear_all_recordings")?.setOnPreferenceClickListener {
            AlertDialog.Builder(requireContext())
                .setTitle("Clear All Recordings")
                .setMessage("Permanently delete all recordings and audio files?")
                .setPositiveButton("Delete All") { _, _ -> recordingsViewModel.deleteAll() }
                .setNegativeButton("Cancel", null)
                .show()
            true
        }

        // ── Recording overlay ──────────────────────────────────────────────
        findPreference<SwitchPreferenceCompat>("show_recording_overlay")?.apply {
            isChecked = PrefsHelper.isShowOverlay(requireContext())
            setOnPreferenceChangeListener { _, newValue ->
                PrefsHelper.setShowOverlay(requireContext(), newValue as Boolean)
                true
            }
        }

        findPreference<Preference>("grant_overlay_permission")?.apply {
            updateOverlaySummary(this)
            setOnPreferenceClickListener {
                if (!RecordingOverlayManager.canShow(requireContext())) {
                    openOverlaySettings()
                } else {
                    snack("✅ Overlay permission already granted")
                }
                true
            }
        }

        // ── CRM Sync ───────────────────────────────────────────────────────
        setupCrmPref(
            key       = PrefsHelper.KEY_CRM_BASE_URL,
            title     = "CRM API URL",
            hint      = "https://api-crm-banglore.deltainstitutions.com",
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_URI,
            maskValue = false,
            getter    = { PrefsHelper.getCrmBaseUrl(requireContext()) },
            setter    = { v -> PrefsHelper.setCrmBaseUrl(requireContext(), v) },
        )
        setupCrmPref(
            key       = PrefsHelper.KEY_CRM_API_KEY,
            title     = "CRM API Key",
            hint      = "Paste the key from CRM admin",
            inputType = InputType.TYPE_CLASS_TEXT or InputType.TYPE_TEXT_VARIATION_PASSWORD,
            maskValue = true,
            getter    = { PrefsHelper.getCrmApiKey(requireContext()) },
            setter    = { v -> PrefsHelper.setCrmApiKey(requireContext(), v) },
        )
        setupCrmPref(
            key       = PrefsHelper.KEY_AGENT_EXTENSION,
            title     = "My Extension",
            hint      = "e.g. 416",
            inputType = InputType.TYPE_CLASS_NUMBER,
            maskValue = false,
            getter    = { PrefsHelper.getAgentExtension(requireContext()) },
            setter    = { v -> PrefsHelper.setAgentExtension(requireContext(), v) },
        )

        // ── Check for update ───────────────────────────────────────────────
        findPreference<Preference>("check_for_update")?.setOnPreferenceClickListener {
            val apiKey = PrefsHelper.getCrmApiKey(requireContext()).trim()
            val baseUrl = PrefsHelper.getCrmBaseUrl(requireContext()).trim()

            if (apiKey.isBlank() || baseUrl.isBlank()) {
                MaterialAlertDialogBuilder(requireContext())
                    .setTitle("CRM Not Configured")
                    .setMessage(
                        "To check for updates you need to configure CRM Sync first.\n\n" +
                        "Go to Settings → CRM Sync and enter:\n" +
                        "• CRM API URL\n" +
                        "• CRM API Key\n\n" +
                        "Ask your admin for these values."
                    )
                    .setPositiveButton("OK", null)
                    .show()
                return@setOnPreferenceClickListener true
            }

            snack("Checking for updates…")
            viewLifecycleOwner.lifecycleScope.launch {
                val update = AppUpdateChecker.check(requireContext())
                if (update != null) {
                    UpdateDialogManager.show(requireActivity(), update)
                } else {
                    snack("✅ You're on the latest version (v${getInstalledVersionName()})")
                }
            }
            true
        }
    }

    private fun getInstalledVersionName(): String = try {
        requireContext().packageManager
            .getPackageInfo(requireContext().packageName, 0).versionName ?: "?"
    } catch (e: Exception) { "?" }

    // ── CRM preference helper — shows an input dialog, saves to PrefsHelper ──

    private fun setupCrmPref(
        key:       String,
        title:     String,
        hint:      String,
        inputType: Int,
        maskValue: Boolean,
        getter:    () -> String,
        setter:    (String) -> Unit,
    ) {
        val pref = findPreference<Preference>(key) ?: return
        fun refreshSummary() {
            val v = getter()
            pref.summary = when {
                v.isBlank()  -> "Not configured — tap to set"
                maskValue    -> "••••••••  (tap to change)"
                else         -> v
            }
        }
        refreshSummary()

        pref.setOnPreferenceClickListener {
            val input = EditText(requireContext()).apply {
                this.hint      = hint
                this.inputType = inputType
                setText(getter())
                setSingleLine(true)
            }
            val container = LinearLayout(requireContext()).apply {
                orientation = LinearLayout.VERTICAL
                val pad = (16 * resources.displayMetrics.density).toInt()
                setPadding(pad, 0, pad, 0)
                addView(input)
            }

            MaterialAlertDialogBuilder(requireContext())
                .setTitle(title)
                .setView(container)
                .setPositiveButton("Save") { _, _ ->
                    val value = input.text.toString().trim()
                    setter(value)
                    refreshSummary()
                    snack("$title saved ✅")
                }
                .setNegativeButton("Cancel", null)
                .show()

            // Focus + show keyboard
            input.requestFocus()
            true
        }
    }

    // ── Companion access ──────────────────────────────────────────────────────

    private fun openCompanionAccess() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
            // Android 10+: use RoleManager for CALL_COMPANION role
            try {
                val roleManager = requireContext().getSystemService(RoleManager::class.java)
                val intent = roleManager?.createRequestRoleIntent("android.app.role.CALL_COMPANION")
                if (intent != null) {
                    defaultDialerLauncher.launch(intent)
                    return
                }
            } catch (e: Exception) { /* fall through */ }
        }

        // Fallback: open Special App Access settings
        try {
            startActivity(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
        } catch (e: Exception) {
            snack(
                "Go to Settings → Apps → Special App Access → Make and Manage Calls → " +
                "select Call Recorder"
            )
        }
    }

    // ── Default dialer ────────────────────────────────────────────────────────

    private fun promptSetDefaultDialer() {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Set as Default Dialer")
            .setMessage(
                "This gives the best recording access.\n\n" +
                "⚠️ This app will handle your incoming call screen (Answer / Decline buttons). " +
                "If it doesn't work properly, use 'Switch Back to System Phone App' in Settings."
            )
            .setPositiveButton("Continue") { _, _ -> launchSetDefaultDialer() }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun launchSetDefaultDialer() {
        try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val roleManager = requireContext().getSystemService(RoleManager::class.java)
                roleManager?.createRequestRoleIntent(RoleManager.ROLE_DIALER)
            } else {
                Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER).apply {
                    putExtra(
                        TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME,
                        requireContext().packageName
                    )
                }
            }
            if (intent != null) defaultDialerLauncher.launch(intent)
        } catch (e: Exception) {
            snack("Could not open dialer settings. Go to Settings → Apps → Default phone app.")
        }
    }

    private fun restoreSystemDialer() {
        MaterialAlertDialogBuilder(requireContext())
            .setTitle("Switch Back to System Phone App")
            .setMessage(
                "This will open Default App Settings where you can select your original phone app " +
                "(usually 'Phone' or 'Dialer').\n\n" +
                "After switching back, this app will still record calls via the microphone — " +
                "you just won't use it as your dialer."
            )
            .setPositiveButton("Open Settings") { _, _ ->
                try {
                    if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                        val roleManager = requireContext().getSystemService(RoleManager::class.java)
                        val intent = roleManager?.createRequestRoleIntent(RoleManager.ROLE_DIALER)
                        if (intent != null) { startActivity(intent); return@setPositiveButton }
                    }
                    startActivity(Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER))
                } catch (e: Exception) {
                    startActivity(Intent(Settings.ACTION_MANAGE_DEFAULT_APPS_SETTINGS))
                }
            }
            .setNegativeButton("Cancel", null)
            .show()
    }

    private fun isCurrentDefaultDialer(): Boolean = try {
        val tm = requireContext().getSystemService(TelecomManager::class.java)
        tm?.defaultDialerPackage == requireContext().packageName
    } catch (e: Exception) { false }

    private fun updateDefaultDialerPref() {
        findPreference<Preference>("set_default_dialer")?.summary =
            if (isCurrentDefaultDialer())
                "✅ Currently the default dialer — InCallService active"
            else
                "Alternative to Companion Access. Gives deepest audio access. Requires this app to handle your incoming call screen."

        findPreference<Preference>("restore_default_dialer")?.isVisible = isCurrentDefaultDialer()
    }

    private fun snack(msg: String) =
        Snackbar.make(requireView(), msg, Snackbar.LENGTH_LONG).show()
}
