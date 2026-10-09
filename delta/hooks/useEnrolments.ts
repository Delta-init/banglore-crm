import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { toast } from "@/lib/toast";
import type { StoredReceipt, Student } from "@/types/student";

const KEY = ["enrolments"] as const;

/** What the outbox knows: whether the enrolment reached finance at all. */
export interface Handover {
  status: "pending" | "sent" | "failed";
  /** What the outbox last heard from finance — available even when finance is not. */
  approvalState: "pending" | "approved" | "returned" | "not_required" | "unknown";
  returnedReason: string;
  returnedAt: string | null;
  /** When it was last sent again after a send-back, and how many times; absent from a server from before. */
  resentAt?: string | null;
  resends?: number;
  attempts: number;
  lastError: string;
  invoiceId: string;
  invoiceNumber: string;
  flags: string[];
  sentAt: string | null;
}

/**
 * What finance knows: whether anybody has approved it.
 *
 * Null when finance could not be reached. That is different from "nobody has
 * looked yet", and the screen says so rather than guessing.
 */
export interface InvoiceState {
  externalId: string;
  invoiceId: string;
  invoiceNumber: string;
  status: string;
  approval: "pending" | "approved" | "returned" | "not_required";
  returnedReason: string;
  issueDate: string;
  currency: string;
  totalMinor: number;
  amountPaidMinor: number;
  balanceMinor: number;
  /** Once approved, what the Delta LMS made of the student. Null before; absent from a finance that did not say. */
  lms?: EnrolmentLms | null;
}

/** Whether the LMS took the student — a new account or theirs — and on which courses, or why not yet. */
export interface EnrolmentLms {
  state: "created" | "existing" | "waiting" | "unmapped" | "failed";
  detail?: string;
  courses: string[];
}

/**
 * One of an enrolment's steps after the close — finance approved, LMS
 * account — as the server works them out.
 * done green, waiting yellow, failed red; unknown and skipped grey.
 */
export interface EnrolmentStep {
  key: "finance" | "lms";
  label: string;
  state: "done" | "waiting" | "failed" | "unknown" | "skipped";
  detail?: string;
  at?: string;
  by?: string;
}

export interface Enrolment extends Student {
  handover: Handover | null;
  invoice: InvoiceState | null;
  /** Its steps; absent from a server from before they were shown. */
  steps?: EnrolmentStep[];
}

/** One enrolment, for its own page, with its steps. */
export type EnrolmentDetail = Enrolment;

export interface EnrolmentCounts {
  total: number;
  onThisPage: number;
  approved: number;
  pending: number;
  returned: number;
  notInvoiced: number;
  failed: number;
  flagged: number;
}

export const useMyEnrolments = (filters: { mine?: boolean; search?: string; state?: string; page?: number; limit?: number }) =>
  useQuery({
    queryKey: [...KEY, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters.mine === false) params.set("mine", "false");
      if (filters.search) params.set("search", filters.search);
      if (filters.state) params.set("state", filters.state);
      if (filters.page) params.set("page", String(filters.page));
      if (filters.limit) params.set("limit", String(filters.limit));
      const res = await api.get<{
        success: boolean;
        data: Enrolment[];
        counts: EnrolmentCounts;
        pagination: { page: number; limit: number; total: number; pages: number };
      }>(`/students/enrolments/mine?${params.toString()}`);
      return res.data;
    },
    // Approval happens in another system, on somebody else's schedule — but
    // one on its way to finance (sent, or sent again) is looked at again in a
    // moment, so "Sending…" turns into what finance said without a reload.
    refetchInterval: (q) => ((q.state.data?.data ?? []).some((e) => e.handover?.status === "pending") ? 3_000 : 30_000),
  });

/** One enrolment, for its own page. */
export const useEnrolment = (id: string) =>
  useQuery({
    queryKey: [...KEY, "one", id],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: EnrolmentDetail }>(`/students/enrolments/${id}`);
      return res.data.data;
    },
    enabled: Boolean(id),
    // Sooner while it is on its way to finance, as on the list.
    refetchInterval: (q) => (q.state.data?.handover?.status === "pending" ? 3_000 : 30_000),
  });

