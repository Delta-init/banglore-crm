import type { Request } from "express";
import type { Document, Types } from "mongoose";

// ─── Permission Actions ────────────────────────────────────────────────────────
export type PermissionAction = "view" | "create" | "edit" | "delete" | "approve" | "export";

export const LOST_REASONS = [
  "price_too_high",
  "not_interested",
  "competitor",
  "unresponsive",
  "budget_issue",
  "wrong_timing",
  "not_enquired",
  "other",
] as const;
export type LostReason = (typeof LOST_REASONS)[number];

/** What each reason is called on screen. */
export const LOST_REASON_LABELS: Record<LostReason, string> = {
  price_too_high: "Price too high",
  not_interested: "Not interested",
  competitor: "Went to a competitor",
  unresponsive: "Unresponsive",
  budget_issue: "Budget issue",
  wrong_timing: "Wrong timing",
  not_enquired: "Not enquired",
  other: "Other",
};

export interface ModulePermissions {
  view: boolean;
  create: boolean;
  edit: boolean;
  delete: boolean;
  approve: boolean;
  export: boolean;
}

// All available modules in the CRM
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
  "students",
  "tracker",
] as const;

export type CrmModule = (typeof CRM_MODULES)[number];

export type PermissionsMap = {
  [K in CrmModule]?: ModulePermissions;
};

// ─── Role ─────────────────────────────────────────────────────────────────────
export interface IRole extends Document {
  _id: Types.ObjectId;
  roleName: string;
  description?: string;
  permissions: PermissionsMap;
  isSystemRole: boolean;
  createdAt: Date;
  updatedAt: Date;
}

// ─── User ─────────────────────────────────────────────────────────────────────
export interface IUser extends Document {
  _id: Types.ObjectId;
  name: string;
  email: string;
  password: string;
  role: Types.ObjectId | IRole;
  designation?: string;
  extension?: string;        // 3CX phone extension number e.g. "101"
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
  comparePassword(candidatePassword: string): Promise<boolean>;
}

// ─── Auth ─────────────────────────────────────────────────────────────────────
export interface JwtPayload {
  userId: string;
  email: string;
  roleId: string;
}

export interface AuthenticatedRequest extends Request {
  user?: {
    userId: string;
    email: string;
    roleId: string;
    role?: IRole;
  };
}

// ─── API Response ─────────────────────────────────────────────────────────────
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

export interface PaginationQuery {
  page?: string;
  limit?: string;
  search?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
  status?: string;
  role?: string;
  isSystemRole?: string;
  team?: string;
}

// ─── Team ─────────────────────────────────────────────────────────────────────
export interface ITeamSettings {
  autoAssign: boolean;
  splitMode: "round_robin" | "equal_load";
  roundRobinIndex: number;
  includedMembers: Types.Array<Types.ObjectId | IUser>;
  splitTime?: string | null;           // legacy single "HH:mm" IST (mirror of splitTimes[0])
  splitTimes?: string[];               // multiple daily "HH:mm" IST split times
  sourceExclusions?: Map<string, string[]>; // userId → sources never auto-assigned to them
  roundRobinStartDate?: Date | null;   // count leads from this date for fair round-robin
  lastSplitAt?: Date | null;           // cron dedup — last time scheduled split ran
}

export interface IAbsentToday {
  userId: Types.ObjectId | IUser;
  date: Date;  // midnight UTC of the IST calendar day
}

export interface ITeam extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  leaders: Types.Array<Types.ObjectId | IUser>;
  members: Types.Array<Types.ObjectId | IUser>;
  status: "active" | "inactive";
  inactiveMembers: Types.Array<Types.ObjectId | IUser>;
  absentToday: Types.Array<IAbsentToday>;
  settings: ITeamSettings;
  createdAt: Date;
  updatedAt: Date;
}

export interface TeamFilters {
  search?: string;
  status?: string;
  page?: string;
  limit?: string;
}

// ─── Course ───────────────────────────────────────────────────────────────────
export interface ICourse extends Document {
  _id: Types.ObjectId;
  name: string;
  description?: string;
  amount: number;
  status: "active" | "inactive";
  createdAt: Date;
  updatedAt: Date;
}

// ─── Lead ──────────────────────────────────────────────────────────────────────
export type LeadStatus = "new" | "assigned" | "pending_response" | "followup" | "closed" | "lost" | "not_connected" | "mia" | "repeated" | "callback" | "cnc" | "booking" | "partialbooking";

export type InitialLeadResponse = "very_interested" | "not_interested" | "let_me_think";
export type PrimaryConcern      = "risk" | "price" | "time" | "trust" | "exact_concern";
export type FollowupStrategyType = "risk_based" | "price_based" | "time_based" | "trust_based";

export type ActivityAction =
  | "lead_created"
  | "lead_updated"
  | "status_changed"
  | "lead_assigned"
  | "team_assigned"
  | "note_added"
  | "note_updated"
  | "note_deleted";

export interface ILeadNote {
  _id: Types.ObjectId;
  content: string;
  author: Types.ObjectId | IUser;
  createdAt: Date;
  updatedAt: Date;
}

