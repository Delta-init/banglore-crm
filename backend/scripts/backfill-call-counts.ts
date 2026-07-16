/**
 * One-time backfill — recompute each lead's callCount + lastCallAt from the
 * existing CallLog records (grouped by leadId).
 *
 * Going forward, callCount is auto-incremented when a call is logged
 * (see callController.bumpLeadCallCount). This script seeds the historical
 * counts so leads that were called before that change show the right number.
 *
 * Usage:
 *   bun scripts/backfill-call-counts.ts                       # local crm_db
 *   bun scripts/backfill-call-counts.ts "mongodb://.../crm"   # explicit URI
 *   DRY=1 bun scripts/backfill-call-counts.ts                 # preview only
 */
import mongoose from "mongoose";
import { Lead } from "../src/models/Lead.js";
import { CallLog } from "../src/models/CallLog.js";

const URI = process.argv[2] || process.env.MONGODB_URI || "mongodb://localhost:27017/crm_db";
const DRY = process.env.DRY === "1";

async function main() {
  await mongoose.connect(URI);
  console.log(`connected: ${URI.replace(/\/\/[^@]+@/, "//***@")}${DRY ? "  (DRY RUN)" : ""}`);

  // Count + newest call date per lead, from lead-linked call logs.
  const grouped = await CallLog.aggregate<{ _id: mongoose.Types.ObjectId; count: number; lastCallAt: Date }>([
    { $match: { leadId: { $ne: null } } },
    { $group: { _id: "$leadId", count: { $sum: 1 }, lastCallAt: { $max: "$callDate" } } },
  ]);

  console.log(`leads with call logs: ${grouped.length}`);
  if (grouped.length === 0) { await mongoose.disconnect(); return; }

  if (DRY) {
    for (const g of grouped.slice(0, 10)) {
      console.log(`  ${g._id.toString()}  callCount=${g.count}  lastCallAt=${g.lastCallAt.toISOString()}`);
    }
    console.log(`… (${grouped.length} total) — no writes (DRY)`);
    await mongoose.disconnect();
    return;
  }

  const ops = grouped.map((g) => ({
    updateOne: {
      filter: { _id: g._id },
      update: { $set: { callCount: g.count, lastCallAt: g.lastCallAt } },
    },
  }));

  const res = await Lead.bulkWrite(ops, { ordered: false });
  console.log(`matched=${res.matchedCount} modified=${res.modifiedCount}`);

  // Verify a couple
  const sample = await Lead.find({ _id: { $in: grouped.slice(0, 3).map((g) => g._id) } })
    .select("name callCount lastCallAt").lean();
  for (const s of sample) {
    console.log(`  ✓ ${s.name}: callCount=${s.callCount} lastCallAt=${s.lastCallAt ? new Date(s.lastCallAt).toISOString() : null}`);
  }

  await mongoose.disconnect();
  console.log("done");
}

main().catch((e) => { console.error("BACKFILL ERROR:", e); process.exit(1); });
