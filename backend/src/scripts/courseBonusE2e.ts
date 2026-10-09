/**
 * A course's bonus, end to end, against a real backend process: set when a
 * course is created or edited, kept, listed, and sent with the course a lead
 * names — what a new close starts from (delta CreateStudentModal).
 *
 *   Case 1  happy path   a course made with a bonus, the bonus changed, in
 *                        every list, and on a lead's course (one and the list)
 *   Case 2  edge         none given is none, taken off, decimals, editing
 *                        other fields leaves it, a course from before
 *   Case 3  errors       negative, not a number, nothing changed by either
 *   Case 4  permission   no token, a role that cannot make or edit courses, a
 *                        switched-off account
 *   Case 5  mapping      a course mapped to a finance product and LMS courses
 *                        (a bundle opens two), unmapped, a bad slug refused;
 *                        the finance catalogue is empty when finance is off
 *
 * Run through scripts/course-bonus-e2e.sh. Refuses anything but a scratch
 * database on 127.0.0.1.
 */
import mongoose from "mongoose";

const uri = process.env.MONGODB_URI ?? "";
if (!/^mongodb:\/\/127\.0\.0\.1:\d+\/[^/?]*e2e/.test(uri)) {
  console.error(`Refusing to run: MONGODB_URI must be a scratch e2e database on 127.0.0.1, got "${uri}"`);
  process.exit(1);
}
const API = `http://127.0.0.1:${process.env.E2E_API_PORT}/api/v1`;

let failures = 0, checks = 0;
function check(label: string, ok: boolean, detail = "") {
  checks++;
  if (ok) console.log(`  \x1b[32m✓\x1b[0m ${label}`);
  else { failures++; console.log(`  \x1b[31m✗ ${label}${detail ? ` — ${detail}` : ""}\x1b[0m`); }
}
const step = (s: string) => console.log(`\n\x1b[1m${s}\x1b[0m`);
/** What this API answers with, as far as the checks read it. */
interface CourseOut { _id: string; name: string; amount: number; bonusAmount?: number }
interface LeadOut { _id: string; course?: CourseOut | null }
interface Envelope { success?: boolean; message?: string; data?: CourseOut & CourseOut[] & LeadOut & LeadOut[] & { accessToken?: string } }
interface Res { status: number; body: Envelope }

const show = (r: Res) => `${r.status} ${JSON.stringify(r.body).slice(0, 220)}`;
async function call(method: string, path: string, body?: unknown, token?: string): Promise<Res> {
  const r = await fetch(`${API}${path}`, {
    method,
    headers: { "content-type": "application/json", ...(token ? { authorization: `Bearer ${token}` } : {}) },
    ...(body !== undefined ? { body: JSON.stringify(body) } : {}),
  });
  return { status: r.status, body: (await r.json().catch(() => ({}))) as Envelope };
}

await mongoose.connect(uri);
if (mongoose.connection.host !== "127.0.0.1") { console.error("Refusing: not 127.0.0.1"); process.exit(1); }
for (const c of await mongoose.connection.db!.listCollections().toArray()) await mongoose.connection.db!.collection(c.name).deleteMany({});

const { Role } = await import("../models/Role.js");
const { User } = await import("../models/User.js");
const { Course } = await import("../models/Course.js");
const { Lead } = await import("../models/Lead.js");

step("Setting up");
const PASSWORD = "E2e-Password-123";
const adminRole = await Role.create({ roleName: "Super Admin", isSystemRole: true });
const viewerRole = await Role.create({ roleName: "Viewer", permissions: { leads: { view: true, create: false, edit: false } } });
const adminUser = await User.create({ name: "Banglore Admin", email: "admin@banglore-e2e.test", password: PASSWORD, role: adminRole._id, status: "active" });
await User.create({ name: "Banglore Viewer", email: "viewer@banglore-e2e.test", password: PASSWORD, role: viewerRole._id, status: "active" });
const login = async (email: string) => (await call("POST", "/auth/login", { email, password: PASSWORD })).body?.data?.accessToken as string | undefined;
const admin = (await login("admin@banglore-e2e.test"))!;
const viewer = (await login("viewer@banglore-e2e.test"))!;
check("an admin and a viewer can sign in", !!admin && !!viewer);

