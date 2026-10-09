import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest, CrmModule, PermissionAction } from "../types/index.js";
import { sendError } from "../utils/response.js";

/**
 * Middleware factory that checks if the authenticated user's role
 * has the required permission for a given module.
 */
export const checkPermission = (module: CrmModule, action: PermissionAction) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const role = req.user?.role;

    if (!role) {
      sendError(res, "Role information missing", 403);
      return;
    }

    // Super Admin role has unrestricted access
    if (role.isSystemRole && role.roleName === "Super Admin") {
      next();
      return;
    }

    const modulePerms = role.permissions?.[module];

    if (!modulePerms) {
      sendError(res, `Access denied: no permissions defined for module '${module}'`, 403);
      return;
    }

    if (!modulePerms[action]) {
      sendError(
        res,
        `Access denied: you do not have '${action}' permission on '${module}'`,
        403
      );
      return;
    }

    next();
  };
};

/**
 * Middleware that lets through a role holding any one of several permissions —
 * for a route two screens share, each gated its own way.
 */
export const checkAnyPermission = (...grants: [CrmModule, PermissionAction][]) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const role = req.user?.role;
    if (!role) {
      sendError(res, "Role information missing", 403);
      return;
    }
    if (role.isSystemRole && role.roleName === "Super Admin") {
      next();
      return;
    }
    if (grants.some(([module, action]) => role.permissions?.[module]?.[action])) {
      next();
      return;
    }
    sendError(
      res,
      `Access denied: you need ${grants.map(([module, action]) => `'${action}' on '${module}'`).join(" or ")}`,
      403,
    );
  };
};

/**
 * Middleware that checks if the user has any permission on a given module.
 * Useful for protecting entire resource routes.
 */
export const requireModule = (module: CrmModule) => {
  return (req: AuthenticatedRequest, res: Response, next: NextFunction): void => {
    const role = req.user?.role;

    if (!role) {
      sendError(res, "Role information missing", 403);
      return;
    }

    if (role.isSystemRole && role.roleName === "Super Admin") {
      next();
      return;
    }

    const modulePerms = role.permissions?.[module];
    const hasAnyAccess =
      modulePerms &&
      Object.values(modulePerms).some(Boolean);

    if (!hasAnyAccess) {
      sendError(res, `Access denied: no access to module '${module}'`, 403);
      return;
    }

    next();
  };
};
