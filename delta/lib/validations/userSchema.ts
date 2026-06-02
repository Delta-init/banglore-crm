import { z } from "zod";

const passwordSchema = z
  .string()
  .min(8, "Password must be at least 8 characters")
  .regex(/[A-Z]/, "Must contain at least one uppercase letter")
  .regex(/[a-z]/, "Must contain at least one lowercase letter")
  .regex(/[0-9]/, "Must contain at least one number");

export const createUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100, "Name too long"),
  email: z.string().email("Invalid email address"),
  password: passwordSchema,
  role: z.string().min(1, "Role is required"),
  designation: z.string().max(100).optional(),
  extension: z.string().max(20).optional().nullable(),
  status: z.enum(["active", "inactive"]).default("active"),
});

export const updateUserSchema = z.object({
  name: z.string().min(1, "Name is required").max(100).optional(),
  email: z.string().email("Invalid email address").optional(),
  password: passwordSchema.optional().or(z.literal("")),
  role: z.string().min(1, "Role is required").optional(),
  designation: z.string().max(100).optional(),
  extension: z.string().max(20).optional().nullable(),
  status: z.enum(["active", "inactive"]).optional(),
});

export type CreateUserFormValues = z.infer<typeof createUserSchema>;
export type UpdateUserFormValues = z.infer<typeof updateUserSchema>;
