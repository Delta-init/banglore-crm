import { Types } from "mongoose";
import {
  BASE_CURRENCY,
  ENROLMENT_LANGUAGES,
  ENROLMENT_PAYMENT_METHODS,
  PAYMENT_METHOD_LABELS,
  type EnrolmentLanguage,
  type EnrolmentPaymentMethod,
} from "../types/index.js";
import { Student } from "../models/Student.js";
import { Lead } from "../models/Lead.js";
import type { IRole, IStudent, IStudentPayment } from "../types/index.js";
import { emailKey, emailPattern, samePerson, takenMessage, type EmailHolder, type Person } from "../utils/clientEmail.js";
import { announceSaleClosed } from "./saleAnnouncement.js";
import { syncSalesNote } from "./financeSalesNote.js";

function createError(msg: string, status: number) {
  return Object.assign(new Error(msg), { statusCode: status });
}

const objectIdOrNull = (v: unknown): Types.ObjectId | null =>
  v && Types.ObjectId.isValid(String(v)) ? new Types.ObjectId(String(v)) : null;

/**
 * Who else in this CRM holds this email and is somebody other than this client
 * (utils/clientEmail.ts) — or null when nobody is. Its own lead is left out, and
 * every student of it, as the same person whatever their details say; so is the
 * student being corrected. Students first, the earliest first; then leads.
 */
async function emailHolder(input: {
  email: string;
  client: Person;
  leadId?: unknown;
  studentId?: unknown;
}): Promise<EmailHolder | null> {
  if (!emailKey(input.email)) return null;
  const match = emailPattern(input.email);
  const leadId = objectIdOrNull(input.leadId);
  const studentId = objectIdOrNull(input.studentId);

  const students = await Student.find({
    email: match,
    ...(studentId ? { _id: { $ne: studentId } } : {}),
    ...(leadId ? { leadId: { $ne: leadId } } : {}),
  })
    .select("name phone enrollmentNumber")
    .sort({ createdAt: 1 })
    .limit(1000)
    .lean();
  const student = students.find((s) => !samePerson(input.client, s));
  if (student) return { kind: "student", id: String(student._id), name: student.name ?? "", code: student.enrollmentNumber };

  const leads = await Lead.find({ email: match, ...(leadId ? { _id: { $ne: leadId } } : {}) })
    .select("name phone")
    .sort({ createdAt: 1 })
    .limit(1000)
    .lean();
  const lead = leads.find((l) => !samePerson(input.client, l));
  return lead ? { kind: "lead", id: String(lead._id), name: lead.name ?? "" } : null;
}

/**
 * Refuses an email somebody else in this CRM holds (409), naming them — never
 * their phone. Finance would file this client's enrolment under them.
 */
async function assertEmailFree(input: { email: string; client: Person; leadId?: unknown; studentId?: unknown }): Promise<void> {
  const holder = await emailHolder(input);
  if (holder) throw createError(takenMessage(holder, input.client.name), 409);
}

/** The system Super Admin, who may see and correct every enrolment. */
function isSuperAdmin(role?: { isSystemRole?: boolean; roleName?: string } | null): boolean {
  return Boolean(role?.isSystemRole && role.roleName === "Super Admin");
}

/** Whole paise, so 300.10 + 199.90 is 500 and never 499.9999. */
const minor = (n: number) => Math.round(n * 100);
const money = (n: number) => n.toLocaleString("en-US", { maximumFractionDigits: 2 });

type ReceiptInput = { name?: string; url?: string; key?: string; size?: number; mimeType?: string } | null | undefined;
type PaymentInput = {
  method?: string;
  amount?: number | string;
  receipt?: ReceiptInput;
  paidAt?: string;
  collectedBefore?: boolean;
  original?: { currency?: string; amount?: number | string; rate?: number | string } | null;
} | null;

/**
 * A payment handed over in dirhams (the user, 2026-10-13: INR by default, AED
 * pickable): the AED and its rate — 1 AED = `rate` INR — checked against the
 * INR the close converted it to, within half a percent for rounding; a figure
 * typed in the wrong currency is refused rather than billed. Not the money
 * already on the lead, which is INR here.
 */
function originalPart(raw: PaymentInput, inr: number, n: string): Pick<IStudentPayment, "original"> {
  const o = raw?.original;
  if (!o) return {};
  const currency = String(o.currency ?? "AED").trim().toUpperCase();
  if (currency !== "AED") throw createError(`${n}: a payment is in INR, or AED with its rate — not ${currency}.`, 422);
  if (raw?.collectedBefore) throw createError(`${n} was already on the lead in INR, so it cannot be in AED.`, 422);
  const aed = Number(o.amount);
  if (!Number.isFinite(aed) || aed <= 0) throw createError(`${n} needs the amount paid in AED.`, 422);
  const rate = Number(o.rate);
  if (!Number.isFinite(rate) || rate <= 0 || rate > 1_000_000) throw createError(`${n} needs its rate: 1 AED = how many rupees.`, 422);
  const expected = Math.round(aed * rate * 100);
  if (Math.abs(minor(inr) - expected) > Math.max(1, Math.round(expected * 0.005))) {
    throw createError(`${n}: AED ${money(aed)} at 1 AED = ₹${rate} comes to ₹${money(expected / 100)}, not ₹${money(inr)}.`, 422);
  }
  return { original: { currency: "AED", amount: minor(aed) / 100, rate } };
}



/**
 * The payments a close sends, checked (the user, 2026-10-05: a client may pay
 * part in cash and part by card, each with its own receipt): every one with a
 * method this CRM takes, an amount above zero and its receipt, and together
 * exactly what was paid. Null when the close sent none — an older screen, with
 * one method, one receipt and the total.
 */
function checkedPayments(list: unknown, paidAmount: number, enrolledOn: Date): IStudentPayment[] | null {
  if (list === undefined || list === null) return null;
  if (!Array.isArray(list) || list.length === 0 || list.length > 10) throw createError("A closing takes between one and ten payments.", 422);
  const payments = (list as PaymentInput[]).map((raw, i) => {
    const n = list.length > 1 ? `Payment ${i + 1}` : "The payment";
    if (!ENROLMENT_PAYMENT_METHODS.includes(raw?.method as EnrolmentPaymentMethod)) throw createError(`${n} needs a payment method.`, 422);
    const amount = Number(raw?.amount);
    if (!Number.isFinite(amount) || amount <= 0) throw createError(`${n} needs an amount above zero.`, 422);
    if (!raw?.receipt?.key || !raw.receipt.url) throw createError(`${n} needs its receipt.`, 422);
    const paidAt = raw.paidAt ? new Date(raw.paidAt) : enrolledOn;
    return {
      method: raw.method as EnrolmentPaymentMethod,
      amount: minor(amount) / 100,
      receipt: {
        name: raw.receipt.name || "Receipt",
        url: raw.receipt.url,
        key: raw.receipt.key,
        ...(raw.receipt.size ? { size: raw.receipt.size } : {}),
        ...(raw.receipt.mimeType ? { mimeType: raw.receipt.mimeType } : {}),
        uploadedAt: new Date(),
      },
      paidAt: Number.isNaN(paidAt.getTime()) ? enrolledOn : paidAt,
      ...(raw.collectedBefore ? { collectedBefore: true } : {}),
      ...originalPart(raw, amount, n),
    };
  });
  const sum = payments.reduce((s, p) => s + minor(p.amount), 0);
  if (sum !== minor(paidAmount)) {
    throw createError(`The payments come to ${money(sum / 100)}, but ${money(paidAmount)} was paid — they must match.`, 422);
  }
  return payments;
}

