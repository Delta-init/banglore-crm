/**
 * Checks payments taken more than one way at the close (the user, 2026-10-05:
 * "total 500, paid 300 cash and 200 card … two receipts"), on a scratch
 * database, through the API:
 *
 *   - Case 1: a close with two payments keeps each — method, amount, date,
 *     receipt — and hands every one to finance, adding up to what was paid;
 *   - Case 2: the money already on the lead as a payment of its own, part
 *     paid, pennies, an older screen that sends one method and one receipt,
 *     and ten payments;
 *   - Case 3: payments that don't add up, without a receipt, an unknown method,
 *     nothing, too many — and anything collected above the fee — refused, on a
 *     close and on an edit, with nothing saved;
 *   - Case 4: who may close;
 *   - Case 5: Banglore — the payload is tagged crm "banglore", in INR with no
 *     conversion, and a close needs the client's email (kept on the lead).
 *
 * Run by split-payments-check.sh. Scratch database only.
 */
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

// The routes load the push service, which wants VAPID keys the moment it loads.
const vapid = (await import("web-push")).default.generateVAPIDKeys();
Object.assign(process.env, {
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  JWT_SECRET: "split-payments-check-jwt",
  JWT_REFRESH_SECRET: "split-payments-check-refresh",
  NODE_ENV: "test",
  RUN_SCHEDULERS: "false",
});

const mongoose = (await import("mongoose")).default;
await mongoose.connect(uri);
await mongoose.connection.dropDatabase();
const db = mongoose.connection.db!;

const { Course } = await import("../src/models/Course.js");
const { Student } = await import("../src/models/Student.js");
const { StudentService } = await import("../src/services/studentService.js");
const { signAccessToken } = await import("../src/utils/jwt.js");
const service = new StudentService();

// ── People, courses ─────────────────────────────────────────────────────────
const superRole = new Types.ObjectId(), bdeRole = new Types.ObjectId(), viewerRole = new Types.ObjectId();
const can = { view: true, create: true, edit: true, delete: false, approve: false, export: false };
await db.collection("roles").insertMany([
  { _id: superRole, roleName: "Super Admin", isSystemRole: true, permissions: {} },
  { _id: bdeRole, roleName: "BDE", isSystemRole: false, permissions: { students: can, leads: can, enrolments: can } },
  { _id: viewerRole, roleName: "Viewer", isSystemRole: false, permissions: { students: { ...can, create: false, edit: false } } },
]);
const people: Record<string, { id: Types.ObjectId; role: Types.ObjectId }> = {};
for (const [name, role] of [["Abrar", superRole], ["Theertha", bdeRole], ["Vera", viewerRole]] as const) {
  const id = new Types.ObjectId();
  await db.collection("users").insertOne({ _id: id, name, email: `${name.toLowerCase()}@test.local`, password: "x", role, status: "active" });
  people[name] = { id, role };
}
const course500 = await Course.create({ name: "COURSE 500", amount: 500 });
const course1000 = await Course.create({ name: "COURSE 1000", amount: 1000 });

// ── The API ─────────────────────────────────────────────────────────────────
const express = (await import("express")).default;
const routes = (await import("../src/routes/index.js")).default;
const { errorHandler } = await import("../src/middleware/errorHandler.js");
const app = express();
app.use(express.json());
app.use("/api/v1", routes);
app.use(errorHandler);
const server = app.listen(0);
const port = (server.address() as { port: number }).port;
const token = (name: string) => signAccessToken({ userId: String(people[name]!.id), email: `${name.toLowerCase()}@test.local`, roleId: String(people[name]!.role) });
type Answer = { status: number; body: { data?: Record<string, unknown>; message?: string } };
async function call(method: string, path: string, who?: string, body?: unknown): Promise<Answer> {
  const res = await fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
    method,
    headers: { "content-type": "application/json", ...(who ? { authorization: `Bearer ${token(who)}` } : {}) },
    body: body === undefined ? undefined : JSON.stringify(body),
  });
  return { status: res.status, body: (await res.json().catch(() => ({}))) as Answer["body"] };
}