// ── Case 1 ──────────────────────────────────────────────────────────────────
step("Case 1 — happy path: made with a bonus, changed, listed, on a lead's course");
let r = await call("POST", "/courses", { name: "COURSE 1 - MARKET BREAKOUT THEORY", amount: 2250, bonusAmount: 500, status: "active" }, admin);
const c1 = r.body.data as CourseOut;
check("a course is made with its bonus", r.status === 201 && c1?.bonusAmount === 500, show(r));
r = await call("PUT", `/courses/${c1._id}`, { bonusAmount: 750 }, admin);
check("...the bonus is changed", r.status === 200 && r.body.data?.bonusAmount === 750, show(r));
r = await call("GET", `/courses/${c1._id}`, undefined, admin);
check("...and kept", r.body.data?.bonusAmount === 750, show(r));
r = await call("GET", "/courses", undefined, admin);
check("the Courses page's list carries it", (r.body.data as CourseOut[] | undefined)?.find((c) => c._id === c1._id)?.bonusAmount === 750, show(r));
r = await call("GET", "/courses/all", undefined, admin);
check("so does the list the close picks from", (r.body.data as CourseOut[] | undefined)?.find((c) => c._id === c1._id)?.bonusAmount === 750, show(r));
const lead = await Lead.create({ name: "Priya Banglore", phone: "+919800000001", reporter: adminUser._id, course: c1._id });
r = await call("GET", `/leads/${lead._id}`, undefined, admin);
check("a lead's course carries it — where the close starts from", r.status === 200 && r.body.data?.course?.bonusAmount === 750, show(r));
r = await call("GET", "/leads", undefined, admin);
check("...on the leads list too", (r.body.data as LeadOut[] | undefined)?.find((l) => l._id === String(lead._id))?.course?.bonusAmount === 750, show(r));

// ── Case 2 ──────────────────────────────────────────────────────────────────
step("Case 2 — edge: none given, taken off, decimals, other edits, a course from before");
r = await call("POST", "/courses", { name: "MENTOR'S MASTERY COURSE", amount: 1837 }, admin);
const c2 = r.body.data as CourseOut;
check("a course made with no bonus has none", r.status === 201 && c2?.bonusAmount === 0, show(r));
r = await call("PUT", `/courses/${c1._id}`, { bonusAmount: 99.5 }, admin);
check("a bonus with paise is kept as it is", r.status === 200 && r.body.data?.bonusAmount === 99.5, show(r));
r = await call("PUT", `/courses/${c1._id}`, { name: "COURSE 1 - MBT", amount: 2400 }, admin);
check("editing the name and fee leaves the bonus alone", r.status === 200 && r.body.data?.amount === 2400 && r.body.data?.bonusAmount === 99.5, show(r));
r = await call("PUT", `/courses/${c1._id}`, { bonusAmount: 0 }, admin);
check("a bonus can be taken off", r.status === 200 && r.body.data?.bonusAmount === 0, show(r));
await mongoose.connection.db!.collection("courses").insertOne({ name: "DELTA WAVE THEORY", amount: 4000, status: "active", createdAt: new Date(), updatedAt: new Date() });
r = await call("GET", "/courses/all", undefined, admin);
const old = (r.body.data as CourseOut[] | undefined)?.find((c) => c.name === "DELTA WAVE THEORY");
check("a course from before reads as no bonus", !!old && (old.bonusAmount ?? 0) === 0, show(r));

// ── Case 3 ──────────────────────────────────────────────────────────────────
step("Case 3 — errors: negative, not a number");
const before = await Course.countDocuments();
r = await call("POST", "/courses", { name: "BAD BONUS", amount: 100, bonusAmount: -1 }, admin);
check("a negative bonus is refused on a new course", r.status === 400, show(r));
r = await call("POST", "/courses", { name: "TEXT BONUS", amount: 100, bonusAmount: "500" }, admin);
check("a bonus that is not a number is refused", r.status === 400, show(r));
check("...and neither made a course", (await Course.countDocuments()) === before);
r = await call("PUT", `/courses/${c2._id}`, { bonusAmount: -5 }, admin);
check("a negative bonus is refused on an edit", r.status === 400, show(r));
r = await call("PUT", `/courses/${c2._id}`, { bonusAmount: null }, admin);
check("so is a bonus of null", r.status === 400, show(r));
check("...and the course is unchanged", (await Course.findById(c2._id).lean())?.bonusAmount === 0);