/*
 * Collecting more than the fee is taken (the owner, 2026-10-06: more is
 * sometimes collected and it must still go through). The close and correction
 * forms say so in amber, the balance stays at zero, never negative, and finance
 * leaves payments above its invoice for accounts to record by hand.
 */

/** A bonus amount that can be recorded: a real number above zero. */
function isBonusAmount(v: unknown): boolean {
  const n = Number(v);
  return v !== null && v !== "" && Number.isFinite(n) && n > 0;
}

/** The shape finance accepts for the client's email — it refuses an enrolment without one. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * A payment on the lead that the close recorded — "Collected at enrolment —
 * <course> · <method>" — as opposed to one the lead held of its own. Only the
 * close's are replaced when the enrolment is corrected.
 */
const fromTheClose = (note?: string | null) => /^Collected at enrolment\b/.test(note ?? "");


/** Everything a close took, sent again as a correction once finance has sent the enrolment back. */
export interface EnrolmentCorrection {
  name?: string;
  phone?: string;
  email?: string;
  course?: string | null;
  team?: string | null;
  assignedTo?: string | null;
  enrollmentDate?: string;
  feeStatus?: string;
  totalFee?: number | string;
  paidAmount?: number | string;
  notes?: string;
  language?: string;
  payments?: unknown;
  hasBonus?: boolean;
  bonusAmount?: number | string;
}

// Auto-generate enrollment number: STU-0001, STU-0002, ...
async function nextEnrollmentNumber(): Promise<string> {
  const last = await Student.findOne().sort({ createdAt: -1 }).select("enrollmentNumber").lean();
  if (!last) return "STU-0001";
  const match = last.enrollmentNumber.match(/\d+$/);
  const num = match ? parseInt(match[0], 10) + 1 : 1;
  return `STU-${String(num).padStart(4, "0")}`;
}

export class StudentService {

  // ── Create ───────────────────────────────────────────────────────────────────

  async createStudent(data: {
    leadId: string;
    name: string;
    phone?: string;
    email?: string;
    course?: string | null;
    team?: string | null;
    assignedTo?: string | null;
    initialLeadResponse?: string | null;
    primaryConcern?: string | null;
    followupStrategyType?: string | null;
    demoScheduled?: boolean;
    demoAttended?: boolean;
    firstContactTime?: string | null;
    lastFollowupDate?: string | null;
    enrollmentDate?: string;
    feeStatus?: string;
    totalFee?: number;
    paidAmount?: number;
    notes?: string;
    language?: string;
    paymentMethod?: string;
    paymentReceipt?: { name: string; url: string; key: string; size?: number; mimeType?: string } | null;
    /** Each payment taken, when the client paid in more than one way. */
    payments?: unknown;
    hasBonus?: boolean;
    bonusAmount?: number;
  }, performedBy?: string) {
    const existing = await Student.findOne({ leadId: data.leadId });
    if (existing) throw createError("A student already exists for this lead", 409);

    const totalFee   = data.totalFee   ?? 0;
    const paidAmount = data.paidAmount ?? 0;
    const enrolledOn = data.enrollmentDate ? new Date(data.enrollmentDate) : new Date();
    // One payment or several; the first is also the one method and receipt.
    const payments = checkedPayments(data.payments, paidAmount, enrolledOn);
    const paymentMethod = payments?.[0]?.method ?? data.paymentMethod;
    const paymentReceipt = payments?.[0]?.receipt ?? data.paymentReceipt;

    /*
     * Required here rather than on the model.
     *
     * Enrolments predating these fields exist and have to keep loading, so the
     * schema leaves them optional; the requirement belongs at the moment of
     * closing, which is the only moment somebody is in a position to answer.
     *
     * All three are asked for at once and refused as one list. Rejecting them
     * one at a time means three round trips to learn three things the form
     * could have said together.
     */
    const missing: string[] = [];
    // The client's email: finance's intake refuses an enrolment without a
    // valid one, so a close without it would fail there, out of sight.
    const email = String(data.email ?? "").trim().toLowerCase();
    if (!EMAIL_RE.test(email)) missing.push("the client's email");
    if (!ENROLMENT_LANGUAGES.includes(data.language as EnrolmentLanguage)) missing.push("language");
    if (!ENROLMENT_PAYMENT_METHODS.includes(paymentMethod as EnrolmentPaymentMethod)) {
      missing.push("payment method");
    }
    if (!paymentReceipt?.key || !paymentReceipt.url) missing.push("payment receipt");
    // Yes or no, every time — and a yes is only an answer with its amount.
    if (typeof data.hasBonus !== "boolean") missing.push("whether a bonus was given");
    else if (data.hasBonus && !isBonusAmount(data.bonusAmount)) missing.push("the bonus amount");
    if (missing.length) {
      throw createError(
        `A closing needs ${missing.join(", ")}. Give the client's email, upload the receipt, choose the language and payment method, and say whether a bonus was given, then close again.`,
        422,
      );
    }

    /*
     * One email, one client (the user, 2026-10-10): finance knows a client by
     * the email alone, so a close with an email another person here already
     * holds would be filed under them. The client is who the close says — the
     * lead's own details where it says nothing.
     */
    const ownLead = data.name && data.phone ? null : await Lead.findById(data.leadId).select("name phone").lean();
    await assertEmailFree({
      email,
      client: { name: data.name || ownLead?.name, phone: data.phone || ownLead?.phone },
      leadId: data.leadId,
    });

    const enrollmentNumber = await nextEnrollmentNumber();

    const student = await Student.create({
      enrollmentNumber,
      name: data.name,
      phone: data.phone,
      email,
      course: data.course || undefined,
      team:   data.team   || undefined,
      assignedTo: data.assignedTo || undefined,
      leadId: data.leadId,
      initialLeadResponse:  data.initialLeadResponse  ?? null,
      primaryConcern:       data.primaryConcern        ?? null,
      followupStrategyType: data.followupStrategyType  ?? null,
      demoScheduled:    data.demoScheduled  ?? false,
      demoAttended:     data.demoAttended   ?? false,
      firstContactTime: data.firstContactTime ? new Date(data.firstContactTime) : null,
      lastFollowupDate: data.lastFollowupDate ? new Date(data.lastFollowupDate) : null,
      enrollmentDate:   enrolledOn,
      feeStatus:    this.computeFeeStatus(totalFee, paidAmount, data.feeStatus),
      totalFee,
      paidAmount,
      pendingAmount: Math.max(0, totalFee - paidAmount),
      notes: data.notes,
      language: data.language,
      paymentMethod,
      paymentReceipt: paymentReceipt
        ? { ...paymentReceipt, uploadedAt: new Date() }
        : undefined,
      ...(payments ? { payments } : {}),
      hasBonus: data.hasBonus,
      bonusAmount: data.hasBonus ? Number(data.bonusAmount) : 0,
      status: "active",
    });

    // The email asked for at the close, kept on the lead too when it had none.
    await this.fillLeadEmail(data.leadId, email, performedBy);

    // Queued, not sent. The sale is recorded the moment this returns; the
    // invoice follows when finance is reachable. See financeHandoverWorker.
    await this.queueFinanceHandover(String(student._id), data.leadId);

    const closed = await this.populateStudent(String(student._id));
    // Every signed-in screen celebrates it (the user, 2026-10-15). Not waited for.
    announceSaleClosed(closed, performedBy);
    return closed;
  }

