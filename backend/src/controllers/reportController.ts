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
    const now = new Date();
    const monthStr =
      (req.query.month as string)?.trim() ||
      `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

    const parts = monthStr.split("-").map(Number);
    const year  = parts[0] ?? now.getFullYear();
    const mon   = parts[1] ?? now.getMonth() + 1;

    const monthStart = new Date(year, mon - 1, 1);
    const monthEnd   = new Date(year, mon, 1);

    // ── Lazy import to avoid circular deps ───────────────────────────────────
    const { User } = await import("../models/User.js");

    // Run all three aggregations in parallel
    const [users, closingsAgg, paymentAgg, callDurAgg] = await Promise.all([

      // All active users
      User.find({}).select("_id name email extension").lean(),

      // Closings per user this month — leads moved to closing status
      Lead.aggregate([
        {
          $match: {
            status:     { $in: ["booking", "partialbooking", "closed"] },
            assignedTo: { $exists: true, $ne: null },
            updatedAt:  { $gte: monthStart, $lt: monthEnd },
          },
        },
        { $group: { _id: "$assignedTo", closings: { $sum: 1 } } },
      ]),

      // Payment amounts per user this month (unwind payments subdoc)
      Lead.aggregate([
        { $match: { assignedTo: { $exists: true, $ne: null }, "payments.0": { $exists: true } } },
        { $unwind: "$payments" },
        { $match: { "payments.date": { $gte: monthStart, $lt: monthEnd } } },
        { $group: { _id: "$assignedTo", closingAmount: { $sum: "$payments.amount" } } },
      ]),

      // Total answered call seconds per agent extension this month
      CallLog.aggregate([
        {
          $match: {
            callDate:       { $gte: monthStart, $lt: monthEnd },
            callType:       { $in: ["Inbound", "Outbound"] },
            callDuration:   { $gt: 0 },
            agentExtension: { $ne: null },
          },
        },
        { $group: { _id: "$agentExtension", totalSecs: { $sum: "$callDuration" } } },
      ]),
    ]);

    // Build lookup maps
    const closingsMap  = new Map<string, number>(
      (closingsAgg as { _id: unknown; closings: number }[])
        .map((x) => [String(x._id), x.closings]),
    );
    const paymentMap   = new Map<string, number>(
      (paymentAgg as { _id: unknown; closingAmount: number }[])
        .map((x) => [String(x._id), x.closingAmount]),
    );
    const callDurMap   = new Map<string, number>(
      (callDurAgg as { _id: string; totalSecs: number }[])
        .map((x) => [x._id, x.totalSecs]),
    );

    // Combine into one entry per user
    const entries = (users as { _id: unknown; name: string; email: string; extension?: string }[])
      .map((user) => {
        const uid              = String(user._id);
        const closings         = closingsMap.get(uid)                        ?? 0;
        const closingAmount    = paymentMap.get(uid)                         ?? 0;
        const callDurationSecs = callDurMap.get(user.extension ?? "___")     ?? 0;
        const callDurationMins = Math.round(callDurationSecs / 60);

        return {
          userId:          uid,
          name:            user.name,
          email:           user.email,
          extension:       user.extension ?? null,
          closings,
          closingAmount,
          callDurationMins,
          callDurationSecs,
          callDurationHit: callDurationMins >= 100,
        };
      })
      // Remove users with zero activity so the board isn't cluttered
      .filter((e) => e.closings > 0 || e.closingAmount > 0 || e.callDurationMins > 0);

    // Sort: closings → amount → call duration
    entries.sort((a, b) => {
      if (b.closings !== a.closings)         return b.closings         - a.closings;
      if (b.closingAmount !== a.closingAmount) return b.closingAmount - a.closingAmount;
      return b.callDurationMins - a.callDurationMins;
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
