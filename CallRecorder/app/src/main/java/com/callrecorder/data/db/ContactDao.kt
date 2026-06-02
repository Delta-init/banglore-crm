package com.callrecorder.data.db

import androidx.room.*
import kotlinx.coroutines.flow.Flow

@Dao
interface ContactDao {

    /** Observe all contacts sorted alphabetically — emits on every DB change. */
    @Query("SELECT * FROM contacts ORDER BY name COLLATE NOCASE ASC")
    fun getAll(): Flow<List<ContactEntity>>

    /** Search by name or phone number fragment. */
    @Query(
        "SELECT * FROM contacts " +
        "WHERE name LIKE '%' || :query || '%' " +
        "   OR phone LIKE '%' || :query || '%' " +
        "ORDER BY name COLLATE NOCASE ASC"
    )
    fun search(query: String): Flow<List<ContactEntity>>

    /** Look up by exact phone number (strip formatting before calling). */
    @Query("SELECT * FROM contacts WHERE phone = :phone LIMIT 1")
    suspend fun findByPhone(phone: String): ContactEntity?

    /** Look up by device contact id (for import deduplication). */
    @Query("SELECT * FROM contacts WHERE deviceContactId = :deviceId LIMIT 1")
    suspend fun findByDeviceId(deviceId: Long): ContactEntity?

    @Insert(onConflict = OnConflictStrategy.REPLACE)
    suspend fun insert(contact: ContactEntity): Long

    @Insert(onConflict = OnConflictStrategy.IGNORE)
    suspend fun insertAll(contacts: List<ContactEntity>): List<Long>

    @Update
    suspend fun update(contact: ContactEntity)

    @Delete
    suspend fun delete(contact: ContactEntity)

    @Query("DELETE FROM contacts")
    suspend fun deleteAll()
}