const receipt = (name: string) => ({ name: `${name}.jpg`, url: `https://files.test.local/receipts/${name}.jpg`, key: `receipts/${name}.jpg`, size: 1000, mimeType: "image/jpeg" });
let n = 0;
/** A lead to close, with whatever was collected on it before. */
async function lead(before: number[] = []) {
  n++;
  const _id = new Types.ObjectId();
  await db.collection("leads").insertOne({
    _id, name: `Client ${n}`, phone: `+97150000${String(n).padStart(4, "0")}`, email: `client${n}@test.local`, status: "closed",
    assignedTo: people.Theertha!.id, payments: before.map((amount) => ({ _id: new Types.ObjectId(), amount, note: "Booking", paidAt: new Date("2026-10-01") })),
  });
  return String(_id);
}
/** A close, as the dialog sends it. */
const close = async (over: Record<string, unknown>, who = "Theertha", before: number[] = []) => {
  const leadId = await lead(before);
  const r = await call("POST", "/students", who, {
    leadId, name: `Client ${n}`, phone: `+97150000${String(n).padStart(4, "0")}`, email: `client${n}@test.local`,
    course: String(course500._id), enrollmentDate: "2026-10-05T00:00:00.000Z", totalFee: 500, language: "English", hasBonus: false,
    ...over,
  });
  return { ...r, leadId };
};
const pay = (method: string, amount: number, name = `${method}-${amount}`, extra: Record<string, unknown> = {}) => ({ method, amount, receipt: receipt(name), paidAt: "2026-10-05T00:00:00.000Z", ...extra });
const studentOf = (r: Answer) => Student.findById(String(r.body.data?._id)).lean();

section("Case 1 — 500 paid as 300 cash and 200 card, each with its receipt");
let r = await close({ paidAmount: 500, payments: [pay("cash", 300, "cash-a"), pay("card", 200, "card-b")] });
check("closed: 201", r.status === 201, `${r.status} ${r.body.message}`);
let s = await studentOf(r);
check("both payments kept, method and amount each", s?.payments?.map((p) => `${p.method}:${p.amount}`).join(",") === "cash:300,card:200", JSON.stringify(s?.payments));
check("…each with its own receipt", s?.payments?.[0]?.receipt?.key === "receipts/cash-a.jpg" && s?.payments?.[1]?.receipt?.key === "receipts/card-b.jpg");
check("…the first also as the one method and receipt", s?.paymentMethod === "cash" && s?.paymentReceipt?.key === "receipts/cash-a.jpg");
check("…paid in full", s?.paidAmount === 500 && s?.pendingAmount === 0 && s?.feeStatus === "paid", `${s?.paidAmount}/${s?.pendingAmount}/${s?.feeStatus}`);
let payload = await service.buildHandoverPayload(String(s!._id)) as Record<string, any>;
check("finance is sent each payment, in paise, dated, with its receipt",
  payload?.payments?.map((p: any) => `${p.method}:${p.amountMinor}:${p.paidOn}:${p.receipt?.key}`).join(",") === "cash:30000:2026-10-05:receipts/cash-a.jpg,card:20000:2026-10-05:receipts/card-b.jpg", JSON.stringify(payload?.payments));
check("…adding up to what was declared paid, with nothing left to collect", payload?.declaredPaidMinor === 50000 && payload?.balanceMinor === 0);
check("…and the first as the one method and receipt, for whatever reads only that", payload?.declaredPaymentMethod === "cash" && payload?.receipt?.key === "receipts/cash-a.jpg");

