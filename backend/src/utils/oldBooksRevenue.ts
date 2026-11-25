import type { PipelineStage } from "mongoose";

/*
 * Finance's old books in the revenue figures (the user, 2026-11-25: counted for their salesperson, "November onwards").
 *
 * For a pipeline that unwinds lead payments (revenue by the day a payment was made): put first, it adds — beside the
 * leads — each old-books invoice kept for a user here (services/oldBooks.ts), as a lead of theirs carrying only the
 * payments that count (from OLD_BOOKS_FROM on, already in rupees). Nothing is on a real lead, so nothing is counted
 * twice; a count of leads must not use this.
 */
export const OLD_BOOKS_UNION: PipelineStage[] = [
  {
    $unionWith: {
      coll: "oldbookssales",
      pipeline: [
        { $match: { assignedTo: { $ne: null }, "payments.0": { $exists: true } } },
        { $project: { _id: "$financeInvoiceId", assignedTo: 1, team: 1, name: "$customerName", payments: 1, oldBooks: { $literal: true } } },
      ],
    },
  },
];