  /**
   * The email asked for at the close, kept on the lead too — when it had none.
   * One the lead already holds is never replaced from here. Logged on the lead
   * when somebody is known to have done it. Never fails the close, which is
   * already saved.
   */
  private async fillLeadEmail(leadId: string, email: string, performedBy?: string): Promise<void> {
    try {
      await Lead.updateOne(
        { _id: leadId, $or: [{ email: { $exists: false } }, { email: null }, { email: "" }] },
        {
          $set: { email },
          ...(performedBy
            ? {
                $push: {
                  activityLogs: {
                    action: "lead_updated",
                    description: `Email added at the close: ${email}`,
                    performedBy,
                    changes: { email: { from: null, to: email } },
                    createdAt: new Date(),
                  },
                },
              }
            : {}),
        },
      );
    } catch (err) {
      console.error("[students] could not keep the email on the lead", err);
    }
  }

  /**
   * Whether an email can be this client's — what the close dialog asks of the
   * lead's email and of one typed in, and the correction dialog of the one on
   * its form, before either saves. The same rule as the close and the
   * correction, which refuse regardless.
   *
   * The client is the lead being closed, or the enrolment being corrected — or,
   * from the correction form, the name and phone it now has.
   */
  async checkEmail(q: { email?: unknown; leadId?: unknown; studentId?: unknown; name?: unknown; phone?: unknown }): Promise<{
    ok: boolean;
    takenBy?: { kind: EmailHolder["kind"]; name: string; code?: string };
    message?: string;
  }> {
    const email = emailKey(q.email);
    if (!EMAIL_RE.test(email)) throw createError("That is not an email address finance will take.", 422);
    const client: Person = {};
    let leadId: unknown = null;
    let studentId: unknown = null;
    if (q.studentId) {
      const s = objectIdOrNull(q.studentId) ? await Student.findById(String(q.studentId)).select("name phone leadId").lean() : null;
      if (!s) throw createError("Enrolment not found", 404);
      Object.assign(client, { name: s.name, phone: s.phone });
      leadId = s.leadId;
      studentId = s._id;
    } else if (q.leadId) {
      const l = objectIdOrNull(q.leadId) ? await Lead.findById(String(q.leadId)).select("name phone").lean() : null;
      if (!l) throw createError("Lead not found", 404);
      Object.assign(client, { name: l.name, phone: l.phone });
      leadId = l._id;
    } else {
      throw createError("Say which lead or enrolment the email is for.", 422);
    }
    if (typeof q.name === "string" && q.name.trim()) client.name = q.name.trim();
    if (typeof q.phone === "string" && q.phone.trim()) client.phone = q.phone.trim();

    const holder = await emailHolder({ email, client, leadId, studentId });
    if (!holder) return { ok: true };
    return {
      ok: false,
      takenBy: { kind: holder.kind, name: holder.name, ...(holder.code ? { code: holder.code } : {}) },
      message: takenMessage(holder, client.name),
    };
  }

