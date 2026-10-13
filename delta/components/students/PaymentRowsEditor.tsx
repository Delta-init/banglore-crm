"use client";

import type { Dispatch, SetStateAction } from "react";
import { AnimatePresence, motion } from "framer-motion";
import { Paperclip, Plus, Upload, X } from "lucide-react";
import { Input } from "@/components/ui/input";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { fmtINR } from "@/lib/currency";
import { uploadReceipt } from "@/hooks/useStudents";
import { ENROLMENT_PAYMENT_METHODS, PAYMENT_METHOD_LABELS, type PaymentOriginal, type StoredReceipt } from "@/types/student";

/*
 * The payments taken at a close, one row each (the user, 2026-10-05): a client
 * may pay part in cash and part by card, and each payment has its own method,
 * amount and receipt. The money already on the lead before the close is a row
 * of its own — its amount fixed, its method and receipt still asked, since
 * finance records every payment against the invoice with its proof.
 *
 * Every payment counts in INR — Banglore's finance organisation keeps its books
 * in INR. A payment handed over in dirhams says so (the user, 2026-10-13: INR by
 * default, AED pickable): the AED and the rate, 1 AED = ₹ how much, and its
 * rupees worked out from them; finance gets both.
 */

export interface PaymentRow {
  id: string;
  method: string;
  /** In INR. */
  amountInput: string;
  /** Handed over in AED — `aedInput` at `rateInput` (INR for 1 AED) is its rupees. */
  paidInAed?: boolean;
  aedInput?: string;
  rateInput?: string;
  receipt: StoredReceipt | null;
  /** The money already on the lead before the close, as one payment. */
  collectedBefore?: boolean;
  /** Already added to the lead's payments, by an attempt that then failed — not added twice. */
  addedToLead?: boolean;
  uploading?: boolean;
  uploadError?: string;
}

export const MAX_PAYMENTS = 10;

let rowSeq = 0;
export const newPaymentRow = (over: Partial<PaymentRow> = {}): PaymentRow => ({
  id: `payment-${++rowSeq}`,
  method: "",
  amountInput: "",
  receipt: null,
  ...over,
});

const num = (s?: string) => Math.max(0, Number(s) || 0);

/** Handed over in AED — never the money already on the lead, which is INR here. */
const inAed = (r: PaymentRow) => !r.collectedBefore && Boolean(r.paidInAed);

/** What the payment counts as, in INR — the rupees an AED payment came to. */
export const rowAmount = (r: PaymentRow) => (inAed(r) ? Math.round(num(r.aedInput) * num(r.rateInput) * 100) / 100 : num(r.amountInput));

/** What finance is told of a payment handed over in AED; nothing otherwise. */
export const rowOriginal = (r: PaymentRow): PaymentOriginal | undefined =>
  inAed(r) ? { currency: "AED", amount: num(r.aedInput), rate: num(r.rateInput) } : undefined;

/** What each payment still needs, the way the close's "Still needed" line says it. */
export function missingInRows(rows: PaymentRow[]): string[] {
  const one = rows.length === 1;
  return rows.flatMap((r, i) => {
    const whose = `payment ${i + 1}'s`;
    return [
      !r.method && (one ? "payment method" : `${whose} method`),
      !r.collectedBefore && !inAed(r) && !(num(r.amountInput) > 0) && (one ? "the amount paid" : `${whose} amount`),
      inAed(r) && !(num(r.aedInput) > 0) && (one ? "the amount paid in AED" : `${whose} AED amount`),
      inAed(r) && !(num(r.rateInput) > 0) && (one ? "the AED rate" : `${whose} AED rate`),
      !r.receipt && (one ? "payment receipt" : `${whose} receipt`),
    ].filter(Boolean) as string[];
  });
}

interface PaymentRowsEditorProps {
  leadId: string;
  rows: PaymentRow[];
  onChange: Dispatch<SetStateAction<PaymentRow[]>>;
}

