import type { Response, NextFunction } from "express";
import type { AuthenticatedRequest } from "../types/index.js";
import { ReportService } from "../services/reportService.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { Lead } from "../models/Lead.js";
import { CallLog } from "../models/CallLog.js";

const svc = new ReportService();

// ── Helpers ───────────────────────────────────────────────────────────────────

function getDateParams(query: Record<string, string>) {
  const dateFrom = query.dateFrom?.trim() || undefined;
  const dateTo   = query.dateTo?.trim()   || undefined;
  return { dateFrom, dateTo };
}

// ── Controllers ───────────────────────────────────────────────────────────────

/** GET /api/reports/overview?dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD */
export const getOverview = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { dateFrom, dateTo } = getDateParams(req.query as Record<string, string>);
    const data = await svc.getOverview(dateFrom, dateTo);
    sendSuccess(res, "Overview fetched successfully", data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/timeline
 * ?period=daily|weekly|monthly&dateFrom=YYYY-MM-DD&dateTo=YYYY-MM-DD
 */
export const getTimeline = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = req.query as Record<string, string>;
    const period = (q.period || "daily") as "daily" | "weekly" | "monthly";

    if (!["daily", "weekly", "monthly"].includes(period)) {
      sendError(res, "period must be daily, weekly, or monthly", 400);
      return;
    }

    const { dateFrom, dateTo } = getDateParams(q);
    const data = await svc.getTimeline(period, dateFrom, dateTo);
    sendSuccess(res, "Timeline fetched successfully", data);
  } catch (err) {
    next(err);
  }
};

/** GET /api/reports/users?dateFrom=...&dateTo=...&limit=20 */
export const getUserRankings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q     = req.query as Record<string, string>;
    const limit = Math.min(parseInt(q.limit || "20", 10), 50);
    const { dateFrom, dateTo } = getDateParams(q);
    const data = await svc.getUserRankings(dateFrom, dateTo, limit);
    sendSuccess(res, "User rankings fetched successfully", data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/team-split
 * ?period=daily|weekly|monthly|yearly&dateFrom=...&dateTo=...
 */
export const getTeamSplit = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q      = req.query as Record<string, string>;
    const period = (q.period || "monthly") as "daily" | "weekly" | "monthly" | "yearly";

    if (!["daily","weekly","monthly","yearly"].includes(period)) {
      sendError(res, "period must be daily, weekly, monthly, or yearly", 400);
      return;
    }

    const { dateFrom, dateTo } = getDateParams(q);
    const data = await svc.getTeamSplit(period, dateFrom, dateTo);
    sendSuccess(res, "Team split fetched successfully", data);
  } catch (err) {
    next(err);
  }
};

/** GET /api/reports/teams?dateFrom=...&dateTo=... */
export const getTeamRankings = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { dateFrom, dateTo } = getDateParams(req.query as Record<string, string>);
    const data = await svc.getTeamRankings(dateFrom, dateTo);
    sendSuccess(res, "Team rankings fetched successfully", data);
  } catch (err) {
    next(err);
  }
};

// ── Revenue controllers ───────────────────────────────────────────────────────

/** GET /api/reports/revenue/overview?dateFrom=&dateTo= */
export const getRevenueOverview = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { dateFrom, dateTo } = getDateParams(req.query as Record<string, string>);
    const data = await svc.getRevenueOverview(dateFrom, dateTo);
    sendSuccess(res, "Revenue overview fetched successfully", data);
  } catch (err) {
    next(err);
  }
};

/**
 * GET /api/reports/revenue/timeline
 * ?period=daily|weekly|monthly|yearly&dateFrom=&dateTo=
 */
export const getRevenueTimeline = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q      = req.query as Record<string, string>;
    const period = (q.period || "monthly") as "daily" | "weekly" | "monthly" | "yearly";

    if (!["daily","weekly","monthly","yearly"].includes(period)) {
      sendError(res, "period must be daily, weekly, monthly, or yearly", 400);
      return;
    }

    const { dateFrom, dateTo } = getDateParams(q);
    const data = await svc.getRevenueTimeline(period, dateFrom, dateTo);
    sendSuccess(res, "Revenue timeline fetched successfully", data);
  } catch (err) {
    next(err);
  }
};

/** GET /api/reports/sources?dateFrom=&dateTo=&team= */
export const getSourceAnalytics = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q = req.query as Record<string, string>;
    const { dateFrom, dateTo } = getDateParams(q);
    const teamId = q.team?.trim() || undefined;
    const data = await svc.getSourceAnalytics(dateFrom, dateTo, teamId);
    sendSuccess(res, "Source analytics fetched successfully", data);
  } catch (err) {
    next(err);
  }
};

