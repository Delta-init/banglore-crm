import type { User } from "@/types";
import type { Team } from "@/types/team";
import type { Course } from "@/types/course";

export type LeadStatus = "new" | "assigned" | "pending_response" | "followup" | "closed" | "lost" | "not_connected" | "mia" | "repeated" | "callback" | "cnc";

export type InitialLeadResponse  = "very_interested" | "not_interested" | "let_me_think";
export type PrimaryConcern       = "risk" | "price" | "time" | "trust" | "exact_concern";
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

export interface LeadNote {
  _id: string;
  content: string;
  author: User | string;
  createdAt: string;
  updatedAt: string;
}

export interface Payment {
  _id: string;
  amount: number;
  note?: string;
  paidAt: string;
  addedBy: User | string;
  createdAt?: string;
  updatedAt?: string;
}

export interface Reminder {
  _id: string;
  title?: string;
  note?: string;
  remindAt: string;
  createdBy: User | string;
  isDone: boolean;
  createdAt?: string;
  updatedAt?: string;
}

export interface ReminderWithLead extends Reminder {
  lead: {
    _id: string;
    name: string;
    phone?: string;
    email?: string;
    status: LeadStatus;
    assignedTo?: User | string | null;
    team?: { _id: string; name: string } | string | null;
  };
}

export interface ActivityLog {
  _id: string;
  action: ActivityAction;
  description: string;
  performedBy: User | string;
  changes?: Record<string, { from: unknown; to: unknown }>;
  createdAt: string;
}

export interface Lead {
  _id: string;
  name: string;
  email?: string;
  phone?: string;
  hasWhatsapp?: boolean;
  source?: string;
  campaignId?: string;
  status: LeadStatus;
  /** Set when the lead is marked lost, cleared if it is revived. */
  lostReason?: string | null;
  lostNotes?: string | null;
  course?: Course | string | null;
  assignedTo?: User | string | null;
  assignedAt?: string | null;
  team?: Team | string | null;
  reporter?: User | string | null;
  notes: LeadNote[];
  reminders: Reminder[];
  payments: Payment[];
  activityLogs: ActivityLog[];
  callNotConnected?: number;
  callCount?: number;
  lastCallAt?: string | null;
  platform?: string;
  campaign?: string;
  leadReceivedTime?: string | null;
  lastFollowupDate?: string | null;
  demoScheduled?: boolean | null;
  demoAttended?: boolean | null;
  exactConcern?: string | null;
  comments?: string | null;
  firstContactTime?: string | null;
  initialLeadResponse?: InitialLeadResponse | null;
  primaryConcern?: PrimaryConcern | null;
  followupStrategyType?: FollowupStrategyType | null;
  sellingAmount?: number | null;
  createdAt: string;
  updatedAt: string;
}

export interface LeadFilters {
  page?: number;
  limit?: number;
  status?: string;
  assignedTo?: string;
  team?: string;
  reporter?: string;
  course?: string;
  source?: string;
  campaignId?: string;
  demoScheduled?: string;
  demoAttended?: string;
  followupFrom?: string;
  followupTo?: string;
  search?: string;
  /** YYYY-MM-DD — leads created on or after this date */
  dateFrom?: string;
  /** YYYY-MM-DD — leads created on or before this date */
  dateTo?: string;
  /** YYYY-MM-DD — leads SPLIT/assigned (assignedAt) on or after this date */
  splitDateFrom?: string;
  /** YYYY-MM-DD — leads SPLIT/assigned (assignedAt) on or before this date */
  splitDateTo?: string;
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

export interface InvalidRow {
  row: number;
  data: Record<string, unknown>;
  errors: string[];
}

export interface UploadLeadsResult {
  total: number;
  created: number;
  assigned: number;
  invalid: number;
  invalidDetails: InvalidRow[];
}

export interface AutoAssignResult {
  assigned: number;
  results: { leadId: string; assignedTo: string }[];
}

/**
 * Why a lead was lost. Mirrors the list the server accepts.
 *
 * "Not enquired" is the one that is not really a loss: the lead never asked
 * about anything, so counting it beside a lead that went to a competitor would
 * flatter the pipeline in one direction and the sales team in the other.
 */
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

/** The label, or a tidied slug for a reason recorded before this list grew. */
export function lostReasonLabel(reason?: string | null): string {
  if (!reason) return "";
  return (
    LOST_REASON_LABELS[reason as LostReason] ??
    reason.replace(/_/g, " ").replace(/\b\w/g, (c) => c.toUpperCase())
  );
}
