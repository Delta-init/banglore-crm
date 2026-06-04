import { Router } from "express";
import { getAppVersion } from "../controllers/appController.js";
import { authenticateDeviceKey } from "../middleware/apiKeyAuth.js";

const router = Router();

/**
 * GET /api/v1/app/version
 * Returns the latest CallRecorder APK version info.
 * Protected by the same device API key used for call recording uploads.
 */
router.get("/version", authenticateDeviceKey, getAppVersion);

export default router;
