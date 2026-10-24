/**
 * A lead that comes in again (the user, 2026-10-23: "a duplicate lead needs to go to whoever is managing it — he gets
 * it again, as a new one"), through every door: the sheet (one row, and Root's batch), an Excel upload, adding it by
 * hand.
 *   Case 1  happy path   the same number in another format, hours later: the same lead back to its holder as new
 *                        (Assigned, today's date, first date kept, counted, history);
 *                        answered as a duplicate with the lead's id, so Root's counts hold; the "came in again" filter
 *   Case 2  edge         within the hour: only noted; a closed lead keeps its status, its holder told; a lost lead
 *                        reopened; a deactivated holder → split again in its team; a short number matches exactly;
 *                        the batch; the upload (one new, one again); a copy marked "repeated" is the last choice
 *   Case 3  errors       adding a known number by hand: 409 naming the holder, no second lead
 *   Case 4  permission   the sheet without its key: 401; the filter stays inside a salesperson's own leads
 *
 * Bangalore keeps no bell records (its notices are live only), so no bell checks here.
 *
 * Run by repeat-enquiry-check.sh. Scratch database only.
 */
import { Types } from "mongoose";

const uri = process.env.MONGODB_URI ?? "";
if (!/127\.0\.0\.1|localhost/.test(uri) || !/e2e|test|scratch/i.test(uri)) {
  console.error(`Refusing to run: MONGODB_URI must be a scratch database, got "${uri}"`);
  process.exit(1);
}
let failures = 0, checks = 0;
function check(label: string, ok: boolean, detail: unknown = "") {
  checks++;
  if (ok) console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  else { failures++; console.log(`  \x1b[31m✗ ${label}${detail !== "" ? ` — ${JSON.stringify(detail)}` : ""}\x1b[0m`); }
}
const section = (s: string) => console.log(`\n${s}`);

const vapid = (await import("web-push")).default.generateVAPIDKeys();
Object.assign(process.env, {
  VAPID_PUBLIC_KEY: vapid.publicKey, VAPID_PRIVATE_KEY: vapid.privateKey,
  JWT_SECRET: "repeat-enquiry-check-jwt-0123456789", JWT_REFRESH_SECRET: "repeat-enquiry-check-refresh-0123456789",
  NODE_ENV: "test", RUN_SCHEDULERS: "false", HRMS_API_URL: "", HRMS_CLIENT_ID: "", HRMS_INTEGRATION_SECRET: "", HRMS_ORG_ID: "",
  THREECX_URL: "", THREECX_CLIENT_ID: "", THREECX_API_KEY: "",
  WHATSAPP_TOKEN: "", WHATSAPP_PHONE_NUMBER_ID: "", WHATSAPP_ACCESS_TOKEN: "",
  SHEETS_API_KEY: "repeat-enquiry-check-sheets-key", SUPER_ADMIN_EMAIL: "root@test.local",
});
const mongoose = (await import("mongoose")).default;
await mongoose.connect(uri);
if (!["127.0.0.1", "localhost"].includes(mongoose.connection.host)) throw new Error("not a local database");
await mongoose.connection.dropDatabase();
const db = mongoose.connection.db!;
const { Lead } = await import("../src/models/Lead.js");
const { signAccessToken } = await import("../src/utils/jwt.js");
const express = (await import("express")).default;
const routes = (await import("../src/routes/index.js")).default;
const { errorHandler } = await import("../src/middleware/errorHandler.js");

const admin = new Types.ObjectId(), agent = new Types.ObjectId();
await db.collection("roles").insertMany([
  { _id: admin, roleName: "Super Admin", isSystemRole: true, permissions: {} },
  { _id: agent, roleName: "Sales Agent", isSystemRole: false, permissions: { leads: { view: true, create: true, edit: true } } },
]);
const root = new Types.ObjectId(), ann = new Types.ObjectId(), ben = new Types.ObjectId(), gone = new Types.ObjectId();
await db.collection("users").insertMany([
  { _id: root, name: "Root", email: "root@test.local", password: "x", role: admin, status: "active" },
  { _id: ann, name: "Ann", email: "ann@test.local", password: "x", role: agent, status: "active" },
  { _id: ben, name: "Ben", email: "ben@test.local", password: "x", role: agent, status: "active" },
  { _id: gone, name: "Gone", email: "gone@test.local", password: "x", role: agent, status: "inactive" },
]);
// A team without auto-assign: a lead split again there waits as New in the team, unassigned.
const team = new Types.ObjectId();
await db.collection("teams").insertOne({ _id: team, name: "Falcons", status: "active", members: [ann, ben, gone], leaders: [], settings: { autoAssign: false } });

