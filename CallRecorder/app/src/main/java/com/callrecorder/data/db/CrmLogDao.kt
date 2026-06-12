package com.callrecorder.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface CrmLogDao {

    @Insert
    suspend fun insert(log: CrmLogEntity)

    @Query("SELECT * FROM crm_logs ORDER BY timestamp DESC")
    fun getAllLogs(): Flow<List<CrmLogEntity>>

    @Query("SELECT * FROM crm_logs ORDER BY timestamp DESC")
    suspend fun getAllLogsSnapshot(): List<CrmLogEntity>

    /** All rows that failed sync and are not currently being retried. */
    @Query("SELECT * FROM crm_logs WHERE synced = 0 AND (errorMessage IS NULL OR errorMessage != '⏳ Retrying…') ORDER BY timestamp DESC")
    suspend fun getFailedLogs(): List<CrmLogEntity>

    /** Write the result of a retry back into an existing row (no new insert). */
    @Query("UPDATE crm_logs SET synced = :synced, callLogId = :callLogId, errorMessage = :errorMessage WHERE id = :id")
    suspend fun updateSyncResult(id: Int, synced: Boolean, callLogId: String?, errorMessage: String?)

    @Query("DELETE FROM crm_logs")
    suspend fun clearAll()
}
