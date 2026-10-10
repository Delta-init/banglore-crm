/**
 * Checks correcting an enrolment finance sent back (the user, 2026-10-05: "if
 * send it back we can edit the course and amount also, all details"), on a
 * scratch database, through the API, against a stand-in finance:
 *
 *   - Case 1: nothing to correct until finance sends it back;
 *   - Case 2: the closer corrects everything — client, course, fee, date,
 *     payments with their receipts, language, bonus, notes — and it goes to
 *     finance again in the same step, as the same enrolment; the lead's
 *     payments follow, its own left alone;
 *   - Case 3: what can't be right is refused, with nothing changed and nothing sent;
 *   - Case 4: who may correct, and who may move a sale to another counsellor or team;
 *   - Case 5: sent back a moment ago — finance says so before the outbox has heard;
 *   - Case 6: an enrolment from before payments were listed, "Send again" as it
 *     was, and the receipt upload a correction uses;
 *   - Case 7: what the form starts from, and "sent again" shown once it was
 *     (the user, 2026-10-05: "if send again show that also");
 *   - Case 8: Banglore — a correction goes as INR, unconverted: a currency or
 *     rate sent with a payment is not kept, and no payment carries `original`.
 *
 *   - Case 9: finance's decision flowing back — the outbox's poll records a
 *     send-back (once, telling the closer) and then the approval.
 *
 * The Banglore CRM's copy of the Remote CRM's check.
 *
 * Run by enrolment-correction-check.sh. Scratch database only.
 */
import http from "node:http";
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
const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));
async function waitFor(ok: () => Promise<boolean> | boolean, ms = 4000): Promise<boolean> {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (await ok()) return true;
    await sleep(50);
  }
  return false;
}

// ── A stand-in finance: takes enrolments, and says what became of them ──────
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const delivered: any[] = [];
const approvalOf = new Map<string, string>();
const finance = http.createServer((req, res) => {
  let raw = "";
  req.on("data", (c) => (raw += c));
  req.on("end", () => {
    const body = raw ? JSON.parse(raw) : {};
    res.setHeader("content-type", "application/json");
    if (req.url === "/api/v1/integrations/enrolments") {
      // With the organization it was sent to (x-delta-org), to check where it went.
      delivered.push({ ...body, _org: String(req.headers["x-delta-org"] ?? "") });
      res.end(JSON.stringify({ data: { invoiceId: `inv-${body.externalId}`, invoiceNumber: `INV-${String(body.externalId).slice(-4)}`, customerId: "cust", duplicate: false, flags: [] } }));
      return;
    }
    if (req.url === "/api/v1/integrations/enrolments/status") {
      const ids = ((body.externalIds ?? []) as string[]).filter((id) => approvalOf.has(id));
      res.end(JSON.stringify({
        data: ids.map((id) => ({
          externalId: id, invoiceId: `inv-${id}`, invoiceNumber: `INV-${id.slice(-4)}`, status: "sent",
          approval: approvalOf.get(id), returnedReason: approvalOf.get(id) === "returned" ? "Wrong course" : "",
          issueDate: "2026-10-05", currency: "INR", totalMinor: 0, amountPaidMinor: 0, balanceMinor: 0,
        })),
      }));
      return;
    }
    res.statusCode = 404;
    res.end("{}");
  });
});
await new Promise<void>((r) => finance.listen(0, "127.0.0.1", () => r()));
const financePort = (finance.address() as { port: number }).port;
const sendsFor = (id: string) => delivered.filter((d) => d.externalId === id);

// The routes load the push service, which wants VAPID keys the moment it loads.
const vapid = (await import("web-push")).default.generateVAPIDKeys();
Object.assign(process.env, {
  VAPID_PUBLIC_KEY: vapid.publicKey,
  VAPID_PRIVATE_KEY: vapid.privateKey,
  JWT_SECRET: "enrolment-correction-check-jwt",
  JWT_REFRESH_SECRET: "enrolment-correction-check-refresh",
  NODE_ENV: "test",
  RUN_SCHEDULERS: "false",
  FINANCE_API_URL: `http://127.0.0.1:${financePort}`,
  FINANCE_CLIENT_ID: "crm-correction-check",
  FINANCE_INTEGRATION_SECRET: "correction-check-secret-correction-check-secret",
  FINANCE_ORG_ID: "org-correction-check",
});

