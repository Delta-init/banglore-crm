import webpush from "web-push";
import { PushSubscription } from "../models/PushSubscription.js";
import { env } from "../config/env.js";

// ── Configure VAPID once ──────────────────────────────────────────────────────
webpush.setVapidDetails(
  env.VAPID_SUBJECT,
  env.VAPID_PUBLIC_KEY,
  env.VAPID_PRIVATE_KEY
);

export interface PushPayload {
  title: string;
  body: string;
  icon?: string;
  badge?: string;
  tag?: string;
  url?: string;
  data?: Record<string, unknown>;
}

// ── Send push to a single user ────────────────────────────────────────────────
export async function sendPushToUser(userId: string, payload: PushPayload): Promise<void> {
  const subs = await PushSubscription.find({ userId });
  if (!subs.length) return;

  const json = JSON.stringify(payload);

  await Promise.allSettled(
    subs.map(async (sub) => {
      try {
        await webpush.sendNotification(
          { endpoint: sub.endpoint, keys: sub.keys },
          json
        );
      } catch (err: unknown) {
        // 404 / 410 = subscription gone, remove it
        const code = (err as { statusCode?: number }).statusCode;
        if (code === 404 || code === 410) {
          await PushSubscription.deleteOne({ _id: sub._id });
        }
      }
    })
  );
}

// ── Send push to multiple users ───────────────────────────────────────────────
export async function sendPushToUsers(userIds: string[], payload: PushPayload): Promise<void> {
  await Promise.allSettled(userIds.map((uid) => sendPushToUser(uid, payload)));
}

/** Notify a user that a lead was assigned to them. Fire-and-forget. */
export async function notifyLeadAssignment(
  assignedUserId: string,
  leadId: string,
  leadName: string,
  emitFn: (userId: string, event: string, payload: object) => void,
): Promise<void> {
  const payload = {
    title: "New Lead Assigned",
    body: `You have been assigned: ${leadName}`,
    tag: `lead-assigned-${leadId}`,
    url: `/leads/${leadId}`,
    data: { type: "lead_assigned", leadId },
  };
  emitFn(assignedUserId, "notification", {
    ...payload,
    createdAt: new Date().toISOString(),
  });
  await sendPushToUser(assignedUserId, payload);
}

/** Notify a user about multiple leads assigned to them (bulk). */
export async function notifyBulkLeadAssignment(
  assignedUserId: string,
  count: number,
  emitFn: (userId: string, event: string, payload: object) => void,
): Promise<void> {
  const payload = {
    title: `${count} Lead${count !== 1 ? "s" : ""} Assigned`,
    body: `${count} lead${count !== 1 ? "s have" : " has"} been assigned to you`,
    tag: `bulk-assigned-${assignedUserId}`,
    url: `/leads`,
    data: { type: "lead_assigned", count },
  };
  emitFn(assignedUserId, "notification", {
    ...payload,
    createdAt: new Date().toISOString(),
  });
  await sendPushToUser(assignedUserId, payload);
}

/**
 * Tell a counsellor that finance sent one of their enrolments back.
 *
 * The one thing on the enrolments screen that is waiting on *them*, so it is
 * the one thing worth interrupting them about. The reason travels in the body:
 * "sent back" on its own only prompts the question this is meant to answer.
 *
 * Fire-and-forget, and it must stay that way — this runs inside a background
 * sweep, and a push that fails is not a reason to stop recording what finance
 * decided.
 */
export async function notifyEnrolmentReturned(
  userId: string,
  studentId: string,
  studentName: string,
  reason: string,
): Promise<void> {
  const payload: PushPayload = {
    title: "An enrolment was sent back",
    body: reason
      ? `${studentName}: ${reason}`
      : `${studentName} — finance gave no reason. Ask them before resending.`,
    // Keyed on the enrolment, so a second send-back replaces the first notice
    // rather than stacking another one beside it.
    tag: `enrolment-returned-${studentId}`,
    url: "/enrolments",
    data: { type: "enrolment_returned", studentId },
  };

  try {
    const { emitToUser } = await import("../socket.js");
    emitToUser(userId, "notification", { ...payload, createdAt: new Date().toISOString() });
  } catch {
    // No socket server in this process; the push below is the message.
  }
  await sendPushToUser(userId, payload);
}
