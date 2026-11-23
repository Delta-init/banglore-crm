import crypto from "node:crypto";
import { Types } from "mongoose";
import { env } from "../config/env.js";
import { Course } from "../models/Course.js";
import { FinanceHandover } from "../models/FinanceHandover.js";
import { Lead } from "../models/Lead.js";
import { Student } from "../models/Student.js";
import { User } from "../models/User.js";
import { BASE_CURRENCY, type ICourseChange, type IRole } from "../types/index.js";
import {
  FinanceRefusal, fetchEnrolmentStatuses, sendCourseChange,
  type EnrolmentStatus, type FinanceCourseChange,
} from "./financeClient.js";
import { financeCourseOf } from "./studentService.js";

/*
 * Change course after finance approved the enrolment (the user, 2026-11-23). A salesperson reopened a closed,
 * approved lead, put it on a cheaper course and closed it again: finance never heard — the invoice kept the old course
 * and price — while the lead's Payments card measured the money against the new course and said "100% paid".
 *
 * So the course and fee of an enrolment finance has are no longer edited here (the locks: leadService.updateLead,
 * StudentService.updateStudent). A change is asked for instead — the new course, its fee and why — and sent to
 * finance at once, where it waits in Approvals as a "Course change", as a balance payment does. Finance's decision
 * comes back with the enrolment's status (every minute, beside the approvals — financeHandoverWorker.ts): approved,
 * the student and the lead move to the new course at the new fee; rejected, it says why. Applied once, by the
 * request's id. This CRM counts no commission of its own, so there is none to count again.
 *
 * One academy here — Bangalore, in rupees — and one finance organization (FINANCE_ORG_ID), as the close and the
 * balance payments use.
 *
 * A request finance kept while this CRM never heard back (a timeout) is taken from finance's answer — an id finance
 * has that isn't here — and handled like any other (2026-11-23).
 */

type Viewer = { userId: string; role?: IRole | null };

const UUID = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;
const BATCH = 200;
/** How long after a request is sent its enrolment is still looked at for one finance kept unheard — well past a timeout. */
const ASKED_OPEN_MS = 10 * 60_000;
/** The reason on a request taken from finance, whose own record here was lost. */
export const ADOPTED_REASON = "Asked from the CRM; its record here was lost — taken from finance";
/** Finance refusing because one is already waiting for it. */
const ALREADY_WAITING = /already waiting|still pending/i;
const escapeRe = (s: string) => s.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");

