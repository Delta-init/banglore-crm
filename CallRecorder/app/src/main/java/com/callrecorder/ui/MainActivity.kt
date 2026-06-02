package com.callrecorder.ui

import android.app.role.RoleManager
import android.content.Intent
import android.os.Build
import android.os.Bundle
import android.telecom.TelecomManager
import androidx.activity.result.contract.ActivityResultContracts
import androidx.appcompat.app.AppCompatActivity
import androidx.navigation.NavController
import androidx.navigation.fragment.NavHostFragment
import androidx.navigation.ui.setupWithNavController
import com.callrecorder.R
import com.callrecorder.databinding.ActivityMainBinding
import com.callrecorder.utils.PermissionHelper
import com.google.android.material.dialog.MaterialAlertDialogBuilder
import com.google.android.material.snackbar.Snackbar

class MainActivity : AppCompatActivity() {

    private lateinit var binding: ActivityMainBinding
    private lateinit var navController: NavController

    private val permissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestMultiplePermissions()
    ) { results ->
        val allGranted = results.values.all { it }
        if (!allGranted) showPermissionRationale()
        else suggestDefaultDialerIfNeeded()
    }

    private val defaultDialerLauncher = registerForActivityResult(
        ActivityResultContracts.StartActivityForResult()
    ) { /* user made a choice — no action needed, service auto-activates */ }

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityMainBinding.inflate(layoutInflater)
        setContentView(binding.root)
        setupNavigation()
        checkPermissions()
    }

    private fun setupNavigation() {
        val navHost = supportFragmentManager
            .findFragmentById(R.id.nav_host_fragment) as NavHostFragment
        navController = navHost.navController
        binding.bottomNavigation.setupWithNavController(navController)
    }

    private fun checkPermissions() {
        val missing = PermissionHelper.getMissingPermissions(this)
        if (missing.isNotEmpty()) {
            permissionLauncher.launch(missing)
        } else {
            suggestDefaultDialerIfNeeded()
        }
    }

    /**
     * On first launch, suggest setting the app as default dialer.
     * This is optional but enables Layer 3 (InCallService) recording — best quality.
     * Only shown once; skipped if already default.
     */
    private fun suggestDefaultDialerIfNeeded() {
        if (isCurrentDefaultDialer()) return
        if (hasShownDefaultDialerPrompt()) return

        markDefaultDialerPromptShown()

        MaterialAlertDialogBuilder(this)
            .setTitle("Upgrade to Both-Sides Recording?")
            .setMessage(
                "For the best recording quality (capturing BOTH sides of every call), " +
                "set Call Recorder as your default Phone app.\n\n" +
                "• This gives deeper audio access via Android's InCallService\n" +
                "• You can switch back to your original phone app at any time\n\n" +
                "Even without this, the app records calls automatically.\n" +
                "You can also enable this later in Settings."
            )
            .setPositiveButton("Set as Default") { _, _ -> promptSetDefaultDialer() }
            .setNegativeButton("Skip for Now", null)
            .show()
    }

    private fun promptSetDefaultDialer() {
        try {
            val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.Q) {
                val roleManager = getSystemService(RoleManager::class.java)
                roleManager?.createRequestRoleIntent(RoleManager.ROLE_DIALER)
            } else {
                Intent(TelecomManager.ACTION_CHANGE_DEFAULT_DIALER).apply {
                    putExtra(
                        TelecomManager.EXTRA_CHANGE_DEFAULT_DIALER_PACKAGE_NAME,
                        packageName
                    )
                }
            }
            if (intent != null) defaultDialerLauncher.launch(intent)
        } catch (e: Exception) {
            Snackbar.make(
                binding.root,
                "Go to Settings → Apps → Default Apps → Phone App to set this manually.",
                Snackbar.LENGTH_LONG
            ).show()
        }
    }

    private fun isCurrentDefaultDialer(): Boolean {
        return try {
            val tm = getSystemService(TelecomManager::class.java)
            tm?.defaultDialerPackage == packageName
        } catch (e: Exception) { false }
    }

    private fun hasShownDefaultDialerPrompt(): Boolean =
        getPreferences(MODE_PRIVATE).getBoolean("shown_dialer_prompt", false)

    private fun markDefaultDialerPromptShown() =
        getPreferences(MODE_PRIVATE).edit().putBoolean("shown_dialer_prompt", true).apply()

    private fun showPermissionRationale() {
        MaterialAlertDialogBuilder(this)
            .setTitle("Permissions Required")
            .setMessage(
                "Call Recorder needs:\n\n" +
                "• Microphone — to record audio\n" +
                "• Phone State — to detect when calls start/end\n" +
                "• Call Log — to identify call type (incoming/outgoing)\n\n" +
                "Without these, recording will not work."
            )
            .setPositiveButton("Open Settings") { _, _ -> PermissionHelper.openAppSettings(this) }
            .setNegativeButton("Not Now", null)
            .show()
    }
}
