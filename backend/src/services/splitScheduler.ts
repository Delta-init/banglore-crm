/**
 * Split Scheduler
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs every 60 seconds.
 *
 * For each team where settings.autoAssign === true AND settings.splitTime is
 * set (HH:mm IST), checks if the current IST time matches. If it does and
 * the team has not already been split in this minute (lastSplitAt), it
 * auto-assigns all unassigned leads belonging to that team.
 */

import { Team } from "../models/Team.js";
import { Lead } from "../models/Lead.js";
import { User } from "../models/User.js";
import { autoSplitLeadPublic } from "./leadService.js";

const INTERVAL_MS = 60_000; // every 60 seconds

function currentISTHHMM(): string {
  return new Date().toLocaleTimeString("en-GB", {
    timeZone: "Asia/Kolkata",
    hour: "2-digit",
    minute: "2-digit",
    hour12: false,
  });
}

async function tick() {
  try {
    const nowHHMM = currentISTHHMM();
    const nowMinus1Min = new Date(Date.now() - 60_000);

    // Find teams that should split at this minute and haven't run yet
    const teams = await Team.find({
      status: "active",
      "settings.autoAssign": true,
      "settings.splitTime": nowHHMM,
      $or: [
        { "settings.lastSplitAt": null },
        { "settings.lastSplitAt": { $lt: nowMinus1Min } },
      ],
    })
      .select("_id name")
      .lean();

    if (teams.length === 0) return;

    // Resolve a real system actor for activity logs (Super Admin). The old code
    // passed the literal string "system", which is not a valid ObjectId and made
    // the activity-log write throw. Fall back to "system" only if not found.
    const systemActor = await User.findOne({ email: process.env.SUPER_ADMIN_EMAIL })
      .select("_id")
      .lean();
    const systemActorId = systemActor?._id?.toString() ?? "system";

    for (const team of teams) {
      const teamId = team._id.toString();

      // Find all unassigned leads in this team
      const unassignedLeads = await Lead.find({
        team: team._id,
        assignedTo: null,
      })
        .select("_id")
        .lean();

      if (unassignedLeads.length === 0) {
        // Still stamp lastSplitAt so we don't re-check every second within the minute
        await Team.updateOne(
          { _id: team._id },
          { $set: { "settings.lastSplitAt": new Date() } },
        );
        continue;
      }

      // Stamp first so concurrent ticks don't double-fire
      await Team.updateOne(
        { _id: team._id },
        { $set: { "settings.lastSplitAt": new Date() } },
      );

      // bypassSplitTime=true — the scheduler IS the batch trigger, so it must
      // skip the "hold until splitTime" gate (otherwise every lead is held and
      // nothing is ever assigned).
      for (const lead of unassignedLeads) {
        await autoSplitLeadPublic(teamId, lead._id.toString(), systemActorId, undefined, true);
      }

      console.log(
        `[splitScheduler] ${team.name}: assigned ${unassignedLeads.length} leads at ${nowHHMM} IST`,
      );
    }
  } catch (err) {
    console.error("[splitScheduler] tick error:", err);
  }
}

export function startSplitScheduler() {
  console.log("⏰ Split scheduler started (checks every 60 s)");
  setInterval(tick, INTERVAL_MS);
}
