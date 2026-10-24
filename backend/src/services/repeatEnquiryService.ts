import { Types } from "mongoose";
import { Lead } from "../models/Lead.js";
import { User } from "../models/User.js";
import { sendPushToUser } from "./pushService.js";
import { emitToUser } from "../socket.js";

/** This CRM keeps no bell records: the live notice on the socket (the bell, the sound) and the phone. */
async function notify(n: { userIds: string[]; type: string; title: string; body: string; url: string; tag: string; data?: Record<string, unknown> }) {
  const payload = { title: n.title, body: n.body, tag: n.tag, url: n.url, data: { type: n.type, ...(n.data ?? {}) } };
  for (const id of n.userIds) {
    emitToUser(id, "notification", { ...payload, createdAt: new Date().toISOString() });
    await sendPushToUser(id, payload).catch(() => null);
  }
}

/*
 * A lead that comes in again (the user, 2026-10-23: "when any duplicate lead comes into the sales portal it needs to be
 * assigned to whoever is managing the lead — he gets it again, as a new one"). Until now a number already in the CRM
 * was skipped (sheets, Root), refused (Excel) or entered a second time (by hand), and its holder never knew.
 *
 * The same lead, never a second copy — its notes, calls and history stay:
 *   - an open or lost lead whose holder is still active goes back to that holder as a new lead: status Assigned, today's
 *     date (the first one kept in originalCreatedAt, as a hand-over keeps it), a "came in again" notice in the bell, on
 *     the phone and with the new-lead sound;
 *   - nobody holds it, or the holder is deactivated: split in its team like a new lead (or to a team, when it has none);
 *   - a closed or booked lead (a student, a booking or part-booking) keeps its status — the holder is told the client
 *     enquired again;
 *   - the same number again within the hour (a row sent twice): only noted in its history.
 * Each time counts on the lead (repeatCount, lastRepeatAt): the "Came in again" tag and filter.
 *
 * Numbers match on their last 9 digits, as the 3CX lookup and Root's router match them — "+971 50 123 4567",
 * "0501234567" and "971501234567" are one person. Email isn't used: a family can share one.
 */

export const PHONE_TAIL = 9;
/** A second arrival this soon after the last is the same enquiry sent twice. */
export const REPEAT_QUIET_MS = 60 * 60_000;

const digits = (v: unknown) => String(v ?? "").replace(/\D/g, "");
/** The last 9 digits of a number, or "" when it has fewer. */
export const phoneTail = (v: unknown) => { const d = digits(v); return d.length >= PHONE_TAIL ? d.slice(-PHONE_TAIL) : ""; };
/** Every number in a lead's phone field (it can hold several: "050… / 055…"), as last-9 tails. */
const tailsOf = (field: unknown) => new Set(String(field ?? "").split(/[/,;|\n]+/).map(phoneTail).filter(Boolean));
const SEP = "[\\s\\-.()]*";

type LeadLike = {
  _id: Types.ObjectId; name?: string; phone?: string; status?: string; source?: string;
  assignedTo?: Types.ObjectId | null; team?: Types.ObjectId | null; createdAt?: Date; updatedAt?: Date;
  lastRepeatAt?: Date | null; repeatCount?: number;
};

/**
 * The lead already holding this number, or null. A copy marked "repeated" (one entered twice before) is the last
 * choice; otherwise the one worked on most recently.
 */
export async function findLeadByPhone(raw: unknown): Promise<LeadLike | null> {
  const phone = String(raw ?? "").trim();
  const tail = phoneTail(phone);
  if (!tail) return phone ? Lead.findOne({ phone }).lean<LeadLike>() : null;
  const pattern = `${tail.split("").join(SEP)}(?!${SEP}\\d)`;
  const found = await Lead.find({ phone: { $regex: pattern } })
    .select("name phone status source assignedTo team createdAt updatedAt lastRepeatAt repeatCount")
    .limit(50).lean<LeadLike[]>();
  const same = found.filter((l) => tailsOf(l.phone).has(tail));
  same.sort((a, b) => Number(a.status === "repeated") - Number(b.status === "repeated")
    || new Date(b.updatedAt ?? 0).getTime() - new Date(a.updatedAt ?? 0).getTime());
  return same[0] ?? null;
}