  /**
   * Put this enrolment in the queue for Delta Finance.
   *
   * Deliberately swallows its own failures. The student exists by the time this
   * runs, and a salesperson should not see an error — still less lose the
   * enrolment — because a queue row could not be written or because the
   * integration is switched off. A missing row is visible on the student, which
   * shows no invoice number.
   */
  /**
   * The enrolment as finance needs to read it.
   *
   * Built from the student as it stands right now. Whether that is a snapshot
   * or the current truth depends on when it is called: at the close it is the
   * snapshot, because the queue row keeps the first one it is given; for a
   * correction after finance sent the enrolment back it is deliberately the
   * current record, because the correction is the whole point.
   *
   * Null when the student has gone.
   */
  async buildHandoverPayload(studentId: string): Promise<Record<string, unknown> | null> {
    const { Student } = await import("../models/Student.js");
    const { Course } = await import("../models/Course.js");
    const { User } = await import("../models/User.js");

    const student = await Student.findById(studentId).lean();
    if (!student) return null;

    const course = student.course ? await Course.findById(student.course).lean() : null;
    const rep = student.assignedTo ? await User.findById(student.assignedTo).select("name email").lean() : null;
    // Every LMS course it opens — the list where it was mapped as one (two for a
    // bundle), the single slug from before otherwise.
    const listed = (course?.lmsCourseSlugs ?? []).map((s) => s.trim()).filter(Boolean);
    const lms = listed.length ? listed : course?.lmsCourseSlug?.trim() ? [course.lmsCourseSlug.trim()] : [];

    return {
      externalId: String(student._id),
      source: "crm",
      // Which sales CRM sold it, shown as a tag in finance and the LMS. Not the
      // source: "crm" is part of finance's idempotency key and stays as every
      // CRM sends it. Keep "banglore" here when code is copied across from
      // another CRM.
      crm: "banglore",
      // The academy, said outright (the user, 2026-10-10): every close here is
      // for the Bangalore academy — finance keeps it on the invoice and passes
      // it on to the LMS and CS Portal. The organization stays
      // FINANCE_ORG_ID, which for this CRM is Bangalore's.
      academy: "bangalore",
      // Banglore's finance organisation keeps its books in INR: every amount
      // below is INR minor units (paise), sent as taken — never converted.
      currency: BASE_CURRENCY,
      customer: {
        name: student.name,
        email: student.email ?? "",
        phone: student.phone ?? "",
      },
      course: {
        name: course?.name ?? "Course",
        ...(course?.financeItemId ? { itemId: course.financeItemId } : {}),
        // The code this course is billed under, where somebody has set one.
        ...(course?.hsnSac?.trim() ? { hsnSac: course.hsnSac.trim() } : {}),
        // Which course(s) this is in the LMS, for finance to fall back on when
        // the item it bills against has no LMS courses of its own — a bundle
        // with no product opens all of them.
        ...(lms.length ? { lmsCourseSlug: lms[0], lmsCourseSlugs: lms } : {}),
        // Minor units: finance counts in paise, the CRM in whole rupees. Getting this wrong bills a client a hundredfold.
        amountMinor: Math.round((student.totalFee ?? 0) * 100),
      },
      ...(rep?.email ? { salespersonEmail: rep.email } : {}),
      ...(rep?.name ? { salespersonName: rep.name } : {}),
      enrolledOn: (student.enrollmentDate ?? new Date()).toISOString().slice(0, 10),
      declaredPaidMinor: Math.round((student.paidAmount ?? 0) * 100),
      // The fee less what was paid, in the same minor units as the two figures
      // it comes from, so finance sees exactly the difference of what it was
      // sent. The bonus is never in it.
      balanceMinor: Math.max(0, Math.round((student.totalFee ?? 0) * 100) - Math.round((student.paidAmount ?? 0) * 100)),
      // Whether a bonus was given at the close, for information. Not sent for
      // an enrolment from before it was asked: unknown is not "no".
      ...(typeof student.hasBonus === "boolean"
        ? {
            bonus: {
              given: student.hasBonus,
              amountMinor: student.hasBonus ? Math.round((student.bonusAmount ?? 0) * 100) : 0,
              // The course bonus is an MT5 bonus, in US dollars in every sales CRM (2026-10-09) —
              // whatever the fee's currency. Cents.
              currency: "USD",
            },
          }
        : {}),
      modeOfStudy: "online" as const,
      // Taken at the close now, rather than sent empty for finance to record
      // as "Not specified" — which is what every enrolment from here used to
      // say, because this field had nothing behind it.
      language: student.language ?? "",
      // The note written at the close, for finance only — kept apart from the
      // invoice's own notes, which are printed for the client. Kept up to date
      // afterwards by financeSalesNote.ts.
      salesNote: (student.notes ?? "").trim(),
      ...(student.paymentMethod ? { declaredPaymentMethod: student.paymentMethod } : {}),
      // The key, not a copy. Both applications address the same bucket, so
      // finance attaches the file this already wrote rather than being sent
      // a second one that can drift from it.
      ...(student.paymentReceipt?.key
        ? {
            receipt: {
              name: student.paymentReceipt.name,
              url: student.paymentReceipt.url,
              key: student.paymentReceipt.key,
              ...(student.paymentReceipt.size ? { size: student.paymentReceipt.size } : {}),
              ...(student.paymentReceipt.mimeType ? { mimeType: student.paymentReceipt.mimeType } : {}),
            },
          }
        : {}),
      // Each payment on its own, with its own method, date and receipt — they
      // add up to declaredPaidMinor, and finance records them on approval. The
      // fields above stay for whatever reads only the total.
      ...(student.payments?.length
        ? {
            payments: student.payments.map((p) => ({
              method: p.method,
              amountMinor: Math.round(p.amount * 100),
              paidOn: new Date(p.paidAt).toISOString().slice(0, 10),
              // Handed over in AED: what the receipt shows, and INR for 1 AED.
              ...(p.original?.amount && p.original.rate
                ? { original: { currency: "AED", amountMinor: Math.round(p.original.amount * 100), rate: p.original.rate } }
                : {}),
              ...(p.receipt?.key && p.receipt.url
                ? {
                    receipt: {
                      name: p.receipt.name,
                      url: p.receipt.url,
                      key: p.receipt.key,
                      ...(p.receipt.size ? { size: p.receipt.size } : {}),
                      ...(p.receipt.mimeType ? { mimeType: p.receipt.mimeType } : {}),
                    },
                  }
                : {}),
            })),
          }
        : {}),
    };
  }

  async queueFinanceHandover(studentId: string, leadId: string): Promise<void> {
    try {
      const { financeConfigured } = await import("./financeClient.js");
      if (!financeConfigured()) return;

      const { FinanceHandover } = await import("../models/FinanceHandover.js");
      const { Student } = await import("../models/Student.js");

      const student = await Student.findById(studentId).select("_id").lean();
      if (!student) return;

      /*
       * A snapshot, not a reference.
       *
       * What is delivered is what was true when the sale happened. If somebody
       * renames the course or reprices it tomorrow, the invoice that goes out
       * should still say what the client actually agreed to. $setOnInsert below
       * is what holds that: a row that exists keeps the payload it was made with.
       */
      const payload = await this.buildHandoverPayload(studentId);
      if (!payload) return;

      await FinanceHandover.updateOne(
        { studentId: student._id },
        {
          $setOnInsert: {
            studentId: student._id,
            leadId,
            payload,
            status: "pending",
            nextAttemptAt: new Date(),
          },
        },
        { upsert: true },
      );

      // Out now, in the background; the worker's timer retries whatever this cannot send.
      const { kickFinanceHandover } = await import("./financeHandoverWorker.js");
      kickFinanceHandover();
    } catch (err) {
      console.error("[finance] could not queue the handover", err);
    }
  }

  // ── Read ─────────────────────────────────────────────────────────────────────

  async getStudents(filters: {
    search?: string;
    status?: string;
    feeStatus?: string;
    course?: string;
    team?: string;
    assignedTo?: string;
    initialLeadResponse?: string;
    primaryConcern?: string;
    followupStrategyType?: string;
    demoScheduled?: string;
    demoAttended?: string;
    enrollmentFrom?: string;
    enrollmentTo?: string;
    page?: string;
    limit?: string;
  }) {
    const page  = Math.max(1, parseInt(filters.page  ?? "1",  10));
    const limit = Math.min(100, parseInt(filters.limit ?? "20", 10));
    const skip  = (page - 1) * limit;

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const query: Record<string, any> = {};

    if (filters.search) {
      const re = new RegExp(filters.search, "i");
      query.$or = [{ name: re }, { phone: re }, { email: re }, { enrollmentNumber: re }];
    }
    if (filters.status)               query.status     = filters.status;
    if (filters.feeStatus)            query.feeStatus  = filters.feeStatus;
    if (filters.course)               query.course     = filters.course;
    if (filters.team)                 query.team       = filters.team;
    if (filters.assignedTo)           query.assignedTo = filters.assignedTo;
    if (filters.initialLeadResponse)  query.initialLeadResponse  = filters.initialLeadResponse;
    if (filters.primaryConcern)       query.primaryConcern       = filters.primaryConcern;
    if (filters.followupStrategyType) query.followupStrategyType = filters.followupStrategyType;
    if (filters.demoScheduled !== undefined) query.demoScheduled = filters.demoScheduled === "true";
    if (filters.demoAttended  !== undefined) query.demoAttended  = filters.demoAttended  === "true";
    if (filters.enrollmentFrom || filters.enrollmentTo) {
      query.enrollmentDate = {};
      if (filters.enrollmentFrom) query.enrollmentDate.$gte = new Date(filters.enrollmentFrom + "T00:00:00.000Z");
      if (filters.enrollmentTo)   query.enrollmentDate.$lte = new Date(filters.enrollmentTo   + "T23:59:59.999Z");
    }

    const [students, total] = await Promise.all([
      Student.find(query)
        .sort({ createdAt: -1 })
        .skip(skip)
        .limit(limit)
        .populate("course",     "name amount")
        .populate("team",       "name")
        .populate("assignedTo", "name email designation")
        .populate("leadId",     "name phone status")
        .lean(),
      Student.countDocuments(query),
    ]);

    return {
      students,
      pagination: {
        total, page, limit,
        totalPages:  Math.ceil(total / limit),
        hasNextPage: page * limit < total,
        hasPrevPage: page > 1,
      },
    };
  }

