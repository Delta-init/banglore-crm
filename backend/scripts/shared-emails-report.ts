/**
 * Which emails in this CRM are held by two or more different people — clients
 * finance would file under one customer, since it knows a client by the email
 * alone (one email, one client: the user, 2026-10-10). Leads and students
 * together, grouped by the email trimmed and lower-cased; "different people" as
 * the close decides it (src/utils/clientEmail.ts): both phones known and a
 * different number (last nine digits), else a different name — and a student
 * is always the same person as the lead it was closed from.
 *
 * Read only. It never writes and takes no option that would: no models are
 * loaded (their index builds write), dotenv is never read, and anything but
 * --json is refused.
 *
 * Run from backend/, naming the database outright — `--no-env-file` keeps bun
 * from loading backend/.env, which names the LIVE database:
 *
 *   MONGODB_URI='mongodb+srv://USER:PASS@HOST/DATABASE' bun --no-env-file scripts/shared-emails-report.ts
 *   MONGODB_URI='…' bun --no-env-file scripts/shared-emails-report.ts --json > shared-emails.json
 *
 * Prints, per shared email: the email masked (its first two characters, ***,
 * @domain), how many records hold it, and each record — student or lead, its
 * name, the enrolment number or the lead's id, its status. Never a phone number.
 */
import mongoose from "mongoose";
import { emailKey, maskEmail, samePerson } from "../src/utils/clientEmail.js";

const args = process.argv.slice(2);
const asJson = args.includes("--json");
const other = args.filter((a) => a !== "--json");
if (other.length) {
  console.error(`This report only reads, and takes nothing but --json — not ${other.join(" ")}.`);
  process.exit(2);
}
const uri = process.env.MONGODB_URI ?? "";
if (!uri) {
  console.error("Give the database outright: MONGODB_URI='mongodb://…' bun --no-env-file scripts/shared-emails-report.ts [--json]");
  process.exit(2);
}

interface Rec {
  kind: "student" | "lead";
  id: string;
  name: string;
  phone: string;
  status: string;
  /** A student's enrolment number. */
  code?: string;
  /** The lead a record belongs to: a lead's own id, a student's lead. */
  lead?: string;
}

// No index builds, no collections made: connecting must not write either.
await mongoose.connect(uri, { autoIndex: false, autoCreate: false, readPreference: "secondaryPreferred" });
const db = mongoose.connection.db!;
const withEmail = { email: { $type: "string" as const, $regex: /\S/ } };
const [leads, students] = await Promise.all([
  db.collection("leads").find(withEmail, { projection: { name: 1, phone: 1, email: 1, status: 1 } }).toArray(),
  db.collection("students").find(withEmail, { projection: { name: 1, phone: 1, email: 1, status: 1, enrollmentNumber: 1, leadId: 1 } }).toArray(),
]);

const byEmail = new Map<string, Rec[]>();
const add = (email: unknown, rec: Rec) => {
  const key = emailKey(email);
  if (!key) return;
  byEmail.set(key, [...(byEmail.get(key) ?? []), rec]);
};
for (const l of leads) {
  add(l.email, { kind: "lead", id: String(l._id), name: String(l.name ?? ""), phone: String(l.phone ?? ""), status: String(l.status ?? ""), lead: String(l._id) });
}
for (const s of students) {
  add(s.email, {
    kind: "student", id: String(s._id), name: String(s.name ?? ""), phone: String(s.phone ?? ""), status: String(s.status ?? ""),
    code: String(s.enrollmentNumber ?? ""), ...(s.leadId ? { lead: String(s.leadId) } : {}),
  });
}

/** Two records of one lead — the lead and its student, or two of its students — are one person. */
const oneLead = (a: Rec, b: Rec) => Boolean(a.lead && b.lead && a.lead === b.lead);
const differentPeople = (list: Rec[]) =>
  list.some((a, i) => list.slice(i + 1).some((b) => !oneLead(a, b) && !samePerson(a, b)));

const groups = [...byEmail.entries()]
  .filter(([, list]) => list.length > 1 && differentPeople(list))
  .map(([email, list]) => ({
    email: maskEmail(email),
    count: list.length,
    records: list
      // Students first, then leads, each by name.
      .sort((a, b) => (a.kind === b.kind ? a.name.localeCompare(b.name) : a.kind === "student" ? -1 : 1))
      .map((r) => ({ kind: r.kind, name: r.name, ...(r.kind === "student" ? { code: r.code } : { id: r.id }), status: r.status })),
  }))
  .sort((a, b) => b.count - a.count || a.email.localeCompare(b.email));

const database = mongoose.connection.name;
await mongoose.disconnect();

if (asJson) {
  console.log(JSON.stringify({ database, groups, totals: { emails: groups.length, records: groups.reduce((t, g) => t + g.count, 0) } }, null, 2));
} else {
  console.log(`Emails held by more than one person — ${database}: ${groups.length} email${groups.length === 1 ? "" : "s"}, ${leads.length} leads and ${students.length} students with an email read.`);
  for (const g of groups) {
    console.log(`\n${g.email} — ${g.count} records`);
    for (const r of g.records) {
      const ref = "code" in r ? r.code : r.id;
      console.log(`  ${r.kind.padEnd(8)} ${(r.name || "(no name)").padEnd(28)} ${String(ref ?? "").padEnd(26)} ${r.status}`);
    }
  }
}