const mongoose = (await import("mongoose")).default;
await mongoose.connect(uri);
await mongoose.connection.dropDatabase();
const db = mongoose.connection.db!;

const { Course } = await import("../src/models/Course.js");
const { Student } = await import("../src/models/Student.js");
const { Lead } = await import("../src/models/Lead.js");
const { FinanceHandover } = await import("../src/models/FinanceHandover.js");
const { signAccessToken } = await import("../src/utils/jwt.js");

// ── People, teams, courses ──────────────────────────────────────────────────
const superRole = new Types.ObjectId(), bdeRole = new Types.ObjectId(), managerRole = new Types.ObjectId(), viewerRole = new Types.ObjectId();
const all = { view: true, create: true, edit: true, delete: false, approve: false, export: false };
await db.collection("roles").insertMany([
  { _id: superRole, roleName: "Super Admin", isSystemRole: true, permissions: {} },
  // Closes leads and corrects their own sales; may not edit students at large.
  { _id: bdeRole, roleName: "BDE", isSystemRole: false, permissions: { students: { ...all, edit: false }, leads: all, enrolments: all } },
  // Edits any student, adds none.
  { _id: managerRole, roleName: "Manager", isSystemRole: false, permissions: { students: { ...all, create: false }, enrolments: all } },
  { _id: viewerRole, roleName: "Viewer", isSystemRole: false, permissions: { students: { ...all, create: false, edit: false } } },
]);
const people: Record<string, { id: Types.ObjectId; role: Types.ObjectId }> = {};
for (const [name, role] of [["Abrar", superRole], ["Theertha", bdeRole], ["Nikhil", bdeRole], ["Maya", managerRole], ["Vera", viewerRole]] as const) {
  const id = new Types.ObjectId();
  await db.collection("users").insertOne({ _id: id, name, email: `${name.toLowerCase()}@test.local`, password: "x", role, status: "active" });
  people[name] = { id, role };
}
const teamA = new Types.ObjectId(), teamB = new Types.ObjectId();
await db.collection("teams").insertMany([
  { _id: teamA, name: "Team A", status: "active", leaders: [], members: [people.Theertha!.id, people.Nikhil!.id] },
  { _id: teamB, name: "Team B", status: "active", leaders: [], members: [] },
]);
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
const pay = (method: string, amount: number, name = `${method}-${amount}`, extra: Record<string, unknown> = {}) =>
  ({ method, amount, receipt: receipt(name), paidAt: "2026-10-05T00:00:00.000Z", ...extra });

let n = 0;
/**
 * A lead closed by Theertha the way the dialog does it: 200 already on the
 * lead of its own, 300 in cash at the close — recorded on the lead by the
 * dialog — and delivered to finance.
 */