  async getStudentById(id: string) {
    const student = await this.populateStudent(id);
    if (!student) throw createError("Student not found", 404);
    return student;
  }

  async getStudentByLeadId(leadId: string) {
    return Student.findOne({ leadId })
      .populate("course",     "name amount")
      .populate("team",       "name")
      .populate("assignedTo", "name email designation")
      .lean();
  }

  // ── Update ───────────────────────────────────────────────────────────────────

  async updateStudent(id: string, data: Partial<IStudent & { course?: string; team?: string; assignedTo?: string }>) {
    const student = await Student.findById(id);
    if (!student) throw createError("Student not found", 404);

    const allowed: Array<keyof typeof data> = [
      "name", "phone", "email", "course", "team", "assignedTo",
      "initialLeadResponse", "primaryConcern", "followupStrategyType",
      "demoScheduled", "demoAttended", "firstContactTime", "lastFollowupDate",
      "enrollmentDate", "feeStatus", "totalFee", "paidAmount", "notes", "status",
    ];
    const noteBefore = (student.notes ?? "").trim();
    for (const field of allowed) {
      if (data[field] !== undefined) {
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        (student as any)[field] = data[field];
      }
    }

    /*
     * The bonus, corrected after the close. Kept here: an enrolment already
     * with finance is not re-sent for an edit — the bonus reaches finance with
     * a correction only after finance sends the enrolment back.
     */
    if (typeof data.hasBonus === "boolean") student.hasBonus = data.hasBonus;
    if (data.bonusAmount !== undefined) student.bonusAmount = Number(data.bonusAmount);
    if (student.hasBonus === true && !isBonusAmount(student.bonusAmount)) {
      throw createError("A bonus needs an amount above zero — or choose no bonus.", 422);
    }
    if (student.hasBonus !== true) student.bonusAmount = 0;

    // Recompute pendingAmount and feeStatus if fee fields changed
    const total   = (student as unknown as Record<string, number>).totalFee   as number ?? 0;
    const paid    = (student as unknown as Record<string, number>).paidAmount  as number ?? 0;
    student.pendingAmount = Math.max(0, total - paid);
    // An explicitly sent status is honoured, as it is on create. The figures
    // decide when nobody says otherwise — but a counsellor who marks an
    // enrolment paid against a part payment has a reason, and discarding it
    // made the dropdown on the enrolment dialog do nothing at all.
    student.feeStatus     = this.computeFeeStatus(total, paid, data.feeStatus);

    await student.save();
    // A changed note reaches finance straight away (financeSalesNote.ts).
    if ((student.notes ?? "").trim() !== noteBefore) await syncSalesNote(id);
    return this.populateStudent(id);
  }

  // ── Delete ───────────────────────────────────────────────────────────────────

  async deleteStudent(id: string) {
    const student = await Student.findByIdAndDelete(id);
    if (!student) throw createError("Student not found", 404);
    return { deleted: String(student._id) };
  }

  // ── Helpers ───────────────────────────────────────────────────────────────────

  private computeFeeStatus(total: number, paid: number, override?: string): "paid" | "partial" | "pending" {
    if (override && ["paid", "partial", "pending"].includes(override)) return override as "paid" | "partial" | "pending";
    if (total <= 0 || paid <= 0) return "pending";
    if (paid >= total) return "paid";
    return "partial";
  }

  private populateStudent(id: string) {
    return Student.findById(id)
      .populate("course",     "name amount")
      .populate("team",       "name")
      .populate("assignedTo", "name email designation")
      .populate("leadId",     "name phone status")
      .lean();
  }

  // ── Enrolments, and what finance made of them ────────────────────────────────