const fail = (statusCode: number, message: string) => Object.assign(new Error(message), { statusCode });
const round2 = (n: number) => Math.round(n * 100) / 100;
const minor = (n: number) => Math.round(n * 100);
const money = (n: number) =>
  `${BASE_CURRENCY} ${(Number(n) || 0).toLocaleString("en-US", { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
const feeStatusOf = (fee: number, paid: number) => (fee <= 0 || paid <= 0 ? "pending" : paid >= fee ? "paid" : "partial");
const isSuperAdmin = (role?: { isSystemRole?: boolean; roleName?: string } | null) =>
  Boolean(role?.isSystemRole && role.roleName === "Super Admin");

type StudentLite = {
  _id: Types.ObjectId;
  course?: unknown;
  totalFee?: number;
  paidAmount?: number;
  assignedTo?: unknown;
  leadId?: unknown;
  courseChanges?: ICourseChange[];
};

/**
 * The enrolment, if this viewer may change its course — as Correct it here: the closer their own (with
 * enrolments:edit, which the route asks for), anyone who may edit students — or a Super Admin — any.
 */
async function changeable(viewer: Viewer, studentId: string): Promise<StudentLite> {
  if (!Types.ObjectId.isValid(studentId)) throw fail(404, "Enrolment not found");
  const student = await Student.findById(studentId)
    .select("course totalFee paidAmount assignedTo leadId courseChanges")
    .lean<StudentLite>();
  if (!student) throw fail(404, "Enrolment not found");
  const any = isSuperAdmin(viewer.role) || viewer.role?.permissions?.students?.edit === true;
  if (String(student.assignedTo ?? "") !== viewer.userId && !any) throw fail(403, "This enrolment isn't yours to change");
  return student;
}

/**
 * Where finance stands on the enrolment, asked live (finance may have decided a minute ago): a course can be changed
 * only once finance has it and has approved it. Sent back, the correction is the way; not sent yet, the close is.
 */
async function financeState(student: StudentLite): Promise<{ whyNot: string; status?: EnrolmentStatus; unreachable?: boolean }> {
  const h = await FinanceHandover.findOne({ studentId: student._id }).select("status").lean();
  if (!h || h.status !== "sent") {
    return { whyNot: "This enrolment isn't in finance yet — change its course by editing the enrolment instead." };
  }
  const [st] = await fetchEnrolmentStatuses([String(student._id)]);
  if (!st) return { unreachable: true, whyNot: "Finance didn't answer about this enrolment — try again in a minute." };
  if (st.status === "void") return { status: st, whyNot: `Its invoice${st.invoiceNumber ? ` ${st.invoiceNumber}` : ""} is void in finance.` };
  if (st.approval === "returned") {
    return { status: st, whyNot: "Finance sent this enrolment back — correct its course and fee with Correct it instead." };
  }
  // "not_required": an invoice finance raised without needing an approval — as good as approved.
  if (st.approval !== "approved" && st.approval !== "not_required") {
    return { status: st, whyNot: "Finance hasn't approved this enrolment yet — wait for its decision (sent back, correct it there)." };
  }
  return { status: st, whyNot: "" };
}

export class CourseChangeService {
  /**
   * What the Change course dialog starts from: whether a change can be asked now (and if not, why), the course and fee
   * as they are, what is paid, the invoice as finance has it, and every change asked for so far.
   */
  async info(viewer: Viewer, studentId: string) {
    const student = await changeable(viewer, studentId);
    const course = student.course ? await Course.findById(student.course).select("name").lean() : null;
    const pending = (student.courseChanges ?? []).find((c) => c.status === "pending");
    const state = pending ? null : await financeState(student);
    const st = state?.status;
    return {
      canRequest: !pending && !state?.whyNot,
      whyNot: pending ? `A change to ${pending.courseName} is already waiting for finance.` : state?.whyNot ?? "",
      academy: "bangalore" as const,
      currency: BASE_CURRENCY,
      course: course ? { id: String(course._id), name: course.name } : null,
      fee: student.totalFee ?? 0,
      paid: student.paidAmount ?? 0,
      invoice: st
        ? { number: st.invoiceNumber, currency: st.currency, totalMinor: st.totalMinor, paidMinor: st.amountPaidMinor, balanceMinor: st.balanceMinor }
        : null,
      changes: student.courseChanges ?? [],
    };
  }

  /**
   * Ask finance to change the course: checked here, then sent to finance synchronously — refused there, refused here
   * with finance's reason. `key` is the dialog's own id for the request (a UUID), so pressing it twice, or again after
   * a timeout, is the same request.
   */
  async request(viewer: Viewer, studentId: string, body: Record<string, unknown>): Promise<ICourseChange> {
    const student = await changeable(viewer, studentId);
    const courseId = String(body.courseId ?? "");
    const fee = Number(body.fee);
    const reason = typeof body.reason === "string" ? body.reason.trim() : "";
    const key = typeof body.key === "string" && UUID.test(body.key) ? body.key.toLowerCase() : "";

    const missing: string[] = [];
    if (!Types.ObjectId.isValid(courseId)) missing.push("the new course");
    if (!Number.isFinite(fee) || fee <= 0) missing.push("the new fee");
    if (reason.length < 3) missing.push("why it changes");
    if (missing.length) throw fail(422, `A course change needs ${missing.join(", ")}.`);
    if (Math.abs(fee * 100 - Math.round(fee * 100)) > 1e-6) throw fail(422, "The fee can have at most 2 decimals.");
    if (reason.length > 500) throw fail(422, "Keep the reason under 500 characters.");

    // Asked already (a retry of the same dialog): the same request back, nothing sent twice.
    const asked = key ? (student.courseChanges ?? []).find((c) => c.externalId === key) : undefined;
    if (asked) return asked;
    const pending = (student.courseChanges ?? []).find((c) => c.status === "pending");
    if (pending) throw fail(409, `A change to ${pending.courseName} is already waiting for finance — one at a time.`);

    const course = await Course.findById(courseId).lean();
    if (!course) throw fail(422, "That course no longer exists — choose another.");
    if (course.status === "inactive") throw fail(422, `${course.name} isn't sold any more — choose another course.`);

    const paid = round2(student.paidAmount ?? 0);
    if (minor(fee) < minor(paid)) throw fail(422, `${money(paid)} is already paid — the new fee can't be less.`);
    if (String(student.course ?? "") === String(course._id) && minor(fee) === minor(student.totalFee ?? 0)) {
      throw fail(422, `It is on ${course.name} at ${money(fee)} already — nothing to change.`);
    }

    const state = await financeState(student);
    if (state.whyNot) throw fail(state.unreachable ? 502 : 409, state.whyNot);

    const me = await User.findById(viewer.userId).select("name email").lean<{ name?: string; email?: string }>();
    const externalId = key || crypto.randomUUID();
    // Marked before it goes: if finance keeps it and the answer never comes back, the read-back still finds it there.
    await Student.updateOne({ _id: student._id }, { $set: { courseChangeAskedAt: new Date() } });
    try {
      await sendCourseChange({
        enrolmentExternalId: String(student._id),
        externalId,
        // Exactly as the close names it — the same item and LMS courses.
        course: financeCourseOf(course),
        priceMinor: minor(fee),
        reason,
        requestedBy: { name: me?.name ?? "", email: me?.email ?? "" },
      }, env.FINANCE_ORG_ID);
    } catch (err) {
      if (err instanceof FinanceRefusal) {
        // Finance's reason is for the person: already paid more, one waiting already, nothing changes. One waiting
        // that isn't here is one this CRM sent and never heard back about: the read-back takes it from finance.
        const message = ALREADY_WAITING.test(err.message)
          ? `${err.message.replace(/[.\s]+$/, "")}. It will show here within a few minutes.`
          : err.message;
        throw fail(err.status === 0 || err.status >= 500 || err.status === 401 || err.status === 403 ? 502 : 409, message);
      }
      throw err;
    }

    const entry: ICourseChange = {
      externalId,
      courseId: course._id as Types.ObjectId,
      courseName: course.name,
      fee: round2(fee),
      reason,
      status: "pending",
      requestedBy: { id: Types.ObjectId.isValid(viewer.userId) ? new Types.ObjectId(viewer.userId) : null, name: me?.name ?? "" },
      requestedAt: new Date(),
    };
    // Once, by its id: a second press that got here too adds nothing.
    await Student.updateOne({ _id: student._id, "courseChanges.externalId": { $ne: externalId } }, { $push: { courseChanges: entry } });
    return entry;
  }
}