export const useRequestInvoice = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (studentId: string) => {
      const res = await api.post<{ message: string }>(`/students/${studentId}/invoice`);
      return res.data;
    },
    onSuccess: (d) => {
      toast.success(d.message ?? "Sent to finance");
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["students"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "Could not send this to finance";
      toast.error(msg);
    },
  });
};

/**
 * What correcting a sent-back enrolment starts from: the enrolment, whether
 * finance has it sent back and why, the money the lead holds of its own (a
 * payment of its own on the form, at that figure), and — for whoever may move
 * a sale — the counsellors and teams.
 */
export interface EnrolmentCorrectionStart {
  sentBack: boolean;
  returnedReason: string;
  invoiceNumber: string;
  /** What the outbox last heard, and when it was last sent again — for the student page. */
  approvalState?: Handover["approvalState"];
  resentAt?: string | null;
  resends?: number;
  mayMove: boolean;
  ownOnLead: number;
  counsellors?: { _id: string; name: string }[];
  teams?: { _id: string; name: string }[];
  student: Student;
}

/** Everything a close took, sent again as the correction. */
export interface EnrolmentCorrectionInput {
  name: string;
  phone: string;
  email: string;
  course: string;
  team?: string | null;
  assignedTo?: string | null;
  enrollmentDate: string;
  feeStatus: string;
  totalFee: number;
  paidAmount: number;
  notes: string;
  language: string;
  /** `amount` in INR. */
  payments: {
    method: string; amount: number; receipt: StoredReceipt | null; paidAt: string; collectedBefore?: boolean;
  }[];
  hasBonus: boolean;
  bonusAmount: number;
}

/** The correction's starting point — only asked for while the dialog is open. */
export const useEnrolmentCorrection = (studentId: string, enabled = true) =>
  useQuery({
    queryKey: [...KEY, "correction", studentId],
    queryFn: async () => {
      const res = await api.get<{ success: boolean; data: EnrolmentCorrectionStart }>(`/students/${studentId}/correction`);
      return res.data.data;
    },
    enabled: Boolean(studentId) && enabled,
    // A 403 (not theirs) or 404 is an answer, not something to retry.
    retry: false,
    staleTime: 0,
  });

/** Save the correction and send it to finance again, in one step. */
export const useCorrectEnrolment = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: EnrolmentCorrectionInput }) => {
      const res = await api.put<{ message: string; data: Student }>(`/students/${id}/correction`, data);
      return res.data;
    },
    onSuccess: (d) => {
      toast.success(d.message ?? "Corrected and sent to finance");
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: ["students"] });
      qc.invalidateQueries({ queryKey: ["leads"] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message
        ?? "Could not save the correction";
      toast.error(msg);
    },
  });
};

/**
 * Where a send-back stands, from what finance says and what the outbox knows:
 * on its way back to finance (finance still says "returned" until it
 * arrives), sent back, or sent again since — the user, 2026-10-05: "if send
 * again show that also".
 */
export function sendBackState(e: Pick<Enrolment, "invoice" | "handover">) {
  const h = e.handover;
  const resending = h?.status === "pending" && Boolean(h?.resentAt);
  const sentBack = !resending && (e.invoice?.approval ?? h?.approvalState) === "returned";
  return {
    resending,
    sentBack,
    /** Sent again at least once and not sent back since. */
    sentAgain: !sentBack && Boolean(h?.resentAt),
    reason: e.invoice?.returnedReason || h?.returnedReason || "",
  };
}

/** "5 Oct, 3:42 pm", in India — put together from parts, which read the same in every browser. */
const IST_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
export function istTime(iso?: string | null): string {
  if (!iso) return "";
  const p = Object.fromEntries(IST_TIME.formatToParts(new Date(iso)).map((x) => [x.type, x.value]));
  return `${p.day} ${p.month}, ${p.hour}:${p.minute} ${String(p.dayPeriod ?? "").toLowerCase()}`.trim();
}
