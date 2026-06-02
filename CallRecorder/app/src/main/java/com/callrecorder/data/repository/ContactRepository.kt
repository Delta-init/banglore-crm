package com.callrecorder.data.repository

import android.content.Context
import android.provider.ContactsContract
import com.callrecorder.data.db.AppDatabase
import com.callrecorder.data.db.ContactEntity
import com.callrecorder.utils.AppLogger
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.flow.Flow
import kotlinx.coroutines.withContext

class ContactRepository(context: Context) {

    private val dao = AppDatabase.getInstance(context).contactDao()
    private val appCtx = context.applicationContext

    fun getAll(): Flow<List<ContactEntity>> = dao.getAll()

    fun search(query: String): Flow<List<ContactEntity>> =
        if (query.isBlank()) dao.getAll() else dao.search(query)

    suspend fun insert(contact: ContactEntity): Long = dao.insert(contact)

    suspend fun update(contact: ContactEntity) = dao.update(contact)

    suspend fun delete(contact: ContactEntity) = dao.delete(contact)

    /**
     * Reads ALL contacts from the device's Contacts app and inserts any that
     * don't already exist in our DB (matched by deviceContactId).
     *
     * Returns the count of newly imported contacts.
     */
    suspend fun importFromDevice(): Int = withContext(Dispatchers.IO) {
        val imported = mutableListOf<ContactEntity>()

        val projection = arrayOf(
            ContactsContract.CommonDataKinds.Phone.CONTACT_ID,
            ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY,
            ContactsContract.CommonDataKinds.Phone.NUMBER,
            ContactsContract.CommonDataKinds.Phone.TYPE,
        )

        try {
            appCtx.contentResolver.query(
                ContactsContract.CommonDataKinds.Phone.CONTENT_URI,
                projection,
                null, null,
                ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY + " ASC"
            )?.use { cursor ->
                val idCol    = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.CONTACT_ID)
                val nameCol  = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.DISPLAY_NAME_PRIMARY)
                val phoneCol = cursor.getColumnIndexOrThrow(ContactsContract.CommonDataKinds.Phone.NUMBER)

                while (cursor.moveToNext()) {
                    val contactId = cursor.getLong(idCol)
                    val name      = cursor.getString(nameCol) ?: continue
                    val phone     = cursor.getString(phoneCol)?.replace("\\s".toRegex(), "") ?: continue

                    // Only import if not already in our DB
                    if (dao.findByDeviceId(contactId) == null) {
                        imported += ContactEntity(
                            name           = name,
                            phone          = phone,
                            deviceContactId = contactId
                        )
                    }
                }
            }
        } catch (e: Exception) {
            AppLogger.e(appCtx, TAG, "importFromDevice failed: ${e.message}")
        }

        if (imported.isNotEmpty()) {
            dao.insertAll(imported)
            AppLogger.i(appCtx, TAG, "Imported ${imported.size} contacts from device")
        }
        imported.size
    }

    companion object {
        private const val TAG = "ContactRepository"
    }
}