  /**
   * A counsellor's own enrolments, each with the state of its invoice.
   *
   * Three things live in three places: the enrolment here, the delivery in the
   * outbox, and the approval in finance. Somebody who wants to know whether
   * their sale went through had to be given a finance login and told to go and
   * look. This joins them so the question is answered where it is asked.
   *
   * Finance is asked once for the whole page. When it cannot be reached the
   * rows still come back — without an approval state, which is the honest
   * answer rather than a wrong one.
   */
  async listEnrolments(filters: {
    mine?: string;
    userId: string;
    search?: string;
    state?: string;
    page?: string;
    limit?: string;
  }) {
    const { FinanceHandover } = await import("../models/FinanceHandover.js");
    const { fetchEnrolmentStatuses } = await import("./financeClient.js");

    const page  = Math.max(1, parseInt(filters.page ?? "1", 10));
    const limit = Math.min(100, parseInt(filters.limit ?? "20", 10));

    // "Your enrolments" by default. Somebody looking at the whole book asks for
    // it explicitly, and still only sees what students:view already allows.
    const query: Record<string, unknown> = {};
    if (filters.mine !== "false") query.assignedTo = filters.userId;

    /*
     * Narrowed to what finance sent back, when that is what was asked for.
     *
     * Answerable here only because the outcome is now written down as the
     * outbox learns it. Filtering on what finance says live would mean asking
     * finance about every enrolment ever closed in order to show one page of
     * the few it sent back — the query would grow with the book and the answer
     * would not.
     */
    if (filters.state === "returned") {
      const sentBack = await FinanceHandover.find({ approvalState: "returned" })
        .select("studentId")
        .lean();
      query._id = { $in: sentBack.map((h) => h.studentId) };
    }

    if (filters.search?.trim()) {
      const rx = new RegExp(filters.search.trim().replace(/[.*+?^${}()|[\]\\]/g, "\\$&"), "i");
      query.$or = [{ name: rx }, { email: rx }, { phone: rx }, { enrollmentNumber: rx }];
    }

    const [students, total] = await Promise.all([
      Student.find(query)
        .sort({ enrollmentDate: -1, createdAt: -1 })
        .skip((page - 1) * limit)
        .limit(limit)
        .populate("course", "name amount")
        .populate("assignedTo", "name email")
        .populate("leadId", "name phone status")
        .lean(),
      Student.countDocuments(query),
    ]);

    const ids = students.map((s) => String(s._id));
    const handovers = await FinanceHandover.find({ studentId: { $in: ids } })
      .select("studentId status attempts lastError invoiceId invoiceNumber flags sentAt approvalState returnedReason returnedAt approvedAt resentAt resends")
      .lean();
    const byStudent = new Map(handovers.map((h) => [String(h.studentId), h]));

    const { stepsOf } = await import("./enrolmentSteps.js");
    const statuses = await fetchEnrolmentStatuses(ids);
    const byExternal = new Map(statuses.map((s) => [s.externalId, s]));

    const rows = students.map((s) => {
      const h = byStudent.get(String(s._id));
      const f = byExternal.get(String(s._id));
      return {
        ...s,
        handover: h
          ? {
              status: h.status,
              attempts: h.attempts,
              lastError: h.lastError ?? "",
              invoiceId: h.invoiceId ?? "",
              invoiceNumber: h.invoiceNumber ?? "",
              flags: h.flags ?? [],
              sentAt: h.sentAt ?? null,
              // What the outbox last heard, as opposed to `invoice` below,
              // which is finance answering right now and may be absent.
              approvalState: h.approvalState ?? "unknown",
              returnedReason: h.returnedReason ?? "",
              returnedAt: h.returnedAt ?? null,
              // Sent again after a send-back: when last, and how many times.
              resentAt: h.resentAt ?? null,
              resends: h.resends ?? 0,
            }
          : null,
        // Absent rather than guessed when finance could not be reached.
        invoice: f ?? null,
        // Its steps — finance, LMS — green / yellow / red on the card.
        steps: stepsOf(f ?? null, h ? { status: h.status, lastError: h.lastError, approvedAt: h.approvedAt, resentAt: h.resentAt } : null),
      };
    });

    /*
     * The counts are of this page's rows, not of the whole book.
     *
     * Counting every enrolment would mean asking finance about every one of
     * them on every request. The bar says what it is counting.
     */
    const counts = {
      total,
      onThisPage: rows.length,
      approved: rows.filter((r) => r.invoice?.approval === "approved").length,
      pending: rows.filter((r) => r.invoice?.approval === "pending").length,
      // Not one already on its way back: finance still says "returned" until it arrives.
      returned: rows.filter((r) => (r.invoice?.approval ?? r.handover?.approvalState) === "returned"
        && !(r.handover?.status === "pending" && r.handover.resentAt)).length,
      notInvoiced: rows.filter((r) => !r.invoice).length,
      failed: rows.filter((r) => r.handover?.status === "failed").length,
      flagged: rows.filter((r) => (r.handover?.flags?.length ?? 0) > 0).length,
    };

    return { rows, counts, pagination: { page, limit, total, pages: Math.ceil(total / limit) } };
  }

  /**
   * One enrolment, for its own page: the student, what finance and the outbox
   * know of it, and its steps with who did each and when.
   *
   * The closer sees their own; anyone who may view students sees any.
   */
  async getEnrolment(id: string, viewer: { userId: string; role?: { isSystemRole?: boolean; roleName?: string; permissions?: Record<string, { view?: boolean } | undefined> } }) {
    const { FinanceHandover } = await import("../models/FinanceHandover.js");
    const { fetchEnrolmentStatuses } = await import("./financeClient.js");
    const { stepsOf } = await import("./enrolmentSteps.js");

    if (!Types.ObjectId.isValid(id)) throw createError("Enrolment not found", 404);
    const student = await Student.findById(id)
      .populate("course", "name amount")
      .populate("assignedTo", "name email")
      .populate("team", "name")
      .lean();
    if (!student) throw createError("Enrolment not found", 404);
    const closer = student.assignedTo && typeof student.assignedTo === "object" && "_id" in student.assignedTo
      ? String((student.assignedTo as { _id: unknown })._id)
      : String(student.assignedTo ?? "");
    const all = isSuperAdmin(viewer.role as never) || viewer.role?.permissions?.students?.view === true;
    if (closer !== viewer.userId && !all) throw createError("This enrolment isn't yours", 403);

    const h = await FinanceHandover.findOne({ studentId: student._id })
      .select("status attempts lastError invoiceId invoiceNumber flags sentAt approvalState returnedReason returnedAt approvedAt resentAt resends")
      .lean();
    const [st] = await fetchEnrolmentStatuses([id]);

    return {
      ...student,
      handover: h
        ? {
            status: h.status, attempts: h.attempts, lastError: h.lastError ?? "", invoiceId: h.invoiceId ?? "",
            invoiceNumber: h.invoiceNumber ?? "", flags: h.flags ?? [], sentAt: h.sentAt ?? null,
            approvalState: h.approvalState ?? "unknown", returnedReason: h.returnedReason ?? "", returnedAt: h.returnedAt ?? null,
            approvedAt: h.approvedAt ?? null, resentAt: h.resentAt ?? null, resends: h.resends ?? 0,
          }
        : null,
      invoice: st ?? null,
      steps: stepsOf(st ?? null, h ? { status: h.status, lastError: h.lastError, approvedAt: h.approvedAt, resentAt: h.resentAt } : null),
    };
  }

  /**
   * Send this enrolment to finance, or send it again.
   *
   * The queue row is upserted with $setOnInsert, so a row that already exists
   * keeps the payload it was created with — the snapshot of the sale. This
   * resets the schedule instead, which is what "try again now" means for one
   * that failed or is waiting on a backoff.
   */
  async requestInvoice(studentId: string): Promise<{ queued: boolean; message: string }> {
    const { FinanceHandover } = await import("../models/FinanceHandover.js");
    const { financeConfigured } = await import("./financeClient.js");

    if (!financeConfigured()) {
      return { queued: false, message: "The finance integration is not configured" };
    }

    const student = await Student.findById(studentId).lean();
    if (!student) return { queued: false, message: "Enrolment not found" };

    const existing = await FinanceHandover.findOne({ studentId }).lean();

    /*
     * Delivered once is usually the end of it — except when finance sent it
     * back.
     *
     * Then the counsellor has corrected something and this is the correction on
     * its way. It goes with a *fresh* payload, which is the whole point: the
     * queue row holds a snapshot of the sale as it was, and resending that
     * would deliver the very figures somebody has just been asked to fix. The
     * snapshot is right for a retry after a timeout and wrong for a
     * resubmission, and the two arrive at this function looking identical.
     *
     * Finance recognises the same externalId on a returned invoice and updates
     * it rather than raising a second one, so this corrects the invoice the
     * approver already has, keeping its number.
     */
    if (existing?.status === "sent") {
      if (!(await this.sendBackOf(studentId, existing)).sentBack) {
        return { queued: false, message: `Already invoiced as ${existing.invoiceNumber ?? "an invoice"}` };
      }
      // Sent again as it stands, it is a correction too: one email, one client
      // (2026-10-10). Someone else's email is changed through "Correct it".
      const holder = await emailHolder({
        email: student.email ?? "", client: { name: student.name, phone: student.phone }, leadId: student.leadId, studentId: student._id,
      });
      if (holder) return { queued: false, message: takenMessage(holder, student.name) };
      if (!(await this.resendCorrected(studentId))) return { queued: false, message: "Enrolment not found" };
      return { queued: true, message: "Correction sent to finance" };
    }

    if (existing) {
      await FinanceHandover.updateOne(
        { studentId },
        { $set: { status: "pending", nextAttemptAt: new Date(), lastError: "" } },
      );
      return { queued: true, message: "Sending to finance again" };
    }

    await this.queueFinanceHandover(String(student._id), String(student.leadId ?? ""));
    return { queued: true, message: "Queued for finance" };
  }

