import { Router } from "express";
import { getMyTracker, saveMyTracker } from "../controllers/myTrackerController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Every rep may see and file their own day. No extra permission: the portal
// scopes to whoever this server says is signed in.
router.get("/me", authenticate, getMyTracker);
router.put("/me", authenticate, saveMyTracker);

export default router;
