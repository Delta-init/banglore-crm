package com.callrecorder.ui

import android.content.Intent
import android.net.Uri
import android.os.Bundle
import android.telecom.TelecomManager
import android.view.View
import androidx.appcompat.app.AppCompatActivity
import com.callrecorder.R
import com.callrecorder.databinding.ActivityDialerBinding
import com.callrecorder.utils.AppLogger
import com.google.android.material.button.MaterialButton

/**
 * Dial pad shown when this app is the default phone app.
 *
 * When the user dials a number (from Contacts, a link, etc.), this screen:
 * 1. Pre-fills the number
 * 2. Lets the user edit it with a full digit pad
 * 3. Tapping the green Call button places the call via TelecomManager.placeCall()
 *
 * If ACTION_CALL is received, the call is placed immediately without showing the pad.
 */
class DialerActivity : AppCompatActivity() {

    private lateinit var binding: ActivityDialerBinding
    private val typedNumber = StringBuilder()

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        binding = ActivityDialerBinding.inflate(layoutInflater)
        setContentView(binding.root)

        val preFilledNumber = extractNumber()
        AppLogger.i(this, TAG, "DialerActivity: action=${intent?.action} number=$preFilledNumber")

        when (intent?.action) {
            // Immediate call — place it and close
            Intent.ACTION_CALL,
            "android.intent.action.CALL_PRIVILEGED" -> {
                placeCallNow(preFilledNumber)
                return
            }

            // Show dial pad, pre-fill number if provided
            Intent.ACTION_DIAL,
            Intent.ACTION_VIEW,
            null -> {
                preFilledNumber.forEach { typedNumber.append(it) }
                refreshDisplay()
                setupDialPad()
                setupCallButton()
                setupBackspace()
            }

            else -> { finish(); return }
        }
    }

    // ── Dial pad wiring ───────────────────────────────────────────────────────

    private fun setupDialPad() {
        val keys = mapOf(
            R.id.key1 to "1",  R.id.key2 to "2",  R.id.key3 to "3",
            R.id.key4 to "4",  R.id.key5 to "5",  R.id.key6 to "6",
            R.id.key7 to "7",  R.id.key8 to "8",  R.id.key9 to "9",
            R.id.keyStar to "*", R.id.key0 to "0", R.id.keyHash to "#"
        )

        keys.forEach { (viewId, digit) ->
            (findViewById<MaterialButton>(viewId))?.apply {
                text = digit
                setOnClickListener { appendDigit(digit) }
                setOnLongClickListener {
                    // Long-press 0 → "+"
                    if (digit == "0") { appendDigit("+"); true } else false
                }
            }
        }
    }

    private fun setupCallButton() {
        binding.btnForward.setOnClickListener {
            val number = typedNumber.toString()
            if (number.isNotBlank()) placeCallNow(number)
        }
    }

    private fun setupBackspace() {
        binding.btnBackspace.setOnClickListener {
            if (typedNumber.isNotEmpty()) {
                typedNumber.deleteCharAt(typedNumber.length - 1)
                refreshDisplay()
            }
        }
        binding.btnBackspace.setOnLongClickListener {
            typedNumber.clear()
            refreshDisplay()
            true
        }
    }

    private fun appendDigit(d: String) {
        typedNumber.append(d)
        refreshDisplay()
    }

    private fun refreshDisplay() {
        binding.tvDialNumber.text = typedNumber.toString()
        binding.btnBackspace.visibility =
            if (typedNumber.isEmpty()) View.INVISIBLE else View.VISIBLE
    }

    // ── Call placement ────────────────────────────────────────────────────────

    private fun placeCallNow(number: String) {
        if (number.isBlank()) return
        try {
            val uri = Uri.fromParts("tel", number, null)
            val telecomManager = getSystemService(TELECOM_SERVICE) as TelecomManager
            telecomManager.placeCall(uri, null)
            AppLogger.i(this, TAG, "placeCall: $number")
            finish()
        } catch (e: SecurityException) {
            AppLogger.e(this, TAG, "CALL_PHONE not granted: ${e.message}")
            binding.tvSubtitle.text = "⚠️ Phone permission missing — grant it in Settings"
        } catch (e: Exception) {
            AppLogger.e(this, TAG, "placeCall failed: ${e.message}")
            binding.tvSubtitle.text = "⚠️ Call failed: ${e.message}"
        }
    }

    private fun extractNumber(): String = try {
        intent?.data?.schemeSpecificPart?.replace("%2B", "+")?.trim() ?: ""
    } catch (e: Exception) { "" }

    companion object {
        private const val TAG = "DialerActivity"
    }
}
