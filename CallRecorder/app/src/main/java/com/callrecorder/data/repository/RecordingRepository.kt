package com.callrecorder.data.repository

import com.callrecorder.data.db.RecordingDao
import com.callrecorder.data.db.RecordingEntity
import kotlinx.coroutines.flow.Flow

class RecordingRepository(private val dao: RecordingDao) {

    val allRecordings: Flow<List<RecordingEntity>> = dao.getAllRecordings()
    val recordingCount: Flow<Int> = dao.getCount()

    suspend fun insert(recording: RecordingEntity): Long = dao.insert(recording)

    suspend fun update(recording: RecordingEntity) = dao.update(recording)

    suspend fun delete(recording: RecordingEntity) = dao.delete(recording)

    suspend fun deleteById(id: Int) = dao.deleteById(id)

    suspend fun deleteAll() = dao.deleteAll()

    suspend fun getById(id: Int): RecordingEntity? = dao.getById(id)

    fun getByPhoneNumber(number: String): Flow<List<RecordingEntity>> =
        dao.getByPhoneNumber(number)
}