  /**
   * Whether finance has this delivered enrolment sent back, and why — by what
   * the outbox last heard, or else by asking finance now: it may have been
   * sent back in the minute before the outbox next asks, and the screens, which
   * ask finance live, already offer the correction.
   */
  private async sendBackOf(
    studentId: string,
    h: { status?: string; approvalState?: string; returnedReason?: string } | null,
  ): Promise<{ sentBack: boolean; reason: string }> {
    if (h?.status !== "sent") return { sentBack: false, reason: "" };
    if (h.approvalState === "returned") return { sentBack: true, reason: h.returnedReason ?? "" };
    // Decided already: an approved enrolment is not sent back, so finance isn't asked.
    if (h.approvalState === "approved" || h.approvalState === "not_required") return { sentBack: false, reason: "" };
    const { fetchEnrolmentStatuses } = await import("./financeClient.js");
    const [st] = await fetchEnrolmentStatuses([studentId]);
    return st?.approval === "returned" ? { sentBack: true, reason: st.returnedReason ?? "" } : { sentBack: false, reason: "" };
  }

  /**
   * Send a sent-back enrolment to finance again, as it stands now.
   *
   * With a *fresh* payload, which is the whole point: the queue row holds a
   * snapshot of the sale as it was, and resending that would deliver the very
   * figures somebody has just been asked to fix. The snapshot is right for a
   * retry after a timeout and wrong for a resubmission.
   *
   * Finance recognises the same externalId on a returned invoice and updates
   * it rather than raising a second one, so this corrects the invoice the
   * approver already has, keeping its number. False when the student has gone.
   */
  private async resendCorrected(studentId: string): Promise<boolean> {
    const { FinanceHandover } = await import("../models/FinanceHandover.js");
    const payload = await this.buildHandoverPayload(studentId);
    if (!payload) return false;
    await FinanceHandover.updateOne(
      { studentId },
      {
        $set: {
          payload,
          status: "pending",
          nextAttemptAt: new Date(),
          attempts: 0,
          lastError: "",
          // Pending again the moment it leaves, so the screen stops offering
          // "send again" for something already on its way back.
          approvalState: "pending",
          returnedReason: "",
          // So the screens can say it was sent again, and when.
          resentAt: new Date(),
        },
        $inc: { resends: 1 },
        // Cleared, so a second send-back is told about a second time.
        $unset: { returnedNotifiedAt: "", returnedAt: "" },
      },
    );
    // Out now, in the background; the worker's timer retries whatever this cannot send.
    const { kickFinanceHandover } = await import("./financeHandoverWorker.js");
    kickFinanceHandover();
    return true;
  }

  // ── Correcting what finance sent back ────────────────────────────────────────

  /**
   * The enrolment, if this viewer may correct it: the closer their own; anyone
   * who may edit students — or a super admin — any, and only they may move a
   * sale to another counsellor or team (`mayMove`).
   */
  private async correctable(id: string, viewer: { userId: string; role?: IRole | null }) {
    if (!Types.ObjectId.isValid(id)) throw createError("Enrolment not found", 404);
    const student = await Student.findById(id);
    if (!student) throw createError("Enrolment not found", 404);
    const mayMove = isSuperAdmin(viewer.role) || viewer.role?.permissions?.students?.edit === true;
    if (String(student.assignedTo ?? "") !== viewer.userId && !mayMove) {
      throw createError("This enrolment isn't yours to correct", 403);
    }
    return { student, mayMove };
  }

  /** What the lead holds of its own, in paise: every payment on it but the ones the close recorded. */
  private async ownOnLead(leadId: unknown): Promise<number> {
    const lead = await Lead.findById(leadId).select("payments").lean();
    return (lead?.payments ?? []).filter((p) => !fromTheClose(p.note)).reduce((s, p) => s + minor(p.amount), 0);
  }

  /**
   * What the correction form starts from: the enrolment as it stands, whether
   * finance has it sent back and why, the money the lead holds of its own — a
   * payment of its own on the form, at that figure, as at the close — and, for
   * whoever may move a sale, the counsellors and teams it may move to.
   */
  async getCorrection(id: string, viewer: { userId: string; role?: IRole | null }) {
    const { FinanceHandover } = await import("../models/FinanceHandover.js");
    const { student, mayMove } = await this.correctable(id, viewer);
    const h = await FinanceHandover.findOne({ studentId: student._id }).lean();
    const { sentBack, reason } = await this.sendBackOf(id, h);
    let options = {};
    if (mayMove) {
      const { Team } = await import("../models/Team.js");
      const { User } = await import("../models/User.js");
      const [counsellors, teams] = await Promise.all([
        User.find({ status: "active" }).select("name").sort({ name: 1 }).lean(),
        Team.find({ status: "active" }).select("name").sort({ name: 1 }).lean(),
      ]);
      options = { counsellors, teams };
    }
    return {
      sentBack,
      returnedReason: reason,
      invoiceNumber: h?.invoiceNumber ?? "",
      // What became of it otherwise: sent again, and when; approved or waiting.
      approvalState: h?.approvalState ?? "unknown",
      resentAt: h?.resentAt ?? null,
      resends: h?.resends ?? 0,
      mayMove,
      ownOnLead: (await this.ownOnLead(student.leadId)) / 100,
      ...options,
      student: await this.populateStudent(id),
    };
  }