section("Case 2 — money already on the lead, part paid, pennies, an older screen, ten payments");
r = await close({ paidAmount: 500, payments: [pay("bank_transfer", 200, "before", { collectedBefore: true }), pay("cash", 300)] }, "Theertha", [200]);
s = await studentOf(r);
check("200 already on the lead + 300 cash: its own payment, marked as before", r.status === 201 && s?.payments?.[0]?.collectedBefore === true && s?.paidAmount === 500, `${r.status} ${r.body.message}`);
r = await close({ course: String(course1000._id), totalFee: 1000, paidAmount: 500, payments: [pay("cash", 300), pay("card", 200)] });
s = await studentOf(r);
payload = await service.buildHandoverPayload(String(s!._id)) as Record<string, any>;
check("part paid: 500 of 1000, half still to collect", r.status === 201 && s?.pendingAmount === 500 && s?.feeStatus === "partial" && payload?.balanceMinor === 50000, `${r.status} ${s?.pendingAmount} ${s?.feeStatus}`);
r = await close({ paidAmount: 500, payments: [pay("cash", 300.1), pay("card", 199.9)] });
s = await studentOf(r);
payload = r.status === 201 ? await service.buildHandoverPayload(String(s!._id)) as Record<string, any> : null;
check("300.10 + 199.90 make 500, to the paisa", r.status === 201 && payload?.payments?.map((p: any) => p.amountMinor).join(",") === "30010,19990" && payload?.declaredPaidMinor === 50000, `${r.status} ${r.body.message}`);
r = await close({ paidAmount: 500, paymentMethod: "tabby", paymentReceipt: receipt("tabby-only") });
s = await studentOf(r);
payload = r.status === 201 ? await service.buildHandoverPayload(String(s!._id)) as Record<string, any> : null;
check("an older screen — one method, one receipt — still closes, with no list", r.status === 201 && !s?.payments?.length && payload?.payments === undefined && payload?.declaredPaymentMethod === "tabby", `${r.status} ${r.body.message}`);
r = await close({ paidAmount: 500, payments: Array.from({ length: 10 }, (_, i) => pay("cash", 50, `cash-${i}`)) });
check("ten payments of 50", r.status === 201, `${r.status} ${r.body.message}`);

section("Case 3 — what can't be right is refused, and nothing is saved");
const refused = async (label: string, over: Record<string, unknown>, pattern: RegExp) => {
  const before = await Student.countDocuments();
  const x = await close(over);
  check(label, x.status === 422 && pattern.test(x.body.message ?? "") && (await Student.countDocuments()) === before, `${x.status} ${x.body.message}`);
};
await refused("payments that don't add up to what was paid: 422", { paidAmount: 500, payments: [pay("cash", 300), pay("card", 100)] }, /must match/);
await refused("a payment without its receipt: 422", { paidAmount: 500, payments: [pay("cash", 300), { method: "card", amount: 200, paidAt: "2026-10-05" }] }, /Payment 2 needs its receipt/);
await refused("a method this CRM doesn't take: 422", { paidAmount: 500, payments: [pay("gold", 500)] }, /payment method/);
await refused("a payment of nothing: 422", { paidAmount: 500, payments: [pay("cash", 500), pay("card", 0)] }, /above zero/);
await refused("eleven payments: 422", { paidAmount: 550, totalFee: 600, payments: Array.from({ length: 11 }, (_, i) => pay("cash", 50, `c${i}`)) }, /between one and ten/);
await refused("an empty list: 422", { paidAmount: 0, payments: [] }, /between one and ten/);
// Collecting more than the fee is taken (the owner, 2026-10-06): the balance is zero, never negative.
{
  const over = await close({ paidAmount: 600, payments: [pay("cash", 300), pay("card", 300)] });
  const saved = over.status === 201 ? await Student.findById(String(over.body.data?._id)).lean() : null;
  check("collected 600 on a 500 fee: taken (201), balance 0", over.status === 201 && saved?.pendingAmount === 0, `${over.status} ${over.body.message}`);
  const older = await close({ paidAmount: 600, paymentMethod: "cash", paymentReceipt: receipt("over") });
  check("…from an older screen too: taken (201)", older.status === 201, `${older.status} ${older.body.message}`);
}
const ok = await close({ paidAmount: 300, payments: [pay("cash", 300)] });
r = await call("PUT", `/students/${String(ok.body.data?._id)}`, "Theertha", { paidAmount: 700 });
s = await Student.findById(String(ok.body.data?._id)).lean();
check("an edit taking it above the fee: taken (200), balance 0", r.status === 200 && s?.paidAmount === 700 && s?.pendingAmount === 0, `${r.status} ${s?.paidAmount}`);
r = await call("PUT", `/students/${String(ok.body.data?._id)}`, "Theertha", { totalFee: 200 });
check("…or lowering the fee below what was paid: taken (200)", r.status === 200, `${r.status}`);
const legacy = await Student.create({ enrollmentNumber: "STU-9999", name: "Legacy", leadId: new Types.ObjectId(), totalFee: 1000, paidAmount: 2250, pendingAmount: 0, feeStatus: "paid", enrollmentDate: new Date() });
r = await call("PUT", `/students/${String(legacy._id)}`, "Theertha", { notes: "Checked with accounts" });
check("an enrolment over its fee from before still takes an edit that leaves the money alone", r.status === 200, `${r.status} ${r.body.message}`);

