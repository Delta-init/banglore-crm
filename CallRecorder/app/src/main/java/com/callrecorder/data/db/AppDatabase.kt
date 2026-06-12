package com.callrecorder.data.db

import android.content.Context
import androidx.room.Database
import androidx.room.Room
import androidx.room.RoomDatabase
import androidx.room.migration.Migration
import androidx.sqlite.db.SupportSQLiteDatabase

@Database(
    entities = [RecordingEntity::class, ContactEntity::class, CrmLogEntity::class],
    version = 6,
    exportSchema = false
)
abstract class AppDatabase : RoomDatabase() {

    abstract fun recordingDao(): RecordingDao
    abstract fun contactDao(): ContactDao
    abstract fun crmLogDao(): CrmLogDao

    companion object {
        @Volatile private var INSTANCE: AppDatabase? = null

        /** v2 → v3: add crmSynced column (existing rows default to 0 = not synced) */
        private val MIGRATION_2_3 = object : Migration(2, 3) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL(
                    "ALTER TABLE recordings ADD COLUMN crmSynced INTEGER NOT NULL DEFAULT 0"
                )
            }
        }

        /** v3 → v4: add syncError column to store HTTP response when sync fails */
        private val MIGRATION_3_4 = object : Migration(3, 4) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE recordings ADD COLUMN syncError TEXT")
            }
        }

        /** v4 → v5: create crm_logs table for per-call API audit trail */
        private val MIGRATION_4_5 = object : Migration(4, 5) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("""
                    CREATE TABLE IF NOT EXISTS crm_logs (
                        id INTEGER PRIMARY KEY AUTOINCREMENT NOT NULL,
                        timestamp INTEGER NOT NULL,
                        phoneNumber TEXT NOT NULL,
                        callType TEXT NOT NULL,
                        durationSecs INTEGER NOT NULL,
                        synced INTEGER NOT NULL,
                        callLogId TEXT,
                        errorMessage TEXT
                    )
                """.trimIndent())
            }
        }

        /**
         * v5 → v6: add ID-based matching columns.
         *
         * recordings.systemCallLogId — Android CallLog.Calls._ID (unique per call)
         * recordings.crmCallLogId    — CRM backend's returned call_log_id
         * crm_logs.systemCallLogId   — same Android _ID, cross-references recordings
         *
         * Existing rows get NULL — they will keep working via the timestamp-fallback
         * matching path in RecentCallsViewModel until they age out of the call log.
         */
        private val MIGRATION_5_6 = object : Migration(5, 6) {
            override fun migrate(db: SupportSQLiteDatabase) {
                db.execSQL("ALTER TABLE recordings ADD COLUMN systemCallLogId INTEGER")
                db.execSQL("ALTER TABLE recordings ADD COLUMN crmCallLogId TEXT")
                db.execSQL("ALTER TABLE crm_logs   ADD COLUMN systemCallLogId INTEGER")
            }
        }

        fun getInstance(context: Context): AppDatabase {
            return INSTANCE ?: synchronized(this) {
                Room.databaseBuilder(
                    context.applicationContext,
                    AppDatabase::class.java,
                    "call_recorder.db"
                )
                    .addMigrations(MIGRATION_2_3, MIGRATION_3_4, MIGRATION_4_5, MIGRATION_5_6)
                    .fallbackToDestructiveMigration()   // safety net for older versions
                    .build()
                    .also { INSTANCE = it }
            }
        }
    }
}
