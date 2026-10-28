import { FinanceHandover } from "../models/FinanceHandover.js";
import { Student } from "../models/Student.js";
import { fetchEnrolmentStatuses, type EnrolmentStatus } from "./financeClient.js";
import { allDone, stepsOf, type EnrolmentStep } from "./enrolmentSteps.js";

/*
 * Here two steps (finance approved, LMS account): Banglore's students do not go
 * to CS Portal.
 *
 * The enrolment workflow for the Root portal (the user, 2026-10-14: "show the
 * my enrolments workflow of every sales portal … where is the more pending —
 * finance, broker admin, salesperson"). Every close handed to finance, its
 * five steps worked out exactly as My Enrolments does (enrolmentSteps.stepsOf,
 * from finance's answer and the outbox's own record), the step it stands at,
 * and whom that waits on:
 *
 *   finance        accounts, to approve it (or finance not answering yet);
 *   salesperson    sent back, or refused — its closer corrects it and sends it again;
 *   lms            the LMS, making the account;
 *   cs_manager     CS Portal has the student, nobody gave them a CS yet;
 *   cs             their CS: the welcome, or logging the MT5 the bonus needs (or a bonus turned down);
 *   broker_admin   a broker admin, approving the MT5 bonus;
 *   tetra          CS Portal itself (on its way there, or it didn't answer).
 *
 * Unfinished ones in full; finished ones only counted. Read only.
 */

export type WaitingRole = "finance" | "salesperson" | "lms" | "cs_manager" | "cs" | "broker_admin" | "tetra";

/** Who the step it stands at waits on — here only finance (or, sent back, its closer) and the LMS. */
function waitingOf(step: EnrolmentStep, _st: EnrolmentStatus | undefined, closer: string): { role: WaitingRole; name: string } {
  if (step.key === "finance") return step.state === "failed" ? { role: "salesperson", name: closer } : { role: "finance", name: "" };
  return { role: "lms", name: "" };
}

const iso = (v: unknown) => (v ? new Date(v as string).toISOString() : "");

/** GET /service/enrolment-flow — every unfinished close with its steps, and how many there are, finished included. */
export async function enrolmentFlowForPortal() {
  const handovers = await FinanceHandover.find({})
    .select("studentId status lastError approvedAt resentAt sentAt createdAt invoiceNumber")
    .lean();
  const ids = handovers.map((h) => h.studentId);
  const students = await Student.find({ _id: { $in: ids } })
    .select("name enrollmentNumber course assignedTo team enrollmentDate")
    .populate("course", "name")
    .populate("assignedTo", "name email")
    .populate("team", "name")
    .lean();
  const studentOf = new Map(students.map((s) => [String(s._id), s]));
  const live = handovers.filter((h) => studentOf.has(String(h.studentId)));
  // One finance organization here (Bangalore's), asked 200 at a time.
  const sentIds = live.map((h) => String(h.studentId));
  const batches: Promise<EnrolmentStatus[]>[] = [];
  for (let i = 0; i < sentIds.length; i += 200) batches.push(fetchEnrolmentStatuses(sentIds.slice(i, i + 200)));
  const statuses = (await Promise.all(batches)).flat();
  const statusOf = new Map(statuses.map((st) => [st.externalId, st]));

  let finished = 0;
  const open = [];
  for (const h of live) {
    const id = String(h.studentId);
    const s = studentOf.get(id)!;
    const st = statusOf.get(id);
    const steps = stepsOf(st ?? null, {
      status: h.status,
      lastError: h.lastError,
      approvedAt: h.approvedAt,
      resentAt: h.resentAt,
    });
    if (allDone(steps)) { finished++; continue; }
    const at = steps.find((x) => x.state !== "done" && x.state !== "skipped")!;
    const closer = s.assignedTo as { _id?: unknown; name?: string; email?: string } | null;
    const team = s.team as { name?: string } | null;
    const course = s.course as { name?: string } | null;
    open.push({
      id,
      name: s.name ?? "",
      enrollmentNumber: s.enrollmentNumber ?? "",
      course: course?.name ?? "",
      academy: "bangalore",
      closedBy: { id: closer?._id ? String(closer._id) : "", name: closer?.name ?? "", email: String(closer?.email ?? "").toLowerCase() },
      team: team?.name ?? "",
      closedAt: iso(s.enrollmentDate),
      invoiceNumber: st?.invoiceNumber || h.invoiceNumber || "",
      stage: at.key,
      stageState: at.state,
      detail: at.detail ?? "",
      waitingOn: waitingOf(at, st, closer?.name ?? ""),
      cs: "",
      since: at.at || iso(h.resentAt) || iso(h.sentAt) || iso(h.createdAt) || iso(s.enrollmentDate),
      steps: steps.map((x) => ({ key: x.key, state: x.state })),
    });
  }
  return {
    // Finance could not be asked about any of them: steps from finance on are unknown, said so rather than guessed.
    financeAnswered: !live.some((h) => h.status === "sent") || statuses.length > 0,
    total: live.length,
    finished,
    open,
  };
}
