# Add project specific ProGuard rules here.

# Keep Room entities
-keep class com.callrecorder.data.db.** { *; }

# Keep data classes
-keepclassmembers class * {
    @androidx.room.* <methods>;
}
