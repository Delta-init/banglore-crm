package com.callrecorder.data.db

import androidx.room.Entity
import androidx.room.PrimaryKey

/**
 * A contact stored locally in our Room database.
 * Can be created manually or imported from the device's Contacts app.
 * [deviceContactId] links back to the system contact if imported.
 */
@Entity(tableName = "contacts")
data class ContactEntity(
    @PrimaryKey(autoGenerate = true) val id: Int = 0,
    val name: String,
    val phone: String,
    val email: String? = null,
    val notes: String? = null,
    /** Non-null when imported from device contacts (ContactsContract lookup key or raw id). */
    val deviceContactId: Long? = null,
    val createdAt: Long = System.currentTimeMillis()
)
