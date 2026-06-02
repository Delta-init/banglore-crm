package com.callrecorder.utils

import android.content.Context
import android.provider.ContactsContract

object ContactHelper {

    /**
     * Looks up a display name for a phone number using the Contacts provider.
     * Returns null if not found or if READ_CONTACTS permission is not granted.
     */
    fun getContactName(context: Context, phoneNumber: String): String? {
        if (phoneNumber.isBlank()) return null
        return try {
            val uri = android.net.Uri.withAppendedPath(
                ContactsContract.PhoneLookup.CONTENT_FILTER_URI,
                android.net.Uri.encode(phoneNumber)
            )
            val cursor = context.contentResolver.query(
                uri,
                arrayOf(ContactsContract.PhoneLookup.DISPLAY_NAME),
                null, null, null
            )
            cursor?.use {
                if (it.moveToFirst()) it.getString(0) else null
            }
        } catch (e: Exception) {
            null
        }
    }

    /**
     * Formats a raw phone number for display (basic cleanup).
     */
    fun formatPhoneNumber(number: String): String {
        if (number.isBlank()) return "Unknown"
        return number.trim()
    }
}
