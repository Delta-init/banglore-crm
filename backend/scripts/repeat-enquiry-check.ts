/**
 * A lead that comes in again, through every door: the sheet (one row, and Root's batch), an Excel upload, adding it by
 * hand. It stays the same lead and its status never changes (the user, 2026-11-05: "the came-again lead's status doesn't
 * need to change — same as before"); only the repeat is counted, noted and told.
 *   Case 1  happy path   the same number in another format, hours later: still its holder's, status and dates kept,
 *                        counted, history; answered as a duplicate with the lead's id, so Root's counts hold; the
 *                        "came in again" filter
 *   Case 2  edge         within the hour: only noted; a closed lead keeps its status; a lost lead stays Lost with its
 *                        reason; a deactivated holder → split again now (not held for a scheduled batch), status kept;
 *                        a short number matches exactly; the batch; the upload; a copy marked "repeated" is the last choice
 *                        a sheet re-sync (an old row, form dated before the lead came in) ignored — no tag, no ping
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
// A team without auto-assign: a lead split again there waits in the team, unassigned.
const team = new Types.ObjectId();
await db.collection("teams").insertOne({ _id: team, name: "Falcons", status: "active", members: [ann, ben, gone], leaders: [], settings: { autoAssign: false } });
// A team with a scheduled split (10:30): a lead split again there goes to an active member now, not at 10:30.
const hawks = new Types.ObjectId();
await db.collection("teams").insertOne({ _id: hawks, name: "Hawks", status: "active", members: [ben, gone], leaders: [], inactiveMembers: [gone], absentToday: [],
  settings: { autoAssign: true, splitMode: "round_robin", roundRobinIndex: 0, includedMembers: [], splitTime: "10:30", splitTimes: ["10:30"], sourceExclusions: {} } });

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

section("Case 1 — the same number again, hours later: still its holder's, status kept");
{
  const id = await lead({ phone: "+971 50 123 4567", status: "followup", createdAt: longAgo });
  const before = await read(id);
  const r = await sheet({ full_name: "Asha again", phone_number: "p:971501234567", platform: "ig", source: "META" });
  await settle();
  const l = await read(id);
  check("answered as a duplicate with the existing lead's id (Root's counts hold)", r.status === 200 && r.body.data?.duplicate === true && r.body.data?.leadId === String(id), r.body);
  check("…saying Ann holds it and was told", r.body.data?.repeat === "back_to_holder" && r.body.data?.heldBy === "Ann" && /Ann was told it came in again \(status kept\)/.test(r.body.message ?? ""), r.body);
  check("no second lead for that number", (await leadsWith("501234567")).length === 1);
  check("still Ann's, status kept (Follow Up), assigned date untouched", String(l.assignedTo) === String(ann) && l.status === "followup" && new Date(l.assignedAt).getTime() === before.assignedAt.getTime(), [l.status, l.assignedTo, l.assignedAt]);
  check("its created date untouched, no originalCreatedAt", new Date(l.createdAt).getTime() === before.createdAt.getTime() && l.originalCreatedAt === undefined, [l.createdAt, l.originalCreatedAt]);
  check("counted: repeatCount 1, lastRepeatAt now", l.repeatCount === 1 && Date.now() - new Date(l.lastRepeatAt).getTime() < 60_000, [l.repeatCount, l.lastRepeatAt]);
  check("its history says it came in again, the 2nd time, status kept, still Ann's", /Came in again from META \(2nd time\) — status kept \(Follow Up\), still Ann's/.test(l.activityLogs.at(-1)?.description ?? ""), l.activityLogs.at(-1));
  // Hours later again: the third time
  await Lead.collection.updateOne({ _id: id }, { $set: { lastRepeatAt: hoursAgo, createdAt: hoursAgo, status: "not_connected" } });
  const r3 = await sheet({ full_name: "Asha", phone_number: "0501234567", source: "GOOGLE" });
  const l3 = await read(id);
  check("the third time: repeatCount 2, history says 3rd time, from GOOGLE, still Not connected", r3.status === 200 && l3.repeatCount === 2 && l3.status === "not_connected" && /from GOOGLE \(3rd time\) — status kept \(Not connected\)/.test(l3.activityLogs.at(-1)?.description ?? ""), l3.activityLogs.at(-1));
  check("…its created date still untouched", new Date(l3.createdAt).getTime() === hoursAgo.getTime() && l3.originalCreatedAt === undefined, [l3.createdAt, l3.originalCreatedAt]);
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
  check("a lost lead: stays Lost with its reason and notes, still Ann's, counted", l.status === "lost" && String(l.assignedTo) === String(ann) && l.lostReason === "price_too_high" && l.lostNotes === "Too dear" && l.repeatCount === 1, [l.status, l.lostReason, l.lostNotes]);
}
{
  const id = await lead({ phone: "+971502220003", status: "followup", assignedTo: gone });
  const r = await sheet({ full_name: "Orphan", phone_number: "+971502220003" });
  const l = await read(id);
  check("its holder deactivated, team without auto-assign: unassigned in its team, status kept (Follow Up)", r.body.data?.repeat === "resplit" && l.status === "followup" && l.assignedTo === null && String(l.team) === String(team) && l.repeatCount === 1, [l.status, l.assignedTo]);
  check("…its history says why", /Gone is no longer active, split again, status kept \(Follow Up\)/.test(l.activityLogs.find((g: Json) => /Came in again/.test(g.description))?.description ?? ""), l.activityLogs);
  check("…and Gone isn't notified", (await notices(gone)).length === 0);
}
{
  const id = await lead({ phone: "+971502220008", status: "lost", lostReason: "unresponsive", assignedTo: gone, team: hawks });
  const r = await sheet({ full_name: "Orphan, scheduled team", phone_number: "+971502220008" });
  await settle();
  const l = await read(id);
  check("holder deactivated, team on a 10:30 split: given to Ben now, not held for the batch", r.body.data?.repeat === "resplit" && String(l.assignedTo) === String(ben) && r.body.data?.heldBy === "Ben", [l.assignedTo, r.body.data]);
  check("…still Lost with its reason", l.status === "lost" && l.lostReason === "unresponsive", [l.status, l.lostReason]);
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
  check("…the known one still MIA, still Ben's", (await read(known)).status === "mia" && String((await read(known)).assignedTo) === String(ben));
}
{
  const known = await lead({ phone: "+971502220006", status: "callback", assignedTo: ann });
  const csv = "Name,Phone,Source\nKnown again,0502220006,EXCEL\nFresh one,+971509990002,EXCEL\n";
  const fd = new FormData();
  fd.append("file", new Blob([csv], { type: "text/csv" }), "leads.csv");
  const r = await call("POST", "/leads/upload", fd, { authorization: `Bearer ${ROOT}` });
  const d = r.body.data ?? {};
  check("an upload: the new row created, the known one came in again (not refused)", r.status === 201 && d.created === 1 && d.cameAgain === 1 && d.invalid === 0
    && d.repeatDetails?.[0]?.leadId === String(known) && /Ann was told it came in again/.test(d.repeatDetails?.[0]?.message ?? ""), d);
  check("…no second lead for it; still Ann's Callback, from the upload", (await leadsWith("502220006")).length === 1 && (await read(known)).status === "callback"
    && /in an upload/.test((await read(known)).activityLogs.at(-1)?.description ?? ""));
}

{
  // A sheet re-synced: the old row sent again, its form date (Google's format) before the lead came in.
  const id = await lead({ phone: "+971502220009", status: "lost", lostReason: "unresponsive", assignedTo: ann, createdAt: longAgo });
  const googleStyle = new Date(longAgo.getTime() - 10 * 86_400_000).toString(); // "Wed Jun 10 2026 05:15:00 GMT+0400 (…)"
  const r = await sheet({ full_name: "Old row", phone_number: "+971502220009", created_time: googleStyle });
  const l = await read(id);
  check("a sheet re-sync — an old row again (enquired before the lead came in): a duplicate, ignored", r.body.data?.duplicate === true && r.body.data?.leadId === String(id)
    && r.body.data?.repeat === "same_enquiry" && /same enquiry sent again/.test(r.body.message ?? ""), r.body);
  check("…no count, no tag, no history line; still Ann's, still Lost", (l.repeatCount ?? 0) === 0 && !l.lastRepeatAt && l.activityLogs.length === 0
    && l.status === "lost" && String(l.assignedTo) === String(ann), [l.repeatCount, l.activityLogs.length, l.status]);
  const r2 = await sheet({ full_name: "New form", phone_number: "+971502220009", created_time: new Date().toISOString() });
  const l2 = await read(id);
  check("a new form, dated after the lead came in: a real repeat — counted, status kept", r2.body.data?.repeat === "back_to_holder" && l2.repeatCount === 1 && l2.status === "lost", [r2.body.data, l2.repeatCount]);
  await Lead.collection.updateOne({ _id: id }, { $set: { lastRepeatAt: hoursAgo } });
  const r3 = await sheet({ full_name: "New form again", phone_number: "+971502220009", created_time: new Date(hoursAgo.getTime() - 60_000).toISOString() });
  const l3 = await read(id);
  check("…that form re-sent hours later: ignored too (enquired before its last repeat)", r3.body.data?.repeat === "same_enquiry" && l3.repeatCount === 1
    && l3.activityLogs.length === l2.activityLogs.length, [r3.body.data, l3.repeatCount]);
  const rb = await call("POST", "/sheets/sync/batch", { rows: [{ full_name: "Old row in a batch", phone_number: "+971502220009", created_time: googleStyle }] },
    { "x-api-key": "repeat-enquiry-check-sheets-key" });
  const res = rb.body.data?.results ?? [];
  check("…and in a batch: the old row a duplicate, ignored the same way", res[0]?.status === "duplicate" && res[0]?.repeat === "same_enquiry" && (await read(id)).repeatCount === 1, res[0]);
  const id2 = await lead({ phone: "+971502220010", status: "followup", assignedTo: ann, createdAt: longAgo });
  const rg = await sheet({ full_name: "Bad date", phone_number: "+971502220010", created_time: "not a date" });
  check("a row whose date can't be read: treated as before — a real repeat", rg.body.data?.repeat === "back_to_holder" && (await read(id2)).repeatCount === 1, rg.body.data);
}

{
  // Every came-in-again line needs a performer, or the lead can't be saved again — its next status change failed with
  // "Path `performedBy` is required" (156 leads, 10 Nov 2026). The sheet sends no user: the lead's reporter stands in.
  const lacking = (l: Json) => (l.activityLogs as Json[]).filter((g) => !g.performedBy).length;
  const statusTo = (id: Types.ObjectId, status: string) => call("PATCH", `/leads/${id}/status`, { status }, { authorization: `Bearer ${ROOT}` });
  const a = await lead({ phone: "+971502220011", status: "followup", assignedTo: ann, createdAt: longAgo });
  await sheet({ full_name: "Again", phone_number: "+971502220011" });
  const b = await lead({ phone: "+971502220012", status: "followup", assignedTo: ann, createdAt: new Date(Date.now() - 20 * 60_000) });
  await sheet({ full_name: "Within the hour", phone_number: "+971502220012" });
  const cc = await lead({ phone: "+971502220013", status: "callback", assignedTo: ann, createdAt: longAgo });
  await call("POST", "/sheets/sync/batch", { rows: [{ full_name: "In a batch", phone_number: "+971502220013" }] }, { "x-api-key": "repeat-enquiry-check-sheets-key" });
  check("from a sheet — again, within the hour, in a batch: every history line has a performer (the lead's reporter)",
    lacking(await read(a)) === 0 && lacking(await read(b)) === 0 && lacking(await read(cc)) === 0
    && String((await read(a)).activityLogs.at(-1)?.performedBy) === String(root), [(await read(a)).activityLogs.at(-1), (await read(b)).activityLogs.at(-1)]);
  const [sa, sb, sc] = [await statusTo(a, "callback"), await statusTo(b, "cnc"), await statusTo(cc, "followup")];
  check("…and each can still be saved: a status change after it succeeds (no \"performedBy is required\")",
    sa.status === 200 && sb.status === 200 && sc.status === 200 && (await read(a)).status === "callback", [sa.status, sb.status, sc.status, sa.body?.errors ?? sb.body?.errors ?? sc.body?.errors]);
}

section("Case 3 — adding a known number by hand");
{
  const known = await lead({ phone: "+971502220007", status: "followup", assignedTo: ann });
  const r = await call("POST", "/leads", { name: "Typed again", phone: "050 222 0007", source: "WALK-IN" }, { authorization: `Bearer ${BEN}` });
  check("409, naming who has it", r.status === 409 && /Ann was told it came in again/.test(r.body.message ?? ""), r);
  check("…no second lead; still Ann's Follow Up, the history says added again by hand", (await leadsWith("502220007")).length === 1 && (await read(known)).status === "followup"
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
