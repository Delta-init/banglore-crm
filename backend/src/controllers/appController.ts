import type { Request, Response } from "express";
import { sendSuccess } from "../utils/response.js";

/**
 * ════════════════════════════════════════════════════════════════════
 *  App Version Controller — for CallRecorder Android auto-update
 * ════════════════════════════════════════════════════════════════════
 *
 *  To release a new version:
 *    1. Build the new APK and host it (e.g. attach to GitHub release,
 *       or upload to your server and paste the direct download link).
 *    2. Bump APP_VERSION_CODE and APP_VERSION_NAME below.
 *    3. Set DOWNLOAD_URL to the direct .apk download link.
 *    4. Update CHANGELOG with what changed.
 *    5. Set FORCE_UPDATE = true to prevent users skipping the update.
 *    6. Restart the backend — the app checks on every launch.
 *
 *  The Android app compares its BuildConfig.VERSION_CODE against
 *  the versionCode returned here. If server > local → show popup.
 * ════════════════════════════════════════════════════════════════════
 */

// ── Update these whenever you ship a new APK ─────────────────────────────────
const LATEST_VERSION_CODE = 21;            // must match versionCode in build.gradle
const LATEST_VERSION_NAME = "1.20";       // human-readable label shown in dialog
const DOWNLOAD_URL        =
  "https://github.com/Delta-init/banglore-crm/releases/download/v1.20/app-release.apk";
const CHANGELOG           =
  "• Every call now syncs to CRM — outbound calls fixed\n" +
  "• ↑ Sync to CRM button on every unsync'd call in the log\n" +
  "• ⚠ Not Synced badge is now tappable — shows error + Retry\n" +
  "• Mock recording mode — no audio captured, CRM sync only\n" +
  "• No microphone permission required";
const FORCE_UPDATE        = true;
const RELEASE_DATE        = "2026-06-12";
// ─────────────────────────────────────────────────────────────────────────────

/**
 * GET /api/v1/app/version
 * Auth: x-api-key (CALL_RECORDER_API_KEY)
 *
 * Response:
 * {
 *   success: true,
 *   data: {
 *     versionCode: number,   // compare against BuildConfig.VERSION_CODE
 *     versionName: string,   // shown in dialog  e.g. "1.1"
 *     downloadUrl: string,   // direct .apk download link
 *     changelog: string,     // bullet list shown in update dialog
 *     forceUpdate: boolean,  // true → "Later" button is hidden
 *     releaseDate: string    // "YYYY-MM-DD"
 *   }
 * }
 */
export const getAppVersion = (_req: Request, res: Response): void => {
  sendSuccess(res, "App version info", {
    versionCode:  LATEST_VERSION_CODE,
    versionName:  LATEST_VERSION_NAME,
    downloadUrl:  DOWNLOAD_URL,
    changelog:    CHANGELOG,
    forceUpdate:  FORCE_UPDATE,
    releaseDate:  RELEASE_DATE,
  });
};
