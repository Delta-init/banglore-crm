// ─── Permissions ──────────────────────────────────────────────────────────────
export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "export";

export interface ModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
}

export const CRM_MODULES = [
  "dashboard",
  "users",
  "roles",
  "leads",
  "teams",
  "courses",
  "reminders",
  "reports",
  "settings",
  "tracker",
  // The student list, and creating a student — which closing a lead does.
  "students",
  // My Enrolments: a counsellor's own sales and what finance made of them;
  // "edit" corrects one finance sent back.
  "enrolments",
  /* Balance payments (2026-10-13): part-paid closes and the next payment, for finance to approve. Open by default. */
  "balancePayments",
  /* Mentors (2026-10-17): the mentor calendar from the LMS. Open by default. */
  "mentors",
] as const;

export type CrmModule = (typeof CRM_MODULES)[number];

export const MODULE_LABELS: Record<CrmModule, string> = {
  dashboard: "Dashboard",
  users: "Users",
  roles: "Roles & Permissions",
  leads: "Leads",
  teams: "Teams",
  courses: "Courses",
  reminders: "Reminders",
  reports: "Reports",
  settings: "Settings",
  tracker: "Daily Tracker",
  students: "Students",
  enrolments: "My Enrolments",
  balancePayments: "Balance payments",
  mentors: "Mentors",
};

export type PermissionsMap = Partial<Record<CrmModule, ModulePermissions>>;

const NO_PERMISSIONS: ModulePermissions = { view: false, create: false, edit: false, delete: false, approve: false, export: false };

/**
 * What a role holds on a module it has never been given a value for — the
 * same default the server holds. Balance payments (2026-10-13) is open to
 * every role until its box is unticked; every other module starts with nothing.
 */
export const OPEN_BY_DEFAULT: Partial<Record<CrmModule, Partial<ModulePermissions>>> = {
  balancePayments: { view: true, create: true },
  mentors: { view: true, create: true, edit: true, delete: true },
};

/** A role's permissions on one module — what it was given, or the module's default. */
export function modulePermissions(perms: PermissionsMap | undefined, mod: CrmModule): ModulePermissions {
  return perms?.[mod] ?? { ...NO_PERMISSIONS, ...OPEN_BY_DEFAULT[mod] };
}

// ─── Role ─────────────────────────────────────────────────────────────────────
export interface Role {
  _id: string;
  roleName: string;
  description?: string;
  permissions: PermissionsMap;
  isSystemRole: boolean;
  createdAt: string;
  updatedAt: string;
}

export type RoleSimple = Pick<Role, "_id" | "roleName" | "description" | "isSystemRole">;

// ─── User ─────────────────────────────────────────────────────────────────────
export interface User {
  _id: string;
  name: string;
  email: string;
  role: Role | string;
  designation?: string;
  extension?: string | null;   // 3CX phone extension e.g. "101"
  status: "active" | "inactive";
  createdAt: string;
  updatedAt: string;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface AuthUser {
  _id: string;
  name: string;
  email: string;
  role: Role;
  designation?: string;
  extension?: string | null;
  status: "active" | "inactive";
}

export interface LoginResponse {
  accessToken: string;
  refreshToken: string;
  user: AuthUser;
}

// ─── API ──────────────────────────────────────────────────────────────────────
export interface ApiResponse<T = unknown> {
  success: boolean;
  message: string;
  data?: T;
  errors?: unknown;
  pagination?: PaginationMeta;
}

export interface PaginationMeta {
  total: number;
  page: number;
  limit: number;
  totalPages: number;
  hasNextPage: boolean;
  hasPrevPage: boolean;
}

export interface PaginatedResult<T> {
  data: T[];
  pagination: PaginationMeta;
}