async function closedSale() {
  n++;
  const leadId = new Types.ObjectId();
  await db.collection("leads").insertOne({
    _id: leadId, name: `Client ${n}`, phone: `+97150000${String(n).padStart(4, "0")}`, email: `client${n}@test.local`, status: "closed",
    assignedTo: people.Theertha!.id,
    payments: [
      { _id: new Types.ObjectId(), amount: 200, note: "Booking", paidAt: new Date("2026-10-01"), addedBy: people.Theertha!.id },
      { _id: new Types.ObjectId(), amount: 300, note: "Collected at enrolment — COURSE 500 · Cash", paidAt: new Date("2026-10-05"), addedBy: people.Theertha!.id },
    ],
  });
  const r = await call("POST", "/students", "Theertha", {
    leadId: String(leadId), name: `Client ${n}`, phone: `+97150000${String(n).padStart(4, "0")}`, email: `client${n}@test.local`,
    course: String(course500._id), team: String(teamA), assignedTo: String(people.Theertha!.id),
    enrollmentDate: "2026-10-05T00:00:00.000Z", totalFee: 500, paidAmount: 500, language: "English", hasBonus: false,
    payments: [pay("bank_transfer", 200, `own-${n}`, { collectedBefore: true }), pay("cash", 300, `cash-${n}`)],
  });
  const id = String(r.body.data?._id ?? "");
  const out = await waitFor(async () => (await FinanceHandover.findOne({ studentId: id }).lean())?.status === "sent");
  if (r.status !== 201 || !out) throw new Error(`could not set up a sale: ${r.status} ${r.body.message}`);
  approvalOf.set(id, "pending");
  return { id, leadId: String(leadId) };
}
/** Finance sends it back — and the outbox has heard, as its poll would. */
async function sendBack(id: string) {
  approvalOf.set(id, "returned");
  await FinanceHandover.updateOne({ studentId: id }, { $set: { approvalState: "returned", returnedReason: "Wrong course", returnedAt: new Date() } });
}
/** Everything, corrected. */
const correction = (over: Record<string, unknown> = {}) => ({
  name: "Abdul Hakeem", phone: "+971501112233", email: "Hakeem@Example.com",
  course: String(course1000._id), enrollmentDate: "2026-10-04T00:00:00.000Z",
  totalFee: 1000, paidAmount: 800, language: "Malayalam", hasBonus: true, bonusAmount: 150, notes: "Corrected after finance sent it back",
  payments: [pay("cash", 200, "own-cash", { collectedBefore: true }), pay("card", 500, "card-new"), pay("tabby", 100, "tabby-new")],
  ...over,
});
// Leaving out what the outbox writes on the student once finance answers an
// earlier send, which can land in the middle of a refused request.
const snapshot = async (id: string) =>
  JSON.stringify(await Student.findById(id).select("-__v -updatedAt -financeInvoiceId -financeInvoiceNumber -financeSyncedAt").lean());

