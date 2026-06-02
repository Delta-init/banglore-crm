package com.callrecorder.ui.calls

import android.content.Intent
import android.content.pm.PackageManager
import android.net.Uri
import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.activity.result.contract.ActivityResultContracts
import androidx.core.content.ContextCompat
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.LinearLayoutManager
import com.callrecorder.databinding.FragmentRecentCallsBinding
import kotlinx.coroutines.launch
import android.Manifest

class RecentCallsFragment : Fragment() {

    private var _binding: FragmentRecentCallsBinding? = null
    private val binding get() = _binding!!

    private val viewModel: RecentCallsViewModel by viewModels()
    private lateinit var adapter: CallLogAdapter

    private val permLauncher = registerForActivityResult(
        ActivityResultContracts.RequestPermission()
    ) { granted ->
        if (granted) viewModel.loadCallLog()
        else showPermissionDenied()
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentRecentCallsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)

        adapter = CallLogAdapter { entry -> dialNumber(entry.number) }

        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@RecentCallsFragment.adapter
        }

        binding.btnRefresh.setOnClickListener { checkPermissionAndLoad() }

        observeState()
        checkPermissionAndLoad()
    }

    private fun checkPermissionAndLoad() {
        when {
            ContextCompat.checkSelfPermission(
                requireContext(), Manifest.permission.READ_CALL_LOG
            ) == PackageManager.PERMISSION_GRANTED -> viewModel.loadCallLog()

            else -> permLauncher.launch(Manifest.permission.READ_CALL_LOG)
        }
    }

    private fun observeState() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                launch {
                    viewModel.loading.collect { loading ->
                        binding.progressBar.visibility = if (loading) View.VISIBLE else View.GONE
                    }
                }
                launch {
                    viewModel.calls.collect { calls ->
                        adapter.submitList(calls)
                        binding.emptyState.visibility =
                            if (calls.isEmpty() && binding.progressBar.visibility == View.GONE)
                                View.VISIBLE else View.GONE
                        binding.recyclerView.visibility =
                            if (calls.isNotEmpty()) View.VISIBLE else View.GONE
                    }
                }
            }
        }
    }

    private fun dialNumber(number: String) {
        if (number.isBlank()) return
        startActivity(Intent(Intent.ACTION_DIAL, Uri.parse("tel:$number")))
    }

    private fun showPermissionDenied() {
        binding.emptyState.visibility = View.VISIBLE
        binding.emptyState.text = "Call log permission denied.\nGrant it in Settings → Apps → Call Recorder → Permissions."
        binding.recyclerView.visibility = View.GONE
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
