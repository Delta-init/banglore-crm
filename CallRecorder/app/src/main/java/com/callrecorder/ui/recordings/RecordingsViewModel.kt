package com.callrecorder.ui.recordings

import android.app.Application
import androidx.lifecycle.AndroidViewModel
import androidx.lifecycle.viewModelScope
import com.callrecorder.App
import com.callrecorder.data.db.RecordingEntity
import com.callrecorder.data.repository.RecordingRepository
import com.callrecorder.utils.StorageHelper
import kotlinx.coroutines.flow.SharingStarted
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.flow.stateIn
import kotlinx.coroutines.launch

class RecordingsViewModel(application: Application) : AndroidViewModel(application) {

    private val repository = RecordingRepository(
        (application as App).database.recordingDao()
    )

    val recordings: StateFlow<List<RecordingEntity>> =
        repository.allRecordings.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = emptyList()
        )

    val recordingCount: StateFlow<Int> =
        repository.recordingCount.stateIn(
            scope = viewModelScope,
            started = SharingStarted.WhileSubscribed(5_000),
            initialValue = 0
        )

    fun delete(recording: RecordingEntity) {
        viewModelScope.launch {
            StorageHelper.deleteFile(recording.filePath)
            repository.delete(recording)
        }
    }

    fun deleteAll() {
        viewModelScope.launch {
            val all = recordings.value
            all.forEach { StorageHelper.deleteFile(it.filePath) }
            repository.deleteAll()
        }
    }
}
