/**
 * Payments accounts record straight in finance, brought into the CRM (the user, 2026-11-25, as in the Sales CRM), on a
 * scratch database, against a stand-in finance — Bangalore: one finance organisation, everything in rupees, no
 * commission (what is paid and pending, the fee status and the revenue figures follow):
 *
 *   - Case 1: the one-off script — read only first; then the close's payment on the lead corrected, finance's ₹5,000 of
 *     13 Nov on the lead as approved, the enrolment paid in full; the lead's tag "approved"; run again: nothing; undone.
 *   - Case 2: the two-minute pass — part-paid enrolments in finance; nothing when finance has no more; held while one of
 *     the lead's own balance payments is still with finance; a balance payment the CRM sent never taken for the missing
 *     money; not in finance yet: not looked at; finance away: nothing; twice: once.
 *   - Case 3: from 1 Nov only — October money left as it is; paid in full in November: paid in full here at finance's
 *     fee; an earlier day takes October in.
 *
 * Run by finance-only-payments-check.sh. Scratch database only.
 */
import crypto from "node:crypto";
import { existsSync, unlinkSync } from "node:fs";
import { Types } from "mongoose";

const uri = process.env.MONGODB_URI ?? "";
if (!/127\.0\.0\.1|localhost/.test(uri) || !/e2e|test|scratch/i.test(uri)) {
  console.error(`Refusing to run: MONGODB_URI must be a scratch database, got "${uri}"`);
  process.exit(1);
}

let failures = 0, checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  if (ok) console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  else { failures++; console.log(`  \x1b[31m✗ ${label}${detail ? ` — ${detail}` : ""}\x1b[0m`); }
}
const section = (s: string) => console.log(`\n${s}`);
const j = (v: unknown) => JSON.stringify(v).slice(0, 400);

/* ── A stand-in finance: each enrolment's status ── */
const SECRET = "finance-only-payments-check-secret-long";
const finance = new Map<string, any>();
let away = false;
const fin = Bun.serve({
  port: 0,
  async fetch(req) {
    const url = new URL(req.url);
    const raw = await req.text();
    const ts = req.headers.get("x-delta-timestamp") ?? "", nonce = req.headers.get("x-delta-nonce") ?? "";
    const canonical = ["POST", url.pathname, ts, nonce, crypto.createHash("sha256").update(raw).digest("hex")].join("\n");
    if (req.headers.get("x-delta-signature") !== crypto.createHmac("sha256", SECRET).update(canonical).digest("hex")) {
      return Response.json({ error: { message: "Bad signature" } }, { status: 401 });
    }
    if (away) return Response.json({ error: { message: "down" } }, { status: 503 });
    const body = JSON.parse(raw || "{}");
    if (url.pathname === "/api/v1/integrations/enrolments/status") {
      return Response.json({ data: (body.externalIds as string[]).map((id) => finance.get(id)).filter(Boolean) });
    }
    return Response.json({ error: "Not found" }, { status: 404 });
  },
});

const vapid = (await import("web-push")).default.generateVAPIDKeys();
Object.assign(process.env, {
  VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey,
  JWT_SECRET: "finance-only-payments-check-jwt", JWT_REFRESH_SECRET: "finance-only-payments-check-refresh",
  NODE_ENV: "test", RUN_SCHEDULERS: "false",
  FINANCE_API_URL: `http://127.0.0.1:${fin.port}`, FINANCE_CLIENT_ID: "banglore-crm-check", FINANCE_INTEGRATION_SECRET: SECRET,
  FINANCE_ORG_ID: "org-blr",
  R2_ACCOUNT_ID: "", R2_ACCESS_KEY_ID: "", R2_SECRET_ACCESS_KEY: "",
});

const mongoose = (await import("mongoose")).default;
await mongoose.connect(uri);
await mongoose.connection.dropDatabase();
const db = mongoose.connection.db!;
const { syncFinanceOnlyPayments } = await import("../src/services/financeOnlyPayments.js");
const { applyApprovedBalances } = await import("../src/services/leadPaymentDecisions.js");
const { matchFinance, undoMatch } = await import("../src/scripts/financeOnlyPayment.js");
const { paymentStatesOf } = await import("../src/services/leadFinancePaymentService.js");
const { isCountedPayment } = await import("../src/utils/countedPayments.js");

