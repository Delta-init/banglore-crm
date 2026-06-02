package com.callrecorder.ui.player

import android.media.MediaPlayer
import android.os.Bundle
import android.os.Handler
import android.os.Looper
import android.view.LayoutInflater
import android.view.View
import android.view.ViewGroup
import androidx.lifecycle.lifecycleScope
import com.callrecorder.App
import com.callrecorder.data.repository.RecordingRepository
import com.callrecorder.databinding.BottomSheetPlayerBinding
import com.callrecorder.utils.StorageHelper
import com.google.android.material.bottomsheet.BottomSheetDialogFragment
import kotlinx.coroutines.launch
import java.io.File

class PlayerBottomSheet : BottomSheetDialogFragment() {

    private var _binding: BottomSheetPlayerBinding? = null
    private val binding get() = _binding!!

    private var player: MediaPlayer? = null
    private val handler = Handler(Looper.getMainLooper())
    private var isPlaying = false
    private var playbackSpeed = 1.0f

    private val recordingId: Int by lazy {
        requireArguments().getInt(ARG_RECORDING_ID)
    }

    override fun onCreateView(
        inflater: LayoutInflater, container: ViewGroup?,
        savedInstanceState: Bundle?
    ): View {
        _binding = BottomSheetPlayerBinding.inflate(inflater, container, false)
        return binding.root
    }

    override fun onViewCreated(view: View, savedInstanceState: Bundle?) {
        super.onViewCreated(view, savedInstanceState)
        loadRecording()
    }

    private fun loadRecording() {
        val db = (requireActivity().application as App).database
        val repo = RecordingRepository(db.recordingDao())

        lifecycleScope.launch {
            val recording = repo.getById(recordingId) ?: return@launch

            // Update UI on main thread
            requireActivity().runOnUiThread {
                val name = recording.contactName?.takeIf { it.isNotBlank() }
                    ?: recording.phoneNumber.takeIf { it.isNotBlank() }
                    ?: "Unknown"
                binding.tvTitle.text       = name
                binding.tvNumber.text      = recording.phoneNumber
                binding.tvDuration.text    = StorageHelper.formatDuration(recording.duration)
                binding.tvTotalDuration.text = StorageHelper.formatDuration(recording.duration)

                initPlayer(recording.filePath)
            }
        }
    }

    private fun initPlayer(filePath: String) {
        if (!File(filePath).exists()) {
            binding.tvTitle.text = "File not found"
            binding.btnPlay.isEnabled = false
            return
        }

        player = MediaPlayer().apply {
            setDataSource(filePath)
            prepare()
            setOnCompletionListener { onPlaybackComplete() }
        }

        val totalMs = player!!.duration.toLong()
        binding.seekBar.max = totalMs.toInt()
        binding.tvTotalDuration.text = StorageHelper.formatDuration(totalMs)

        binding.btnPlay.setOnClickListener { togglePlayback() }

        binding.seekBar.setOnSeekBarChangeListener(object :
            android.widget.SeekBar.OnSeekBarChangeListener {
            override fun onProgressChanged(sb: android.widget.SeekBar, progress: Int, fromUser: Boolean) {
                if (fromUser) {
                    player?.seekTo(progress)
                    binding.tvCurrentPosition.text = StorageHelper.formatDuration(progress.toLong())
                }
            }
            override fun onStartTrackingTouch(sb: android.widget.SeekBar) {}
            override fun onStopTrackingTouch(sb: android.widget.SeekBar) {}
        })

        // Speed buttons
        binding.btn075x.setOnClickListener { setSpeed(0.75f) }
        binding.btn1x.setOnClickListener   { setSpeed(1.0f)  }
        binding.btn15x.setOnClickListener  { setSpeed(1.5f)  }
        binding.btn2x.setOnClickListener   { setSpeed(2.0f)  }
    }

    private fun togglePlayback() {
        val p = player ?: return
        if (isPlaying) {
            p.pause()
            isPlaying = false
            binding.btnPlay.setImageResource(android.R.drawable.ic_media_play)
            handler.removeCallbacksAndMessages(null)
        } else {
            p.start()
            isPlaying = true
            binding.btnPlay.setImageResource(android.R.drawable.ic_media_pause)
            startProgressUpdater()
        }
    }

    private fun startProgressUpdater() {
        handler.post(object : Runnable {
            override fun run() {
                val p = player ?: return
                if (isPlaying) {
                    val pos = p.currentPosition
                    binding.seekBar.progress = pos
                    binding.tvCurrentPosition.text = StorageHelper.formatDuration(pos.toLong())
                    handler.postDelayed(this, 200)
                }
            }
        })
    }

    private fun onPlaybackComplete() {
        isPlaying = false
        binding.btnPlay.setImageResource(android.R.drawable.ic_media_play)
        binding.seekBar.progress = 0
        binding.tvCurrentPosition.text = StorageHelper.formatDuration(0)
        handler.removeCallbacksAndMessages(null)
    }

    private fun setSpeed(speed: Float) {
        playbackSpeed = speed
        player?.let {
            if (android.os.Build.VERSION.SDK_INT >= android.os.Build.VERSION_CODES.M) {
                it.playbackParams = it.playbackParams.setSpeed(speed)
            }
        }
        // Highlight active speed button
        val alpha025 = 0.4f
        val alpha1   = 1.0f
        binding.btn075x.alpha = if (speed == 0.75f) alpha1 else alpha025
        binding.btn1x.alpha   = if (speed == 1.0f)  alpha1 else alpha025
        binding.btn15x.alpha  = if (speed == 1.5f)  alpha1 else alpha025
        binding.btn2x.alpha   = if (speed == 2.0f)  alpha1 else alpha025
    }

    override fun onDestroyView() {
        handler.removeCallbacksAndMessages(null)
        player?.apply { if (isPlaying) stop(); release() }
        player = null
        _binding = null
        super.onDestroyView()
    }

    companion object {
        const val TAG = "PlayerBottomSheet"
        private const val ARG_RECORDING_ID = "recording_id"

        fun newInstance(recordingId: Int) = PlayerBottomSheet().apply {
            arguments = Bundle().apply { putInt(ARG_RECORDING_ID, recordingId) }
        }
    }
}
