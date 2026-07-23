/**
 * Reassign back to a user the leads that were assigned to them and later
 * moved to someone else.
 *
 * Finds the same set as find-reassigned-leads.ts (explicit "assigned to
 * TARGET" event followed by a later assignment elsewhere), then points those
 * leads back at TARGET.
 *
 * Deliberate choices:
 *   • status is NOT touched. The normal assign path forces status to
 *     "assigned", which would wipe real state such as followup / lost /
 *     pending_response. Only the assignment itself changes.
 *   • Leads already assigned to TARGET are skipped (nothing to do).
 *   • Every change writes a lead_assigned activity log with structured
 *     changes.assignedTo.{from,to}, so the history stays auditable.
 *
 * Safe by default: DRY RUN unless CONFIRM=REASSIGN is set.
 *
 * Usage:
 *   bun scripts/reassign-leads-back.ts "Adiya"                     # preview
 *   CONFIRM=REASSIGN bun scripts/reassign-leads-back.ts "Adiya"    # apply
 *   bun scripts/reassign-leads-back.ts "Adiya" "mongodb://…"       # explicit URI
 */
import mongoose from "mongoose";
import { Lead } from "../src/models/Lead.js";
import { User } from "../src/models/User.js";
import { Role } from "../src/models/Role.js";

const TARGET = process.argv[2];
const URI = process.argv[3] || process.env.MONGODB_URI || "mongodb://localhost:27017/crm_db";
const CONFIRMED = process.env.CONFIRM === "REASSIGN";

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

interface AssignEvent {
  at: Date;
  userId: string | null;
  name: string | null;
}

const NO_NAME = /^(counselor on import|team successfully|member successfully)$/i;

