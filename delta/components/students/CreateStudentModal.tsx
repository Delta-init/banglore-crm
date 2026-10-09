"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, X, User2, Phone, Mail, BookOpen,
  Calendar, DollarSign, StickyNote, CheckCircle2, Gift,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { fmtINR } from "@/lib/currency";
import { useCreateStudent, useUpdateStudent } from "@/hooks/useStudents";
import { useAllCourses } from "@/hooks/useCourses";
import { useAddPayment } from "@/hooks/usePayments";
import {
  PaymentRowsEditor, missingInRows, newPaymentRow, rowAmount, type PaymentRow,
} from "@/components/students/PaymentRowsEditor";
import type { Lead } from "@/types/lead";
import type { Course } from "@/types/course";
import type { EnrolmentPaymentMethod, FeeStatus, Student, StoredReceipt } from "@/types/student";
import {
  ENROLMENT_LANGUAGES,
  PAYMENT_METHOD_LABELS,
} from "@/types/student";

/** An address finance will take: its intake refuses an enrolment without a valid one. */
const EMAIL_RE = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

interface Props {
  open: boolean;
  lead: Lead;
  /**
   * The enrolment this lead already has, when it has one.
   *
   * Closing a lead that was closed before is not a mistake — somebody moved it
   * to follow-up and back, and wants to see the enrolment again. This used to
   * skip the dialog entirely and update the status behind their back, so the
   * second close looked like nothing happened at all.
   */
  existingStudent?: Student | null;
  /** "2 of 5" when this is one of several leads being closed together. */
  progress?: string;
  /** Dismissing still closes the lead: the status was already chosen. */
  onClose: () => void;
  onCreated: () => void;
}