export interface IPayment {
  _id: Types.ObjectId;
  amount: number;
  note?: string;
  paidAt: Date;
  addedBy: Types.ObjectId | IUser;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IReminder {
  _id: Types.ObjectId;
  title?: string;
  note?: string;
  remindAt: Date;
  createdBy: Types.ObjectId | IUser;
  isDone: boolean;
  /** Set when the server sends the on-time push/socket notification */
  notifiedAt?: Date;
  /** Set when the server sends the 30-min advance-warning notification */
  warnedAt?: Date;
  createdAt?: Date;
  updatedAt?: Date;
}

export interface IActivityLog {
  _id: Types.ObjectId;
  action: ActivityAction;
  description: string;
  performedBy: Types.ObjectId | IUser;
  changes?: Record<string, { from: unknown; to: unknown }>;
  createdAt: Date;
}

export interface ILead extends Document {
  _id: Types.ObjectId;
  name: string;
  email?: string;
  phone: string;
  hasWhatsapp?: boolean;
  source?: string;
  status: LeadStatus;
  course?: Types.ObjectId | ICourse;
  assignedTo?: Types.ObjectId | IUser;
  assignedAt?: Date | null;
  team?: Types.ObjectId | ITeam;
  reporter: Types.ObjectId | IUser;
  notes: Types.DocumentArray<ILeadNote & Document>;
  reminders: Types.DocumentArray<IReminder & Document>;
  payments: Types.DocumentArray<IPayment & Document>;
  activityLogs: Types.DocumentArray<IActivityLog & Document>;
  platform?: string;
  campaign?: string;
  callNotConnected: number;
  callCount: number;
  lastCallAt?: Date | null;
  firstContactTime?: Date | null;
  initialLeadResponse?: InitialLeadResponse | null;
  primaryConcern?: PrimaryConcern | null;
  followupStrategyType?: FollowupStrategyType | null;
  sellingAmount?: number | null;
  /** Why the lead was lost. Set when the status becomes "lost", cleared when it leaves. */
  lostReason?: LostReason | null;
  lostNotes?: string | null;
  // Legacy import fields
  leadReceivedTime?: string | null;
  exactConcern?: string | null;
  demoScheduled?: boolean | null;
  demoAttended?: boolean | null;
  lastFollowupDate?: Date | null;
  comments?: string | null;
  closedAt?: Date | null;   // set when status transitions into booking/partialbooking/closed
  createdAt: Date;
  updatedAt: Date;
}

export interface LeadFilters {
  status?: LeadStatus;
  /** Narrow lost leads to one reason. Meaningless on any other status. */
  lostReason?: LostReason;
  assignedTo?: string;
  team?: string;
  reporter?: string;
  course?: string;
  source?: string;
  search?: string;
  /** ISO date string – filter leads created on or after this date (inclusive) */
  dateFrom?: string;
  /** ISO date string – filter leads created on or before this date (inclusive, end of day) */
  dateTo?: string;
  /** ISO date string – filter leads SPLIT/assigned (assignedAt) on or after this date */
  splitDateFrom?: string;
  /** ISO date string – filter leads SPLIT/assigned (assignedAt) on or before this date */
  splitDateTo?: string;
  /** "true" | "false" as a query string; anything else means no filter. */
  demoScheduled?: string;
  demoAttended?: string;
  /** ISO date — last follow-up on or after this day */
  followupFrom?: string;
  /** ISO date — last follow-up on or before this day */
  followupTo?: string;
  page?: string;
  limit?: string;
  sortBy?: string;
  sortOrder?: "asc" | "desc";
}

export interface LeadStats {
  total: number;
  new: number;
  assigned: number;
  pending_response: number;
  followup: number;
  closed: number;
  lost: number;
  not_connected: number;
  mia: number;
  repeated: number;
  callback: number;
  cnc: number;
}

// ─── Student ───────────────────────────────────────────────────────────────────
export interface IStudent extends Document {
  _id: Types.ObjectId;
  enrollmentNumber: string;
  name: string;
  phone?: string;
  email?: string;
  course?: Types.ObjectId | ICourse;
  team?: Types.ObjectId | ITeam;
  assignedTo?: Types.ObjectId | IUser;
  leadId: Types.ObjectId | ILead;
  initialLeadResponse?: InitialLeadResponse | null;
  primaryConcern?: PrimaryConcern | null;
  followupStrategyType?: FollowupStrategyType | null;
  demoScheduled: boolean;
  demoAttended: boolean;
  firstContactTime?: Date | null;
  lastFollowupDate?: Date | null;
  enrollmentDate: Date;
  feeStatus: "paid" | "partial" | "pending";
  totalFee: number;
  paidAmount: number;
  pendingAmount: number;
  status: "active" | "inactive" | "graduated" | "dropped";
  notes?: string;
  createdAt: Date;
  updatedAt: Date;
}

export interface ParsedLead {
  name: string;
  email?: string;
  phone: string;
  source?: string;
  notes?: string;
}

export interface ExcelParseResult {
  valid: ParsedLead[];
  invalid: { row: number; data: Record<string, unknown>; errors: string[] }[];
}

export interface AutoAssignResult {
  assigned: number;
  results: { leadId: string; assignedTo: string }[];
}
