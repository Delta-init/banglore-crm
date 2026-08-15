/**
 * For the leads most recently rebalanced away from a source member (i.e. the
 * ones carrying a "Rebalanced from <SOURCE>" audit entry written by
 * redistribute-untouched.ts), reset:
 *    • status    -> "assigned"
 *    • createdAt -> now (so they show as today's leads and sort to the top)
 *    • updatedAt -> now
 *
 * A status_changed activity entry is appended per lead so the prior status is
 * still recoverable from history. Everything else on the lead is untouched.
 *
 * WARNING: this overwrites the current working status (not_connected, mia,
 * pending_response, …) with "assigned", and rewrites the lead's created date.
 * Only the source's just-rebalanced batch is affected.
 *
 * Safe by default: DRY RUN unless CONFIRM=STAMP.
 *
 * Usage:
 *   SOURCE="Poojana" bun scripts/stamp-rebalanced-batch.ts
 *   SOURCE="Poojana" CONFIRM=STAMP bun scripts/stamp-rebalanced-batch.ts
 *   ACTOR="ajvad@…" …
 */
import mongoose from "mongoose";
import { Lead } from "../src/models/Lead.js";
import { User } from "../src/models/User.js";
import { Role } from "../src/models/Role.js";

const URI = process.env.MONGODB_URI || "mongodb://localhost:27017/crm_db";
const SOURCE = process.env.SOURCE;
const CONFIRMED = process.env.CONFIRM === "STAMP";

interface LiteUser { _id: mongoose.Types.ObjectId; name: string; email?: string; }

async function resolve(token: string): Promise<LiteUser[]> {
  const e = token.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return User.find({ $or: [{ name: { $regex: e, $options: "i" } }, { email: { $regex: e, $options: "i" } }] })
    .select("name email").lean<LiteUser[]>();
}

async function main() {
  if (!SOURCE) { console.error('Set SOURCE="<name or email>". Optional: ACTOR, CONFIRM=STAMP'); process.exit(1); }

  await mongoose.connect(URI, /\/\/[^@]+@/.test(URI) ? { authSource: "admin" } : {});
  console.log(`connected: ${URI.replace(/\/\/[^@]+@/, "//***@")}${CONFIRMED ? "  ** LIVE — WILL WRITE **" : "  (DRY RUN)"}\n`);

  const sm = await resolve(SOURCE);
  if (sm.length !== 1) {
    console.log(sm.length === 0 ? `No user matching SOURCE "${SOURCE}".` : `SOURCE "${SOURCE}" ambiguous:`);
    for (const u of sm) console.log(`  • ${u.name} <${u.email}> ${u._id}`);
    await mongoose.disconnect(); return;
  }
  const source = sm[0];
  console.log(`Source: ${source.name} (${source._id})`);

  // Audit actor
  let admin: LiteUser | null = null;
  if (process.env.ACTOR) {
    admin = (await resolve(process.env.ACTOR))[0] ?? null;
    if (!admin) { console.error(`ACTOR "${process.env.ACTOR}" matched no user. Aborting.`); await mongoose.disconnect(); process.exit(1); }
  }
  if (!admin) {
    const sa = await Role.findOne({ roleName: /super admin/i }).select("_id").lean<{ _id: mongoose.Types.ObjectId } | null>();
    if (sa) admin = await User.findOne({ role: sa._id, status: "active" }).select("name email").lean<LiteUser | null>();
  }
  if (!admin) { console.error("No audit actor. Set ACTOR=<email>. Aborting."); await mongoose.disconnect(); process.exit(1); }
  console.log(`Audit actor: ${admin.name}\n`);

  // Target = leads carrying this source's rebalance audit entry.
  const rebalRe = new RegExp(`^Rebalanced from ${source.name.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")} `);
  const leads = await Lead.find({
    activityLogs: { $elemMatch: { action: "lead_assigned", description: rebalRe, "changes.assignedTo.from": source._id.toString() } },
  })
    .select("name phone status createdAt")
    .lean<{ _id: mongoose.Types.ObjectId; name?: string; status?: string }[]>();

  console.log(`${leads.length} lead(s) carry a "Rebalanced from ${source.name}" entry.\n`);
  if (leads.length === 0) { console.log("Nothing to stamp."); await mongoose.disconnect(); return; }

  const byStatus = leads.reduce<Record<string, number>>((m, l) => ((m[l.status ?? "?"] = (m[l.status ?? "?"] ?? 0) + 1), m), {});
  console.log(`current status breakdown: ${Object.entries(byStatus).map(([s, n]) => `${s}=${n}`).join(", ")}`);
  const already = leads.filter((l) => l.status === "assigned").length;
  console.log(`will set all -> status "assigned"  (${already} already assigned) and createdAt -> now\n`);

  if (!CONFIRMED) {
    console.log("DRY RUN — nothing written.");
    console.log(`To apply:  SOURCE="${SOURCE}" CONFIRM=STAMP bun scripts/stamp-rebalanced-batch.ts`);
    await mongoose.disconnect(); return;
  }

  const now = new Date();
  let ok = 0;
  for (const l of leads) {
    const prev = l.status ?? "unknown";
    const res = await Lead.updateOne(
      { _id: l._id },
      {
        $set: { status: "assigned", createdAt: now, updatedAt: now },
        $push: {
          activityLogs: {
            action: "status_changed",
            description: `Status reset to "assigned" and lead date stamped to today by bulk script (was "${prev}")`,
            performedBy: admin._id,
            changes: { status: { from: prev, to: "assigned" } },
            createdAt: now,
          },
        },
      },
      // timestamps:false — we set createdAt/updatedAt explicitly.
      // overwriteImmutable:true — Mongoose marks createdAt immutable when
      // timestamps are enabled, so without this the createdAt $set is silently
      // dropped and only the status/updatedAt changes land.
      { timestamps: false, overwriteImmutable: true },
    );
    if (res.modifiedCount === 1) ok++;
  }
  console.log(`stamped ${ok}/${leads.length} lead(s).`);

  const verify = await Lead.countDocuments({
    _id: { $in: leads.map((l) => l._id) },
    status: "assigned",
    createdAt: { $gte: new Date(now.getTime() - 5000) },
  });
  console.log(`verified: ${verify}/${leads.length} now status=assigned with today's date`);

  await mongoose.disconnect();
  console.log("done");
}

main().catch((e) => { console.error("ERROR:", e); process.exit(1); });
