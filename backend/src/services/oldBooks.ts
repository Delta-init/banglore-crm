import { Types } from "mongoose";
import { env } from "../config/env.js";
import { OldBooksSale } from "../models/OldBooksSale.js";
import { Team } from "../models/Team.js";
import { User } from "../models/User.js";
import { fetchOldBooksPayments, type OldBooksInvoice } from "./financeClient.js";

/*
 * Finance's old books counted for their salesperson (the user, 2026-11-25: "why the old books is not showing in the
 * sales CRM and Manager TV" — then: counted, "November onwards", in every CRM and Root).
 *
 * The old books are the invoices imported into finance from the previous system: sales from before the CRMs, still
 * paid off in instalments. No lead here points at them, so nothing here ever counted them. Every ten minutes finance
 * is asked for the old-books invoices with money paid on or after OLD_BOOKS_FROM; each whose salesperson's email is
 * one of this CRM's users is kept (OldBooksSale), and each payment from OLD_BOOKS_FROM on counts for that user, in
 * their team, on the day it was paid — Reports, team pages, rewards: every figure that adds up lead payments by the
 * day paid (utils/oldBooksRevenue.ts OLD_BOOKS_UNION).
 *
 * The old books are in dirhams, and every figure here is in rupees: each payment is counted at OLD_BOOKS_INR_PER_AED
 * rupees to the dirham (Root's Settings rate), its AED kept beside it. No commission: this CRM has none (the Sales,
 * Remote and Draw CRMs count it there). An invoice voided in finance counts nowhere.
 *
 * Not counted: an invoice in another currency than AED (none today), money before OLD_BOOKS_FROM, a salesperson who
 * isn't a user here (kept, with no user, for the script to list — Root shows those apart).
 */

const round2 = (n: number) => Math.round(n * 100) / 100;
const dayStart = (d: string) => new Date(`${d.slice(0, 10)}T00:00:00+04:00`);   // a finance date, as a UAE day

export interface OldBooksResult {
  invoices: number;
  kept: number;
  notHere: { invoice: string; salesperson: string; email: string; paidAed: number }[];
  /** Kept for a user here: invoice, person, rupees counted from OLD_BOOKS_FROM on. */
  here: { invoice: string; person: string; paidAed: number; paidInr: number }[];
}

/** A user's one active team (the revenue figures' team); none when in no team or several. */
async function teamOf(user: Types.ObjectId): Promise<Types.ObjectId | null> {
  const teams = await Team.find({ status: "active", $or: [{ members: user }, { leaders: user }] }).select("_id").lean();
  return teams.length === 1 ? (teams[0]!._id as Types.ObjectId) : null;
}

/** One pass. `write: false` only reports. `invoices`: finance's answer, for the checks (else asked of finance). */
export async function syncOldBooks(opts: { write?: boolean; from?: string; invoices?: OldBooksInvoice[] } = {}): Promise<OldBooksResult> {
  const write = opts.write !== false;
  const from = opts.from ?? env.OLD_BOOKS_FROM;
  const rate = env.OLD_BOOKS_INR_PER_AED;
  const since = dayStart(from);
  const list = opts.invoices ?? (await fetchOldBooksPayments(from));
  const out: OldBooksResult = { invoices: list.length, kept: 0, notHere: [], here: [] };
  if (!list.length) return out;

  const emails = [...new Set(list.map((i) => i.salespersonEmail).filter(Boolean))];
  const users = await User.find({ email: { $in: emails } }).select("name email").lean<{ _id: Types.ObjectId; name: string; email: string }[]>();
  const userOf = new Map(users.map((u) => [String(u.email).toLowerCase(), u]));

  for (const inv of list) {
    try {
      if (!Types.ObjectId.isValid(inv.invoiceId) || (inv.currency || "AED").toUpperCase() !== "AED") continue;
      const user = userOf.get(inv.salespersonEmail) ?? null;
      const all = inv.payments.map((p) => ({ financeId: p.id, amount: round2(p.amountMinor / 100), paidAt: dayStart(p.paidOn) })).filter((p) => p.amount > 0);
      const counted = all.filter((p) => p.paidAt >= since);
      const paidAed = round2(counted.reduce((s, p) => s + p.amount, 0));
      if (!user) out.notHere.push({ invoice: inv.invoiceNumber, salesperson: inv.salespersonName, email: inv.salespersonEmail, paidAed });
      else {
        out.kept++;
        out.here.push({ invoice: inv.invoiceNumber, person: user.name, paidAed, paidInr: round2(paidAed * rate) });
      }
      if (!write) continue;
      const isVoid = inv.status === "void";
      const paidInFullAt = !isVoid && inv.balanceMinor <= 0 && all.length ? new Date(Math.max(...all.map((p) => p.paidAt.getTime()))) : null;
      await OldBooksSale.updateOne(
        { financeInvoiceId: new Types.ObjectId(inv.invoiceId) },
        {
          $set: {
            invoiceNumber: inv.invoiceNumber, customerName: inv.customerName, course: inv.course, courseRef: null,
            salespersonName: inv.salespersonName, salespersonEmail: inv.salespersonEmail,
            assignedTo: user?._id ?? null, team: user ? await teamOf(user._id) : null, fee: round2(inv.totalMinor / 100), currency: "AED",
            issueDate: inv.issueDate ? dayStart(inv.issueDate) : null, status: inv.status, balance: round2(inv.balanceMinor / 100),
            // In rupees, as every figure here; a void invoice counts nowhere.
            payments: isVoid ? [] : counted.map((p) => ({
              financeId: p.financeId, amount: round2(p.amount * rate), aed: p.amount, paidAt: p.paidAt,
              method: inv.payments.find((x) => x.id === p.financeId)?.method ?? "",
              note: `Old books · ${inv.invoiceNumber} · AED ${p.amount} at 1 AED = ₹${rate}`, oldBooks: true,
            })),
            allPayments: all, paidInFullAt, syncedAt: new Date(),
          },
        },
        { upsert: true },
      );
    } catch (err) {
      console.error(`[oldBooks] ${inv.invoiceNumber} — ${err instanceof Error ? err.message : err}`);
    }
  }
  return out;
}

const EVERY_MS = 10 * 60_000;
let lastRun = 0;
let running = false;

/** For the finance worker's tick: at most every ten minutes. Never throws. */
export async function oldBooksTick(): Promise<void> {
  if (running || Date.now() - lastRun < EVERY_MS) return;
  running = true;
  lastRun = Date.now();
  try {
    const r = await syncOldBooks();
    if (r.kept) console.log(`[oldBooks] ${r.kept} old-books invoice(s) kept for users here`);
  } catch (err) {
    console.error(`[oldBooks] could not be read from finance — ${err instanceof Error ? err.message : err}`);
  } finally {
    running = false;
  }
}