export function CreateStudentModal({ open, lead, existingStudent, progress, onClose, onCreated }: Props) {
  const editing = Boolean(existingStudent);

  /** The course the lead already carries, if it was picked during the sale. */
  const leadCourse = lead.course && typeof lead.course === "object" ? lead.course as Course : null;
  const studentCourse =
    existingStudent?.course && typeof existingStudent.course === "object"
      ? existingStudent.course as Course
      : null;
  const knownCourse = studentCourse ?? leadCourse;

  // Only fetched when there is nothing to show, which is the only time it is
  // needed — a lead that already names its course does not need the list.
  const { data: courses = [], isLoading: coursesLoading } = useAllCourses();

  const [courseId, setCourseId] = useState(knownCourse?._id ?? "");
  const pickedCourse = knownCourse ?? courses.find((c) => c._id === courseId) ?? null;

  /*
   * The fee follows the course, and can be argued with.
   *
   * Seeded from what the enrolment already stores, or the course's price when
   * it stores nothing — an enrolment created before a course was picked has a
   * fee of zero, and showing that beside a course priced at 5,200 makes every
   * figure under it wrong. Editable because the price on the brochure is not
   * always the price that was agreed.
   */
  const [feeInput, setFeeInput] = useState(
    String(existingStudent?.totalFee || knownCourse?.amount || ""),
  );
  const totalFee = Number(feeInput) || 0;

  /** What was collected before today, from the payments already on the lead. */
  const alreadyPaid = (lead.payments ?? []).reduce((s, p) => s + p.amount, 0);
  /*
   * A new close takes each payment as a row — method, amount and receipt, a
   * client may pay part in cash and part by card (PaymentRowsEditor) — with
   * what the lead already holds as the first, at the amount it had when this
   * opened: the payments this close then adds to the lead must not count
   * twice. Editing an enrolment keeps the one "collected now" figure.
   */
  const [paymentRows, setPaymentRows] = useState<PaymentRow[]>(() =>
    alreadyPaid > 0 ? [newPaymentRow({ collectedBefore: true, amountInput: String(alreadyPaid) })] : [newPaymentRow()],
  );
  const [paidNowInput, setPaidNowInput] = useState("");
  const paidNow = editing
    ? Math.max(0, Number(paidNowInput) || 0)
    : paymentRows.filter((r) => !r.collectedBefore).reduce((s, r) => s + rowAmount(r), 0);
  const paidAmount = editing ? alreadyPaid + paidNow : paymentRows.reduce((s, r) => s + rowAmount(r), 0);
  const pending = Math.max(0, totalFee - paidAmount);
  /** Collected more than the fee: taken (the owner, 2026-10-06) and said so in amber, not refused. */
  const overFee = Math.round(paidAmount * 100) > Math.round(totalFee * 100);
  const overBy = Math.max(0, paidAmount - totalFee);
  const uploading = paymentRows.some((r) => r.uploading);

  const computedFeeStatus: FeeStatus =
    totalFee <= 0 || paidAmount <= 0 ? "pending"
    : paidAmount >= totalFee         ? "paid"
    :                                  "partial";

  const [notes, setNotes] = useState(existingStudent?.notes ?? "");
  const [enrollmentDate, setEnrollmentDate] = useState(
    (existingStudent?.enrollmentDate ?? new Date().toISOString()).slice(0, 10),
  );
  const [feeStatus, setFeeStatus] = useState<FeeStatus>(existingStudent?.feeStatus ?? computedFeeStatus);
  const [feeStatusTouched, setFeeStatusTouched] = useState(false);
  // Follows the numbers until somebody sets it by hand, then stays put.
  const effectiveFeeStatus = feeStatusTouched ? feeStatus : computedFeeStatus;

  const createMut = useCreateStudent();
  const updateMut = useUpdateStudent();
  const addPayment = useAddPayment(lead._id);
  const saving = createMut.isPending || updateMut.isPending || addPayment.isPending;

  // An enrolment with no course bills nothing. Where the lead never named one
  // it has to be chosen here, rather than quietly producing a zero invoice.
  const courseMissing = !pickedCourse;

  /*
   * The client's email, asked for only when the lead has none that works.
   * Finance refuses an enrolment without one, so a close without it would fail
   * there, out of sight. Kept on the lead too once saved.
   */
  const leadEmail = (lead.email ?? "").trim();
  const leadEmailOk = EMAIL_RE.test(leadEmail);
  const askEmail = !editing && !leadEmailOk;
  const [emailInput, setEmailInput] = useState(leadEmailOk ? "" : leadEmail);
  const email = leadEmailOk ? leadEmail : emailInput.trim();
  const emailMissing = askEmail && !EMAIL_RE.test(email);

  /*
   * Three things a close cannot be made without.
   *
   * They exist because finance needs them and had nothing behind them: every
   * enrolment handed over from here recorded its language as "Not specified",
   * and none carried how the money was taken or any proof that it had been.
   * An approver was deciding on an invoice with none of that in front of them.
   *
   * Only for a new close. Editing an enrolment made before these existed must
   * not be blocked on filling in what nobody was asked for at the time.
   */
  const [language, setLanguage] = useState<string>(existingStudent?.language ?? "");

  /*
   * Whether a bonus was given, and how much.
   *
   * Asked at every close — yes or no, with the amount when yes — because the
   * people who approve, teach and mentor this client all need to know what was
   * promised. Beside the money, never in it: the balance above is the fee less
   * what was paid, whatever the bonus. An enrolment from before this was asked
   * starts unanswered, and can be answered here.
   *
   * A new close starts from the bonus its course comes with (set on the
   * Courses page): yes, with that amount, until the seller answers otherwise.
   * An enrolment being edited keeps what it has.
   */
  const courseBonus = editing ? 0 : knownCourse?.bonusAmount ?? 0;
  const [bonusChoice, setBonusChoice] = useState<"" | "yes" | "no">(
    existingStudent?.hasBonus === true ? "yes"
    : existingStudent?.hasBonus === false ? "no"
    : courseBonus > 0 ? "yes" : "",
  );
  const [bonusInput, setBonusInput] = useState(
    existingStudent?.hasBonus ? String(existingStudent.bonusAmount || "")
    : courseBonus > 0 ? String(courseBonus) : "",
  );
  const [bonusTouched, setBonusTouched] = useState(false);
  /** The bonus shown is the course's own, not one the seller set. */
  const bonusFromCourse = !editing && !bonusTouched && bonusChoice === "yes" && (pickedCourse?.bonusAmount ?? 0) > 0;
  const bonusAmount = Math.max(0, Number(bonusInput) || 0);
  const bonusAmountMissing = bonusChoice === "yes" && !(bonusAmount > 0);
  /** Only what was answered is sent: unanswered stays unanswered, not "no". */
  const bonusFields = bonusChoice
    ? { hasBonus: bonusChoice === "yes", bonusAmount: bonusChoice === "yes" ? bonusAmount : 0 }
    : {};

  const missing = editing
    ? [bonusAmountMissing && "the bonus amount"].filter(Boolean) as string[]
    : [
        emailMissing && "the client's email",
        !language && "language",
        ...missingInRows(paymentRows),
        !bonusChoice && "whether a bonus was given",
        bonusAmountMissing && "the bonus amount",
      ].filter(Boolean) as string[];

  function toIST(iso?: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
      year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
    }) + " IST";
  }

  async function handleCreate() {
    /*
     * The money is recorded on the lead, not just on the enrolment.
     *
     * The lead's payment list is where the CRM already counts what a client
     * has handed over, and it is what the fee summary above reads. Writing the
     * figure only onto the student would leave two records of the same money
     * that drift apart the moment anybody adds a payment the ordinary way.
     *
     * Done before the enrolment is saved: a payment that failed to record is
     * worth stopping for, whereas one recorded against an enrolment that then
     * failed can be finished by hand.
     */
    if (editing && paidNow > 0) {
      await addPayment.mutateAsync({
        amount: paidNow,
        note: `Collected at enrolment${pickedCourse ? ` — ${pickedCourse.name}` : ""}`,
        paidAt: new Date(enrollmentDate).toISOString(),
      });
    }
    // Each payment taken now, one by one, saying how it was paid. One that an
    // attempt already recorded before failing is not recorded again.
    if (!editing) {
      for (const row of paymentRows) {
        if (row.collectedBefore || row.addedToLead) continue;
        // In INR, like everything this close records.
        await addPayment.mutateAsync({
          amount: rowAmount(row),
          note: `Collected at enrolment${pickedCourse ? ` — ${pickedCourse.name}` : ""} · ${PAYMENT_METHOD_LABELS[row.method as EnrolmentPaymentMethod] ?? row.method}`,
          paidAt: new Date(enrollmentDate).toISOString(),
        });
        setPaymentRows((prev) => prev.map((r) => (r.id === row.id ? { ...r, addedToLead: true } : r)));
      }
    }

    if (editing && existingStudent) {
      // The enrolment exists; this is the second visit to it. Only the fields
      // this dialog actually owns are sent, so nothing recorded elsewhere is
      // overwritten by a stale copy of the lead.
      await updateMut.mutateAsync({
        id: existingStudent._id,
        data: {
          course: pickedCourse?._id ?? null,
          enrollmentDate: new Date(enrollmentDate).toISOString(),
          feeStatus: effectiveFeeStatus,
          totalFee,
          paidAmount,
          notes: notes || undefined,
          ...bonusFields,
        },
      });
      onCreated();
      return;
    }

    await createMut.mutateAsync({
      leadId: lead._id,
      name:   lead.name,
      phone:  lead.phone ?? undefined,
      email:  email || undefined,
      course: pickedCourse?._id ?? null,
      team:   lead.team
        ? typeof lead.team === "object" ? (lead.team as { _id: string })._id : lead.team
        : null,
      assignedTo: lead.assignedTo
        ? typeof lead.assignedTo === "object" ? (lead.assignedTo as { _id: string })._id : lead.assignedTo
        : null,
      initialLeadResponse:  lead.initialLeadResponse  ?? null,
      primaryConcern:       lead.primaryConcern        ?? null,
      followupStrategyType: lead.followupStrategyType  ?? null,
      demoScheduled:    lead.demoScheduled  ?? false,
      demoAttended:     lead.demoAttended   ?? false,
      firstContactTime: lead.firstContactTime  ?? null,
      lastFollowupDate: lead.lastFollowupDate  ?? null,
      enrollmentDate: new Date(enrollmentDate).toISOString(),
      feeStatus: effectiveFeeStatus,
      totalFee,
      paidAmount,
      notes: notes || undefined,
      language,
      // The first payment's, for whatever reads only one; every one below.
      paymentMethod: paymentRows[0]?.method,
      paymentReceipt: paymentRows[0]?.receipt,
      payments: paymentRows.map((r) => ({
        method: r.method,
        amount: rowAmount(r),
        receipt: r.receipt as StoredReceipt,
        paidAt: new Date(enrollmentDate).toISOString(),
        ...(r.collectedBefore ? { collectedBefore: true } : {}),
      })),
      ...bonusFields,
    });
    onCreated();
  }

  const assignedName = lead.assignedTo
    ? typeof lead.assignedTo === "object"
      ? (lead.assignedTo as { name: string }).name
      : lead.assignedTo
    : null;


  return (
    <AnimatePresence>
      {open && (
        <Dialog open={open} onOpenChange={onClose}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/50 bg-card px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogHeader>
                    <DialogTitle className="text-base font-bold">{editing ? "Enrolment" : "Create Student Profile"}</DialogTitle>
                  </DialogHeader>
                  <p className="text-xs text-muted-foreground">
                    {lead.name} · {editing ? `Enrolled ${existingStudent?.enrollmentNumber ?? ""}`.trim() : "Lead closed"}
                    {progress ? ` · ${progress}` : ""}
                  </p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </motion.div>

            <div className="px-5 py-4 space-y-5">
              {/* Personal details strip */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Personal Details</p>
                <div className="rounded-xl border border-border/50 bg-muted/20 divide-y divide-border/30">
                  {[
                    { icon: User2, label: "Name",    value: lead.name },
                    { icon: Phone, label: "Phone",   value: lead.phone },
                    { icon: Mail,  label: "Email",   value: askEmail ? null : (leadEmail || existingStudent?.email) },
                    { icon: BookOpen, label: "Course", value: knownCourse ? `${knownCourse.name}${knownCourse.amount ? ` · ${fmtINR(knownCourse.amount)}` : ""}` : null },
                    { icon: User2, label: "Counsellor", value: assignedName },
                  ].filter((r) => r.value).map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 px-3 py-2.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-muted-foreground w-20 shrink-0">{label}</span>
                      <span className="text-xs font-medium text-foreground truncate">{value}</span>
                    </div>
                  ))}
                  {/* Asked here, where it would have shown, when the lead has
                      none that works — finance cannot invoice without it. */}
                  {askEmail && (
                    <div className="flex items-start gap-3 px-3 py-2">
                      <Mail className="mt-2 h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="mt-1.5 text-[11px] text-muted-foreground w-20 shrink-0">Email *</span>
                      <div className="flex-1 space-y-1">
                        <Input
                          type="email" value={emailInput}
                          onChange={(e) => setEmailInput(e.target.value)}
                          placeholder="client@example.com" className="h-8 text-xs"
                          aria-label="Client email"
                        />
                        <p className={cn("text-[10px]", emailMissing && emailInput ? "text-amber-400" : "text-muted-foreground")}>
                          {emailMissing && emailInput
                            ? "That is not an email address finance will take."
                            : "This lead has no email. Finance needs one for the invoice; it is saved on the lead too."}
                        </p>
                      </div>
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Lead insight badges */}
              {(lead.initialLeadResponse || lead.primaryConcern || lead.followupStrategyType ||
                lead.demoScheduled || lead.firstContactTime || lead.lastFollowupDate) && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Lead Insights</p>
                  <div className="flex flex-wrap gap-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                    {lead.initialLeadResponse && (
                      <span className="inline-flex items-center rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 text-[10px] font-medium text-violet-400">
                        {lead.initialLeadResponse.replace(/_/g, " ")}
                      </span>
                    )}
                    {lead.primaryConcern && (
                      <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[10px] font-medium text-amber-400">
                        Concern: {lead.primaryConcern.replace(/_/g, " ")}
                      </span>
                    )}
                    {lead.followupStrategyType && (
                      <span className="inline-flex items-center rounded-full bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 text-[10px] font-medium text-sky-400">
                        {lead.followupStrategyType.replace(/_/g, " ")}
                      </span>
                    )}
                    {lead.demoScheduled && (
                      <span className="inline-flex items-center rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 text-[10px] font-medium text-violet-400">
                        Demo {lead.demoAttended ? "Attended" : "Scheduled"}
                      </span>
                    )}
                    {lead.firstContactTime && (
                      <span className="text-[10px] text-muted-foreground">1st contact: {toIST(lead.firstContactTime)}</span>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Fee section */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Fee Summary</p>
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-card p-2 border border-border/30">
                      <p className="text-sm font-bold text-foreground">{fmtINR(totalFee)}</p>
                      <p className="text-[10px] text-muted-foreground">Total Fee</p>
                    </div>
                    <div className="rounded-lg bg-card p-2 border border-border/30">
                      <p className="text-sm font-bold text-green-400">{fmtINR(paidAmount)}</p>
                      <p className="text-[10px] text-muted-foreground">Paid</p>
                    </div>
                    <div className="rounded-lg bg-card p-2 border border-border/30">
                      <p className={cn("text-sm font-bold", pending > 0 ? "text-amber-400" : "text-green-400")}>{fmtINR(pending)}</p>
                      <p className="text-[10px] text-muted-foreground">Balance</p>
                    </div>
                  </div>
                  <p className="text-[10px] text-muted-foreground">
                    All amounts in INR (₹). Balance = total fee − paid. A bonus is never part of it.
                  </p>
                  <div className={cn("grid gap-2", editing ? "grid-cols-2" : "grid-cols-1")}>
                    <div className="space-y-1">
                      <p className="text-[11px] text-muted-foreground">Total fee (₹)</p>
                      <Input
                        type="number" min="0" step="0.01" value={feeInput}
                        onChange={(e) => setFeeInput(e.target.value)}
                        placeholder="0" className="h-8 text-xs"
                      />
                    </div>
                    {/* A new close takes its payments one by one, below. */}
                    {editing && (
                      <div className="space-y-1">
                        <p className="text-[11px] text-muted-foreground">
                          Collected now{alreadyPaid > 0 ? ` · ${fmtINR(alreadyPaid)} already` : ""}
                        </p>
                        <Input
                          type="number" min="0" step="0.01" value={paidNowInput}
                          onChange={(e) => setPaidNowInput(e.target.value)}
                          placeholder="0" className="h-8 text-xs"
                        />
                      </div>
                    )}
                  </div>
                  {/* What is collected here becomes a payment on the lead, so
                      the money is recorded in one place rather than two that
                      can disagree. */}
                  {paidNow > 0 && (
                    <p className="text-[10px] text-muted-foreground">
                      {fmtINR(paidNow)} will be added to this lead&apos;s payments.
                    </p>
                  )}
                  {overFee && (
                    <p className="text-[11px] font-medium text-amber-400">
                      Collected ({fmtINR(paidAmount)}) is {fmtINR(overBy)} more than the fee ({fmtINR(totalFee)}) — fine if it was taken: it goes to finance as collected.
                    </p>
                  )}
                  {totalFee > 0 && (
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-green-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (paidAmount / totalFee) * 100)}%` }}
                        transition={{ delay: 0.3, duration: 0.6 }}
                      />
                    </div>
                  )}

                  {/* The bonus: asked, answered, and kept beside the money. */}
                  <div className="space-y-1.5 border-t border-border/30 pt-2">
                    <p className="text-[11px] text-muted-foreground flex items-center gap-1">
                      <Gift className="h-3 w-3" /> Bonus given?{!editing && " *"}
                    </p>
                    <div className="flex items-center gap-2">
                      {(["no", "yes"] as const).map((choice) => (
                        <button
                          key={choice}
                          type="button"
                          onClick={() => { setBonusChoice(choice); setBonusTouched(true); }}
                          className={cn(
                            "h-8 rounded-md border px-3 text-xs font-medium transition-colors",
                            bonusChoice === choice
                              ? "border-primary bg-primary/10 text-primary"
                              : "border-border/60 text-muted-foreground hover:border-primary/40 hover:text-foreground",
                          )}
                        >
                          {choice === "yes" ? "Yes" : "No"}
                        </button>
                      ))}
                      <AnimatePresence>
                        {bonusChoice === "yes" && (
                          <motion.div
                            initial={{ opacity: 0, x: -6 }}
                            animate={{ opacity: 1, x: 0 }}
                            exit={{ opacity: 0, x: -6 }}
                            className="flex-1"
                          >
                            <Input
                              type="number" min="0" step="0.01" value={bonusInput}
                              onChange={(e) => { setBonusInput(e.target.value); setBonusTouched(true); }}
                              placeholder="Bonus amount (₹)" className="h-8 text-xs"
                              aria-label="Bonus amount"
                            />
                          </motion.div>
                        )}
                      </AnimatePresence>
                    </div>
                    {bonusFromCourse && (
                      <p className="text-[10px] text-primary">From the course — change it if this sale differs.</p>
                    )}
                    {/* Where the answer goes. After the close an edit stays in
                        the CRM: finance only takes a changed enrolment when it
                        has sent it back to be corrected. */}
                    {bonusChoice && (
                      <p className="text-[10px] text-muted-foreground">
                        {editing
                          ? "Saved here. Finance sees a change only if it sends this enrolment back for correction."
                          : bonusChoice === "yes"
                            ? `${bonusAmount > 0 ? fmtINR(bonusAmount) : "The"} bonus goes to finance with the enrolment, and on to the LMS — outside the fee and balance.`
                            : "No bonus — recorded as such with the enrolment."}
                      </p>
                    )}
                  </div>
                </div>
              </motion.div>


              {/* Editable fields */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Enrollment</p>

                {/* Only when the lead never named a course. One that did shows
                    it in the details strip above; asking again there would be
                    two answers to the same question. */}
                {!knownCourse && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <BookOpen className="h-3 w-3" /> Course
                    </p>
                    <Select
                      value={courseId}
                      onValueChange={(v) => {
                        setCourseId(v);
                        // The fee follows the course that was just chosen,
                        // rather than leaving the old number under a new name.
                        const c = courses.find((x) => x._id === v);
                        if (c?.amount) setFeeInput(String(c.amount));
                        // So does the bonus it comes with, until the seller has answered it.
                        if (!editing && !bonusTouched) {
                          const bonus = c?.bonusAmount ?? 0;
                          setBonusChoice(bonus > 0 ? "yes" : "");
                          setBonusInput(bonus > 0 ? String(bonus) : "");
                        }
                      }}
                      disabled={coursesLoading}
                    >
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder={coursesLoading ? "Loading courses…" : "Select a course"} />
                      </SelectTrigger>
                      <SelectContent>
                        {courses.map((c) => (
                          <SelectItem key={c._id} value={c._id} className="text-xs">
                            {c.name}{c.amount ? ` · ${fmtINR(c.amount)}` : ""}
                          </SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                    {courseMissing && !coursesLoading && (
                      <p className="text-[10px] text-amber-400">
                        This lead has no course. Pick one — the fee and the invoice come from it.
                      </p>
                    )}
                  </div>
                )}

                {/* What finance is given about the sale: what it is taught in,
                    and how it was paid for — each payment with its receipt. */}
                {!editing && (
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground">Language *</p>
                    <Select value={language} onValueChange={setLanguage}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue placeholder="Taught in…" />
                      </SelectTrigger>
                      <SelectContent>
                        {ENROLMENT_LANGUAGES.map((l) => (
                          <SelectItem key={l} value={l} className="text-xs">{l}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {!editing && (
                  <div className="space-y-1.5">
                    <p className="text-xs text-muted-foreground">
                      Payments * <span className="text-[10px]">— one for each way the client paid, each with its receipt</span>
                    </p>
                    <PaymentRowsEditor leadId={lead._id} rows={paymentRows} onChange={setPaymentRows} />
                  </div>
                )}

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Enrollment Date
                    </p>
                    <Input
                      type="date"
                      value={enrollmentDate}
                      onChange={(e) => setEnrollmentDate(e.target.value)}
                      className="h-8 text-xs [color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Fee Status
                    </p>
                    <Select value={effectiveFeeStatus} onValueChange={(v) => { setFeeStatus(v as FeeStatus); setFeeStatusTouched(true); }}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid"    className="text-xs"><span className="text-green-400">Paid</span></SelectItem>
                        <SelectItem value="partial" className="text-xs"><span className="text-amber-400">Partial</span></SelectItem>
                        <SelectItem value="pending" className="text-xs"><span className="text-muted-foreground">Pending</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <StickyNote className="h-3 w-3" /> Notes (optional)
                  </p>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes about the student…"
                    className="resize-none text-xs min-h-[64px]"
                    rows={2}
                  />
                </div>
              </motion.div>
            </div>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border/50 bg-card px-5 py-3"
            >
              {/* Named rather than left to a greyed-out button: a control that
                  will not respond and does not say why is the worst of both. */}
              <span className={cn("text-[11px]", !missing.length && overFee ? "text-amber-400" : "text-muted-foreground")}>
                {missing.length
                  ? `Still needed: ${missing.join(", ")}.`
                  : overFee
                    ? `Collected is ${fmtINR(overBy)} more than the fee — it goes to finance as collected.`
                    : editing
                      ? "Changes apply to this enrolment."
                      : "The lead is closed either way."}
              </span>
              <Button
                size="sm"
                className="gap-2"
                onClick={handleCreate}
                disabled={saving || courseMissing || missing.length > 0 || uploading}
              >
                {saving ? (
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> {editing ? "Saving…" : "Creating…"}</span>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> {editing ? "Save enrolment" : "Create Student"}</>
                )}
              </Button>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
