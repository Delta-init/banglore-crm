import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/index.js";
import { UserService } from "../services/userService.js";
import { createUserSchema, updateUserSchema } from "../validations/userValidation.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { signAccessToken } from "../utils/jwt.js";

const userService = new UserService();

export const createUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = createUserSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, "Validation failed", 400, parsed.error.flatten().fieldErrors);
      return;
    }

    const user = await userService.createUser(parsed.data);
    sendSuccess(res, "User created successfully", user, 201);
  } catch (error) {
    next(error);
  }
};

export const getUsers = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const { users, pagination } = await userService.getUsers(req.query as Record<string, string>);
    sendSuccess(res, "Users retrieved successfully", users, 200, pagination);
  } catch (error) {
    next(error);
  }
};

/** GET /users/profile — returns the currently logged-in user */
export const getUserProfile = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await userService.getUserById(req.user!.userId);
    sendSuccess(res, "User retrieved successfully", user);
  } catch (error) {
    next(error);
  }
};

/** GET /users/:id — returns any user by ID (requires users.view OR self-access) */
export const getUserById = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const user = await userService.getUserById(req.params.id);
    sendSuccess(res, "User retrieved successfully", user);
  } catch (error) {
    next(error);
  }
};

export const updateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const parsed = updateUserSchema.safeParse(req.body);
    if (!parsed.success) {
      sendError(res, "Validation failed", 400, parsed.error.flatten().fieldErrors);
      return;
    }

    const user = await userService.updateUser(req.params.id, parsed.data);
    sendSuccess(res, "User updated successfully", user);
  } catch (error) {
    next(error);
  }
};

export const deleteUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const result = await userService.deleteUser(req.params.id, req.user!.userId);
    sendSuccess(res, result.message);
  } catch (error) {
    next(error);
  }
};

/** POST /users/:id/impersonate — Super Admin only. Returns a short-lived token for the target user. */
export const impersonateUser = async (req: AuthenticatedRequest, res: Response, next: NextFunction): Promise<void> => {
  try {
    const callerRole = req.user?.role;
    const isSuperAdmin = callerRole?.isSystemRole && callerRole?.roleName === "Super Admin";
    if (!isSuperAdmin) {
      sendError(res, "Forbidden — Super Admin only", 403);
      return;
    }

    if (req.user!.userId === req.params.id) {
      sendError(res, "Cannot impersonate yourself", 400);
      return;
    }

    const target = await userService.getUserById(req.params.id);
    const roleId = typeof (target as any).role === "object"
      ? (target as any).role._id.toString()
      : (target as any).role;

    // 2-hour token so the admin can browse comfortably before it expires
    const accessToken = signAccessToken({ userId: (target as any)._id.toString(), email: (target as any).email, roleId });

    sendSuccess(res, "Impersonation token generated", { accessToken, user: target });
  } catch (error) {
    next(error);
  }
};
