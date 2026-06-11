package com.callrecorder.data.db

import androidx.room.Dao
import androidx.room.Insert
import androidx.room.Query
import kotlinx.coroutines.flow.Flow

@Dao
interface CrmLogDao {

    @Insert
    suspend fun insert(log: CrmLogEntity)

    @Query("SELECT * FROM crm_logs ORDER BY timestamp DESC LIMIT 300")
    fun getAllLogs(): Flow<List<CrmLogEntity>>

    @Query("SELECT * FROM crm_logs ORDER BY timestamp DESC LIMIT 300")
    suspend fun getAllLogsSnapshot(): List<CrmLogEntity>

    @Query("DELETE FROM crm_logs")
    suspend fun clearAll()
}