function nameFromDescription(desc: string): string | null {
  const d = desc.trim();
  const patterns = [
    /^Auto-assigned to "(.+?)" via /,
    /^Assigned to team member (.+?)$/,
    /^Assigned to (.+?) by team leader$/,
    /^Lead assigned to (.+?)$/,
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
    console.error('Usage: bun scripts/reassign-leads-back.ts "<user name or email>" [mongodb-uri]');
    process.exit(1);
  }

  const opts = /\/\/[^@]+@/.test(URI) ? { authSource: "admin" } : {};
  await mongoose.connect(URI, opts);
  console.log(
    `connected: ${URI.replace(/\/\/[^@]+@/, "//***@")}${CONFIRMED ? "  ** LIVE — WILL WRITE **" : "  (DRY RUN)"}\n`,
  );

  // ── Resolve target ─────────────────────────────────────────────────────────
  const esc = TARGET.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  const matches = await User.find({
    $or: [{ name: { $regex: esc, $options: "i" } }, { email: { $regex: esc, $options: "i" } }],
  })
    .select("name email")
    .lean<{ _id: mongoose.Types.ObjectId; name: string; email: string }[]>();

  if (matches.length !== 1) {
    console.log(
      matches.length === 0
        ? `No user matching "${TARGET}".`
        : `"${TARGET}" matched ${matches.length} users — narrow it down:`,
    );
    for (const u of matches) console.log(`  • ${u.name}  <${u.email}>  ${u._id.toString()}`);
    await mongoose.disconnect();
    return;
  }

  const target = matches[0];
  const targetId = target._id.toString();
  const targetObjId = target._id;
  console.log(`Target: ${target.name} <${target.email}>  (${targetId})\n`);

  // Actor recorded against each activity-log entry. Resolution order:
  //   1. ACTOR env (email or name) — explicit override
  //   2. SUPER_ADMIN_EMAIL — but note this often points at a dev account that
  //      does not exist in production, hence the fallback below
  //   3. first active Super Admin in this database
  let admin = null as { _id: mongoose.Types.ObjectId; name: string; email: string } | null;

  if (process.env.ACTOR) {
    const a = process.env.ACTOR.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    admin = await User.findOne({ $or: [{ email: { $regex: a, $options: "i" } }, { name: { $regex: a, $options: "i" } }] })
      .select("_id name email")
      .lean<typeof admin>();
    if (!admin) {
      console.error(`ACTOR "${process.env.ACTOR}" did not match any user. Aborting.`);
      await mongoose.disconnect();
      process.exit(1);
    }
  }
  if (!admin && process.env.SUPER_ADMIN_EMAIL) {
    admin = await User.findOne({ email: process.env.SUPER_ADMIN_EMAIL })
      .select("_id name email")
      .lean<typeof admin>();
  }
  if (!admin) {
    const saRole = await Role.findOne({ roleName: /super admin/i })
      .select("_id")
      .lean<{ _id: mongoose.Types.ObjectId } | null>();
    if (saRole) {
      admin = await User.findOne({ role: saRole._id, status: "active" })
        .select("_id name email")
        .lean<typeof admin>();
    }
  }
  if (!admin) {
    console.error("Could not resolve an actor for the audit log. Set ACTOR=<email>. Aborting.");
    await mongoose.disconnect();
    process.exit(1);
  }
  console.log(`Audit actor: ${admin.name} <${admin.email}>   (override with ACTOR=<email>)\n`);

  const users = await User.find({}).select("name").lean<{ _id: mongoose.Types.ObjectId; name: string }[]>();
  const idToName = new Map(users.map((u) => [u._id.toString(), u.name]));
  const nameToIds = new Map<string, string[]>();
  for (const u of users) {
    const k = u.name.trim().toLowerCase();
    nameToIds.set(k, [...(nameToIds.get(k) ?? []), u._id.toString()]);
  }
  const targetNameKey = target.name.trim().toLowerCase();
  const targetNameAmbiguous = (nameToIds.get(targetNameKey)?.length ?? 0) > 1;

  // ── Exclusions ───────────────────────────────────────────────────────────────
  // EXCLUDE_CURRENT="Adiya,foo@bar" — skip any matched lead that is CURRENTLY
  // assigned to one of these users. Used when a lead legitimately passed through
  // more than one person and a prior reassignment already parked it with someone
  // we want to leave undisturbed.
  const excludeIds = new Set<string>();
  const excludeNames: string[] = [];
  if (process.env.EXCLUDE_CURRENT) {
    for (const tokRaw of process.env.EXCLUDE_CURRENT.split(",")) {
      const tok = tokRaw.trim();
      if (!tok) continue;
      const e = tok.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      const us = await User.find({ $or: [{ name: { $regex: e, $options: "i" } }, { email: { $regex: e, $options: "i" } }] })
        .select("name")
        .lean<{ _id: mongoose.Types.ObjectId; name: string }[]>();
      if (us.length === 0) {
        console.error(`EXCLUDE_CURRENT: "${tok}" matched no user. Aborting to avoid a wrong write.`);
        await mongoose.disconnect();
        process.exit(1);
      }
      for (const u of us) {
        excludeIds.add(u._id.toString());
        excludeNames.push(u.name);
      }
    }
    console.log(`Excluding leads currently held by: ${excludeNames.join(", ")}\n`);
  }

  // ── Detection ──────────────────────────────────────────────────────────────
  // Two rules, the second enabled by INCLUDE_WORKED=1:
  //
  //   "assigned"  an explicit "assigned to TARGET" event, then a later
  //               assignment elsewhere.
  //   "worked"    TARGET performed activity on the lead (typically because they
  //               created it, which writes no assignment event at all), and the
  //               lead was assigned away AFTER their last activity.
  //
  // The "worked" rule exists because creating a lead makes you its implicit
  // owner without ever emitting a lead_assigned entry, so the strict rule alone
  // cannot see leads the target originated.
  const INCLUDE_WORKED = process.env.INCLUDE_WORKED === "1";

  const leads = await Lead.find(
    INCLUDE_WORKED
      ? { $or: [{ "activityLogs.action": "lead_assigned" }, { "activityLogs.performedBy": targetObjId }] }
      : { "activityLogs.action": "lead_assigned" },
  )
    .select("name phone status assignedTo activityLogs")
    .lean<LeadDoc[]>();

  const hits: { lead: LeadDoc; reason: "assigned" | "worked" }[] = [];

  for (const lead of leads) {
    const logs = (lead.activityLogs ?? [])
      .slice()
      .sort((a, b) => new Date(a.createdAt).getTime() - new Date(b.createdAt).getTime());

    const events: AssignEvent[] = [];
    for (const log of logs) {
      if (log.action !== "lead_assigned") continue;
      const toId = log.changes?.assignedTo?.to ?? null;
      const nm = nameFromDescription(log.description);
      let userId: string | null = toId;
      if (!userId && nm) {
        const ids = nameToIds.get(nm.trim().toLowerCase());
        if (ids?.length === 1) userId = ids[0];
      }
      events.push({ at: new Date(log.createdAt), userId, name: (userId ? idToName.get(userId) : null) ?? nm });
    }

    const isTarget = (e: AssignEvent) =>
      e.userId ? e.userId === targetId : !targetNameAmbiguous && e.name?.trim().toLowerCase() === targetNameKey;

    // Rule 1 — explicitly assigned to target, then moved on.
    const firstIdx = events.findIndex(isTarget);
    if (firstIdx !== -1) {
      const movedTo = events.slice(firstIdx + 1).find((e) => (e.userId ?? e.name) !== null && !isTarget(e));
      if (movedTo) {
        hits.push({ lead, reason: "assigned" });
        continue;
      }
    }

    if (!INCLUDE_WORKED) continue;

    // Rule 2 — target worked the lead, then it was assigned away afterwards.
    const targetActs = logs.filter((a) => String(a.performedBy) === targetId);
    if (targetActs.length === 0) continue;
    const lastTouch = new Date(targetActs[targetActs.length - 1].createdAt).getTime();

    const movedAfter = events.find(
      (e) => e.at.getTime() > lastTouch && (e.userId ?? e.name) !== null && !isTarget(e),
    );
    if (movedAfter) hits.push({ lead, reason: "worked" });
  }

  // Already back with the target → nothing to do.
  const notTarget = hits.filter((h) => h.lead.assignedTo?.toString() !== targetId);
  const alreadyOk = hits.length - notTarget.length;

  // Drop leads currently held by an excluded user (see EXCLUDE_CURRENT above).
  const excluded = notTarget.filter((h) => h.lead.assignedTo && excludeIds.has(h.lead.assignedTo.toString()));
  const todo = notTarget.filter((h) => !(h.lead.assignedTo && excludeIds.has(h.lead.assignedTo.toString())));

  const byReason = (r: "assigned" | "worked") => todo.filter((h) => h.reason === r).length;
  console.log(
    `${hits.length} lead(s) matched; ${todo.length} need reassigning` +
      `${alreadyOk > 0 ? `, ${alreadyOk} already with ${target.name}` : ""}` +
      `${excluded.length > 0 ? `, ${excluded.length} left with excluded user(s)` : ""}.` +
      (INCLUDE_WORKED ? `\n  breakdown: ${byReason("assigned")} assigned-then-moved, ${byReason("worked")} worked-then-moved` : "") +
      `\n`,
  );

  if (excluded.length > 0) {
    console.log(`Excluded (kept with current holder):`);
    for (const { lead: l } of excluded) {
      const holder = idToName.get(l.assignedTo?.toString() ?? "") ?? "?";
      console.log(`  · ${l.name ?? "(no name)"}  ${l.phone ?? ""}  — stays with ${holder}`);
    }
    console.log();
  }

  if (todo.length === 0) {
    console.log("Nothing to do.");
    await mongoose.disconnect();
    return;
  }

  for (const { lead: l, reason } of todo) {
    const from = l.assignedTo?.toString();
    console.log(
      `  ${l.name ?? "(no name)"}  ${l.phone ?? ""}   (${reason})\n` +
        `      ${(from && idToName.get(from)) ?? "(unassigned)"}  ->  ${target.name}   [status ${l.status ?? "-"} kept as-is]`,
    );
  }
  console.log();

  if (!CONFIRMED) {
    console.log(`DRY RUN — nothing written.`);
    console.log(`To apply, re-run with:`);
    console.log(
      `  ${INCLUDE_WORKED ? "INCLUDE_WORKED=1 " : ""}CONFIRM=REASSIGN bun scripts/reassign-leads-back.ts "${TARGET}"`,
    );
    await mongoose.disconnect();
    return;
  }

  // ── Apply ──────────────────────────────────────────────────────────────────
  const now = new Date();
  let ok = 0;
  for (const { lead: l } of todo) {
    const from = l.assignedTo?.toString() ?? null;
    const res = await Lead.updateOne(
      { _id: l._id },
      {
        $set: { assignedTo: targetObjId, assignedAt: now },
        $push: {
          activityLogs: {
            action: "lead_assigned",
            description: `Lead reassigned to ${target.name} by bulk script`,
            performedBy: admin._id,
            changes: { assignedTo: { from, to: targetId } },
            createdAt: now,
          },
        },
      },
    );
    if (res.modifiedCount === 1) ok++;
    else console.warn(`  ! no change written for ${l.name ?? l._id.toString()}`);
  }

  console.log(`reassigned ${ok}/${todo.length} lead(s) to ${target.name}`);

  const verify = await Lead.countDocuments({
    _id: { $in: todo.map((h) => h.lead._id) },
    assignedTo: targetObjId,
  });
  console.log(`verified: ${verify}/${todo.length} now assigned to ${target.name}`);

  await mongoose.disconnect();
  console.log("done");
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
