import type { Response, NextFunction } from "express";
import axios from "axios";
import type { AuthenticatedRequest } from "../types/index.js";
import { sendSuccess, sendError } from "../utils/response.js";
import { User } from "../models/User.js";

/**
 * "My Daily Tracker" — this CRM's window onto the Root portal's tracker.
 *
 * The figures live in the portal, not here, so managers see one set of numbers
 * whether a rep files from the portal or from inside their own CRM. This
 * endpoint is a thin proxy: it takes the identity from this server's own
 * session and never from the request body, so a rep cannot file against a
 * colleague by editing what the browser sends.
 */
const portal = () => {
  const base = process.env.ROOT_ERP_API_URL;
  const secret = process.env.ROOT_ORG_SECRET;
  if (!base || !secret) return null;
  return { base: base.replace(/\/+$/, ""), secret };
};

const unavailable = (res: Response) =>
  sendError(
    res,
    "The daily tracker is not configured on this server. Set ROOT_ERP_API_URL and ROOT_ORG_SECRET.",
    503,
  );

export const getMyTracker = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const cfg = portal();
  if (!cfg) {
    unavailable(res);
    return;
  }

  try {
    const { data } = await axios.get(`${cfg.base}/api/v1/service/tracker/me`, {
      params: { userId: req.user!.userId, date: req.query.date },
      headers: { "x-org-secret": cfg.secret },
      timeout: 15000,
    });
    sendSuccess(res, "My tracker", data.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      const message =
        (error.response?.data as { message?: string } | undefined)?.message ??
        "Could not reach the Root portal";
      sendError(res, message, status === 500 ? 502 : status);
      return;
    }
    next(error);
  }
};

export const saveMyTracker = async (
  req: AuthenticatedRequest,
  res: Response,
  next: NextFunction,
): Promise<void> => {
  const cfg = portal();
  if (!cfg) {
    unavailable(res);
    return;
  }

  const { date, metrics, texts } = req.body as {
    date?: string;
    metrics?: Record<string, number>;
    texts?: Record<string, string>;
  };

  if (!date) {
    sendError(res, "date is required", 400);
    return;
  }

  try {
    const user = await User.findById(req.user!.userId).select("name");
    const { data } = await axios.put(
      `${cfg.base}/api/v1/service/tracker/me`,
      {
        userId: req.user!.userId,
        userName: user?.name ?? "",
        date,
        metrics: metrics ?? {},
        texts: texts ?? {},
      },
      { headers: { "x-org-secret": cfg.secret }, timeout: 15000 },
    );
    sendSuccess(res, "Saved", data.data);
  } catch (error) {
    if (axios.isAxiosError(error)) {
      const status = error.response?.status ?? 502;
      const message =
        (error.response?.data as { message?: string } | undefined)?.message ??
        "Could not reach the Root portal";
      sendError(res, message, status === 500 ? 502 : status);
      return;
    }
    next(error);
  }
};
