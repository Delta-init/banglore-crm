package com.callrecorder

import android.app.Application
import android.app.NotificationChannel
import android.app.NotificationManager
import android.os.Build
import com.callrecorder.data.db.AppDatabase
import com.callrecorder.service.CrmSyncService
import kotlinx.coroutines.CoroutineScope
import kotlinx.coroutines.Dispatchers
import kotlinx.coroutines.SupervisorJob
import kotlinx.coroutines.delay
import kotlinx.coroutines.flow.MutableStateFlow
import kotlinx.coroutines.flow.StateFlow
import kotlinx.coroutines.launch

class App : Application() {

    val database: AppDatabase by lazy { AppDatabase.getInstance(this) }

    // Application-scoped coroutine scope for background work that outlives any Activity/Fragment
    private val appScope = CoroutineScope(SupervisorJob() + Dispatchers.IO)

    // Exposed to CrmLogsFragment for the sync-job status bar
    private val _lastSyncMs = MutableStateFlow(0L)
    val lastSyncMs: StateFlow<Long> = _lastSyncMs

    override fun onCreate() {
        super.onCreate()
        createNotificationChannels()
        startPeriodicSync()
    }

    /**
     * Retries every failed CRM sync every [SYNC_INTERVAL_SECS] seconds.
     * Also runs once at startup after a short warm-up delay.
     * Exposed via [lastSyncMs] so the CRM Logs tab can show a countdown.
     */
    private fun startPeriodicSync() {
        appScope.launch {
            delay(4_000L)
            while (true) {
                _lastSyncMs.value = System.currentTimeMillis()
                CrmSyncService.retryAllFailed(this@App)
                delay(SYNC_INTERVAL_SECS * 1_000L)
            }
        }
    }

    private fun createNotificationChannels() {
        if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.O) {
            val manager = getSystemService(NotificationManager::class.java)

            val recordingChannel = NotificationChannel(
                CHANNEL_RECORDING,
                "Call Recording",
                NotificationManager.IMPORTANCE_LOW
            ).apply {
                description = "Shown while a call is being recorded"
                setShowBadge(false)
            }

            val generalChannel = NotificationChannel(
                CHANNEL_GENERAL,
                "General",
                NotificationManager.IMPORTANCE_DEFAULT
            ).apply {
                description = "General app notifications"
            }

            manager.createNotificationChannel(recordingChannel)
            manager.createNotificationChannel(generalChannel)
        }
    }

    companion object {
        const val CHANNEL_RECORDING   = "channel_recording"
        const val CHANNEL_GENERAL     = "channel_general"
        const val SYNC_INTERVAL_SECS  = 30L   // auto-retry interval — shown in CRM Logs status bar
    }
}