export type RepeatOutcome = "back_to_holder" | "resplit" | "closed_client" | "same_enquiry";
export interface RepeatResult { outcome: RepeatOutcome; leadId: string; holderId: string | null; holderName: string | null; times: number }

const LABEL: Record<string, string> = {
  new: "New", assigned: "Assigned", pending_response: "Pending response", followup: "Follow Up", closed: "Closed",
  lost: "Lost", not_connected: "Not connected", mia: "MIA", repeated: "Repeated", callback: "Callback", cnc: "CNC",
  booking: "Booking", partialbooking: "Partial booking",
};
const ordinal = (n: number) => `${n}${n % 100 >= 11 && n % 100 <= 13 ? "th" : ["th", "st", "nd", "rd"][n % 10] ?? "th"}`;
const sourceText = (s?: string | null) => (s?.trim() ? ` from ${s.trim().toUpperCase()}` : "");

/**
 * The lead came in again. `via` and `source` say how (the sheet, Root, an upload, someone adding it); `by` is who
 * added it by hand, if anyone. `split` places a lead with no active holder — the caller's own split (the sheets pass
 * the team auto-assign), so this file needs nothing of the lead service.
 */
export async function repeatEnquiry(
  lead: LeadLike,
  opts: {
    via: "sheet" | "upload" | "manual";
    source?: string | null;
    by?: string | null;
    now?: Date;
    split: (leadId: string, teamId: string | null) => Promise<unknown>;
  },
): Promise<RepeatResult> {
  const now = opts.now ?? new Date();
  const id = String(lead._id);
  const holder = lead.assignedTo
    ? await User.findById(lead.assignedTo).select("name status").lean<{ _id: Types.ObjectId; name?: string; status?: string }>()
    : null;
  const holderActive = !!holder && holder.status === "active";
  const holderName = holder?.name ?? null;
  const performedBy = opts.by && Types.ObjectId.isValid(opts.by) ? { performedBy: new Types.ObjectId(opts.by) } : {};
  const times = (lead.repeatCount ?? 0) + 2; // the first time, then each repeat: this one is the (count + 2)th
  const how = `${sourceText(opts.source ?? lead.source)}${opts.via === "manual" ? " (added again by hand)" : opts.via === "upload" ? " (in an upload)" : ""}`;
  const log = (description: string) => ({ action: "lead_updated", description: description.slice(0, 500), ...performedBy, createdAt: now });

  // The same enquiry sent twice: noted, nothing moves, nobody is pinged again.
  const last = Math.max(new Date(lead.lastRepeatAt ?? 0).getTime(), new Date(lead.createdAt ?? 0).getTime());
  if (now.getTime() - last < REPEAT_QUIET_MS) {
    await Lead.collection.updateOne({ _id: lead._id }, { $push: { activityLogs: log(`Came in again${how} within the hour — kept as it is`) } as never });
    return { outcome: "same_enquiry", leadId: id, holderId: holder ? String(holder._id) : null, holderName, times: (lead.repeatCount ?? 0) + 1 };
  }

  const counted = { $inc: { repeatCount: 1 }, $set: { lastRepeatAt: now } };

  // A student already, or booked: the status stays; their salesperson hears of it.
  if (lead.status === "closed" || lead.status === "booking" || lead.status === "partialbooking") {
    await Lead.collection.updateOne({ _id: lead._id }, {
      ...counted,
      $push: { activityLogs: log(`Came in again${how} (${ordinal(times)} time) — already ${LABEL[lead.status ?? ""]?.toLowerCase() ?? "closed"}, status kept`) } as never,
    });
    if (holderActive) {
      await notify({
        userIds: [String(holder!._id)], type: "lead_assigned",
        title: "Your client enquired again", body: `${lead.name || "A client"} came in again${sourceText(opts.source ?? lead.source)} (${ordinal(times)} time)`,
        url: `/leads/${id}`, tag: `lead-again-${id}-${now.getTime()}`, data: { leadId: id, repeat: true },
      }).catch(() => null);
    }
    return { outcome: "closed_client", leadId: id, holderId: holder ? String(holder._id) : null, holderName, times };
  }

  const was = LABEL[lead.status ?? ""] ?? lead.status ?? "—";
  // Fresh again: today's lead, its first date kept once (as a hand-over keeps it). Straight to the collection, so the
  // model's hooks don't run over it; what a status change would clear is cleared here.
  const fresh = {
    originalCreatedAt: { $ifNull: ["$originalCreatedAt", "$createdAt"] },
    createdAt: now, lastRepeatAt: now, repeatCount: { $add: [{ $ifNull: ["$repeatCount", 0] }, 1] },
    lostReason: null, lostNotes: null,
  };

  if (holderActive) {
    await Lead.collection.updateOne({ _id: lead._id }, [{ $set: { ...fresh, status: "assigned", assignedAt: now } }]);
    await Lead.collection.updateOne({ _id: lead._id }, {
      $push: { activityLogs: log(`Came in again${how} (${ordinal(times)} time) — back to ${holderName ?? "its holder"} as a new lead (was ${was})`) } as never,
    });
    await notify({
      userIds: [String(holder!._id)], type: "lead_assigned",
      title: "Lead came in again", body: `${lead.name || "A lead"} came in again${sourceText(opts.source ?? lead.source)} (${ordinal(times)} time) — it's in your leads as new`,
      url: `/leads/${id}`, tag: `lead-again-${id}-${now.getTime()}`, data: { leadId: id, repeat: true },
    }).catch(() => null);
    return { outcome: "back_to_holder", leadId: id, holderId: String(holder!._id), holderName, times };
  }

  // Nobody to give it back to: a new lead in its team (or for a team), split as any other.
  await Lead.collection.updateOne({ _id: lead._id }, [{ $set: { ...fresh, status: "new", assignedTo: null, assignedAt: null } }]);
  await Lead.collection.updateOne({ _id: lead._id }, {
    $push: { activityLogs: log(`Came in again${how} (${ordinal(times)} time) — ${holder ? `${holderName ?? "its holder"} is no longer active` : "nobody held it"}, split as a new lead (was ${was})`) } as never,
  });
  try {
    await opts.split(id, lead.team ? String(lead.team) : null);
  } catch (err) {
    console.error("[repeatEnquiry] split failed:", err instanceof Error ? err.message : err);
  }
  const after = await Lead.findById(lead._id).select("assignedTo").populate("assignedTo", "name").lean<{ assignedTo?: { _id: Types.ObjectId; name?: string } | null }>();
  return { outcome: "resplit", leadId: id, holderId: after?.assignedTo ? String(after.assignedTo._id) : null, holderName: after?.assignedTo?.name ?? null, times };
}

/** The usual split for a lead that came in again with nobody to give it to: in its team, else to a team. */
export function splitAgainAs(by: string) {
  return async (leadId: string, teamId: string | null) => {
    const { LeadService, autoSplitLeadPublic } = await import("./leadService.js");
    if (teamId) await autoSplitLeadPublic(teamId, leadId, by);
    else await new LeadService().autoAssignLeads([leadId]);
  };
}

/** A sentence for whoever sent it: the sheet, Root, the upload summary, the person adding it. */
export function repeatMessage(r: RepeatResult): string {
  switch (r.outcome) {
    case "back_to_holder": return `Already in the CRM — given back to ${r.holderName ?? "its holder"} as a new lead`;
    case "resplit": return `Already in the CRM — split again${r.holderName ? ` to ${r.holderName}` : ""} (its holder is no longer active)`;
    case "closed_client": return `Already a client — ${r.holderName ?? "their salesperson"} was told they enquired again`;
    default: return "Already in the CRM — came in again within the hour, kept as it is";
  }
}
