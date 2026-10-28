import type { EnrolmentStatus } from "./financeClient.js";

/*
 * An enrolment's journey after the close, in two steps:
 *
 *   1. Finance approved   accounts approved the enrolment
 *   2. LMS account        the student's LMS account exists, on the course
 *
 * Shown on every My Enrolments card and on the enrolment's own page, green /
 * yellow / red. Worked out from finance's answer for the enrolment — which
 * carries the LMS's side — and the outbox's own record, for what happened
 * before finance had it. Banglore students do not go to CS Portal, so
 * the Remote CRM's CS / onboarded / MT5 bonus steps are not here.
 */

export type StepState = "done" | "waiting" | "failed" | "unknown" | "skipped";
export type StepKey = "finance" | "lms";

export interface EnrolmentStep {
  key: StepKey;
  label: string;
  state: StepState;
  detail?: string;
  /** When it happened, and who did it, where that is known. */
  at?: string;
  by?: string;
}

/** What the outbox knows of the enrolment, for before finance had it. */
export interface HandoverLike {
  status?: string;
  lastError?: string | null;
  approvedAt?: Date | string | null;
  /** When it was last sent again after a send-back. */
  resentAt?: Date | string | null;
}

/** "5 Oct, 3:42 pm", in India, where the sales are made — put together from parts, which read the same on every runtime. */
const IST_TIME = new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Kolkata", day: "numeric", month: "short", hour: "numeric", minute: "2-digit", hour12: true });
function ist(v: Date | string): string {
  const p = Object.fromEntries(IST_TIME.formatToParts(new Date(v)).map((x) => [x.type, x.value]));
  return `${p.day} ${p.month}, ${p.hour}:${p.minute} ${String(p.dayPeriod ?? "").toLowerCase()}`.trim();
}

const LABEL: Record<StepKey, string> = {
  finance: "Finance approved",
  lms: "LMS account",
};

const step = (key: StepKey, state: StepState, more: Partial<EnrolmentStep> = {}): EnrolmentStep => ({
  key,
  label: LABEL[key],
  state,
  ...Object.fromEntries(Object.entries(more).filter(([, v]) => v !== undefined && v !== "")),
});

const iso = (v: Date | string | null | undefined) => (v ? new Date(v).toISOString() : undefined);

export function stepsOf(st: EnrolmentStatus | null | undefined, h?: HandoverLike | null): EnrolmentStep[] {
  // 1 — finance. Sent again after a send-back says so, and when (the user, 2026-10-05).
  const resent = h?.resentAt ? `Sent again ${ist(h.resentAt)}` : "";
  // On its way back to finance — which says "returned" until it arrives.
  const resending = h?.status === "pending" && Boolean(resent);
  let finance: EnrolmentStep;
  if (resending) {
    finance = step("finance", "waiting", { detail: `${resent} — on its way to finance`, at: iso(h?.resentAt) });
  } else if (!st) {
    finance = h?.status === "failed"
      ? step("finance", "failed", { detail: `Couldn't be sent to finance${h.lastError ? ` — ${h.lastError}` : ""}` })
      : h?.status === "sent"
        ? step("finance", "unknown", { detail: "Finance didn't answer — asked again shortly" })
        : step("finance", "waiting", { detail: "Not sent to finance yet" });
  } else if (st.status === "void") {
    finance = step("finance", "failed", { detail: "The invoice was voided" });
  } else if (st.approval === "approved" || st.approval === "not_required") {
    finance = step("finance", "done", { detail: st.invoiceNumber ? `Invoice ${st.invoiceNumber}` : undefined, at: iso(h?.approvedAt) });
  } else if (st.approval === "returned") {
    finance = h?.status === "failed" && resent
      ? step("finance", "failed", { detail: `${resent}, but finance didn't take it${h.lastError ? ` — ${h.lastError}` : ""}` })
      : step("finance", "failed", { detail: `Sent back${st.returnedReason ? `: ${st.returnedReason}` : ""} — correct it and send it again` });
  } else {
    finance = step("finance", "waiting", {
      detail: resent ? `${resent} — waiting for accounts to approve it` : "Waiting for accounts to approve it",
      at: iso(h?.resentAt),
    });
  }
  const approved = finance.state === "done";

  // 2 — the LMS
  const lms = st?.lms;
  const lmsStep = !approved
    ? step("lms", "waiting", { detail: "After finance approves it" })
    : !lms
      ? step("lms", "waiting", { detail: "On its way to the LMS" })
      : lms.state === "created"
      ? step("lms", "done", { detail: `New LMS account${lms.courses.length ? ` — ${lms.courses.join(", ")}` : ""}` })
      : lms.state === "existing"
        ? step("lms", "done", { detail: `Had an LMS account — ${lms.courses.length ? lms.courses.join(", ") : "the course"} added` })
        : lms.state === "waiting"
          ? step("lms", "waiting", { detail: lms.detail || "On its way to the LMS" })
          : step("lms", "failed", { detail: lms.detail || "The LMS turned it down" });

  return [finance, lmsStep];
}

/** Every step done — or not needed. */
export const allDone = (steps: EnrolmentStep[]) => steps.every((s) => s.state === "done" || s.state === "skipped");

/** The first step not done yet, as a sentence: "Next step: LMS account — …" / "Stopped at: Finance approved — …". */
export function waitingOn(steps: EnrolmentStep[]): string {
  const s = steps.find((x) => x.state !== "done" && x.state !== "skipped");
  if (!s) return "";
  return `${s.state === "failed" ? "Stopped at" : "Next step"}: ${s.label}${s.detail ? ` — ${s.detail}` : ""}`;
}
