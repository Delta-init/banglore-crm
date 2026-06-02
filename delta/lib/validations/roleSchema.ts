import { z } from "zod";
import { CRM_MODULES } from "@/types";

const modulePermissionsSchema = z.object({
  view: z.boolean().default(false),
  create: z.boolean().default(false),
  edit: z.boolean().default(false),
  delete: z.boolean().default(false),
  approve: z.boolean().default(false),
  export: z.boolean().default(false),
});

const permissionsSchema = z
  .object(Object.fromEntries(CRM_MODULES.map((mod) => [mod, modulePermissionsSchema.optional()])))
  .optional();

export const createRoleSchema = z.object({
  roleName: z.string().min(1, "Role name is required").max(50, "Role name too long"),
  description: z.string().max(200).optional(),
  permissions: permissionsSchema,
});

export const updateRoleSchema = z.object({
  roleName: z.string().min(1, "Role name is required").max(50).optional(),
  description: z.string().max(200).optional(),
  permissions: permissionsSchema,
});

export type CreateRoleFormValues = z.infer<typeof createRoleSchema>;
export type UpdateRoleFormValues = z.infer<typeof updateRoleSchema>;
