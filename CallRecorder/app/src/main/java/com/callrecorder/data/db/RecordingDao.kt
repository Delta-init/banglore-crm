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

    /**
     * Persist CRM sync result.
     * Also writes the Android system call log ID and the CRM-assigned call_log_id
     * so the Recent Calls tab can match calls by ID instead of timestamp.
     */
    @Query("""
        UPDATE recordings
        SET crmSynced = :synced,
            syncError = :error,
            crmCallLogId = :crmCallLogId,
            systemCallLogId = :systemCallLogId
        WHERE id = :id
    """)
    suspend fun updateSyncResult(
        id: Int,
        synced: Boolean,
        error: String?,
        crmCallLogId: String?,
        systemCallLogId: Long?,
    )

    /** Look up a recording by its Android system call log _ID. */
    @Query("SELECT * FROM recordings WHERE systemCallLogId = :sysId LIMIT 1")
    suspend fun getBySystemCallLogId(sysId: Long): RecordingEntity?

    /** Most recent recording created at or after [since] ms — used by CallStateReceiver to
     *  back-fill crmSynced after the CRM POST completes. */
    @Query("SELECT * FROM recordings WHERE createdAt >= :since ORDER BY createdAt DESC LIMIT 1")
    suspend fun getMostRecentAfter(since: Long): RecordingEntity?
}
