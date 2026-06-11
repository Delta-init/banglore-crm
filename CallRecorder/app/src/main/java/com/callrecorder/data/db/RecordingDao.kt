package com.callrecorder.data.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface RecordingDao {

    @Query("SELECT * FROM recordings ORDER BY createdAt DESC")
    fun getAllRecordings(): Flow<List<RecordingEntity>>

    @Query("SELECT * FROM recordings WHERE id = :id")
    suspend fun getById(id: Int): RecordingEntity?

    @Query("SELECT * FROM recordings WHERE phoneNumber LIKE '%' || :number || '%'")
    fun getByPhoneNumber(number: String): Flow<List<RecordingEntity>>

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(recording: RecordingEntity): Long

    @Update
    suspend fun update(recording: RecordingEntity)

    @Delete
    suspend fun delete(recording: RecordingEntity)

    @Query("DELETE FROM recordings WHERE id = :id")
    suspend fun deleteById(id: Int)

    @Query("DELETE FROM recordings")
    suspend fun deleteAll()

    @Query("SELECT COUNT(*) FROM recordings")
    fun getCount(): Flow<Int>

    /** One-shot snapshot — used to cross-reference the system call log. */
    @Query("SELECT * FROM recordings ORDER BY createdAt DESC")
    suspend fun getAllRecordingsSnapshot(): List<RecordingEntity>

    /** Mark a recording as successfully synced (or not) to the CRM. */
    @Query("UPDATE recordings SET crmSynced = :synced WHERE id = :id")
    suspend fun updateCrmSynced(id: Int, synced: Boolean)
}
