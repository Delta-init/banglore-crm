/**
 * Split Scheduler
 * ─────────────────────────────────────────────────────────────────────────────
 * Runs every 60 seconds.
 *
 * For each team where settings.autoAssign === true AND settings.splitTime is
 * set (HH:mm IST), auto-assigns all unassigned leads belonging to that team
 * once per day, at or after that team's split time.
 *
 * A team is "due" when BOTH hold:
 *   1. now >= today's splitTime instant (IST), and
 *   2. settings.lastSplitAt is before that same instant (i.e. today's window
 *      has not been handled yet).
 *
 * This deliberately does NOT require a tick to land inside the exact splitTime
 * minute. setInterval drifts, and a restart or redeploy spanning that minute
 * used to skip the batch for the entire day with no retry. With the window
 * check above, a missed minute is picked up by the next tick instead — still
 * exactly one split per day. The tradeoff: if the server is down at splitTime
 * and comes back up later, the missed batch fires on the next tick rather than
 * being skipped until tomorrow.
 */

import { Team } from "../models/Team.js";
import { Lead } from "../models/Lead.js";
import { User } from "../models/User.js";
import { autoSplitLeadPublic } from "./leadService.js";

const INTERVAL_MS = 60_000; // every 60 seconds

// IST wall-clock HH:mm, computed with fixed +5:30 arithmetic.
//
// Do NOT use toLocaleTimeString({ timeZone: "Asia/Kolkata" }) here: that relies
// on full ICU data being present in the runtime. On a small-icu build the
// timeZone option is silently ignored and it falls back to the SERVER's local
// timezone — on a UTC+4 host that made every batch fire 1h30m early/late.
// India has no DST, so the fixed offset is exact. This also matches the +5:30
// math used by teamService.getUpcomingBatch(), so the UI countdown and the
// actual fire time now agree.
const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000;

function currentISTHHMM(): string {
  const ist = new Date(Date.now() + IST_OFFSET_MS);
  const hh = String(ist.getUTCHours()).padStart(2, "0");
  const mm = String(ist.getUTCMinutes()).padStart(2, "0");
  return `${hh}:${mm}`;
}

/**
 * Today's split instant for an "HH:mm" IST wall-clock time, returned as a UTC
 * Date. Uses the same fixed +5:30 math as teamService.getUpcomingBatch() so the
 * UI countdown and the actual fire time refer to the same instant.
 * Returns null if splitTime is malformed.
 */
function istSplitInstantUTC(splitTime: string, nowMs: number): Date | null {
  const m = /^(\d{1,2}):(\d{2})$/.exec(splitTime.trim());
  if (!m) return null;
  const hh = Number(m[1]);
  const mm = Number(m[2]);
  if (hh > 23 || mm > 59) return null;

  const ist = new Date(nowMs + IST_OFFSET_MS);
  const splitIST = Date.UTC(
    ist.getUTCFullYear(),
    ist.getUTCMonth(),
    ist.getUTCDate(),
    hh,
    mm,
    0,
    0,
  );
  return new Date(splitIST - IST_OFFSET_MS);
}

async function tick() {
  try {
    const nowMs = Date.now();

    // Fetch every candidate team, then decide in JS whether it is due.
    //
    // The old query matched settings.splitTime against the current HH:mm string
    // exactly, which meant the batch only ran if a tick happened to land inside
    // that one specific minute. setInterval drifts (each tick's awaited work
    // pushes the next one later), and a restart/redeploy/downtime spanning that
    // minute skipped it outright — the batch then silently never ran that day.
    //
    // Instead: fire when NOW is at or past today's split instant AND we have not
    // already split for today's window. That is still exactly one split per day,
    // but it self-heals a missed minute instead of losing the whole day.
    // A team is a candidate if EITHER the legacy single time OR the multi-time
    // array is set. Effective times are resolved per-team below.
    const candidates = await Team.find({
      status: "active",
      "settings.autoAssign": true,
      $or: [
        { "settings.splitTime": { $nin: [null, ""] } },
        { "settings.splitTimes.0": { $exists: true } },
      ],
    })
      .select("_id name settings.splitTime settings.splitTimes settings.lastSplitAt")
      .lean();

    const teams = candidates.filter((t) => {
      const settings = (t as unknown as {
        settings?: { splitTime?: string | null; splitTimes?: string[]; lastSplitAt?: Date | null };
      }).settings;

      // Effective times: the multi-time array wins; else the legacy single time.
      const times = (settings?.splitTimes?.length ? settings.splitTimes : (settings?.splitTime ? [settings.splitTime] : []));
      if (times.length === 0) return false;

      // Latest split instant that has already passed today, across all times.
      // Firing against the most-recent passed window means several overdue
      // windows (e.g. after downtime) collapse into a single catch-up split.
      let latestDue = -Infinity;
      for (const time of times) {
        const fireAt = istSplitInstantUTC(time, nowMs);
        if (!fireAt) {
          console.warn(`[splitScheduler] ${t.name}: invalid split time "${time}" — skipped`);
          continue;
        }
        const ms = fireAt.getTime();
        if (ms <= nowMs && ms > latestDue) latestDue = ms;
      }
      if (latestDue === -Infinity) return false; // no window has passed yet today

      // Already split for (or after) that window.
      const lastSplitAt = settings?.lastSplitAt;
      if (lastSplitAt && new Date(lastSplitAt).getTime() >= latestDue) return false;

      return true;
    });

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
        // Still stamp lastSplitAt so today's window counts as handled
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
        `[splitScheduler] ${team.name}: assigned ${unassignedLeads.length} leads at ${currentISTHHMM()} IST`,
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
