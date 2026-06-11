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
import kotlinx.coroutines.launch

class CrmLogsFragment : Fragment() {

    private var _binding: FragmentCrmLogsBinding? = null
    private val binding get() = _binding!!

    private val adapter = CrmLogAdapter()

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

        binding.rvCrmLogs.layoutManager = LinearLayoutManager(requireContext())
        binding.rvCrmLogs.adapter = adapter

        // Observe DB — updates live whenever a new sync attempt is saved
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                val db = (requireActivity().application as App).database
                db.crmLogDao().getAllLogs().collect { logs ->
                    adapter.submitList(logs)
                    val count = logs.size
                    binding.tvCount.text = if (count > 0) "$count entries" else ""
                    binding.tvEmpty.visibility = if (count == 0) View.VISIBLE else View.GONE
                    binding.rvCrmLogs.visibility = if (count > 0) View.VISIBLE else View.GONE
                }
            }
        }

        binding.btnClear.setOnClickListener {
            viewLifecycleOwner.lifecycleScope.launch {
                val db = (requireActivity().application as App).database
                db.crmLogDao().clearAll()
            }
        }
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
