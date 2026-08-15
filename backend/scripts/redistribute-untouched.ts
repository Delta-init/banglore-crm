/**
 * Split one member's UNTOUCHED leads equally across their team.
 *
 * "Untouched" = never worked by the assignee: callCount is 0/absent AND status
 * is still "new" or "assigned". These are the dumped-but-not-actioned leads
 * (e.g. a scheduler flood). Leads the assignee has actually worked (any call,
 * or any status past new/assigned) are NEVER moved.
 *
 * The untouched leads are spread round-robin across the team's present pool
 * (active, non-absent, included members) so each member ends with an equal
 * share. By default the SOURCE member is part of that pool and keeps a fair
 * slice; set EXCLUDE_SOURCE=1 to hand the whole flood to the others instead.
 *
 * Only the assignment changes — lead status is left exactly as-is. Each move
 * writes a lead_assigned activity log with structured from/to for audit.
 *
 * Safe by default: DRY RUN unless CONFIRM=REDISTRIBUTE.
 *
 * Usage:
 *   SOURCE="SIMRAN" TEAM="New Team" bun scripts/redistribute-untouched.ts
 *   SOURCE="SIMRAN" CONFIRM=REDISTRIBUTE bun scripts/redistribute-untouched.ts
 *   SOURCE="SIMRAN" EXCLUDE_SOURCE=1 bun scripts/redistribute-untouched.ts   # give all to others
 *   ACTOR="ajvad@…" …                                                        # audit-log actor
 */
import mongoose from "mongoose";
import { Lead } from "../src/models/Lead.js";
import { User } from "../src/models/User.js";
import { Team } from "../src/models/Team.js";
import { Role } from "../src/models/Role.js";

const URI = process.env.MONGODB_URI || "mongodb://localhost:27017/crm_db";
const TEAM = process.env.TEAM || "New Team";
const SOURCE = process.env.SOURCE;
const CONFIRMED = process.env.CONFIRM === "REDISTRIBUTE";
const EXCLUDE_SOURCE = process.env.EXCLUDE_SOURCE === "1";

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

interface LiteUser { _id: mongoose.Types.ObjectId; name: string; email?: string; }

async function resolveUser(token: string, extra = ""): Promise<LiteUser[]> {
  const e = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return User.find({ $or: [{ name: { $regex: e, $options: "i" } }, { email: { $regex: e, $options: "i" } }] })
    .select("name email")
    .lean<LiteUser[]>();
}