// ── Finance's decisions, read back ───────────────────────────────────────────────────────────────────────────────────

/**
 * An approved change, made here (once — the request is still pending here, or nothing happens): the student's course
 * and fee, what is left to pay and the fee status; the lead's course (and selling amount, where it has one) with an
 * entry in its activity.
 */
export async function applyApprovedCourseChange(studentId: string, d: FinanceCourseChange): Promise<boolean> {
  if (!Types.ObjectId.isValid(studentId)) return false;
  const pendingHere = { $elemMatch: { externalId: d.externalId, status: "pending" } };
  const student = await Student.findOne({ _id: new Types.ObjectId(studentId), courseChanges: pendingHere })
    .select("course totalFee paidAmount assignedTo leadId courseChanges")
    .lean<StudentLite>();
  if (!student) return false;                              // not asked here, or applied already
  const cc = (student.courseChanges ?? []).find((c) => c.externalId === d.externalId)!;
  // Finance's price is what the invoice says now; the one asked for otherwise (they are the same).
  const fee = d.priceMinor > 0 ? round2(d.priceMinor / 100) : cc.fee;
  const paid = round2(student.paidAmount ?? 0);
  const now = new Date();
  // Taken from finance with a course that isn't one here: the fee changes, the course stays as it is.
  const keepsCourse = !cc.courseId;
  const done = await Student.updateOne(
    // Not while something else is changing what was paid: then the next pass does it.
    { _id: student._id, paidAmount: student.paidAmount ?? null, courseChanges: pendingHere },
    {
      $set: {
        ...(keepsCourse ? {} : { course: cc.courseId }),
        totalFee: fee,
        pendingAmount: Math.max(0, round2(fee - paid)),
        feeStatus: feeStatusOf(fee, paid),
        "courseChanges.$.status": "approved",
        "courseChanges.$.appliedAt": now,
        "courseChanges.$.decidedAt": d.decidedAt ? new Date(d.decidedAt) : now,
        "courseChanges.$.decidedBy": d.decidedBy ?? "",
        ...(d.note ? { "courseChanges.$.note": d.note } : {}),
      },
    },
  );
  if (!done.modifiedCount) return false;

  const from = student.course ? await Course.findById(student.course).select("name").lean() : null;
  const fromName = from?.name ?? "no course";
  const lead = student.leadId
    ? await Lead.findById(student.leadId).select("sellingAmount reporter").lean<{ _id: Types.ObjectId; sellingAmount?: number | null; reporter?: Types.ObjectId | null }>()
    : null;
  if (lead) {
    /*
     * Who asked for it; finance approved it. Every line in a lead's activity needs a performer here, or the lead can't
     * be saved again ("Path `performedBy` is required" — the came-in-again lines, 2026-11-10): for one taken from
     * finance, nobody known asked, so the lead's reporter stands in, as it does for those lines — else its closer.
     */
    const by = cc.requestedBy?.id ?? lead.reporter ?? (student.assignedTo as Types.ObjectId | null | undefined) ?? null;
    const description = (keepsCourse
      ? `Fee changed (finance approved): ${money(student.totalFee ?? 0)} → ${money(fee)} — finance moved it to ${cc.courseName}, which isn't a course here, so the course stays ${fromName}`
      : `Course changed (finance approved): ${fromName} → ${cc.courseName}, fee ${money(student.totalFee ?? 0)} → ${money(fee)}`).slice(0, 500);
    await Lead.updateOne(
      { _id: lead._id },
      {
        $set: { ...(keepsCourse ? {} : { course: cc.courseId }), ...(lead.sellingAmount != null ? { sellingAmount: fee } : {}) },
        ...(by
          ? {
              $push: {
                activityLogs: {
                  action: "lead_updated",
                  description,
                  performedBy: by,
                  changes: {
                    ...(keepsCourse ? {} : { course: { from: fromName, to: cc.courseName } }),
                    fee: { from: student.totalFee ?? 0, to: fee },
                  },
                  createdAt: now,
                },
              },
            }
          : {}),
      },
    );
  }
  return true;
}

