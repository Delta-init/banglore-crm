package com.callrecorder.ui.logs

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.fragment.app.Fragment
import com.callrecorder.databinding.FragmentLogsBinding
import com.callrecorder.utils.AppLogger

class LogsFragment : Fragment() {

    private var _binding: FragmentLogsBinding? = null
    private val binding get() = _binding!!

    override fun onCreateView(
        inflater: LayoutInflater,
        container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentLogsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        loadLogs()

        binding.btnRefreshLogs.setOnClickListener { loadLogs() }

        binding.btnClearLogs.setOnClickListener {
            AppLogger.clear(requireContext())
            loadLogs()
        }
    }

    override fun onResume() {
        super.onResume()
        loadLogs()   // Auto-refresh whenever the tab is opened
    }

    private fun loadLogs() {
        val lines = AppLogger.getLines(requireContext())
        if (lines.isEmpty()) {
            binding.tvLogs.text =
                "No logs yet.\n\nMake a call — logs will appear here showing:\n" +
                "• Which audio source was used (VOICE_CALL / Raw Audio / Speaker+Mic / Mic)\n" +
                "• Recording duration and file size\n" +
                "• Incoming vs outgoing call type\n" +
                "• Any errors that occurred"
        } else {
            binding.tvLogs.text = lines.joinToString("\n")
            // Scroll to top (newest first)
            binding.scrollLogs.post { binding.scrollLogs.scrollTo(0, 0) }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