// ── Case 4 ──────────────────────────────────────────────────────────────────
step("Case 4 — permission: no token, a role that cannot make or edit courses, a switched-off account");
for (const [label, method, path, body] of [
  ["making a course with a bonus", "POST", "/courses", { name: "SNEAKY", amount: 1, bonusAmount: 1 }],
  ["changing a course's bonus", "PUT", `/courses/${c2._id}`, { bonusAmount: 999 }],
] as const) {
  const anon = await call(method, path, body);
  const denied = await call(method, path, body, viewer);
  check(`${label}: no token is 401, a viewer is 403`, anon.status === 401 && denied.status === 403, `${show(anon)} | ${show(denied)}`);
}
check("...and nothing came of either", !(await Course.findOne({ name: "SNEAKY" }).lean()) && (await Course.findById(c2._id).lean())?.bonusAmount === 0);
await User.updateOne({ email: "viewer@banglore-e2e.test" }, { $set: { status: "inactive" } });
const off = await call("POST", "/auth/login", { email: "viewer@banglore-e2e.test", password: PASSWORD });
check("a switched-off account cannot sign in to try", off.status >= 400 && !off.body?.data?.accessToken, show(off));

// ── Case 5 ──────────────────────────────────────────────────────────────────
step("Case 5 — mapping: a finance product and LMS courses");
r = await call("PUT", `/courses/${c2._id}`, { financeItemId: "0123456789abcdef01234567", lmsCourseSlugs: ["market-breakout-theory", "delta-wave-theory", "market-breakout-theory"] }, admin);
let mapped = await Course.findById(c2._id).lean();
check("mapped: the finance item, and both LMS courses in order, repeats dropped", r.status === 200 && mapped?.financeItemId === "0123456789abcdef01234567" && mapped?.lmsCourseSlugs?.join(",") === "market-breakout-theory,delta-wave-theory" && mapped?.lmsCourseSlug === "market-breakout-theory", show(r));
r = await call("PUT", `/courses/${c2._id}`, { hsnSac: "999293" }, admin);
mapped = await Course.findById(c2._id).lean();
check("the SAC code is kept, and an edit that doesn't mention the mapping leaves it", r.status === 200 && mapped?.hsnSac === "999293" && mapped?.financeItemId === "0123456789abcdef01234567" && mapped?.lmsCourseSlugs?.length === 2, show(r));
r = await call("PUT", `/courses/${c2._id}`, { financeItemId: "", lmsCourseSlugs: [] }, admin);
mapped = await Course.findById(c2._id).lean();
check("unmapped: no finance item, no LMS course", r.status === 200 && mapped?.financeItemId === null && (mapped?.lmsCourseSlugs?.length ?? 0) === 0 && mapped?.lmsCourseSlug === "", show(r));
r = await call("PUT", `/courses/${c2._id}`, { lmsCourseSlugs: ["Not A Slug!"] }, admin);
check("a slug the LMS couldn't have is refused", r.status === 400, show(r));
r = await call("PUT", `/courses/${c2._id}`, { financeItemId: "nope" }, admin);
check("…so is a finance item id that isn't one", r.status === 400, show(r));
r = await call("GET", "/courses/finance-items", undefined, admin);
check("finance switched off: the catalogue is an empty list, not an error", r.status === 200 && Array.isArray(r.body.data) && (r.body.data as unknown[]).length === 0, show(r));
r = await call("PUT", `/courses/${c2._id}`, { financeItemId: "0123456789abcdef01234567" }, viewer);
check("a viewer can't map a course: 403", r.status === 403, show(r));

await mongoose.disconnect();
console.log(`\n${checks - failures}/${checks} checks passed`);
process.exit(failures ? 1 : 0);
