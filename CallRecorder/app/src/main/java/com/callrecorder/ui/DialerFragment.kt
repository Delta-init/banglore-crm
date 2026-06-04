package com.callrecorder.ui

import android.Manifest
import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.telecom.TelecomManager
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import android.widget.TextView
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import com.callrecorder.R
import com.callrecorder.utils.AppLogger
import com.callrecorder.utils.PrefsHelper
import com.google.android.material.button.MaterialButton
import com.google.android.material.floatingactionbutton.ExtendedFloatingActionButton
import com.google.android.material.snackbar.Snackbar

/**
 * Dialer tab — agents type a number on the dial pad and tap Call.
 * The call is placed via TelecomManager (or tel: intent fallback).
 * CallRecordingService auto-records it via InCallService / BroadcastReceiver.
 */
class DialerFragment : Fragment(R.layout.fragment_dialer) {

    private val typed = StringBuilder()

    // Views — resolved in onViewCreated via findViewById (avoids ViewBinding
    // include-layout typing issues with MaterialButton)
    private lateinit var tvNumber:    TextView
    private lateinit var btnBackspace: MaterialButton      // ⌫ always visible in row 5
    private lateinit var btnCall:     ExtendedFloatingActionButton

    // ── Request CALL_PHONE if not yet granted ─────────────────────────────────

    private val callPermissionLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) placeCallNow(typed.toString())
        else Snackbar.make(requireView(), "Phone permission is required to place calls", Snackbar.LENGTH_LONG).show()
    }

    // ── Fragment lifecycle ────────────────────────────────────────────────────

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        tvNumber    = view.findViewById(R.id.tvDialNumber)
        btnBackspace = view.findViewById(R.id.btnBackspace)
        btnCall     = view.findViewById(R.id.btnCall)
        setupDialPad(view)
        setupCallButton()
        setupBackspace()
    }

    // ── Dial pad setup ────────────────────────────────────────────────────────

    private fun setupDialPad(view: View) {
        // Text labels are set in fragment_dialer.xml — only wire click listeners here
        val keys = mapOf(
            R.id.key1    to "1",
            R.id.key2    to "2",
            R.id.key3    to "3",
            R.id.key4    to "4",
            R.id.key5    to "5",
            R.id.key6    to "6",
            R.id.key7    to "7",
            R.id.key8    to "8",
            R.id.key9    to "9",
            R.id.keyStar to "*",
            R.id.key0    to "0",
            R.id.keyHash to "#",
        )
        keys.forEach { (id, digit) ->
            view.findViewById<MaterialButton>(id)?.apply {
                // ⚠️ Must use this@DialerFragment.append — inside apply{}, plain
                // append() resolves to TextView.append() and writes onto the button label.
                setOnClickListener { this@DialerFragment.append(digit) }
                setOnLongClickListener {
                    if (digit == "0") { this@DialerFragment.append("+"); true } else false
                }
            }
        }
    }

    private fun setupCallButton() {
        btnCall.setOnClickListener {
            val number = typed.toString()
            if (number.isBlank()) {
                Snackbar.make(requireView(), "Enter a number first", Snackbar.LENGTH_SHORT).show()
                return@setOnClickListener
            }
            if (hasCallPermission()) {
                placeCallNow(number)
            } else {
                callPermissionLauncher.launch(Manifest.permission.CALL_PHONE)
            }
        }
    }

    private fun setupBackspace() {
        btnBackspace.setOnClickListener {
            if (typed.isNotEmpty()) {
                typed.deleteCharAt(typed.length - 1)
                refreshDisplay()
            }
        }
        btnBackspace.setOnLongClickListener {
            typed.clear()
            refreshDisplay()
            true
        }
    }

    // ── State ─────────────────────────────────────────────────────────────────

    private fun append(digit: String) {
        typed.append(digit)
        refreshDisplay()
    }

    private fun refreshDisplay() {
        tvNumber.text = typed.toString()
        // Backspace is always visible — dim it when nothing to delete
        btnBackspace.alpha = if (typed.isEmpty()) 0.3f else 1.0f
    }

    // ── Call placement ────────────────────────────────────────────────────────

    private fun placeCallNow(number: String) {
        if (number.isBlank()) return
        AppLogger.i(requireContext(), TAG, "Dialing: $number")
        // Save for CallStateReceiver fallback — Android 10+ doesn't fire ACTION_NEW_OUTGOING_CALL
        PrefsHelper.setLastDialedNumber(requireContext(), number)
        try {
            val uri = Uri.fromParts("tel", number, null)
            val tm  = requireContext().getSystemService(TelecomManager::class.java)
            tm.placeCall(uri, null)
        } catch (e: SecurityException) {
            AppLogger.w(requireContext(), TAG, "TelecomManager denied — fallback to tel: intent")
            dialViaTelIntent(number)
        } catch (e: Exception) {
            AppLogger.e(requireContext(), TAG, "placeCall failed: ${e.message}")
            Snackbar.make(requireView(), "⚠️ ${e.message}", Snackbar.LENGTH_LONG).show()
        }
    }

    private fun dialViaTelIntent(number: String) {
        try {
            startActivity(Intent(Intent.ACTION_CALL, Uri.parse("tel:$number")))
        } catch (e: Exception) {
            Snackbar.make(requireView(), "No phone app found to place call", Snackbar.LENGTH_SHORT).show()
        }
    }

    private fun hasCallPermission() =
        ContextCompat.checkSelfPermission(requireContext(), Manifest.permission.CALL_PHONE) ==
                PackageManager.PERMISSION_GRANTED

    companion object {
        private const val TAG = "DialerFragment"
    }
}