const sneha = new Types.ObjectId();
await db.collection("users").insertOne({ _id: sneha, name: "Sneha", email: "sneha@test.local", password: "x", status: "active" });
const day = (d: string) => new Date(`${d}T00:00:00.000Z`);

/* ── A close: its lead, enrolment, hand-over, and what finance says ── */
let n = 0;
async function close(o: {
  leadPays: { amount: number; note: string; day: string; finance?: any }[];
  closeRows: { amount: number; method: string }[];
  fee: number; paid: number; pending?: number; sent?: boolean;
  fin: { paidMinor: number; payments: { id?: string; amountMinor: number; paidOn: string; method: string; receiptNumber?: string; taxInvoiceNumber?: string }[]; balancePayments?: any[]; fee?: number } | null;
}) {
  n++;
  const leadId = new Types.ObjectId(), studentId = new Types.ObjectId();
  await db.collection("leads").insertOne({
    _id: leadId, name: `Client ${n}`, phone: `+9198000000${n}`, assignedTo: sneha, status: "closed", createdAt: day("2026-10-01"), updatedAt: new Date(),
    payments: o.leadPays.map((p) => ({ _id: new Types.ObjectId(), amount: p.amount, note: p.note, paidAt: day(p.day), addedBy: sneha, createdAt: day(p.day), updatedAt: day(p.day), ...(p.finance ? { finance: p.finance } : {}) })),
  });
  await db.collection("students").insertOne({
    _id: studentId, leadId, name: `Client ${n}`, enrollmentNumber: `STU-${String(100 + n)}`, assignedTo: sneha, academy: "bangalore",
    totalFee: o.fee, paidAmount: o.paid, pendingAmount: o.pending ?? Math.max(0, o.fee - o.paid), feeStatus: o.paid >= o.fee ? "paid" : "partial",
    enrollmentDate: day("2026-10-29"), status: "active",
    payments: o.closeRows.map((r) => ({ method: r.method, amount: r.amount, paidAt: day("2026-10-29"), receipt: { name: "r", url: "https://x/r", key: "k" } })),
  });
  const invoice = `IN-${String(50 + n).padStart(5, "0")}`;
  await db.collection("financehandovers").insertOne({ studentId, status: o.sent === false ? "pending" : "sent", invoiceNumber: invoice, payload: {}, sentAt: day("2026-10-29") });
  if (o.fin) {
    const fee = (o.fin.fee ?? o.fee) * 100;
    finance.set(String(studentId), {
      externalId: String(studentId), invoiceId: `inv-${n}`, invoiceNumber: invoice, status: o.fin.paidMinor >= fee ? "paid" : "partial", approval: "approved",
      returnedReason: "", issueDate: "2026-10-29", currency: "INR",
      totalMinor: fee, amountPaidMinor: o.fin.paidMinor, balanceMinor: Math.max(0, fee - o.fin.paidMinor),
      payments: o.fin.payments.map((p, i) => ({ id: p.id ?? `pay-${n}-${i}`, ...p })), balancePayments: o.fin.balancePayments ?? [],
    });
  }
  return { leadId, studentId, invoice };
}
const leadOf = async (c: { leadId: Types.ObjectId }) => (await db.collection("leads").findOne({ _id: c.leadId }))!;
const studentOf = async (c: { studentId: Types.ObjectId }) => (await db.collection("students").findOne({ _id: c.studentId }))!;
const CLOSE = "Collected at enrolment — FOREX MASTERY · Razorpay";

