import mongoose, { Schema } from "mongoose";
import type { IRole, ModulePermissions } from "../types/index.js";
import { CRM_MODULES, OPEN_BY_DEFAULT } from "../types/index.js";

const modulePermissionsSchema = new Schema<ModulePermissions>(
  {
    view: { type: Boolean, default: false },
    create: { type: Boolean, default: false },
    edit: { type: Boolean, default: false },
    delete: { type: Boolean, default: false },
    approve: { type: Boolean, default: false },
    export: { type: Boolean, default: false },
  },
  { _id: false }
);

// Build permissions map schema dynamically from CRM_MODULES
const permissionsFields: Record<string, unknown> = {};
for (const mod of CRM_MODULES) {
  permissionsFields[mod] = { type: modulePermissionsSchema, default: () => ({ ...OPEN_BY_DEFAULT[mod] }) };
}

const roleSchema = new Schema<IRole>(
  {
    roleName: {
      type: String,
      required: [true, "Role name is required"],
      unique: true,
      trim: true,
      maxlength: [50, "Role name cannot exceed 50 characters"],
    },
    description: {
      type: String,
      trim: true,
      maxlength: [200, "Description cannot exceed 200 characters"],
    },
    permissions: {
      type: permissionsFields,
      default: {},
    },
    isSystemRole: {
      type: Boolean,
      default: false,
    },
  },
  {
    timestamps: true,
    versionKey: false,
  }
);

roleSchema.index({ roleName: 1 });

export const Role = mongoose.model<IRole>("Role", roleSchema);
