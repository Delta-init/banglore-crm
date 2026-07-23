/**
 * Find leads that were assigned to a given user, then later reassigned to
 * someone else.
 *
 * Match rule: the lead has an explicit "assigned to <TARGET>" event in its
 * activity log, AND a later assignment event pointing at a different person.
 * Leads that are merely worked on by the target (notes / field edits) do NOT
 * match — only real assignment events count.
 *
 * Assignment events come in three shapes, so both are handled:
 *   1. Manual assign  — changes.assignedTo.{from,to} hold real user ids (best)
 *   2. Auto-assign    — no changes; assignee name only in the description,
 *                       e.g. Auto-assigned to "SIMRAN S" via round robin
 *   3. Legacy import  — "Lead assigned to counselor on import"; no name at all,
 *                       so the assignee is unknowable and the event is skipped
 *                       (reported in the summary so nothing is silently lost).
 *
 * Read-only — this script never writes.
 *
 * Usage:
 *   bun scripts/find-reassigned-leads.ts "Adiya"
 *   bun scripts/find-reassigned-leads.ts "Adiya" "mongodb://user:pass@host:27017/db"
 *   VERBOSE=1 bun scripts/find-reassigned-leads.ts "Adiya"   # show full chain
 */
import mongoose from "mongoose";
import { Lead } from "../src/models/Lead.js";
import { User } from "../src/models/User.js";

const TARGET = process.argv[2];
const URI = process.argv[3] || process.env.MONGODB_URI || "mongodb://localhost:27017/crm_db";
const VERBOSE = process.env.VERBOSE === "1";

interface ActivityLog {
  action: string;
  description: string;
  performedBy?: mongoose.Types.ObjectId;
  changes?: { assignedTo?: { from: string | null; to: string | null } };
  createdAt: Date;
}

interface LeadDoc {
  _id: mongoose.Types.ObjectId;
  name?: string;
  phone?: string;
  status?: string;
  assignedTo?: mongoose.Types.ObjectId | null;
  activityLogs?: ActivityLog[];
}

/** One assignment event, with the assignee resolved as far as possible. */
interface AssignEvent {
  at: Date;
  userId: string | null;   // resolved user id, when known
  name: string | null;     // display name, when known
  raw: string;
}

const IST = (d: Date) =>
  d.toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }) + " IST";

/**
 * Pull the assignee name out of an assignment description, if it carries one.
 * Covers every shape the backend emits for a lead_assigned entry:
 *   Auto-assigned to "SIMRAN S" via round robin
 *   Lead assigned to SIMRAN S
 *   Assigned to SIMRAN S by team leader
 *   Assigned to team member SIMRAN S
 * Deliberately returns null for descriptions that name no user, e.g.
 * "Lead assigned to counselor on import".
 *
 * Note: team-level entries such as `Auto-assigned to team "X"` are logged under
 * the team_assigned action and are filtered out before this is ever called.
 */
const NO_NAME = /^(counselor on import|team successfully|member successfully)$/i;

function nameFromDescription(desc: string): string | null {
  const d = desc.trim();

  const patterns = [
    /^Auto-assigned to "(.+?)" via /,      // auto split
    /^Assigned to team member (.+?)$/,     // team-member assign
    /^Assigned to (.+?) by team leader$/,  // team-leader assign
    /^Lead assigned to (.+?)$/,            // manual assign
  ];

  for (const re of patterns) {
    const m = re.exec(d);
    if (m) {
      const name = m[1].trim();
      return NO_NAME.test(name) ? null : name;
    }
  }
  return null;
}

