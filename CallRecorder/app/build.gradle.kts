import java.util.Properties

plugins {
    alias(libs.plugins.android.application)
    alias(libs.plugins.kotlin.android)
    alias(libs.plugins.ksp)
}

android {
    namespace = "com.callrecorder"
    compileSdk = 35

    defaultConfig {
        applicationId = "com.callrecorder"
        minSdk = 26
        targetSdk = 35
        versionCode = 13
        versionName = "1.12"
        testInstrumentationRunner = "androidx.test.runner.AndroidJUnitRunner"
    }

    // ── Signing ──────────────────────────────────────────────────────────────
    // Store keystore credentials in local.properties (never commit to git)
    signingConfigs {
        create("release") {
            val props = Properties().also { p ->
                rootProject.file("local.properties")
                    .takeIf { it.exists() }
                    ?.inputStream()?.use { p.load(it) }
            }
            storeFile     = props.getProperty("KEYSTORE_PATH")?.let { file(it) }
            storePassword = props.getProperty("KEYSTORE_PASSWORD")
            keyAlias      = props.getProperty("KEY_ALIAS")
            keyPassword   = props.getProperty("KEY_PASSWORD")
        }
    }

    buildTypes {
        release {
            isMinifyEnabled = true
            isShrinkResources = true
            signingConfig = signingConfigs.getByName("release")
            proguardFiles(
                getDefaultProguardFile("proguard-android-optimize.txt"),
                "proguard-rules.pro"
            )
        }
    }

    buildFeatures {
        viewBinding   = true
        buildConfig   = true   // needed for BuildConfig.VERSION_CODE in AppUpdateChecker
    }

    compileOptions {
        sourceCompatibility = JavaVersion.VERSION_17
        targetCompatibility = JavaVersion.VERSION_17
    }
    kotlinOptions {
        jvmTarget = "17"
    }
}

dependencies {
    implementation(libs.androidx.core.ktx)
    implementation(libs.androidx.appcompat)
    implementation(libs.material)
    implementation(libs.androidx.activity.ktx)
    implementation(libs.androidx.fragment.ktx)
    implementation(libs.androidx.constraintlayout)
    implementation(libs.androidx.preference.ktx)

    // Lifecycle
    implementation(libs.androidx.lifecycle.viewmodel)
    implementation(libs.androidx.lifecycle.livedata)
    implementation(libs.androidx.lifecycle.runtime)
    implementation(libs.androidx.lifecycle.service)

    // Navigation
    implementation(libs.androidx.navigation.fragment)
    implementation(libs.androidx.navigation.ui)

    // Room
    implementation(libs.androidx.room.runtime)
    implementation(libs.androidx.room.ktx)
    ksp(libs.androidx.room.compiler)

    // Coroutines
    implementation(libs.kotlinx.coroutines.android)

    // HTTP client — for CRM sync (call log + recording upload)
    implementation(libs.okhttp)
}