section("Case 1 — nothing to correct until finance sends it back");
const sale = await closedSale();
let r = await call("PUT", `/students/${sale.id}/correction`, "Theertha", correction());
check("waiting for approval: 409, and nothing changed", r.status === 409 && /hasn't sent this enrolment back/.test(r.body.message ?? "") && (await Student.findById(sale.id).lean())?.name === `Client ${n}`, `${r.status} ${r.body.message}`);
let form = await call("GET", `/students/${sale.id}/correction`, "Theertha");
check("the form's starting point says it isn't sent back yet", form.status === 200 && form.body.data?.sentBack === false, `${form.status} ${JSON.stringify(form.body.data?.sentBack)}`);
approvalOf.set(sale.id, "approved");
await FinanceHandover.updateOne({ studentId: sale.id }, { $set: { approvalState: "approved" } });
r = await call("PUT", `/students/${sale.id}/correction`, "Theertha", correction());
check("approved: 409 — a change then goes through finance", r.status === 409, `${r.status} ${r.body.message}`);
approvalOf.set(sale.id, "pending");
await FinanceHandover.updateOne({ studentId: sale.id }, { $set: { approvalState: "pending" } });

section("Case 2 — the closer corrects everything, and it goes to finance again in the same step");
await sendBack(sale.id);
form = await call("GET", `/students/${sale.id}/correction`, "Theertha");
check("the form starts from: sent back, why, the invoice, the lead's own 200, no moving it for a BDE",
  form.status === 200 && form.body.data?.sentBack === true && form.body.data?.returnedReason === "Wrong course" && form.body.data?.invoiceNumber === `INV-${sale.id.slice(-4)}`
    && form.body.data?.ownOnLead === 200 && form.body.data?.mayMove === false && form.body.data?.counsellors === undefined
    && (form.body.data?.student as { enrollmentNumber?: string })?.enrollmentNumber !== undefined,
  JSON.stringify({ ...form.body.data, student: undefined }));
form = await call("GET", `/students/${sale.id}/correction`, "Maya");
check("…and for a manager, the counsellors and teams it may move to",
  form.body.data?.mayMove === true && (form.body.data?.counsellors as { name: string }[])?.some((u) => u.name === "Nikhil") && (form.body.data?.teams as { name: string }[])?.length === 2);
form = await call("GET", `/students/${sale.id}/correction`, "Nikhil");
check("…and none of it for another BDE: 403", form.status === 403, `${form.status}`);
const sendsBefore = sendsFor(sale.id).length;
r = await call("PUT", `/students/${sale.id}/correction`, "Theertha", correction());
check("corrected: 200, \"sent to finance\"", r.status === 200 && /Corrected and sent to finance/.test(r.body.message ?? ""), `${r.status} ${r.body.message}`);
let s = await Student.findById(sale.id).lean();
check("the client: name, phone, email (kept lower case)", s?.name === "Abdul Hakeem" && s?.phone === "+971501112233" && s?.email === "hakeem@example.com", `${s?.name} ${s?.phone} ${s?.email}`);
check("the course, and the date", String(s?.course) === String(course1000._id) && s?.enrollmentDate?.toISOString().slice(0, 10) === "2026-10-04");
check("the money: fee 1000, paid 800, 200 to collect, part paid", s?.totalFee === 1000 && s?.paidAmount === 800 && s?.pendingAmount === 200 && s?.feeStatus === "partial", `${s?.totalFee}/${s?.paidAmount}/${s?.pendingAmount}/${s?.feeStatus}`);
check("each payment, with its receipt; the first is the one method and receipt",
  s?.payments?.map((p) => `${p.method}:${p.amount}:${p.receipt?.key}${p.collectedBefore ? ":own" : ""}`).join(",") === "cash:200:receipts/own-cash.jpg:own,card:500:receipts/card-new.jpg,tabby:100:receipts/tabby-new.jpg"
    && s?.paymentMethod === "cash" && s?.paymentReceipt?.key === "receipts/own-cash.jpg", JSON.stringify(s?.payments));
check("language, bonus and notes", s?.language === "Malayalam" && s?.hasBonus === true && s?.bonusAmount === 150 && s?.notes === "Corrected after finance sent it back");
check("…and the closer and team stay as they were", String(s?.assignedTo) === String(people.Theertha!.id) && String(s?.team) === String(teamA));
let lead = await Lead.findById(sale.leadId).lean();
check("the lead: its own 200 left alone, the close's 300 cash replaced by 500 card and 100 Tabby",
  lead?.payments?.map((p) => `${p.note}:${p.amount}`).join(" | ") === "Booking:200 | Collected at enrolment — COURSE 1000 · Card:500 | Collected at enrolment — COURSE 1000 · Tabby:100",
  lead?.payments?.map((p) => `${p.note}:${p.amount}`).join(" | "));
check("…so the lead holds what the enrolment says was paid", (lead?.payments ?? []).reduce((t, p) => t + p.amount, 0) === 800);
const delivered2 = await waitFor(() => sendsFor(sale.id).length === sendsBefore + 1);
const sent = sendsFor(sale.id).at(-1);
check("finance is sent it again at once, as the same enrolment, from this CRM", delivered2 && sent?.externalId === sale.id && sent?.source === "crm" && sent?.crm === "banglore" && sent?.currency === "INR", `${sendsFor(sale.id).length} sends`);
check("…for the Bangalore academy, into this CRM's own finance organization", sent?.academy === "bangalore" && sent?._org === "org-correction-check" && sendsFor(sale.id).every((d) => d.academy === "bangalore"), `${sent?.academy} ${sent?._org}`);
check("…with the client as corrected", sent?.customer?.name === "Abdul Hakeem" && sent?.customer?.email === "hakeem@example.com" && sent?.customer?.phone === "+971501112233", JSON.stringify(sent?.customer));
check("…the course, its fee in paise, the date", sent?.course?.name === "COURSE 1000" && sent?.course?.amountMinor === 100000 && sent?.enrolledOn === "2026-10-04", JSON.stringify(sent?.course));
check("…what was paid, what is left, each payment with its receipt",
  sent?.declaredPaidMinor === 80000 && sent?.balanceMinor === 20000
    && sent?.payments?.map((p: { method: string; amountMinor: number; receipt?: { key: string } }) => `${p.method}:${p.amountMinor}:${p.receipt?.key}`).join(",") === "cash:20000:receipts/own-cash.jpg,card:50000:receipts/card-new.jpg,tabby:10000:receipts/tabby-new.jpg",
  JSON.stringify(sent?.payments));
check("…the language and the bonus", sent?.language === "Malayalam" && sent?.bonus?.given === true && sent?.bonus?.amountMinor === 15000);
let h = await FinanceHandover.findOne({ studentId: sale.id }).lean();
check("the outbox: delivered, waiting for approval again, the send-back reason cleared", h?.status === "sent" && h?.approvalState === "pending" && !h?.returnedReason && !h?.returnedAt, `${h?.status} ${h?.approvalState} ${h?.returnedReason}`);
check("…and it says it was sent again, once, just now", h?.resends === 1 && Date.now() - new Date(h?.resentAt ?? 0).getTime() < 60_000, `${h?.resends} ${h?.resentAt}`);

section("Case 3 — what can't be right is refused, with nothing changed and nothing sent");
approvalOf.set(sale.id, "pending");
r = await call("PUT", `/students/${sale.id}/correction`, "Theertha", correction());
check("once resent, it can't be corrected again until finance sends it back again: 409", r.status === 409, `${r.status} ${r.body.message}`);
await sendBack(sale.id);
const refused = async (label: string, body: Record<string, unknown>, status: number, pattern: RegExp, who = "Theertha") => {
  const before = await snapshot(sale.id);
  const sends = sendsFor(sale.id).length;
  const leadBefore = JSON.stringify((await Lead.findById(sale.leadId).lean())?.payments);
  const x = await call("PUT", `/students/${sale.id}/correction`, who, body);
  await sleep(100);
  const same = (await snapshot(sale.id)) === before && sendsFor(sale.id).length === sends
    && JSON.stringify((await Lead.findById(sale.leadId).lean())?.payments) === leadBefore;
  check(label, x.status === status && pattern.test(x.body.message ?? "") && same, `${x.status} ${x.body.message}${same ? "" : " — something changed"}`);
};
await refused("no email and no language: 422, both named", correction({ email: "", language: "" }), 422, /the client's email, language/);
await refused("an email finance can't take: 422", correction({ email: "hakeem@example" }), 422, /the client's email/);
await refused("no name, no phone: 422", correction({ name: " ", phone: "" }), 422, /the client's name, the client's phone/);
await refused("no course: 422", correction({ course: null }), 422, /a course/);
await refused("a course that no longer exists: 422", correction({ course: String(new Types.ObjectId()) }), 422, /no longer exists/);
await refused("no fee: 422", correction({ totalFee: "" }), 422, /the fee/);
await refused("payments that don't add up to what was paid: 422", correction({ paidAmount: 900 }), 422, /must match/);
await refused("a payment without its receipt: 422", correction({ payments: [pay("cash", 200, "own", { collectedBefore: true }), { method: "card", amount: 600, paidAt: "2026-10-05" }] }), 422, /Payment 2 needs its receipt/);
await refused("no payments at all: 422", correction({ payments: undefined }), 422, /needs its payments/);
await refused("the lead's own 200 left out: 422", correction({ paidAmount: 600, payments: [pay("card", 500), pay("tabby", 100)] }), 422, /holds 200 of its own/);
await refused("the lead's own money at another figure: 409, open it again", correction({ paidAmount: 750, payments: [pay("cash", 150, "own", { collectedBefore: true }), pay("card", 500), pay("tabby", 100)] }), 409, /changed while this was open/);
await refused("two payments both the lead's own: 422", correction({ paidAmount: 900, payments: [pay("cash", 200, "a", { collectedBefore: true }), pay("cash", 200, "b", { collectedBefore: true }), pay("card", 500)] }), 422, /Only one payment/);
await refused("a bonus without its amount: 422", correction({ bonusAmount: 0 }), 422, /the bonus amount/);
await refused("not said whether a bonus was given: 422", correction({ hasBonus: undefined }), 422, /whether a bonus was given/);

section("Case 4 — who may correct, and who may move a sale");
await refused("another BDE, not the closer: 403", correction(), 403, /isn't yours/, "Nikhil");
await refused("a role without enrolments: 403", correction(), 403, /Access denied/, "Vera");
await refused("the closer moving it to another counsellor: 403", correction({ assignedTo: String(people.Nikhil!.id) }), 403, /Only someone who may edit students/);
await refused("…or to another team: 403", correction({ team: String(teamB) }), 403, /Only someone who may edit students/);
r = await call("PUT", `/students/${sale.id}/correction`, undefined, correction());
check("not signed in: 401", r.status === 401, `${r.status}`);
let sends = sendsFor(sale.id).length;
r = await call("PUT", `/students/${sale.id}/correction`, "Maya", correction({ assignedTo: String(people.Nikhil!.id), team: String(teamB) }));
s = await Student.findById(sale.id).lean();
check("a manager who may edit students corrects it and moves it to Nikhil in Team B: 200", r.status === 200 && String(s?.assignedTo) === String(people.Nikhil!.id) && String(s?.team) === String(teamB), `${r.status} ${r.body.message}`);
await waitFor(() => sendsFor(sale.id).length === sends + 1);
check("…and finance is told who closed it now", sendsFor(sale.id).at(-1)?.salespersonEmail === "nikhil@test.local", sendsFor(sale.id).at(-1)?.salespersonEmail);
await sendBack(sale.id);
await refused("…after which Theertha's sale is no longer hers to correct: 403", correction(), 403, /isn't yours/);
sends = sendsFor(sale.id).length;
r = await call("PUT", `/students/${sale.id}/correction`, "Abrar", correction({ assignedTo: String(people.Theertha!.id), team: String(teamA) }));
check("a super admin may correct any, and move it back", r.status === 200 && String((await Student.findById(sale.id).lean())?.assignedTo) === String(people.Theertha!.id), `${r.status} ${r.body.message}`);
await waitFor(() => sendsFor(sale.id).length === sends + 1);

section("Case 5 — sent back a moment ago: finance says so before the outbox has heard");
const fresh = await closedSale();
approvalOf.set(fresh.id, "returned"); // the outbox still says "pending"
r = await call("PUT", `/students/${fresh.id}/correction`, "Theertha", correction({ name: "Fresh Client" }));
check("corrected all the same: 200", r.status === 200 && (await Student.findById(fresh.id).lean())?.name === "Fresh Client", `${r.status} ${r.body.message}`);

section("Case 6 — an enrolment from before payments were listed; \"Send again\"; the receipt upload");
const oldLead = new Types.ObjectId();
await db.collection("leads").insertOne({ _id: oldLead, name: "Old Client", phone: "+971509999999", status: "closed", assignedTo: people.Theertha!.id, payments: [] });
const old = await Student.create({
  enrollmentNumber: "STU-9000", name: "Old Client", phone: "+971509999999", leadId: oldLead, course: course500._id, team: teamA,
  assignedTo: people.Theertha!.id, totalFee: 500, paidAmount: 500, pendingAmount: 0, feeStatus: "paid", enrollmentDate: new Date("2026-09-20"),
  paymentMethod: "cash", paymentReceipt: receipt("old-cash"),
});
await FinanceHandover.create({ studentId: old._id, leadId: oldLead, payload: {}, status: "sent", invoiceNumber: "INV-OLD", approvalState: "returned", returnedReason: "No email" });
approvalOf.set(String(old._id), "returned");
r = await call("PUT", `/students/${String(old._id)}/correction`, "Theertha", correction({
  name: "Old Client", phone: "+971509999999", email: "old.client@test.local", course: String(course500._id), totalFee: 500, paidAmount: 500,
  language: "English", hasBonus: false, bonusAmount: 0, payments: [pay("cash", 500, "old-cash")],
}));
s = await Student.findById(old._id).lean();
lead = await Lead.findById(oldLead).lean();
check("an older enrolment — one method, one receipt, no list — is corrected into a list: 200",
  r.status === 200 && s?.email === "old.client@test.local" && s?.payments?.length === 1 && s?.hasBonus === false, `${r.status} ${r.body.message}`);
check("…and its lead, which held nothing, now holds what was collected at the close",
  lead?.payments?.map((p) => `${p.note}:${p.amount}`).join(" | ") === "Collected at enrolment — COURSE 500 · Cash:500", lead?.payments?.map((p) => `${p.note}:${p.amount}`).join(" | "));
await waitFor(async () => (await FinanceHandover.findOne({ studentId: old._id }).lean())?.status === "sent");
await sendBack(String(old._id));
r = await call("POST", `/students/${String(old._id)}/invoice`, "Theertha");
check("\"Send again\" still resends a sent-back enrolment as it stands", r.status === 200 && /Correction sent/.test(r.body.message ?? ""), `${r.status} ${r.body.message}`);
await waitFor(async () => (await FinanceHandover.findOne({ studentId: old._id }).lean())?.status === "sent");
approvalOf.set(String(old._id), "pending");
r = await call("POST", `/students/${String(old._id)}/invoice`, "Theertha");
check("…and refuses one waiting for approval: 409", r.status === 409 && /Already invoiced/.test(r.body.message ?? ""), `${r.status} ${r.body.message}`);
check("…counting each time it went again: corrected once, sent again once", (await FinanceHandover.findOne({ studentId: old._id }).lean())?.resends === 2);

const upload = async (who: string) => {
  const form = new FormData();
  form.append("file", new Blob([new Uint8Array([0xff, 0xd8, 0xff, 0xd9])], { type: "image/jpeg" }), "receipt.jpg");
  const res = await fetch(`http://127.0.0.1:${port}/api/v1/students/receipts/${sale.leadId}`, { method: "POST", headers: { authorization: `Bearer ${token(who)}` }, body: form });
  return res.status;
};
const managerUpload = await upload("Maya");
check("a receipt for a correction can be taken by someone who corrects but adds no students (not 403)", managerUpload !== 403, `${managerUpload}`);
check("…but not by a role with neither: 403", (await upload("Vera")) === 403);

section("Case 7 — \"sent again\" shown once it was");
approvalOf.set(sale.id, "pending");
const mine = await call("GET", "/students/enrolments/mine", "Theertha");
// eslint-disable-next-line @typescript-eslint/no-explicit-any
const row = ((mine.body as any).data as any[])?.find((x) => String(x._id) === sale.id);
check("My Enrolments carries when it was sent again, and how many times (corrected three times)", Boolean(row?.handover?.resentAt) && row?.handover?.resends === 3, JSON.stringify(row?.handover));
check("…and its finance step says \"Sent again …, waiting for accounts\"", row?.steps?.[0]?.state === "waiting" && /^Sent again \d{1,2} \w{3}, .* — waiting for accounts to approve it$/.test(row?.steps?.[0]?.detail ?? ""), row?.steps?.[0]?.detail);
const one = await call("GET", `/students/enrolments/${sale.id}`, "Abrar");
check("…its own page too", (one.body.data as any)?.handover?.resends === 3 && /^Sent again/.test((one.body.data as any)?.steps?.[0]?.detail ?? ""), JSON.stringify((one.body.data as any)?.steps?.[0]));
const { stepsOf } = await import("../src/services/enrolmentSteps.js");
const returned = { externalId: "x", invoiceId: "i", invoiceNumber: "INV-1", status: "sent", approval: "returned", returnedReason: "Wrong course", issueDate: "", currency: "INR", totalMinor: 0, amountPaidMinor: 0, balanceMinor: 0 };
let st = stepsOf(returned, { status: "pending", resentAt: new Date() })[0]!;
check("on its way back — finance still says \"returned\" — it shows as sent again, not sent back", st.state === "waiting" && /^Sent again .* — on its way to finance$/.test(st.detail ?? ""), st.detail);
st = stepsOf(returned, { status: "failed", resentAt: new Date(), lastError: "Invalid email" })[0]!;
check("sent again but refused by finance: says so, with why", st.state === "failed" && /^Sent again .*, but finance didn't take it — Invalid email$/.test(st.detail ?? ""), st.detail);
st = stepsOf(returned, { status: "sent" })[0]!;
check("sent back, never sent again: as before", st.state === "failed" && st.detail === "Sent back: Wrong course — correct it and send it again", st.detail);

section("Case 8 — Banglore: a correction goes as INR, unconverted");
const inrSale = await closedSale();
await sendBack(inrSale.id);
const k = sendsFor(inrSale.id).length;
r = await call("PUT", `/students/${inrSale.id}/correction`, "Theertha", correction({
  paidAmount: 640,
  // An old screen (or the Remote CRM's) sending a currency and a rate: not taken here.
  payments: [pay("cash", 200, "own-cash", { collectedBefore: true }), pay("bank_transfer", 440, "inr-transfer", { currency: "AED", amountInCurrency: 10, exchangeRate: 44 })],
}));
s = await Student.findById(inrSale.id).lean();
const p2 = s?.payments?.[1] as Record<string, unknown> | undefined;
check("corrected: 200, the payment kept in INR with no currency or rate", r.status === 200 && p2?.amount === 440 && p2?.currency === undefined && p2?.exchangeRate === undefined, `${r.status} ${r.body.message} ${JSON.stringify(p2)}`);
lead = await Lead.findById(inrSale.leadId).lean();
check("…the lead's note is the close's, with no conversion in it",
  lead?.payments?.map((p) => `${p.note}:${p.amount}`).join(" | ") === "Booking:200 | Collected at enrolment — COURSE 1000 · Bank Transfer:440",
  lead?.payments?.map((p) => `${p.note}:${p.amount}`).join(" | "));
await waitFor(() => sendsFor(inrSale.id).length === k + 1);
const sentInr = sendsFor(inrSale.id).at(-1);
check("…and finance is sent 440 INR as 44000 paise, currency INR, no `original`",
  sentInr?.currency === "INR" && sentInr?.crm === "banglore" && sentInr?.payments?.[1]?.amountMinor === 44000 && sentInr?.payments?.[1]?.original === undefined,
  JSON.stringify(sentInr?.payments?.[1]));

section("Case 9 — finance's decision flows back through the poll");
{
  const { pollFinanceOutcomes } = await import("../src/services/financeHandoverWorker.js");
  const polled = await closedSale();
  await pollFinanceOutcomes();
  let h = await FinanceHandover.findOne({ studentId: polled.id }).lean();
  check("waiting in finance: the outbox says pending", h?.approvalState === "pending" && Boolean(h?.checkedAt), JSON.stringify({ a: h?.approvalState }));
  approvalOf.set(polled.id, "returned");
  await pollFinanceOutcomes();
  h = await FinanceHandover.findOne({ studentId: polled.id }).lean();
  check("sent back in finance: recorded with its reason, and the closer told once", h?.approvalState === "returned" && h?.returnedReason === "Wrong course" && Boolean(h?.returnedAt) && Boolean(h?.returnedNotifiedAt), JSON.stringify({ a: h?.approvalState, r: h?.returnedReason, n: h?.returnedNotifiedAt }));
  const toldAt = String(h?.returnedNotifiedAt);
  await pollFinanceOutcomes();
  h = await FinanceHandover.findOne({ studentId: polled.id }).lean();
  check("…and not told again on the next poll", String(h?.returnedNotifiedAt) === toldAt);
  approvalOf.set(polled.id, "approved");
  await pollFinanceOutcomes();
  h = await FinanceHandover.findOne({ studentId: polled.id }).lean();
  check("approved in finance: recorded, with when", h?.approvalState === "approved" && Boolean(h?.approvedAt), JSON.stringify({ a: h?.approvalState }));
  const mine = await call("GET", `/students/enrolments/${polled.id}`, "Theertha");
  const steps = (mine.body.data as any)?.steps as { key: string; state: string }[] | undefined;
  check("its page shows two steps — finance done, LMS next", steps?.length === 2 && steps[0]?.key === "finance" && steps[0]?.state === "done" && steps[1]?.key === "lms", JSON.stringify(steps));
}

// Collecting more than the fee is taken now (the owner, 2026-10-06) — last, so nothing above depends on it.
await sendBack(sale.id);
const overRes = await call("PUT", `/students/${sale.id}/correction`, "Theertha", correction({ totalFee: 700 }));
const overSaved = await Student.findById(sale.id).lean();
check("collected more than the fee: taken (200), balance 0", overRes.status === 200 && overSaved?.totalFee === 700 && overSaved?.pendingAmount === 0, `${overRes.status} ${overRes.body.message}`);

server.close();
finance.close();
await mongoose.disconnect();
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
