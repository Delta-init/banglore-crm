import { Router } from "express";
import { authenticate } from "../middleware/auth.js";
import { rewardsClaim, rewardsMe, rewardsPhoto } from "../controllers/rewardsController.js";

/* Gift rewards (2026-11-04) — the photos are open (an <img> sends no sign-in); the rest is the signed-in person's own. */
const router = Router();

router.get("/photos/:id", rewardsPhoto);
router.use(authenticate);
router.get("/me", rewardsMe);
router.post("/claim", rewardsClaim);

export default router;
