import { Router } from "express";
import { getMyTracker, saveMyTracker } from "../controllers/myTrackerController.js";
import { authenticate } from "../middleware/auth.js";
import { checkPermission } from "../middleware/permissions.js";

const router = Router();

// Gated on the tracker module so the Roles & Permissions matrix actually
// governs it. Without this the checkbox would be decorative: the sidebar item
// would hide, but anyone could still call the endpoint directly.
//
// A rep only ever reads and writes their OWN row — the portal scopes to
// whoever this server says is signed in — so "edit" here means "may file my
// own day", not "may edit anyone's".
router.get("/me", authenticate, checkPermission("tracker", "view"), getMyTracker);
router.put("/me", authenticate, checkPermission("tracker", "edit"), saveMyTracker);

export default router;
