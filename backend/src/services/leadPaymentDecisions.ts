import { Lead } from "../models/Lead.js";
import { Student } from "../models/Student.js";
import { syncFinanceOnlyPayments } from "./financeOnlyPayments.js";
import { oldBooksTick } from "./oldBooks.js";
import { fetchEnrolmentStatuses, type BalanceFields, type EnrolmentStatus, type FinanceBalancePayment } from "./financeClient.js";

/*
 * Finance's decision on each balance payment sent from a lead (the user, 2026-11-25: Bangalore "need finance approval
 * also", as the Remote CRM since 2026-10-26). Kept on the lead's payment (`finance.state`), so it counts — revenue,
 * reports (utils/countedPayments.ts) — once approved, and shows as a request until then, or as rejected with finance's
 * reason. Every two minutes: every lead with a sent payment not decided yet, asked of finance by its enrolment. A
 * decision is final: an approved or rejected payment is not asked about again.
 */

const UNDECIDED = { "finance.externalId": { $exists: true }, "finance.state": { $nin: ["approved", "rejected"] } };
const INTERVAL_MS = 120_000;
const BATCH = 200;

type LeadPayments = { _id: unknown; payments?: { _id: unknown; finance?: { externalId?: string; state?: string } | null }[] };

export async function syncLeadPaymentDecisions(): Promise<number> {
  const leads = await Lead.find({ payments: { $elemMatch: UNDECIDED } }).select("payments._id payments.finance").lean<LeadPayments[]>();
  let changed = 0;
  for (let i = 0; i < leads.length; i += BATCH) {
    const batch = leads.slice(i, i + BATCH);
    const students = await Student.find({ leadId: { $in: batch.map((l) => l._id) } }).select("leadId").lean<{ _id: unknown; leadId: unknown }[]>();
    const statuses = (await fetchEnrolmentStatuses(students.map((s) => String(s._id)))) as (EnrolmentStatus & BalanceFields)[];
    if (!statuses.length) continue;                       // finance away, or none of them there: next time
    const decisionOf = new Map<string, FinanceBalancePayment>(statuses.flatMap((st) => (st.balancePayments ?? []).map((b) => [b.externalId, b] as const)));

    for (const lead of batch) {
      for (const p of lead.payments ?? []) {
        const f = p.finance;
        if (!f?.externalId || f.state === "approved" || f.state === "rejected") continue;
        const b = decisionOf.get(f.externalId);
        if (!b || b.status === f.state) continue;          // finance doesn't know it (yet), or nothing new
        await Lead.updateOne(
          { _id: lead._id },
          {
            $set: {
              "payments.$[p].finance.state": b.status,
              ...(b.status !== "pending" ? { "payments.$[p].finance.decidedAt": b.decidedAt ? new Date(b.decidedAt) : new Date() } : {}),
              ...(b.reason ? { "payments.$[p].finance.reason": b.reason } : {}),
            },
          },
          { arrayFilters: [{ "p._id": p._id }] },
        );
        changed++;
      }
    }
  }
  return changed;
}

type ApprovedLead = { _id: unknown; payments?: { amount: number; finance?: { externalId?: string; state?: string } | null }[] };
const round2 = (n: number) => Math.round(n * 100) / 100;

/**
 * Each approved balance payment, added to its enrolment (2026-11-25, as in the Remote CRM since 2026-10-31) — the
 * lead's own, and the ones accounts recorded straight in finance (financeOnlyPayments.ts). Once per payment, by
 * finance's id (`balanceApplied`), so a pass run again — or two at once — adds nothing twice; then what is pending and
 * the fee status follow, as an edit of the enrolment works them out. All in rupees, like everything here.
 *
 * Never counted twice when somebody already typed it in by hand: where the enrolment lists what was taken at the
 * close, its paid amount becomes at least that plus every approved balance payment — never that plus what is there.
 */
export async function applyApprovedBalances(): Promise<number> {
  const leads = await Lead.find({ payments: { $elemMatch: { "finance.externalId": { $exists: true }, "finance.state": "approved" } } })
    .select("payments.amount payments.finance").lean<ApprovedLead[]>();
  if (!leads.length) return 0;
  const students = await Student.find({ leadId: { $in: leads.map((l) => l._id) } })
    .select("leadId balanceApplied payments.amount")
    .lean<{ _id: unknown; leadId: unknown; balanceApplied?: string[]; payments?: { amount: number }[] }[]>();
  const studentOf = new Map(students.map((st) => [String(st.leadId), st]));
  let applied = 0;
  for (const lead of leads) {
    const st = studentOf.get(String(lead._id));
    if (!st) continue;
    const approved = (lead.payments ?? []).filter((p) => p.finance?.externalId && p.finance.state === "approved" && p.amount > 0);
    // What the enrolment should show at least: taken at the close, and every approved balance payment.
    const atClose = st.payments?.length ? st.payments.reduce((sum, p) => sum + (p.amount || 0), 0) : null;
    const floor = atClose === null ? null : round2(atClose + approved.reduce((sum, p) => sum + p.amount, 0));
    for (const p of approved) {
      const id = p.finance!.externalId!;
      if ((st.balanceApplied ?? []).includes(id)) continue;
      // With the close's payments known: up to what they and the approved balances make, never past it. Without
      // (an older close): added on.
      const after = await Student.findOneAndUpdate(
        { _id: st._id, balanceApplied: { $ne: id } },
        floor === null
          ? { $inc: { paidAmount: p.amount }, $addToSet: { balanceApplied: id } }
          : { $max: { paidAmount: floor }, $addToSet: { balanceApplied: id } },
        { new: true, projection: { totalFee: 1, paidAmount: 1 } },
      ).lean<{ totalFee?: number; paidAmount?: number }>();
      if (!after) continue;                               // another pass added it first
      st.balanceApplied = [...(st.balanceApplied ?? []), id];
      const total = after.totalFee ?? 0;
      const paid = round2(after.paidAmount ?? 0);
      await Student.updateOne(
        { _id: st._id },
        { $set: { paidAmount: paid, pendingAmount: Math.max(0, round2(total - paid)), feeStatus: total <= 0 || paid <= 0 ? "pending" : paid >= total ? "paid" : "partial" } },
      );
      applied++;
    }
  }
  return applied;
}

let running = false;
async function tick() {
  if (running) return;                                   // a slow pass is never overlapped by the next one
  running = true;
  try {
    const n = await syncLeadPaymentDecisions();
    if (n) console.log(`[leadPayments] ${n} balance payment decision(s) from finance kept on their leads`);
    const a = await applyApprovedBalances();
    if (a) console.log(`[leadPayments] ${a} approved balance payment(s) added to their enrolments`);
    // Money accounts record straight in finance (2026-11-25), from FINANCE_ONLY_PAYMENTS_FROM on — put on the lead as
    // approved and added to the enrolment as an approved balance payment is; paid in full in finance, paid in full here.
    const f = await syncFinanceOnlyPayments();
    if (f.added || f.paidInFull) {
      const fa = await applyApprovedBalances();
      console.log(`[leadPayments] ${f.added} payment(s) recorded in finance put on their leads, ${fa} added to their enrolments; ${f.paidInFull} enrolment(s) paid in full as finance has them`);
    }
    // Finance's old books (2026-11-25): counted for their salesperson here — every ten minutes.
    await oldBooksTick();
  } catch (err) {
    console.error("[leadPayments] tick error:", err);
  } finally {
    running = false;
  }
}

export function startLeadPaymentDecisionScheduler() {
  console.log("⏰ Balance payment decisions from finance — every 2 min");
  void tick();
  setInterval(tick, INTERVAL_MS);
}