const H = 3_600_000;
const longAgo = new Date(Date.now() - 20 * 86_400_000), hoursAgo = new Date(Date.now() - 5 * H);
let n = 0;
async function lead(o: Record<string, unknown> = {}) {
  const _id = new Types.ObjectId();
  await Lead.collection.insertOne({
    _id, name: `L${++n}`, phone: `+97150${1000000 + n}`, email: `l${n}@test.local`, source: "META", status: "followup", assignedTo: ann, assignedAt: longAgo,
    team, reporter: root, notes: [], reminders: [], payments: [], activityLogs: [], followUps: [], callCount: 0,
    createdAt: longAgo, updatedAt: longAgo, ...o,
  });
  return _id;
}
const read = async (id: Types.ObjectId) => (await Lead.collection.findOne({ _id: id }))!;
const notices = async (user: Types.ObjectId) => db.collection("notifications").find({ user }).toArray();
const leadsWith = async (tail: string) => (await Lead.collection.find({}).toArray()).filter((l) => String(l.phone).replace(/\D/g, "").endsWith(tail));

const app = express();
app.use(express.json());
app.use("/api/v1", routes);
app.use(errorHandler);
const server = app.listen(0);
const port = (server.address() as { port: number }).port;
const tokenOf = (u: Types.ObjectId, r: Types.ObjectId, email: string) => signAccessToken({ userId: String(u), email, roleId: String(r) });
const ROOT = tokenOf(root, admin, "root@test.local"), BEN = tokenOf(ben, agent, "ben@test.local");
type Json = Record<string, any>; // eslint-disable-line @typescript-eslint/no-explicit-any
async function call(method: string, path: string, body?: unknown, headers: Record<string, string> = {}) {
  const isForm = body instanceof FormData;
  const r = await fetch(`http://127.0.0.1:${port}/api/v1${path}`, {
    method, headers: { ...(isForm || body === undefined ? {} : { "content-type": "application/json" }), ...headers },
    body: body === undefined ? undefined : isForm ? body : JSON.stringify(body),
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Json };
}
const sheet = (row: Json, key = "repeat-enquiry-check-sheets-key") => call("POST", "/sheets/sync", row, { "x-api-key": key });
const settle = () => new Promise((ok) => setTimeout(ok, 150));

section("Case 1 — the same number again, hours later: back to its holder as new");
{
  const id = await lead({ phone: "+971 50 123 4567", status: "followup", createdAt: longAgo });
  const before = await read(id);
  const r = await sheet({ full_name: "Asha again", phone_number: "p:971501234567", platform: "ig", source: "META" });
  await settle();
  const l = await read(id);
  check("answered as a duplicate with the existing lead's id (Root's counts hold)", r.status === 200 && r.body.data?.duplicate === true && r.body.data?.leadId === String(id), r.body);
  check("…saying it went back to Ann", r.body.data?.repeat === "back_to_holder" && r.body.data?.heldBy === "Ann" && /given back to Ann/.test(r.body.message ?? ""), r.body);
  check("no second lead for that number", (await leadsWith("501234567")).length === 1);
  check("still Ann's, status Assigned, assigned now", String(l.assignedTo) === String(ann) && l.status === "assigned" && Date.now() - new Date(l.assignedAt).getTime() < 60_000, [l.status, l.assignedTo]);
  check("today's lead: createdAt now, the first date kept in originalCreatedAt", Date.now() - new Date(l.createdAt).getTime() < 60_000 && new Date(l.originalCreatedAt).getTime() === before.createdAt.getTime(), [l.createdAt, l.originalCreatedAt]);
  check("counted: repeatCount 1, lastRepeatAt now", l.repeatCount === 1 && Date.now() - new Date(l.lastRepeatAt).getTime() < 60_000, [l.repeatCount, l.lastRepeatAt]);
  check("its history says it came in again, the 2nd time, back to Ann, and what it was", /Came in again from META \(2nd time\) — back to Ann as a new lead \(was Follow Up\)/.test(l.activityLogs.at(-1)?.description ?? ""), l.activityLogs.at(-1));
  // Hours later again: the third time
  await Lead.collection.updateOne({ _id: id }, { $set: { lastRepeatAt: hoursAgo, createdAt: hoursAgo, status: "not_connected" } });
  const r3 = await sheet({ full_name: "Asha", phone_number: "0501234567", source: "GOOGLE" });
  const l3 = await read(id);
  check("the third time: repeatCount 2, history says 3rd time, from GOOGLE", r3.status === 200 && l3.repeatCount === 2 && /from GOOGLE \(3rd time\).*\(was Not connected\)/.test(l3.activityLogs.at(-1)?.description ?? ""), l3.activityLogs.at(-1));
  check("…the first date still the very first", new Date(l3.originalCreatedAt).getTime() === before.createdAt.getTime());
  const f = await call("GET", "/leads?cameAgain=true&limit=50", undefined, { authorization: `Bearer ${ROOT}` });
  const ids = (f.body.data?.leads ?? f.body.data ?? []).map((x: Json) => String(x._id));
  check("the came-in-again filter lists it", f.status === 200 && ids.includes(String(id)), f.body);
}

section("Case 2 — edges");
{
  const id = await lead({ phone: "+971502220000", status: "followup", createdAt: new Date(Date.now() - 20 * 60_000) });
  const r = await sheet({ full_name: "X", phone_number: "+971502220000" });
  const l = await read(id);
  check("within the hour of coming in: only noted, nothing moved, nobody pinged", r.body.data?.repeat === "same_enquiry" && l.status === "followup" && (l.repeatCount ?? 0) === 0 && /within the hour/.test(l.activityLogs.at(-1)?.description ?? ""), [r.body, l.status]);
}
{
  const id = await lead({ phone: "+971502220001", status: "closed", assignedTo: ben });
  const r = await sheet({ full_name: "Student", phone_number: "971502220001" });
  const l = await read(id);
  check("a closed lead (a student): status kept, counted", r.body.data?.repeat === "closed_client" && l.status === "closed" && l.repeatCount === 1 && new Date(l.createdAt).getTime() === longAgo.getTime(), [l.status, l.repeatCount]);
  const b = await lead({ phone: "+971502229001", status: "booking", assignedTo: ben });
  const rb = await sheet({ full_name: "Booked", phone_number: "+971502229001" });
  check("Bangalore: a booking keeps its status too", rb.body.data?.repeat === "closed_client" && (await read(b)).status === "booking", rb.body.data);
}
{
  const id = await lead({ phone: "+971502220002", status: "lost", lostReason: "price_too_high", lostNotes: "Too dear" });
  await sheet({ full_name: "Lost", phone_number: "+971502220002" });
  const l = await read(id);
  check("a lost lead: reopened to its holder as new, the lost reason cleared", l.status === "assigned" && String(l.assignedTo) === String(ann) && l.lostReason === null && l.lostNotes === null, [l.status, l.lostReason]);
}
{
  const id = await lead({ phone: "+971502220003", status: "followup", assignedTo: gone });
  const r = await sheet({ full_name: "Orphan", phone_number: "+971502220003" });
  const l = await read(id);
  check("its holder deactivated: split again in its team — New there, nobody's yet (no auto-assign)", r.body.data?.repeat === "resplit" && l.status === "new" && l.assignedTo === null && String(l.team) === String(team) && l.repeatCount === 1, [l.status, l.assignedTo]);
  check("…its history says why", /Gone is no longer active, split as a new lead/.test(l.activityLogs.at(-1)?.description ?? ""), l.activityLogs.at(-1));
  check("…and Gone isn't notified", (await notices(gone)).length === 0);
}
{
  const id = await lead({ phone: "12345", status: "followup" });
  const r = await sheet({ full_name: "Short", phone_number: "12345" });
  const r2 = await sheet({ full_name: "Short2", phone_number: "912345" });
  check("a number shorter than 9 digits matches only itself exactly", r.body.data?.leadId === String(id) && r.body.data?.duplicate === true && r2.body.data?.duplicate === false, [r.body.data, r2.body.data]);
}
{
  const copy = await lead({ phone: "+971502220004", status: "repeated", updatedAt: new Date() });
  const real = await lead({ phone: "0502220004", status: "followup", assignedTo: ben, updatedAt: longAgo });
  const r = await sheet({ full_name: "Two copies", phone_number: "+971 50 222 0004" });
  check("two copies of a number: the one marked Repeated is the last choice", r.body.data?.leadId === String(real) && (await read(copy)).status === "repeated", r.body.data);
}
{
  const known = await lead({ phone: "+971502220005", status: "mia", assignedTo: ben });
  const r = await call("POST", "/sheets/sync/batch", { rows: [
    { full_name: "Known", phone_number: "00971502220005" },
    { full_name: "Brand new", phone_number: "+971509990001" },
  ] }, { "x-api-key": "repeat-enquiry-check-sheets-key" });
  const res = r.body.data?.results ?? [];
  check("Root's batch: the known number a duplicate with its lead id, back to Ben; the new one created", r.status === 201
    && res[0]?.status === "duplicate" && res[0]?.leadId === String(known) && res[0]?.repeat === "back_to_holder" && res[0]?.heldBy === "Ben"
    && res[1]?.status === "created" && r.body.data?.summary?.duplicate === 1 && r.body.data?.summary?.created === 1, r.body);
  check("…the known one Assigned to Ben again", (await read(known)).status === "assigned");
}
{
  const known = await lead({ phone: "+971502220006", status: "callback", assignedTo: ann });
  const csv = "Name,Phone,Source\nKnown again,0502220006,EXCEL\nFresh one,+971509990002,EXCEL\n";
  const fd = new FormData();
  fd.append("file", new Blob([csv], { type: "text/csv" }), "leads.csv");
  const r = await call("POST", "/leads/upload", fd, { authorization: `Bearer ${ROOT}` });
  const d = r.body.data ?? {};
  check("an upload: the new row created, the known one came in again (not refused)", r.status === 201 && d.created === 1 && d.cameAgain === 1 && d.invalid === 0
    && d.repeatDetails?.[0]?.leadId === String(known) && /given back to Ann/.test(d.repeatDetails?.[0]?.message ?? ""), d);
  check("…no second lead for it; it's Ann's as new, from the upload", (await leadsWith("502220006")).length === 1 && (await read(known)).status === "assigned"
    && /in an upload/.test((await read(known)).activityLogs.at(-1)?.description ?? ""));
}

section("Case 3 — adding a known number by hand");
{
  const known = await lead({ phone: "+971502220007", status: "followup", assignedTo: ann });
  const r = await call("POST", "/leads", { name: "Typed again", phone: "050 222 0007", source: "WALK-IN" }, { authorization: `Bearer ${BEN}` });
  check("409, naming who has it", r.status === 409 && /given back to Ann/.test(r.body.message ?? ""), r);
  check("…no second lead; Ann's as new, the history says added again by hand", (await leadsWith("502220007")).length === 1 && (await read(known)).status === "assigned"
    && /added again by hand/.test((await read(known)).activityLogs.at(-1)?.description ?? ""));
  const fresh = await call("POST", "/leads", { name: "Brand new by hand", phone: "+971509990003", source: "WALK-IN" }, { authorization: `Bearer ${BEN}` });
  check("a new number by hand: created as before", fresh.status === 201, fresh.status);
}

section("Case 4 — permission");
{
  const r = await sheet({ full_name: "X", phone_number: "+971501234567" }, "wrong-key");
  check("the sheet without its key: 401, nothing changes", r.status === 401, r.status);
  const f = await call("GET", "/leads?cameAgain=true&limit=50", undefined, { authorization: `Bearer ${BEN}` });
  const mine = (f.body.data?.leads ?? f.body.data ?? []) as Json[];
  check("a salesperson's came-in-again list holds only their own leads", f.status === 200 && mine.length > 0 && mine.every((x) => String(x.assignedTo?._id ?? x.assignedTo) === String(ben)), mine.map((x) => x.assignedTo));
}

server.close();
await mongoose.connection.dropDatabase();
await mongoose.disconnect();
console.log(`\n${checks - failures}/${checks} checks passed${failures ? ` — ${failures} FAILED` : ""}`);
process.exit(failures ? 1 : 0);
