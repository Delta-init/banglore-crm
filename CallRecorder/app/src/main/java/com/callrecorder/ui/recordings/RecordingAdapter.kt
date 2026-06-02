package com.callrecorder.ui.recordings

import android.view.LayoutInflater
import android.view.ViewGroup
import androidx.recyclerview.widget.DiffUtil
import androidx.recyclerview.widget.ListAdapter
import androidx.recyclerview.widget.RecyclerView
import com.callrecorder.data.db.RecordingEntity
import com.callrecorder.databinding.ItemRecordingBinding
import com.callrecorder.utils.StorageHelper
import java.text.SimpleDateFormat
import java.util.Date
import java.util.Locale

class RecordingAdapter(
    private val onPlay:   (RecordingEntity) -> Unit,
    private val onDelete: (RecordingEntity) -> Unit,
) : ListAdapter<RecordingEntity, RecordingAdapter.ViewHolder>(DIFF) {

    private val dateFormat = SimpleDateFormat("dd MMM yyyy  HH:mm", Locale.getDefault())

    inner class ViewHolder(private val binding: ItemRecordingBinding) :
        RecyclerView.ViewHolder(binding.root) {

        fun bind(item: RecordingEntity) {
            // Display name: contact name or phone number
            binding.tvName.text = item.contactName?.takeIf { it.isNotBlank() }
                ?: item.phoneNumber.takeIf { it.isNotBlank() }
                ?: "Unknown"

            binding.tvPhoneNumber.text = item.phoneNumber.ifBlank { "Unknown" }
            binding.tvDate.text        = dateFormat.format(Date(item.createdAt))
            binding.tvDuration.text    = StorageHelper.formatDuration(item.duration)
            binding.tvSize.text        = StorageHelper.formatFileSize(item.fileSize)
            binding.tvCallType.text    = item.callType.replaceFirstChar { it.uppercase() }

            binding.btnPlay.setOnClickListener   { onPlay(item)   }
            binding.btnDelete.setOnClickListener { onDelete(item) }
        }
    }

    override fun onCreateViewHolder(parent: ViewGroup, viewType: Int): ViewHolder {
        val binding = ItemRecordingBinding.inflate(
            LayoutInflater.from(parent.context), parent, false
        )
        return ViewHolder(binding)
    }

    override fun onBindViewHolder(holder: ViewHolder, position: Int) {
        holder.bind(getItem(position))
    }

    companion object {
        private val DIFF = object : DiffUtil.ItemCallback<RecordingEntity>() {
            override fun areItemsTheSame(a: RecordingEntity, b: RecordingEntity) = a.id == b.id
            override fun areContentsTheSame(a: RecordingEntity, b: RecordingEntity) = a == b
        }
    }
}
