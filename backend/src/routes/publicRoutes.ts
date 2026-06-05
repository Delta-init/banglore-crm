import { Router } from "express";
import { getLeaderboard } from "../controllers/reportController.js";

/**
 * Public routes — NO authentication required.
 * Accessible by anyone with the URL.
 * Currently exposes only the leaderboard (read-only, no sensitive data).
 */
const router = Router();

// GET /api/v1/public/leaderboard?month=YYYY-MM
router.get("/leaderboard", getLeaderboard);

export default router;