section("Case 4 — who may close");
r = await call("POST", "/students", undefined, { leadId: await lead(), name: "No one", totalFee: 500, paidAmount: 500, payments: [pay("cash", 500)] });
check("not signed in: 401", r.status === 401, `${r.status}`);
r = await close({ paidAmount: 500, payments: [pay("cash", 500)] }, "Vera");
check("a role that can't add students: 403", r.status === 403, `${r.status}`);
r = await close({ paidAmount: 500, payments: [pay("cash", 300), pay("card", 200)] }, "Abrar");
check("a super admin closes too", r.status === 201, `${r.status} ${r.body.message}`);

section("Case 5 — Banglore: crm tag, INR, the client's email");
r = await close({ paidAmount: 500, payments: [pay("cash", 300), pay("card", 200)] });
s = await studentOf(r);
payload = await service.buildHandoverPayload(String(s!._id)) as Record<string, any>;
check("tagged crm \"banglore\", source \"crm\"", payload?.crm === "banglore" && payload?.source === "crm", `${payload?.crm} ${payload?.source}`);
check("currency INR, amounts as taken (500 → 50000 paise), no conversion", payload?.currency === "INR" && payload?.course?.amountMinor === 50000 && payload?.declaredPaidMinor === 50000, JSON.stringify({ c: payload?.currency, a: payload?.course?.amountMinor }));
check("no payment carries an `original` (no foreign currency)", (payload?.payments ?? []).every((p: any) => p.original === undefined));
{
  const before = await Student.countDocuments();
  const leadId = await lead();
  await db.collection("leads").updateOne({ _id: new Types.ObjectId(leadId) }, { $unset: { email: "" } });
  const noEmail = await call("POST", "/students", "Theertha", {
    leadId, name: "No email", phone: "+919800000000", course: String(course500._id), enrollmentDate: "2026-10-05T00:00:00.000Z",
    totalFee: 500, paidAmount: 500, payments: [pay("cash", 500)], language: "English", hasBonus: false,
  });
  check("a close without the client's email: 422, nothing saved", noEmail.status === 422 && /client's email/.test(noEmail.body.message ?? "") && (await Student.countDocuments()) === before, `${noEmail.status} ${noEmail.body.message}`);
  const bad = await call("POST", "/students", "Theertha", {
    leadId, name: "Bad email", phone: "+919800000000", email: "not-an-email", course: String(course500._id), enrollmentDate: "2026-10-05T00:00:00.000Z",
    totalFee: 500, paidAmount: 500, payments: [pay("cash", 500)], language: "English", hasBonus: false,
  });
  check("…or with one finance won't take: 422", bad.status === 422 && /client's email/.test(bad.body.message ?? ""), `${bad.status} ${bad.body.message}`);
  const good = await call("POST", "/students", "Theertha", {
    leadId, name: "Asked email", phone: "+919800000000", email: "Asked@Test.Local", course: String(course500._id), enrollmentDate: "2026-10-05T00:00:00.000Z",
    totalFee: 500, paidAmount: 500, payments: [pay("cash", 500)], language: "English", hasBonus: false,
  });
  const leadAfter = await db.collection("leads").findOne({ _id: new Types.ObjectId(leadId) });
  check("the email asked at the close is kept, lower-cased, on the student and the lead", good.status === 201 && good.body.data?.email === "asked@test.local" && leadAfter?.email === "asked@test.local", `${good.status} ${good.body.message} ${leadAfter?.email}`);
  check("…and the lead logs who added it", (leadAfter?.activityLogs ?? []).some((l: any) => /Email added at the close/.test(l.description)));
}

server.close();
await mongoose.disconnect();
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
