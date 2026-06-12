package com.callrecorder.ui.crmlogs

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import com.callrecorder.App
import com.callrecorder.databinding.FragmentCrmLogsBinding
import com.callrecorder.service.CrmSyncService
import com.google.android.material.snackbar.Snackbar
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.delay
import kotlinx.coroutines.launch
import kotlinx.coroutines.withContext
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale
import java.util.TimeZone

class CrmLogsFragment : Fragment() {

    private var _binding: FragmentCrmLogsBinding? = null
    private val binding get() = _binding!!

    private lateinit var adapter: CrmLogAdapter

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentCrmLogsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        // ── Adapter with per-row retry callback ──────────────────────────────
        adapter = CrmLogAdapter { log ->
            // Triggered by the ↺ button on a single failed row
            viewLifecycleOwner.lifecycleScope.launch {
                withContext(Dispatchers.IO) {
                    CrmSyncService.retrySingle(requireContext(), log)
                }
                // DB Flow auto-refreshes the row — no manual notify needed
            }
        }

        binding.rvCrmLogs.layoutManager = LinearLayoutManager(requireContext())
        binding.rvCrmLogs.adapter = adapter

        // ── Observe DB — live updates whenever a sync attempt is written ─────
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                val db = (requireActivity().application as App).database
                db.crmLogDao().getAllLogs().collect { logs ->
                    adapter.submitList(logs)

                    val count   = logs.size
                    val failed  = logs.count { !it.synced && it.errorMessage != "⏳ Retrying…" }
                    val syncing = logs.count { it.errorMessage == "⏳ Retrying…" }

                    binding.tvCount.text = buildString {
                        if (count > 0) append("$count entries")
                        if (syncing > 0) append("  •  ⏳ $syncing syncing")
                        if (failed > 0)  append("  •  ⚠️ $failed failed")
                    }

                    binding.tvEmpty.visibility    = if (count == 0) View.VISIBLE else View.GONE
                    binding.rvCrmLogs.visibility  = if (count > 0) View.VISIBLE else View.GONE

                    // Show "Retry All" button only when there are failed entries
                    binding.btnRetryAll.visibility = if (failed > 0) View.VISIBLE else View.GONE
                }
            }
        }

        // ── Retry All Failed button ───────────────────────────────────────────
        binding.btnRetryAll.setOnClickListener {
            binding.btnRetryAll.isEnabled = false
            viewLifecycleOwner.lifecycleScope.launch {
                val successCount = withContext(Dispatchers.IO) {
                    CrmSyncService.retryAllFailed(requireContext())
                }
                binding.btnRetryAll.isEnabled = true

                val msg = if (successCount > 0)
                    "✅ $successCount sync${if (successCount > 1) "s" else ""} succeeded"
                else
                    "⚠️ All retries failed — check CRM connection"
                Snackbar.make(binding.root, msg, Snackbar.LENGTH_LONG).show()
            }
        }

        // ── Clear all ────────────────────────────────────────────────────────
        binding.btnClear.setOnClickListener {
            viewLifecycleOwner.lifecycleScope.launch {
                val db = (requireActivity().application as App).database
                db.crmLogDao().clearAll()
            }
        }

        // ── Sync-job status bar — updates every second ───────────────────────
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                val app = requireActivity().application as App
                while (true) {
                    val lastMs = app.lastSyncMs.value
                    binding.tvSyncStatus.text = if (lastMs == 0L) {
                        "⏱ Auto-sync: starting in a moment…"
                    } else {
                        val elapsed = (System.currentTimeMillis() - lastMs) / 1_000L
                        val nextIn  = maxOf(0L, App.SYNC_INTERVAL_SECS - elapsed)
                        "⏱ Auto-sync every ${App.SYNC_INTERVAL_SECS}s  •  Last: ${fmtTime(lastMs)}  •  Next in: ${nextIn}s"
                    }
                    delay(1_000L)
                }
            }
        }
    }

    private fun fmtTime(epochMs: Long): String =
        SimpleDateFormat("HH:mm:ss", Locale.getDefault()).apply {
            timeZone = TimeZone.getTimeZone("Asia/Kolkata")
        }.format(Date(epochMs))

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