async function main() {
  if (!SOURCE) {
    console.error('Set SOURCE="<name or email>". Optional: TEAM, EXCLUDE_SOURCE=1, ACTOR, CONFIRM=REDISTRIBUTE');
    process.exit(1);
  }

  const opts = /\/\/[^@]+@/.test(URI) ? { authSource: "admin" } : {};
  await mongoose.connect(URI, opts);
  console.log(
    `connected: ${URI.replace(/\/\/[^@]+@/, "//***@")}${CONFIRMED ? "  ** LIVE — WILL WRITE **" : "  (DRY RUN)"}\n`,
  );

  // ── Source member ──────────────────────────────────────────────────────────
  const srcMatch = await resolveUser(SOURCE);
  if (srcMatch.length !== 1) {
    console.log(srcMatch.length === 0 ? `No user matching SOURCE "${SOURCE}".` : `SOURCE "${SOURCE}" is ambiguous:`);
    for (const u of srcMatch) console.log(`  • ${u.name} <${u.email}> ${u._id}`);
    await mongoose.disconnect();
    return;
  }
  const source = srcMatch[0];
  console.log(`Source: ${source.name} <${source.email}>`);

  // ── Team + present pool ────────────────────────────────────────────────────
  const team = await Team.findOne({ name: TEAM })
    .lean<{
      _id: mongoose.Types.ObjectId; name: string;
      members: mongoose.Types.ObjectId[]; leaders: mongoose.Types.ObjectId[];
      inactiveMembers?: mongoose.Types.ObjectId[];
      absentToday?: { userId: mongoose.Types.ObjectId; date: Date }[];
      settings?: { includedMembers?: mongoose.Types.ObjectId[] };
    } | null>();
  if (!team) {
    console.error(`Team "${TEAM}" not found.`);
    await mongoose.disconnect();
    process.exit(1);
  }

  // Today's IST window, to read absentToday.
  const istNow = new Date(Date.now() + IST_OFFSET_MS);
  const todayMidUTC = new Date(Date.UTC(istNow.getUTCFullYear(), istNow.getUTCMonth(), istNow.getUTCDate()) - IST_OFFSET_MS);
  const tomorrowMidUTC = new Date(todayMidUTC.getTime() + 86400000);
  const absentIds = new Set(
    (team.absentToday ?? [])
      .filter((a) => new Date(a.date) >= todayMidUTC && new Date(a.date) < tomorrowMidUTC)
      .map((a) => a.userId.toString()),
  );
  const inactive = new Set((team.inactiveMembers ?? []).map((m) => m.toString()));
  const included = (team.settings?.includedMembers ?? []).map((m) => m.toString());

  const allMembers = (team.members ?? []).map((m) => m.toString());
  let pool = allMembers.filter(
    (id) => !inactive.has(id) && !absentIds.has(id) && (included.length ? included.includes(id) : true),
  );
  if (EXCLUDE_SOURCE) pool = pool.filter((id) => id !== source._id.toString());

  if (pool.length === 0) {
    console.error("Present pool is empty — nobody to distribute to. Aborting.");
    await mongoose.disconnect();
    process.exit(1);
  }

  const names = new Map((await User.find({ _id: { $in: pool } }).select("name").lean<LiteUser[]>()).map((u) => [u._id.toString(), u.name]));
  // Deterministic order.
  pool.sort((a, b) => (names.get(a) ?? a).localeCompare(names.get(b) ?? b));
  console.log(`Team "${team.name}" present pool (${pool.length}${EXCLUDE_SOURCE ? ", source excluded" : ", source included"}): ${pool.map((id) => names.get(id)).join(", ")}`);
  if (absentIds.size) console.log(`  (${absentIds.size} absent today, excluded from pool)`);

  // ── Audit actor ────────────────────────────────────────────────────────────
  let admin: LiteUser | null = null;
  if (process.env.ACTOR) {
    const a = await resolveUser(process.env.ACTOR);
    admin = a[0] ?? null;
    if (!admin) { console.error(`ACTOR "${process.env.ACTOR}" matched no user. Aborting.`); await mongoose.disconnect(); process.exit(1); }
  }
  if (!admin) {
    const saRole = await Role.findOne({ roleName: /super admin/i }).select("_id").lean<{ _id: mongoose.Types.ObjectId } | null>();
    if (saRole) admin = await User.findOne({ role: saRole._id, status: "active" }).select("name email").lean<LiteUser | null>();
  }
  if (!admin) { console.error("No audit actor. Set ACTOR=<email>. Aborting."); await mongoose.disconnect(); process.exit(1); }
  console.log(`Audit actor: ${admin.name}\n`);

  // ── Leads of the source to move ────────────────────────────────────────────
  // SCOPE=untouched (default): only never-worked dumps (safe — no active work
  //   disturbed). SCOPE=all: every lead the source holds, including worked ones
  //   — use when covering an absent/departing member's whole queue.
  const SCOPE = (process.env.SCOPE || "untouched").toLowerCase();
  if (SCOPE !== "untouched" && SCOPE !== "all") {
    console.error(`SCOPE must be "untouched" or "all" (got "${SCOPE}").`);
    await mongoose.disconnect();
    process.exit(1);
  }
  const filter =
    SCOPE === "all"
      ? { assignedTo: source._id }
      : {
          assignedTo: source._id,
          status: { $in: ["new", "assigned"] },
          $or: [{ callCount: { $exists: false } }, { callCount: { $lte: 0 } }],
        };

  const untouched = await Lead.find(filter)
    .select("name phone status createdAt")
    .sort({ createdAt: 1 })
    .lean<{ _id: mongoose.Types.ObjectId; name?: string; phone?: string; status?: string }[]>();

  console.log(
    SCOPE === "all"
      ? `${source.name} has ${untouched.length} lead(s) total (SCOPE=all — includes worked leads).\n`
      : `${source.name} has ${untouched.length} untouched lead(s) (never called, status new/assigned).\n`,
  );
  if (untouched.length === 0) { console.log("Nothing to redistribute."); await mongoose.disconnect(); return; }

  // ── Round-robin allocation ─────────────────────────────────────────────────
  // Start the pointer at source (if present) so the rotation is stable, then
  // assign each lead to the next pool member in turn.
  const start = Math.max(0, pool.indexOf(source._id.toString()));
  const assignment = new Map<string, mongoose.Types.ObjectId[]>(); // memberId -> leadIds
  untouched.forEach((lead, i) => {
    const memberId = pool[(start + i) % pool.length];
    (assignment.get(memberId) ?? assignment.set(memberId, []).get(memberId)!).push(lead._id);
  });

  console.log(`Allocation (equal round-robin):`);
  let moves = 0;
  for (const id of pool) {
    const got = assignment.get(id)?.length ?? 0;
    const keep = id === source._id.toString();
    if (!keep) moves += got;
    console.log(`  ${(names.get(id) ?? id).padEnd(22)} ${String(got).padStart(3)}${keep ? "  (source keeps these)" : ""}`);
  }
  console.log(`\n${moves} lead(s) will move off ${source.name}; ${untouched.length - moves} stay.\n`);

  if (!CONFIRMED) {
    console.log("DRY RUN — nothing written.");
    console.log(`To apply:  ${SCOPE === "all" ? "SCOPE=all " : ""}${EXCLUDE_SOURCE ? "EXCLUDE_SOURCE=1 " : ""}SOURCE="${SOURCE}" TEAM="${TEAM}" CONFIRM=REDISTRIBUTE bun scripts/redistribute-untouched.ts`);
    await mongoose.disconnect();
    return;
  }

  // ── Apply ──────────────────────────────────────────────────────────────────
  const now = new Date();
  let ok = 0;
  for (const [memberId, leadIds] of assignment) {
    if (memberId === source._id.toString()) continue; // no-op for kept leads
    const memberObjId = new mongoose.Types.ObjectId(memberId);
    for (const leadId of leadIds) {
      const res = await Lead.updateOne(
        { _id: leadId },
        {
          $set: { assignedTo: memberObjId, assignedAt: now },
          $push: {
            activityLogs: {
              action: "lead_assigned",
              description: `Rebalanced from ${source.name} to ${names.get(memberId)} by bulk script`,
              performedBy: admin._id,
              changes: { assignedTo: { from: source._id.toString(), to: memberId } },
              createdAt: now,
            },
          },
        },
      );
      if (res.modifiedCount === 1) ok++;
    }
  }
  console.log(`moved ${ok}/${moves} lead(s).`);

  // Verify final untouched distribution of just-moved leads.
  const movedIds = [...assignment].filter(([id]) => id !== source._id.toString()).flatMap(([, ids]) => ids);
  const verify = await Lead.aggregate([
    { $match: { _id: { $in: movedIds } } },
    { $group: { _id: "$assignedTo", n: { $sum: 1 } } },
  ]);
  console.log(`verified recipients: ${verify.map((v) => `${names.get(v._id.toString()) ?? v._id}=${v.n}`).join(", ")}`);

  await mongoose.disconnect();
  console.log("done");
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