export function PaymentRowsEditor({ leadId, rows, onChange }: PaymentRowsEditorProps) {
  const update = (id: string, patch: Partial<PaymentRow>) =>
    onChange((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));


  async function attach(id: string, file: File) {
    update(id, { uploading: true, uploadError: "" });
    try {
      const receipt = await uploadReceipt(leadId, file);
      update(id, { receipt, uploading: false });
    } catch (e) {
      update(id, { uploading: false, uploadError: e instanceof Error ? e.message : "Could not upload that file" });
    }
  }

  const removable = rows.filter((r) => !r.collectedBefore).length > 1 || rows.some((r) => r.collectedBefore);

  return (
    <div className="space-y-2">
      <AnimatePresence initial={false}>
        {rows.map((r, i) => (
          <motion.div
            key={r.id}
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            className="space-y-1.5 rounded-lg border border-border/50 bg-muted/20 p-2"
          >
            <div className="flex items-center gap-2">
              <span className="w-5 shrink-0 text-[10px] font-semibold text-muted-foreground">{i + 1}.</span>
              {/* "INR Transfer" is rupees: it puts the row back in INR. */}
              <Select value={r.method} onValueChange={(v) => update(r.id, v === "inr_bank_account" ? { method: v, paidInAed: false } : { method: v })}>
                <SelectTrigger className="h-8 w-[130px] shrink-0 text-xs" aria-label={`Payment ${i + 1} method`}>
                  <SelectValue placeholder="Paid by…" />
                </SelectTrigger>
                <SelectContent>
                  {ENROLMENT_PAYMENT_METHODS.map((m) => (
                    <SelectItem key={m} value={m} className="text-xs">{PAYMENT_METHOD_LABELS[m]}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
              {r.collectedBefore ? (
                <div className="flex-1 text-xs">
                  <span className="font-semibold text-foreground">{fmtINR(rowAmount(r))}</span>
                  <span className="ml-1.5 text-[10px] text-muted-foreground">already on the lead</span>
                </div>
              ) : (
                <>
                  <Select value={r.paidInAed ? "AED" : "INR"} onValueChange={(v) => update(r.id, { paidInAed: v === "AED" })}>
                    <SelectTrigger className="h-8 w-[72px] shrink-0 text-xs" aria-label={`Payment ${i + 1} currency`}>
                      <SelectValue />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="INR" className="text-xs">INR</SelectItem>
                      <SelectItem value="AED" className="text-xs">AED</SelectItem>
                    </SelectContent>
                  </Select>
                  {r.paidInAed ? (
                    <Input
                      type="number" min="0" step="0.01" value={r.aedInput ?? ""}
                      onChange={(e) => update(r.id, { aedInput: e.target.value })}
                      placeholder="Paid in AED" className="h-8 min-w-0 flex-1 text-xs"
                      aria-label={`Payment ${i + 1} amount in AED`}
                    />
                  ) : (
                    <Input
                      type="number" min="0" step="0.01" value={r.amountInput}
                      onChange={(e) => update(r.id, { amountInput: e.target.value })}
                      placeholder="Amount (₹)" className="h-8 min-w-0 flex-1 text-xs"
                      aria-label={`Payment ${i + 1} amount in INR`}
                    />
                  )}
                </>
              )}
              {!r.collectedBefore && removable && (
                <motion.button
                  type="button"
                  whileTap={{ scale: 0.97 }}
                  onClick={() => onChange((prev) => prev.filter((x) => x.id !== r.id))}
                  className="shrink-0 rounded p-1 text-muted-foreground hover:text-red-400"
                  aria-label={`Remove payment ${i + 1}`}
                >
                  <X className="h-3.5 w-3.5" />
                </motion.button>
              )}
            </div>
            {/* Handed over in AED: the rate, 1 AED = ₹ how much, and the rupees it comes to. */}
            {inAed(r) && (
              <div className="flex flex-wrap items-center gap-2 pl-7">
                <span className="text-[11px] text-muted-foreground">1 AED = ₹</span>
                <Input
                  type="number" min="0" step="0.0001" value={r.rateInput ?? ""}
                  onChange={(e) => update(r.id, { rateInput: e.target.value })}
                  placeholder="rate" className="h-7 w-20 text-xs"
                  aria-label={`Payment ${i + 1} rate, rupees for one dirham`}
                />
                <span className="text-[11px] font-medium text-foreground">= {fmtINR(rowAmount(r))}</span>
              </div>
            )}
            {r.receipt ? (
              <div className="flex items-center gap-2 rounded-md border border-border/50 bg-card px-2.5 py-1.5">
                <Paperclip className="h-3.5 w-3.5 shrink-0 text-muted-foreground" />
                <a href={r.receipt.url} target="_blank" rel="noreferrer" className="flex-1 truncate text-xs hover:underline">
                  {r.receipt.name}
                </a>
                <button
                  type="button"
                  onClick={() => update(r.id, { receipt: null })}
                  className="text-[10px] text-muted-foreground hover:text-red-400"
                >
                  Replace
                </button>
              </div>
            ) : (
              <label
                className={cn(
                  "flex cursor-pointer items-center justify-center gap-2 rounded-md border border-dashed border-border/60 px-3 py-2 text-xs text-muted-foreground hover:border-primary/50 hover:text-foreground",
                  r.uploading && "pointer-events-none opacity-60",
                )}
              >
                <Upload className="h-3.5 w-3.5" />
                {r.uploading ? "Uploading…" : "Attach this payment's receipt — photo or PDF"}
                <input
                  type="file"
                  accept="image/jpeg,image/png,image/webp,image/heic,application/pdf"
                  className="hidden"
                  onChange={(e) => {
                    const f = e.target.files?.[0];
                    if (f) void attach(r.id, f);
                    e.target.value = "";
                  }}
                />
              </label>
            )}
            {r.uploadError && <p className="text-[10px] text-red-400">{r.uploadError}</p>}
          </motion.div>
        ))}
      </AnimatePresence>
      {rows.length < MAX_PAYMENTS && (
        <motion.button
          type="button"
          whileTap={{ scale: 0.97 }}
          onClick={() => onChange((prev) => [...prev, newPaymentRow()])}
          className="flex items-center gap-1.5 text-xs font-medium text-primary hover:underline"
        >
          <Plus className="h-3.5 w-3.5" /> Add another payment
        </motion.button>
      )}
    </div>
  );
}
