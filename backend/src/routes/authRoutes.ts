import { Router } from "express";
import { login, refreshToken, getProfile, changePassword, ssoLogin } from "../controllers/authController.js";
import { authenticate } from "../middleware/auth.js";

const router = Router();

// Public routes
router.post("/login", login);
router.post("/refresh-token", refreshToken);
router.post("/sso-login", ssoLogin); // Root portal SSO

// Protected routes
router.get("/profile", authenticate, getProfile);
router.put("/change-password", authenticate, changePassword);

export default router;