  /**
   * Correct an enrolment finance sent back, and send it again — one step (the
   * user, 2026-10-05: "if send it back we can edit the course and amount, all
   * details"). Everything the close took can change: the client's name, phone
   * and email, the course, the date, the fee, each payment with its receipt,
   * the language, the bonus and the notes — and, for whoever may edit
   * students, who closed it and for which team. It is checked as a close is,
   * and then goes to finance as the correction of the invoice it sent back:
   * the same invoice, the same number.
   *
   * Only while finance has it sent back. An enrolment waiting for approval, or
   * approved, is not rewritten from here.
   *
   * The closer corrects their own; anyone who may edit students, any.
   */
  async correctEnrolment(
    id: string,
    data: EnrolmentCorrection,
    viewer: { userId: string; role?: IRole | null },
  ): Promise<{ student: unknown; message: string }> {
    const { FinanceHandover } = await import("../models/FinanceHandover.js");
    const { Course } = await import("../models/Course.js");
    const { Team } = await import("../models/Team.js");
    const { User } = await import("../models/User.js");

    const { student, mayMove } = await this.correctable(id, viewer);

    const h = await FinanceHandover.findOne({ studentId: student._id }).lean();
    if (!(await this.sendBackOf(id, h)).sentBack) {
      throw createError(
        "Finance hasn't sent this enrolment back, so there is nothing to correct. A change once it is approved goes through finance.",
        409,
      );
    }

    // Asked for all at once and refused as one list, as the close does.
    const name = String(data.name ?? "").trim();
    const phone = String(data.phone ?? "").trim();
    const email = String(data.email ?? "").trim().toLowerCase();
    const enrolledOn = data.enrollmentDate ? new Date(data.enrollmentDate) : null;
    const totalFee = data.totalFee === "" || data.totalFee === null ? NaN : Number(data.totalFee);
    const paidAmount = Number(data.paidAmount ?? NaN);
    const missing: string[] = [];
    if (!name) missing.push("the client's name");
    if (!phone) missing.push("the client's phone");
    if (!EMAIL_RE.test(email)) missing.push("the client's email");
    if (typeof data.course !== "string" || !Types.ObjectId.isValid(data.course)) missing.push("a course");
    if (!enrolledOn || Number.isNaN(enrolledOn.getTime())) missing.push("the enrolment date");
    if (!Number.isFinite(totalFee) || totalFee < 0) missing.push("the fee");
    if (!Number.isFinite(paidAmount) || paidAmount < 0) missing.push("what was paid");
    if (!ENROLMENT_LANGUAGES.includes(data.language as EnrolmentLanguage)) missing.push("language");
    if (typeof data.hasBonus !== "boolean") missing.push("whether a bonus was given");
    else if (data.hasBonus && !isBonusAmount(data.bonusAmount)) missing.push("the bonus amount");
    if (missing.length) throw createError(`A correction needs ${missing.join(", ")}.`, 422);

    const course = await Course.findById(data.course).select("name").lean();
    if (!course) throw createError("That course no longer exists — choose another.", 422);

    // Who closed it, and for which team: kept unless somebody who may edit
    // students moves it.
    const idOrNull = (v: unknown) => (typeof v === "string" && v ? v : null);
    const team = data.team === undefined ? String(student.team ?? "") || null : idOrNull(data.team);
    const closer = data.assignedTo === undefined ? String(student.assignedTo ?? "") || null : idOrNull(data.assignedTo);
    if ((team ?? "") !== String(student.team ?? "") || (closer ?? "") !== String(student.assignedTo ?? "")) {
      if (!mayMove) throw createError("Only someone who may edit students can move a sale to another counsellor or team.", 403);
      if (team && (!Types.ObjectId.isValid(team) || !(await Team.exists({ _id: team })))) {
        throw createError("That team no longer exists — choose another.", 422);
      }
      if (closer && (!Types.ObjectId.isValid(closer) || !(await User.exists({ _id: closer })))) {
        throw createError("That counsellor no longer exists — choose another.", 422);
      }
    }

    const payments = checkedPayments(data.payments, paidAmount, enrolledOn!);
    if (!payments) throw createError("A correction needs its payments, each with its method, amount and receipt.", 422);

    /*
     * The money the lead held of its own — every payment on it but the ones the
     * close recorded — is a payment of its own here, as at the close, and at
     * what it comes to now: the close's own payments on the lead are about to
     * be replaced by these, and the two must not count the same money twice
     * or lose any.
     */
    const own = await this.ownOnLead(student.leadId);
    const ownRows = payments.filter((p) => p.collectedBefore);
    if (ownRows.length > 1) throw createError("Only one payment can be the money already on the lead.", 422);
    if (own > 0 && !ownRows.length) {
      throw createError(
        `This lead already holds ${money(own / 100)} of its own — it stays as a payment of its own, with its method and receipt.`,
        422,
      );
    }
    if (ownRows.length && minor(ownRows[0]!.amount) !== own) {
      throw createError(
        `The lead's own payments come to ${money(own / 100)} now, not ${money(ownRows[0]!.amount)} — they changed while this was open. Close the correction and open it again.`,
        409,
      );
    }

    // One email, one client, as at the close — for the client as corrected.
    await assertEmailFree({ email, client: { name, phone }, leadId: student.leadId, studentId: student._id });

    student.set({
      name,
      phone,
      email,
      course: course._id,
      team,
      assignedTo: closer,
      enrollmentDate: enrolledOn,
      totalFee,
      paidAmount,
      pendingAmount: Math.max(0, totalFee - paidAmount),
      feeStatus: this.computeFeeStatus(totalFee, paidAmount, data.feeStatus),
      ...(typeof data.notes === "string" ? { notes: data.notes } : {}),
      language: data.language,
      // The first payment's, for whatever reads only one; every one below.
      paymentMethod: payments[0]!.method,
      paymentReceipt: payments[0]!.receipt,
      payments,
      hasBonus: data.hasBonus,
      bonusAmount: data.hasBonus ? Number(data.bonusAmount) : 0,
    });
    await student.save();

    /*
     * The lead's payment list follows: what the close recorded there is
     * replaced by the payments as corrected, so the lead and the enrolment
     * keep counting the same money — the lead's own payments are left as they
     * are. Not worth failing the correction over; it says so instead.
     */
    let leadNote = "";
    try {
      const lead = await Lead.findById(student.leadId).select("payments").lean();
      if (lead) {
        const kept = (lead.payments ?? []).filter((p) => !fromTheClose(p.note));
        const taken = payments.filter((p) => !p.collectedBefore).map((p) => ({
          amount: p.amount,
          note: `Collected at enrolment — ${course.name} · ${PAYMENT_METHOD_LABELS[p.method] ?? p.method}`,
          paidAt: p.paidAt,
          addedBy: new Types.ObjectId(viewer.userId),
        }));
        await Lead.updateOne({ _id: lead._id }, { $set: { payments: [...kept, ...taken] } });
      }
    } catch (err) {
      console.error(`[enrolments] could not bring the lead's payments in line with corrected enrolment ${id}`, err);
      leadNote = " The lead's own payment list could not be updated — check it on the lead.";
    }

    await this.resendCorrected(id);
    return { student: await this.populateStudent(id), message: `Corrected and sent to finance.${leadNote}` };
  }

}
