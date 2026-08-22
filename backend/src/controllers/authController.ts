import type { Request, Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/index.js";
import { AuthService } from "../services/authService.js";
import { loginSchema, refreshTokenSchema, changePasswordSchema } from "../validations/authValidation.js";
import { sendSuccess, sendError } from "../utils/response.js";
import axios from "axios";

const authService = new AuthService();

export const login = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = loginSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, "Validation failed", 400, parsed.error.flatten().fieldErrors);
      return;
    }

    const result = await authService.login(parsed.data);
    sendSuccess(res, "Login successful", result, 200);
  } catch (error) {
    next(error);
  }
};

export const refreshToken = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = refreshTokenSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, "Validation failed", 400, parsed.error.flatten().fieldErrors);
      return;
    }

    const result = await authService.refreshToken(parsed.data.refreshToken);
    sendSuccess(res, "Token refreshed successfully", result, 200);
  } catch (error) {
    next(error);
  }
};

export const getProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await authService.getProfile(req.user!.userId);
    sendSuccess(res, "Profile retrieved successfully", user);
  } catch (error) {
    next(error);
  }
};

export const changePassword = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = changePasswordSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, "Validation failed", 400, parsed.error.flatten().fieldErrors);
      return;
    }

    const result = await authService.changePassword(req.user!.userId, parsed.data);
    sendSuccess(res, result.message);
  } catch (error) {
    next(error);
  }
};

/**
 * POST /api/v1/auth/sso-login
 *
 * Exchanges a one-time handoff token issued by the Root portal for a normal
 * CRM session. The token arrives in the request body, never the URL — the
 * portal redirects the browser with it in the query string, and the CRM's
 * /sso page immediately POSTs it here rather than letting it sit in history.
 */
export const ssoLogin = async (req: Request, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { ssoToken } = req.body as { ssoToken?: string };
    if (!ssoToken) {
      sendError(res, "ssoToken is required", 400);
      return;
    }

    // Fail closed. An unset ROOT_ERP_API_URL previously fell back to
    // localhost, which in production means this server quietly asks itself
    // to vouch for the token.
    const rootApi = process.env.ROOT_ERP_API_URL;
    if (!rootApi) {
      sendError(res, "SSO is not configured on this server", 503);
      return;
    }

    const verifyRes = await axios.get(`${rootApi.replace(/\/+$/, "")}/api/auth/verify-sso-token`, {
      params: { token: ssoToken },
      timeout: 5000,
    });

    const admin = verifyRes.data?.data as { id: string; email: string; name: string; role: string };
    if (!admin?.email) {
      sendError(res, "Invalid SSO token", 401);
      return;
    }

    const result = await authService.ssoLogin(admin);
    sendSuccess(res, "SSO login successful", result, 200);
  } catch (error) {
    // The portal rejects a spent or expired token with a 401. Surface that as
    // a 401 here too, rather than letting it bubble up as a generic 500.
    if (axios.isAxiosError(error) && error.response?.status === 401) {
      sendError(res, "Invalid or expired SSO token", 401);
      return;
    }
    if (axios.isAxiosError(error)) {
      sendError(res, "Could not reach the Root portal to verify this token", 502);
      return;
    }
    next(error);
  }
};