async function main() {
  if (!TARGET) {
    console.error('Usage: bun scripts/find-reassigned-leads.ts "<user name or email>" [mongodb-uri]');
    process.exit(1);
  }

  // Mirror the auth setup used by the other scripts for remote hosts.
  const opts = /\/\/[^@]+@/.test(URI) ? { authSource: "admin" } : {};
  await mongoose.connect(URI, opts);
  console.log(`connected: ${URI.replace(/\/\/[^@]+@/, "//***@")}\n`);

  // ── Resolve the target user ────────────────────────────────────────────────
  const esc = TARGET.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = await User.find({
    $or: [{ name: { $regex: esc, $options: "i" } }, { email: { $regex: esc, $options: "i" } }],
  })
    .select("name email")
    .lean<{ _id: mongoose.Types.ObjectId; name: string; email: string }[]>();

  if (matches.length === 0) {
    console.log(`No user matching "${TARGET}".`);
    await mongoose.disconnect();
    return;
  }
  if (matches.length > 1) {
    console.log(`"${TARGET}" matched ${matches.length} users — narrow it down:`);
    for (const u of matches) console.log(`  • ${u.name}  <${u.email}>  ${u._id.toString()}`);
    await mongoose.disconnect();
    return;
  }

  const target = matches[0];
  const targetId = target._id.toString();
  console.log(`Target: ${target.name} <${target.email}>  (${targetId})\n`);

  // ── Name → id map, to resolve auto-assign events that only carry a name ────
  const users = await User.find({}).select("name").lean<{ _id: mongoose.Types.ObjectId; name: string }[]>();
  const idToName = new Map(users.map((u) => [u._id.toString(), u.name]));
  const nameToIds = new Map<string, string[]>();
  for (const u of users) {
    const k = u.name.trim().toLowerCase();
    nameToIds.set(k, [...(nameToIds.get(k) ?? []), u._id.toString()]);
  }
  const targetNameKey = target.name.trim().toLowerCase();
  // A name is ambiguous if two different users share it — then name-only
  // (auto-assign) events cannot be attributed with confidence.
  const targetNameAmbiguous = (nameToIds.get(targetNameKey)?.length ?? 0) > 1;

  // ── Scan leads that have at least one assignment event ─────────────────────
  const leads = await Lead.find({ "activityLogs.action": "lead_assigned" })
    .select("name phone status assignedTo activityLogs")
    .lean<LeadDoc[]>();

  console.log(`scanning ${leads.length} leads with assignment history…\n`);

  let unknownAssignee = 0;
  const hits: {
    lead: LeadDoc;
    assignedToTargetAt: Date;
    movedTo: AssignEvent;
    chain: AssignEvent[];
  }[] = [];

  for (const lead of leads) {
    const events: AssignEvent[] = [];

    for (const log of lead.activityLogs ?? []) {
      if (log.action !== "lead_assigned") continue;

      // Prefer the structured id; fall back to the name in the description.
      const toId = log.changes?.assignedTo?.to ?? null;
      const nm = nameFromDescription(log.description);

      let userId: string | null = toId;
      if (!userId && nm) {
        const ids = nameToIds.get(nm.trim().toLowerCase());
        if (ids?.length === 1) userId = ids[0];
      }
      if (!userId && !nm) unknownAssignee++;

      events.push({
        at: new Date(log.createdAt),
        userId,
        name: (userId ? idToName.get(userId) : null) ?? nm,
        raw: log.description,
      });
    }

    if (events.length < 2) continue;
    events.sort((a, b) => a.at.getTime() - b.at.getTime());

    const isTarget = (e: AssignEvent) =>
      e.userId
        ? e.userId === targetId
        : !targetNameAmbiguous && e.name?.trim().toLowerCase() === targetNameKey;

    const firstIdx = events.findIndex(isTarget);
    if (firstIdx === -1) continue;

    // A later assignment to a *different, identifiable* person.
    const movedTo = events
      .slice(firstIdx + 1)
      .find((e) => (e.userId ?? e.name) !== null && !isTarget(e));
    if (!movedTo) continue;

    hits.push({ lead, assignedToTargetAt: events[firstIdx].at, movedTo, chain: events });
  }

  // ── Report ─────────────────────────────────────────────────────────────────
  if (hits.length === 0) {
    console.log(`No leads were assigned to ${target.name} and then reassigned to someone else.`);
  } else {
    hits.sort((a, b) => b.assignedToTargetAt.getTime() - a.assignedToTargetAt.getTime());
    console.log(`${hits.length} lead${hits.length === 1 ? "" : "s"} assigned to ${target.name}, then reassigned:\n`);

    for (const h of hits) {
      const cur = h.lead.assignedTo?.toString();
      console.log(`• ${h.lead.name ?? "(no name)"}  ${h.lead.phone ?? ""}`);
      console.log(`    lead id     : ${h.lead._id.toString()}`);
      console.log(`    status      : ${h.lead.status ?? "-"}`);
      console.log(`    → ${target.name} at : ${IST(h.assignedToTargetAt)}`);
      console.log(`    → moved to     : ${h.movedTo.name ?? "(unknown)"} at ${IST(h.movedTo.at)}`);
      console.log(`    currently with : ${(cur && idToName.get(cur)) ?? "(unassigned)"}`);
      if (VERBOSE) {
        console.log(`    full chain:`);
        for (const e of h.chain) console.log(`      - ${IST(e.at)}  ${e.raw}`);
      }
      console.log();
    }
  }

  if (unknownAssignee > 0) {
    console.log(
      `note: ${unknownAssignee} assignment event(s) carried no identifiable assignee ` +
        `(e.g. legacy "assigned to counselor on import") and were skipped.`,
    );
  }
  if (targetNameAmbiguous) {
    console.log(
      `warning: more than one user is named "${target.name}", so auto-assign events ` +
        `that only record a name were matched by id only.`,
    );
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