/** GET /api/reports/sources/:source/campaigns?dateFrom=&dateTo= */
export const getSourceCampaigns = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const q      = req.query as Record<string, string>;
    const source = req.params.source?.trim();
    if (!source) {
      sendError(res, "source param is required", 400);
      return;
    }
    const { dateFrom, dateTo } = getDateParams(q);
    const data = await svc.getSourceCampaigns(source, dateFrom, dateTo);
    sendSuccess(res, "Campaign breakdown fetched successfully", data);
  } catch (err) {
    next(err);
  }
};

/** GET /api/reports/revenue/teams?dateFrom=&dateTo= */
export const getRevenueTeams = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const { dateFrom, dateTo } = getDateParams(req.query as Record<string, string>);
    const data = await svc.getRevenueTeams(dateFrom, dateTo);
    sendSuccess(res, "Revenue teams fetched successfully", data);
  } catch (err) {
    next(err);
  }
};

// ── GET /api/v1/reports/leaderboard?month=YYYY-MM ────────────────────────────
// Returns all users ranked by closings, closing amount, and call duration
// for the specified month (defaults to current month).

export const getLeaderboard = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  try {
    const IST_OFFSET_MS = 5.5 * 60 * 60 * 1000; // UTC+5:30
    const nowIST = new Date(Date.now() + IST_OFFSET_MS);
    const monthStr =
      (req.query.month as string)?.trim() ||
      `${nowIST.getUTCFullYear()}-${String(nowIST.getUTCMonth() + 1).padStart(2, "0")}`;

    const parts = monthStr.split("-").map(Number);
    const year  = parts[0] ?? nowIST.getUTCFullYear();
    const mon   = parts[1] ?? nowIST.getUTCMonth() + 1;

    // IST month boundaries expressed as UTC timestamps
    const monthStart = new Date(Date.UTC(year, mon - 1, 1) - IST_OFFSET_MS);
    const monthEnd   = new Date(Date.UTC(year, mon,     1) - IST_OFFSET_MS);

    // IST today boundaries (midnight → midnight) expressed as UTC timestamps
    const todayStart = new Date(
      Date.UTC(nowIST.getUTCFullYear(), nowIST.getUTCMonth(), nowIST.getUTCDate()) - IST_OFFSET_MS,
    );
    const todayEnd = new Date(todayStart.getTime() + 24 * 60 * 60 * 1000);

    // ── Lazy import to avoid circular deps ───────────────────────────────────
    const { User } = await import("../models/User.js");

    // Run all aggregations in parallel
    const [users, closingsAgg, paymentAgg, callDurAgg, statusAgg, callDurTodayAgg] = await Promise.all([

      // All active users
      User.find({ status: "active" }).select("_id name email extension").lean(),

      // Closings per user this month — uses closedAt (set exactly when status
      // transitions into booking/partialbooking/closed) so that any other update
      // to the lead (call logged, note added, etc.) does NOT shift the lead into
      // a different month's count.
      Lead.aggregate([
        {
          $match: {
            status:     { $in: ["booking", "partialbooking", "closed"] },
            assignedTo: { $exists: true, $ne: null },
            closedAt:   { $gte: monthStart, $lt: monthEnd },
          },
        },
        { $group: { _id: "$assignedTo", closings: { $sum: 1 } } },
      ]),

      // Payment amounts per user this month
      Lead.aggregate([
        { $match: { assignedTo: { $exists: true, $ne: null }, "payments.0": { $exists: true } } },
        { $unwind: "$payments" },
        { $match: { "payments.date": { $gte: monthStart, $lt: monthEnd } } },
        { $group: { _id: "$assignedTo", closingAmount: { $sum: "$payments.amount" } } },
      ]),

      // Call count + total call seconds per assigned user this month.
      // Counts ALL inbound/outbound calls; only connected calls (duration > 0)
      // contribute to totalSecs. Attributed via leadId → Lead.assignedTo.
      CallLog.aggregate([
        {
          $match: {
            callDate: { $gte: monthStart, $lt: monthEnd },
            callType: { $in: ["Inbound", "Outbound"] },
            leadId:   { $ne: null },
          },
        },
        {
          $lookup: {
            from:         "leads",
            localField:   "leadId",
            foreignField: "_id",
            as:           "lead",
            pipeline:     [{ $project: { assignedTo: 1 } }],
          },
        },
        { $unwind: "$lead" },
        { $match: { "lead.assignedTo": { $exists: true, $ne: null } } },
        {
          $group: {
            _id:       "$lead.assignedTo",
            totalSecs: { $sum: { $cond: [{ $gt: ["$callDuration", 0] }, "$callDuration", 0] } },
            callCount: { $sum: 1 },
          },
        },
      ]),

      // All-time lead status counts per assigned user
      Lead.aggregate([
        { $match: { assignedTo: { $exists: true, $ne: null } } },
        { $group: { _id: { user: "$assignedTo", status: "$status" }, count: { $sum: 1 } } },
      ]),

      // Call count + seconds per assigned user for TODAY (IST midnight → now)
      CallLog.aggregate([
        {
          $match: {
            callDate: { $gte: todayStart, $lt: todayEnd },
            callType: { $in: ["Inbound", "Outbound"] },
            leadId:   { $ne: null },
          },
        },
        {
          $lookup: {
            from:         "leads",
            localField:   "leadId",
            foreignField: "_id",
            as:           "lead",
            pipeline:     [{ $project: { assignedTo: 1 } }],
          },
        },
        { $unwind: "$lead" },
        { $match: { "lead.assignedTo": { $exists: true, $ne: null } } },
        {
          $group: {
            _id:       "$lead.assignedTo",
            totalSecs: { $sum: { $cond: [{ $gt: ["$callDuration", 0] }, "$callDuration", 0] } },
            callCount: { $sum: 1 },
          },
        },
      ]),
    ]);

    // Build lookup maps
    const closingsMap = new Map<string, number>(
      (closingsAgg as { _id: unknown; closings: number }[])
        .map((x) => [String(x._id), x.closings]),
    );
    const paymentMap = new Map<string, number>(
      (paymentAgg as { _id: unknown; closingAmount: number }[])
        .map((x) => [String(x._id), x.closingAmount]),
    );
    const callDurMap = new Map<string, { totalSecs: number; callCount: number }>(
      (callDurAgg as { _id: string; totalSecs: number; callCount: number }[])
        .map((x) => [String(x._id), { totalSecs: x.totalSecs, callCount: x.callCount }]),
    );
    const callDurTodayMap = new Map<string, { totalSecs: number; callCount: number }>(
      (callDurTodayAgg as { _id: string; totalSecs: number; callCount: number }[])
        .map((x) => [String(x._id), { totalSecs: x.totalSecs, callCount: x.callCount }]),
    );

    // Build status counts map: userId → { status → count }
    const statusCountsMap = new Map<string, Record<string, number>>();
    for (const row of statusAgg as { _id: { user: unknown; status: string }; count: number }[]) {
      const uid = String(row._id.user);
      if (!statusCountsMap.has(uid)) statusCountsMap.set(uid, {});
      statusCountsMap.get(uid)![row._id.status] = row.count;
    }

    // Combine into one entry per user — ALL users shown, even 0-activity ones
    const entries = (users as { _id: unknown; name: string; email: string; extension?: string }[])
      .map((user) => {
        const uid              = String(user._id);
        const closings         = closingsMap.get(uid)                    ?? 0;
        const closingAmount    = paymentMap.get(uid)                     ?? 0;
        const callStats             = callDurMap.get(uid)      ?? { totalSecs: 0, callCount: 0 };
        const callStatsToday        = callDurTodayMap.get(uid) ?? { totalSecs: 0, callCount: 0 };
        const callDurationSecs      = callStats.totalSecs;
        const callDurationMins      = Math.round(callDurationSecs / 60);
        const callCount             = callStats.callCount;
        const callDurationMinsToday = Math.round(callStatsToday.totalSecs / 60);
        const callCountToday        = callStatsToday.callCount;
        const statusCounts          = statusCountsMap.get(uid) ?? {};
        const totalLeads            = Object.values(statusCounts).reduce((s, n) => s + n, 0);

        return {
          userId:               uid,
          name:                 user.name,
          email:                user.email,
          extension:            user.extension ?? null,
          closings,
          closingAmount,
          callCount,
          callDurationMins,
          callDurationSecs,
          callDurationHit:      callDurationMins >= 100,
          callCountToday,
          callDurationMinsToday,
          callDurationHitToday: callDurationMinsToday >= 20,
          // All-time lead status breakdown
          totalLeads,
          leadCounts:           statusCounts,
        };
      })
      // Only show users who have at least 1 assigned lead; hide specific accounts
      .filter((e) => e.totalLeads > 0 && e.email !== "safvan@gmail.com");

    // Sort: revenue → closings → call duration → followup → call count
    entries.sort((a, b) => {
      if (b.closingAmount    !== a.closingAmount)    return b.closingAmount    - a.closingAmount;
      if (b.closings         !== a.closings)         return b.closings         - a.closings;
      if (b.callDurationMins !== a.callDurationMins) return b.callDurationMins - a.callDurationMins;
      if ((b.leadCounts.followup ?? 0) !== (a.leadCounts.followup ?? 0))
        return (b.leadCounts.followup ?? 0) - (a.leadCounts.followup ?? 0);
      return b.callCount - a.callCount;
    });

    // Assign ranks
    const ranked = entries.map((e, i) => ({ ...e, rank: i + 1 }));

    sendSuccess(res, "Leaderboard fetched", {
      month:     monthStr,
      updatedAt: new Date().toISOString(),
      entries:   ranked,
    });
  } catch (err) {
    next(err);
  }
};