try {
  section("Case 1 — the one-off script");
  const one = await close({
    leadPays: [{ amount: 25_000, note: CLOSE, day: "2026-10-29" }], closeRows: [{ amount: 20_000, method: "razorpay" }], fee: 25_000, paid: 20_000,
    fin: { paidMinor: 2_500_000, payments: [
      { id: "pay-close", amountMinor: 2_000_000, paidOn: "2026-10-29", method: "razorpay" },
      { id: "pay-5000", amountMinor: 500_000, paidOn: "2026-11-13", method: "inr_bank_account", taxInvoiceNumber: "TI-00031" },
    ] },
  });
  const look = await matchFinance({ invoice: one.invoice, write: false });
  const said = look.lines.join("\n");
  check("read only: says the close's payment 25,000.00 → 20,000.00 and the 5,000.00 of 2026-11-13 · TI-00031", /25,000\.00 → 20,000\.00/.test(said) && /5,000\.00 on 2026-11-13 · TI-00031/.test(said), said);
  check("…and changes nothing", (await leadOf(one)).payments.length === 1 && (await studentOf(one)).pendingAmount === 5000 && !look.undoFile);
  const done = await matchFinance({ invoice: one.invoice, write: true, undoFile: `/tmp/finance-only-check-blr-${process.pid}.json` });
  const lead = await leadOf(one);
  const added = lead.payments.find((p: any) => p.finance?.externalId);
  check("written: the close's payment on the lead is 20,000", lead.payments.find((p: any) => /^Collected at enrolment/.test(p.note))?.amount === 20_000, j(lead.payments));
  check("…finance's ₹5,000 of 13 Nov on the lead, approved by finance, its tax invoice in the note, its method",
    added?.amount === 5000 && added.paidAt.toISOString().slice(0, 10) === "2026-11-13" && added.finance.state === "approved" && added.finance.externalId === "fin-pay-5000"
      && /Recorded in finance — TI-00031/.test(added.note) && added.method === "inr_bank_account" && String(added.addedBy) === String(sneha), j(added));
  const st = await studentOf(one);
  check("…the enrolment paid in full: 25,000 paid, 0 pending, paid", st.paidAmount === 25_000 && st.pendingAmount === 0 && st.feeStatus === "paid", j(st));
  const tags = paymentStatesOf(lead.payments, { status: "sent", sentAt: day("2026-10-29") }, undefined);
  check("the lead's tag on it: approved by finance", tags.find((t) => t.id === String(added?._id))?.financeStatus === "approved", j(tags));
  check("…and it counts (revenue, reports)", isCountedPayment(added));
  check("run again: nothing to change", (await matchFinance({ invoice: one.invoice, write: false })).lines.includes("Nothing to change."));
  check("…and the two-minute pass adds nothing either", (await syncFinanceOnlyPayments()).added === 0 && (await leadOf(one)).payments.length === 2);
  await undoMatch(done.undoFile!);
  const undone = await leadOf(one), sUndone = await studentOf(one);
  check("undo: the lead as it was, the enrolment 20,000 paid · 5,000 pending",
    undone.payments.length === 1 && undone.payments[0].amount === 25_000 && sUndone.paidAmount === 20_000 && sUndone.pendingAmount === 5000 && sUndone.feeStatus === "partial", j({ undone: undone.payments, sUndone }));
  if (done.undoFile && existsSync(done.undoFile)) unlinkSync(done.undoFile);

  section("Case 2 — the two-minute pass");
  const late = await close({   // paid in finance in two parts after the close
    leadPays: [{ amount: 10_000, note: CLOSE, day: "2026-10-29" }], closeRows: [{ amount: 10_000, method: "razorpay" }], fee: 25_000, paid: 10_000,
    fin: { paidMinor: 2_500_000, payments: [
      { amountMinor: 1_000_000, paidOn: "2026-10-29", method: "razorpay" },
      { amountMinor: 1_000_000, paidOn: "2026-11-05", method: "inr_bank_account" },
      { amountMinor: 500_000, paidOn: "2026-11-20", method: "Smart Invoice" },
    ] },
  });
  const same = await close({
    leadPays: [{ amount: 10_000, note: CLOSE, day: "2026-10-29" }], closeRows: [{ amount: 10_000, method: "razorpay" }], fee: 25_000, paid: 10_000,
    fin: { paidMinor: 1_000_000, payments: [{ amountMinor: 1_000_000, paidOn: "2026-10-29", method: "razorpay" }] },
  });
  const held = await close({
    leadPays: [{ amount: 10_000, note: CLOSE, day: "2026-10-29" }, { amount: 5000, note: "Balance payment · Cash", day: "2026-11-10", finance: { externalId: "bp-held", method: "cash", sentAt: day("2026-11-10"), state: "pending" } }],
    closeRows: [{ amount: 10_000, method: "razorpay" }], fee: 25_000, paid: 10_000,
    fin: { paidMinor: 1_500_000, payments: [{ amountMinor: 1_000_000, paidOn: "2026-10-29", method: "razorpay" }, { amountMinor: 500_000, paidOn: "2026-11-10", method: "cash", receiptNumber: "RCT-5" }] },
  });
  const crmSent = await close({
    leadPays: [{ amount: 10_000, note: CLOSE, day: "2026-10-29" }, { amount: 5000, note: "Balance payment · Cash", day: "2026-11-18", finance: { externalId: "bp-mine", method: "cash", sentAt: day("2026-11-18"), state: "approved" } }],
    closeRows: [{ amount: 10_000, method: "razorpay" }], fee: 25_000, paid: 15_000,
    fin: { paidMinor: 2_500_000, payments: [
      { amountMinor: 1_000_000, paidOn: "2026-10-29", method: "razorpay" },
      { amountMinor: 1_000_000, paidOn: "2026-11-08", method: "inr_bank_account" },
      { amountMinor: 500_000, paidOn: "2026-11-18", method: "cash", receiptNumber: "RCT-8" },
    ], balancePayments: [{ externalId: "bp-mine", amountMinor: 500_000, currency: "INR", method: "cash", paidOn: "2026-11-18", status: "approved", receiptNumber: "RCT-8" }] },
  });
  await db.collection("students").updateOne({ _id: crmSent.studentId }, { $set: { balanceApplied: ["bp-mine"] } });
  const notIn = await close({
    leadPays: [{ amount: 10_000, note: CLOSE, day: "2026-10-29" }], closeRows: [{ amount: 10_000, method: "razorpay" }], fee: 25_000, paid: 10_000, sent: false,
    fin: { paidMinor: 2_500_000, payments: [{ amountMinor: 2_500_000, paidOn: "2026-11-02", method: "razorpay" }] },
  });
  away = true;
  check("finance away: nothing", (await syncFinanceOnlyPayments()).added === 0);
  away = false;
  const r = await syncFinanceOnlyPayments();
  await applyApprovedBalances();
  const fromFin = (await leadOf(late)).payments.filter((p: any) => p.finance?.externalId?.startsWith("fin-"));
  check("paid in finance in two parts: both on the lead, on finance's days, approved",
    fromFin.length === 2 && fromFin.map((p: any) => `${p.amount}@${p.paidAt.toISOString().slice(0, 10)}`).sort().join() === "10000@2026-11-05,5000@2026-11-20", j(fromFin));
  check("…a method the CRM doesn't take is left off the payment (kept on its finance note)", fromFin.find((p: any) => p.amount === 5000)?.method === undefined && fromFin.find((p: any) => p.amount === 5000)?.finance.method === "Smart Invoice");
  const lateSt = await studentOf(late);
  check("…the enrolment paid in full", lateSt.paidAmount === 25_000 && lateSt.pendingAmount === 0 && lateSt.feeStatus === "paid", j(lateSt));
  check("Case 1's close (undone) by the pass alone: its ₹5,000 back on the lead, the enrolment paid in full",
    (await leadOf(one)).payments.some((p: any) => p.finance?.externalId === "fin-pay-5000") && (await studentOf(one)).pendingAmount === 0);
  check("finance has no more than the CRM: nothing", (await leadOf(same)).payments.length === 1 && (await studentOf(same)).paidAmount === 10_000);
  check("one of the lead's balance payments still with finance: left alone, said why",
    (await leadOf(held)).payments.length === 2 && r.found.some((f) => f.studentId === String(held.studentId) && /still waiting for finance/.test(f.skipped ?? "")), j(r.found));
  const taken = (await leadOf(crmSent)).payments.filter((p: any) => p.finance?.externalId?.startsWith("fin-"));
  check("the CRM's own balance payment is never the missing money: finance's own ₹10,000 of 8 Nov taken, not the 18 Nov one",
    taken.length === 1 && taken[0].amount === 10_000 && taken[0].paidAt.toISOString().slice(0, 10) === "2026-11-08" && (await studentOf(crmSent)).paidAmount === 25_000, j(taken));
  check("not in finance yet: not looked at", (await leadOf(notIn)).payments.length === 1 && (await studentOf(notIn)).paidAmount === 10_000);
  const twice = await syncFinanceOnlyPayments();
  check("run twice: nothing more", twice.added === 0 && twice.paidInFull === 0 && (await leadOf(late)).payments.length === 3, j(twice.found.filter((f) => f.payments.length)));

  section("Case 3 — from 1 November only");
  const octOnly = await close({
    leadPays: [{ amount: 10_000, note: CLOSE, day: "2026-10-01" }], closeRows: [{ amount: 10_000, method: "razorpay" }], fee: 15_000, paid: 10_000,
    fin: { paidMinor: 1_500_000, payments: [{ amountMinor: 1_000_000, paidOn: "2026-10-01", method: "razorpay" }, { amountMinor: 500_000, paidOn: "2026-10-15", method: "cash" }] },
  });
  const stale = await close({
    leadPays: [{ amount: 5000, note: CLOSE, day: "2026-11-13" }], closeRows: [{ amount: 5000, method: "razorpay" }], fee: 25_000, paid: 25_000, pending: 20_000,
    fin: { paidMinor: 2_500_000, payments: [{ amountMinor: 500_000, paidOn: "2026-11-13", method: "razorpay" }, { amountMinor: 2_000_000, paidOn: "2026-11-17", method: "inr_bank_account" }] },
  });
  const novFee = await close({
    leadPays: [{ amount: 20_000, note: CLOSE, day: "2026-11-03" }], closeRows: [{ amount: 20_000, method: "razorpay" }], fee: 25_000, paid: 20_000,
    fin: { fee: 22_000, paidMinor: 2_200_000, payments: [{ amountMinor: 2_000_000, paidOn: "2026-11-03", method: "razorpay" }, { amountMinor: 200_000, paidOn: "2026-11-09", method: "cash", taxInvoiceNumber: "TI-90" }] },
  });
  const r3 = await syncFinanceOnlyPayments();
  await applyApprovedBalances();
  check("October money: nothing taken, still owing, said why",
    (await leadOf(octOnly)).payments.length === 1 && (await studentOf(octOnly)).pendingAmount === 5000 && r3.found.some((f) => f.studentId === String(octOnly.studentId) && /before 2026-11-01/.test(f.skipped ?? "")), j(r3.found));
  const sStale = await studentOf(stale);
  check("its pending never came down, paid in full in November: paid in full, nothing added", sStale.pendingAmount === 0 && sStale.feeStatus === "paid" && (await leadOf(stale)).payments.length === 1, j(sStale));
  const sNov = await studentOf(novFee);
  check("fee lowered in finance, paid in full in November: its ₹2,000 brought in, the enrolment at finance's fee 22,000, paid in full",
    sNov.totalFee === 22_000 && sNov.paidAmount === 22_000 && sNov.pendingAmount === 0 && sNov.feeStatus === "paid" && (await leadOf(novFee)).payments.some((p: any) => p.amount === 2000 && /TI-90/.test(p.note)), j(sNov));
  const wider = await syncFinanceOnlyPayments({ studentIds: [String(octOnly.studentId)], write: false, from: "2026-10-01" });
  check("an earlier day (FINANCE_ONLY_PAYMENTS_FROM) takes October in: the 5,000 of 15 Oct", wider.found[0]?.payments.map((m) => `${m.amountMinor / 100}@${m.paidOn}`).join() === "5000@2026-10-15", j(wider.found));
} finally {
  fin.stop(true);
  await mongoose.disconnect();
}

console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