/** A rejected change: so, with finance's reason and who decided. Once. */
export async function applyRejectedCourseChange(studentId: string, d: FinanceCourseChange): Promise<boolean> {
  if (!Types.ObjectId.isValid(studentId)) return false;
  const done = await Student.updateOne(
    { _id: new Types.ObjectId(studentId), courseChanges: { $elemMatch: { externalId: d.externalId, status: "pending" } } },
    {
      $set: {
        "courseChanges.$.status": "rejected",
        "courseChanges.$.rejectReason": d.reason ?? "",
        "courseChanges.$.decidedAt": d.decidedAt ? new Date(d.decidedAt) : new Date(),
        "courseChanges.$.decidedBy": d.decidedBy ?? "",
      },
    },
  );
  return done.modifiedCount > 0;
}

/**
 * A request finance has that isn't here — sent from here, kept by finance, and the answer lost (a timeout) — taken
 * from finance's answer: its id, the course by name (a course here of that name, case and spaces aside — else none,
 * and only the fee will change), the fee. Taken as pending; finance's decision is then applied like any other. Once.
 */
export async function adoptCourseChange(studentId: string, d: FinanceCourseChange): Promise<boolean> {
  if (!Types.ObjectId.isValid(studentId) || !d.externalId) return false;
  const name = String(d.course ?? "").trim();
  const course = name
    ? await Course.findOne({ name: new RegExp(`^\\s*${name.split(/\s+/).map(escapeRe).join("\\s+")}\\s*$`, "i") }).select("_id name").lean()
    : null;
  const entry: ICourseChange = {
    externalId: d.externalId,
    courseId: (course?._id as Types.ObjectId | undefined) ?? null,
    courseName: name || "(no course named)",
    fee: round2((d.priceMinor || 0) / 100),
    reason: ADOPTED_REASON,
    status: "pending",
    requestedBy: { id: null, name: "" },
    requestedAt: new Date(),
  };
  const done = await Student.updateOne(
    { _id: new Types.ObjectId(studentId), "courseChanges.externalId": { $ne: d.externalId } },
    { $push: { courseChanges: entry } },
  );
  return done.modifiedCount > 0;
}

