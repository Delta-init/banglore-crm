/**
 * Danger — delete ALL leads from the database.
 *
 * Safe by default: runs as a DRY RUN (counts only, no writes) unless you pass
 * CONFIRM=DELETE. This prevents an accidental wipe from a stray run.
 *
 * Usage:
 *   bun scripts/delete-all-leads.ts                             # DRY RUN — just counts
 *   CONFIRM=DELETE bun scripts/delete-all-leads.ts             # actually delete (local crm_db)
 *   CONFIRM=DELETE bun scripts/delete-all-leads.ts "mongodb://.../crm"   # explicit URI
 */
import mongoose from "mongoose";
import { Lead } from "../src/models/Lead.js";

const URI = process.argv[2] || process.env.MONGODB_URI || "mongodb://localhost:27017/crm_db";
const CONFIRMED = process.env.CONFIRM === "DELETE";

async function main() {
  await mongoose.connect(URI,{
authSource:"admin"
});
  console.log(`connected: ${URI.replace(/\/\/[^@]+@/, "//***@")}${CONFIRMED ? "" : "  (DRY RUN)"}`);

  const total = await Lead.countDocuments({});
  console.log(`leads in database: ${total}`);

  if (total === 0) {
    console.log("nothing to delete.");
    await mongoose.disconnect();
    return;
  }

  if (!CONFIRMED) {
    console.log(`\n⚠️  DRY RUN — no leads deleted.`);
    console.log(`To actually delete all ${total} leads, re-run with:`);
    console.log(`  CONFIRM=DELETE bun scripts/delete-all-leads.ts`);
    await mongoose.disconnect();
    return;
  }

  const res = await Lead.deleteMany({});
  console.log(`deleted: ${res.deletedCount} leads`);

  const remaining = await Lead.countDocuments({});
  console.log(`remaining: ${remaining}`);

  await mongoose.disconnect();
  console.log("done");
}

main().catch((e) => { console.error("DELETE ERROR:", e); process.exit(1); });
