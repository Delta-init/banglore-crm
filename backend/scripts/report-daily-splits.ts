/**
 * Daily batch split report (READ-ONLY — never writes).
 *
 * Reconstructs each day's auto-assignment batch from lead activity logs and
 * shows how evenly (or not) each batch was spread across members. Flags any
 * day where one member received a lopsided share — the signature of the
 * "returning-absent-member gets the whole batch" bug.
 *
 * A "batch" here = all `Auto-assigned to "X"` events on one IST calendar day
 * for one team, grouped by assignee.
 *
 * Usage:
 *   bun scripts/report-daily-splits.ts                 # all teams, last 14 days
 *   bun scripts/report-daily-splits.ts "New Team"      # one team
 *   DAYS=30 bun scripts/report-daily-splits.ts         # widen the window
 */
import mongoose from "mongoose";
import { Lead } from "../src/models/Lead.js";
import { User } from "../src/models/User.js";
import { Team } from "../src/models/Team.js";

const TEAM_FILTER = process.argv[2] || null;
const URI = process.argv[3] || process.env.MONGODB_URI || "mongodb://localhost:27017/crm_db";
const DAYS = Number(process.env.DAYS || 14);

const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

/** IST calendar day (YYYY-MM-DD) for a UTC date. */
function istDay(d: Date): string {
  const ist = new Date(new Date(d).getTime() + IST_OFFSET_MS);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}-${String(ist.getUTCDate()).padStart(2, "0")}`;
}

const AUTO_RE = /^Auto-assigned to "(.+?)" via /;

async function main() {
  const opts = /\/\/[^@]+@/.test(URI) ? { authSource: "admin" } : {};
  await mongoose.connect(URI, opts);
  console.log(`connected: ${URI.replace(/\/\/[^@]+@/, "//***@")}   window: last ${DAYS} days\n`);

  const users = await User.find({}).select("name").lean<{ _id: mongoose.Types.ObjectId; name: string }[]>();
  const idToName = new Map(users.map((u) => [u._id.toString(), u.name]));

  const teams = await Team.find(TEAM_FILTER ? { name: TEAM_FILTER } : {})
    .select("name")
    .lean<{ _id: mongoose.Types.ObjectId; name: string }[]>();
  if (teams.length === 0) {
    console.log(TEAM_FILTER ? `No team named "${TEAM_FILTER}".` : "No teams.");
    await mongoose.disconnect();
    return;
  }

  const since = new Date(Date.now() - DAYS * 86400000);

  for (const team of teams) {
    const leads = await Lead.find({ team: team._id, "activityLogs.action": "lead_assigned" })
      .select("activityLogs")
      .lean<{ activityLogs: { action: string; description: string; createdAt: Date }[] }[]>();

    // day -> assigneeName -> count   (auto-assign events only)
    const byDay = new Map<string, Map<string, number>>();
    for (const l of leads) {
      for (const log of l.activityLogs ?? []) {
        if (log.action !== "lead_assigned") continue;
        const m = AUTO_RE.exec(log.description);
        if (!m) continue; // only auto-split events, not manual assigns
        const when = new Date(log.createdAt);
        if (when < since) continue;
        const day = istDay(when);
        const name = m[1].trim();
        const row = byDay.get(day) ?? new Map<string, number>();
        row.set(name, (row.get(name) ?? 0) + 1);
        byDay.set(day, row);
      }
    }

    console.log("═".repeat(72));
    console.log(`TEAM: ${team.name}`);
    console.log("═".repeat(72));

    if (byDay.size === 0) {
      console.log("  (no auto-split batches in window)\n");
      continue;
    }

    for (const day of [...byDay.keys()].sort().reverse()) {
      const row = byDay.get(day)!;
      const entries = [...row.entries()].sort((a, b) => b[1] - a[1]);
      const total = entries.reduce((s, [, c]) => s + c, 0);
      const members = entries.length;
      const avg = total / members;
      const top = entries[0];
      // Flood = top member got more than 2x the even share AND grabbed >50% of batch.
      const flooded = top[1] > 2 * avg && top[1] > total * 0.5 && members > 1;

      console.log(
        `\n  ${day}   ${total} leads → ${members} member${members === 1 ? "" : "s"}` +
          `   (even share ≈ ${avg.toFixed(1)}/member)${flooded ? "   ⚠️  LOPSIDED" : ""}`,
      );
      for (const [name, count] of entries) {
        const bar = "█".repeat(Math.round((count / Math.max(...entries.map((e) => e[1]))) * 24));
        const flag = count > 2 * avg && members > 1 ? "  ←" : "";
        console.log(`     ${name.padEnd(22)} ${String(count).padStart(3)}  ${bar}${flag}`);
      }
    }
    console.log();
  }

  await mongoose.disconnect();
}

main().catch((e) => {
  console.error("ERROR:", e);
  process.exit(1);
});