/**
 * Every enrolment with a change waiting — or one sent from here lately, which finance may have kept unheard — asked of
 * finance, 200 at a time: a request finance has that isn't here is taken (adoptCourseChange), and each decision
 * applied. Run with the approvals sweep, every minute. Finance away: next time.
 */
export async function syncCourseChanges(): Promise<number> {
  const students = await Student.find({ $or: [{ "courseChanges.status": "pending" }, { courseChangeAskedAt: { $exists: true } }] })
    .select("_id courseChanges.externalId")
    .lean<{ _id: Types.ObjectId; courseChanges?: { externalId: string }[] }[]>();
  let changed = 0;
  for (let i = 0; i < students.length; i += BATCH) {
    const batch = students.slice(i, i + BATCH);
    const statuses = await fetchEnrolmentStatuses(batch.map((s) => String(s._id)));
    const knownOf = new Map(batch.map((s) => [String(s._id), new Set((s.courseChanges ?? []).map((c) => c.externalId))]));
    for (const st of statuses) {
      const known = knownOf.get(st.externalId);
      if (!known) continue;
      // Oldest first, as finance lists them: a lost one is taken and decided before a later one is.
      for (const d of st.courseChanges ?? []) {
        try {
          if (!known.has(d.externalId) && (await adoptCourseChange(st.externalId, d))) changed++;
          if (d.status === "approved" && (await applyApprovedCourseChange(st.externalId, d))) changed++;
          else if (d.status === "rejected" && (await applyRejectedCourseChange(st.externalId, d))) changed++;
        } catch (err) {
          console.error(`[courseChanges] could not apply ${d.externalId} to enrolment ${st.externalId}`, err);
        }
      }
      // Finance answered, and nothing of its is missing here: once the last send is long past and nothing waits, stop asking.
      await Student.updateOne(
        { _id: new Types.ObjectId(st.externalId), courseChangeAskedAt: { $lt: new Date(Date.now() - ASKED_OPEN_MS) }, "courseChanges.status": { $ne: "pending" } },
        { $unset: { courseChangeAskedAt: "" } },
      );
    }
  }
  return changed;
}
