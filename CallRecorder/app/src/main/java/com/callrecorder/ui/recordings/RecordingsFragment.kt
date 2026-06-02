package com.callrecorder.ui.recordings

import android.os.Bundle
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.appcompat.app.AlertDialog
import androidx.fragment.app.Fragment
import androidx.fragment.app.viewModels
import androidx.lifecycle.Lifecycle
import androidx.lifecycle.lifecycleScope
import androidx.lifecycle.repeatOnLifecycle
import androidx.recyclerview.widget.ItemTouchHelper
import androidx.recyclerview.widget.LinearLayoutManager
import androidx.recyclerview.widget.RecyclerView
import com.callrecorder.R
import com.callrecorder.data.db.RecordingEntity
import com.callrecorder.databinding.FragmentRecordingsBinding
import com.callrecorder.ui.player.PlayerBottomSheet
import com.google.android.material.snackbar.Snackbar
import kotlinx.coroutines.launch

class RecordingsFragment : Fragment() {

    private var _binding: FragmentRecordingsBinding? = null
    private val binding get() = _binding!!

    private val viewModel: RecordingsViewModel by viewModels()
    private lateinit var adapter: RecordingAdapter

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = FragmentRecordingsBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        setupRecyclerView()
        observeRecordings()
    }

    private fun setupRecyclerView() {
        adapter = RecordingAdapter(
            onPlay   = { recording -> openPlayer(recording) },
            onDelete = { recording -> confirmDelete(recording) }
        )

        binding.recyclerView.apply {
            layoutManager = LinearLayoutManager(requireContext())
            adapter = this@RecordingsFragment.adapter
        }

        // Swipe-to-delete
        val swipeCallback = object : ItemTouchHelper.SimpleCallback(
            0, ItemTouchHelper.LEFT or ItemTouchHelper.RIGHT
        ) {
            override fun onMove(rv: RecyclerView, vh: RecyclerView.ViewHolder,
                                target: RecyclerView.ViewHolder) = false

            override fun onSwiped(vh: RecyclerView.ViewHolder, direction: Int) {
                val item = adapter.currentList[vh.adapterPosition]
                viewModel.delete(item)
                Snackbar.make(binding.root, "Recording deleted", Snackbar.LENGTH_SHORT).show()
            }
        }
        ItemTouchHelper(swipeCallback).attachToRecyclerView(binding.recyclerView)
    }

    private fun observeRecordings() {
        viewLifecycleOwner.lifecycleScope.launch {
            viewLifecycleOwner.repeatOnLifecycle(Lifecycle.State.STARTED) {
                viewModel.recordings.collect { recordings ->
                    adapter.submitList(recordings)
                    updateEmptyState(recordings.isEmpty())
                }
            }
        }
    }

    private fun updateEmptyState(isEmpty: Boolean) {
        binding.emptyState.visibility   = if (isEmpty) View.VISIBLE else View.GONE
        binding.recyclerView.visibility = if (isEmpty) View.GONE    else View.VISIBLE
    }

    private fun openPlayer(recording: RecordingEntity) {
        PlayerBottomSheet.newInstance(recording.id)
            .show(childFragmentManager, PlayerBottomSheet.TAG)
    }

    private fun confirmDelete(recording: RecordingEntity) {
        AlertDialog.Builder(requireContext())
            .setTitle("Delete Recording")
            .setMessage("Delete this recording? This cannot be undone.")
            .setPositiveButton("Delete") { _, _ -> viewModel.delete(recording) }
            .setNegativeButton("Cancel", null)
            .show()
    }

    override fun onDestroyView() {
        super.onDestroyView()
        _binding = null
    }
}
