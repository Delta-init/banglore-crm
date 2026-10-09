"use client";

import { useState } from "react";
import Link from "next/link";
import { motion } from "framer-motion";
import {
  GraduationCap, Search, Receipt, RefreshCw, CheckCircle2, Clock,
  Undo2, AlertTriangle, FileWarning, Loader2, ExternalLink, Pencil, Send,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import { fmtINR } from "@/lib/currency";
import { useMyEnrolments, useRequestInvoice, sendBackState, istTime, type Enrolment } from "@/hooks/useEnrolments";
import { EnrolmentStepsStrip } from "@/components/students/EnrolmentSteps";
import { CorrectEnrolmentDialog } from "@/components/students/CorrectEnrolmentDialog";
import type { Course } from "@/types/course";

/**
 * My Enrolments.
 *
 * A counsellor closes a lead and an invoice is raised for it somewhere else.
 * Until now the only way to learn what happened to that invoice — whether
 * anybody approved it, whether it was sent back, whether it was ever raised at
 * all — was a finance login and a different application. This is that answer,
 * on the side of the wall where the question gets asked.
 */
export default function EnrolmentsPage() {
  const [search, setSearch] = useState("");
  const [mine, setMine] = useState(true);
  const [page, setPage] = useState(1);
  /*
   * Everything, or only what finance sent back.
   *
   * Its own tab rather than a filter buried in a dropdown, because these are
   * the only enrolments on this screen that are *waiting on the counsellor*.
   * Everything else here is news; this is a list of work, and work mixed into
   * news gets read as news.
   */
  const [tab, setTab] = useState<"all" | "returned">("all");

  const { data, isLoading, isFetching, refetch } = useMyEnrolments({
    mine, search, page, limit: 20,
    ...(tab === "returned" ? { state: "returned" } : {}),
  });
  const invoiceMut = useRequestInvoice();
  /** The sent-back enrolment being corrected, if any. */
  const [correcting, setCorrecting] = useState<string | null>(null);

  const rows = data?.data ?? [];
  const counts = data?.counts;

  return (
    <div className="space-y-6">
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <div className="flex items-center gap-2">
            <GraduationCap className="h-6 w-6 text-primary" />
            <h2 className="text-2xl font-bold">My Enrolments</h2>
          </div>
          <p className="text-muted-foreground text-sm mt-0.5">
            Every sale you closed, and what finance made of it
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" onClick={() => { setMine(!mine); setPage(1); }} className="gap-2">
            {mine ? "Show everyone's" : "Show only mine"}
          </Button>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching} className="gap-2">
            <RefreshCw className={cn("h-4 w-4", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Two tabs, because one of them is a to-do list. */}
      <div className="flex items-center gap-1 border-b border-border/60">
        {([
          ["all", "All enrolments"],
          ["returned", "Sent back"],
        ] as const).map(([key, label]) => (
          <button
            key={key}
            type="button"
            onClick={() => { setTab(key); setPage(1); }}
            className={cn(
              "-mb-px border-b-2 px-3 py-2 text-sm transition-colors",
              tab === key
                ? "border-primary font-medium text-foreground"
                : "border-transparent text-muted-foreground hover:text-foreground",
            )}
          >
            {label}
            {key === "returned" && (counts?.returned ?? 0) > 0 && (
              <span className="ml-1.5 rounded-full bg-red-500/15 px-1.5 py-0.5 text-[10px] text-red-400">
                {counts?.returned}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* ── The bar. Approved and sent back without leaving this screen. ────── */}
      {counts && (
        <motion.div
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-5"
        >
          <Stat icon={CheckCircle2} label="Approved"     value={counts.approved}    tone="green" />
          <Stat icon={Clock}        label="Waiting"      value={counts.pending}     tone="amber" />
          <Stat icon={Undo2}        label="Sent back"    value={counts.returned}    tone="red"   />
          <Stat icon={Receipt}      label="No invoice"   value={counts.notInvoiced} tone="muted" />
          <Stat icon={FileWarning}  label="Needs a look" value={counts.flagged}     tone="violet"/>
        </motion.div>
      )}
      {counts && counts.total > counts.onThisPage && (
        <p className="-mt-3 text-[11px] text-muted-foreground">
          Counts are for the {counts.onThisPage} enrolments on this page, of {counts.total} in total.
        </p>
      )}

      <div className="relative max-w-sm">
        <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
        <Input
          value={search}
          onChange={(e) => { setSearch(e.target.value); setPage(1); }}
          placeholder="Search by name, phone or enrolment number…"
          className="pl-9"
        />
      </div>

      {isLoading ? (
        <div className="flex items-center justify-center py-24">
          <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
        </div>
      ) : rows.length === 0 ? (
        <div className="rounded-xl border border-border/50 bg-card px-6 py-16 text-center">
          <GraduationCap className="mx-auto h-8 w-8 text-muted-foreground/50" />
          <p className="mt-3 text-sm font-medium">
            {tab === "returned" ? "Nothing has been sent back" : "No enrolments yet"}
          </p>
          <p className="mt-1 text-xs text-muted-foreground">
            {tab === "returned"
              ? "When finance needs a correction, the enrolment appears here with the reason."
              : "Close a lead and it appears here, with its invoice."}
          </p>
        </div>
      ) : (
        <div className="space-y-3">
          {rows.map((e) => (
            <EnrolmentRow
              key={e._id}
              enrolment={e}
              onGenerate={() => invoiceMut.mutate(e._id)}
              onCorrect={() => setCorrecting(e._id)}
              generating={invoiceMut.isPending && invoiceMut.variables === e._id}
            />
          ))}
        </div>
      )}

      {/* Everything the close took, corrected and sent to finance again in one step. */}
      {correcting && <CorrectEnrolmentDialog studentId={correcting} open onClose={() => setCorrecting(null)} />}

      {data && data.pagination.pages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-xs text-muted-foreground">
            Page {data.pagination.page} of {data.pagination.pages}
          </p>
          <div className="flex gap-2">
            <Button variant="outline" size="sm" disabled={page <= 1} onClick={() => setPage(page - 1)}>Previous</Button>
            <Button variant="outline" size="sm" disabled={page >= data.pagination.pages} onClick={() => setPage(page + 1)}>Next</Button>
          </div>
        </div>
      )}
    </div>
  );
}

function Stat({ icon: Icon, label, value, tone }: {
  icon: React.ElementType; label: string; value: number;
  tone: "green" | "amber" | "red" | "muted" | "violet";
}) {
  const tones = {
    green:  "text-green-400 bg-green-500/10 border-green-500/20",
    amber:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
    red:    "text-red-400 bg-red-500/10 border-red-500/20",
    muted:  "text-muted-foreground bg-muted/30 border-border/50",
    violet: "text-violet-400 bg-violet-500/10 border-violet-500/20",
  }[tone];
  return (
    <div className={cn("rounded-xl border p-3", tones)}>
      <div className="flex items-center gap-2">
        <Icon className="h-4 w-4" />
        <span className="text-[11px] font-medium">{label}</span>
      </div>
      <p className="mt-1 text-2xl font-bold tabular-nums">{value}</p>
    </div>
  );
}

function EnrolmentRow({ enrolment: e, onGenerate, onCorrect, generating }: {
  enrolment: Enrolment; onGenerate: () => void; onCorrect: () => void; generating: boolean;
}) {
  const course = e.course && typeof e.course === "object" ? (e.course as Course) : null;
  const inv = e.invoice;
  const h = e.handover;
  /* Finance if it answered, the outbox's own record if it did not — and one on
     its way back to finance is sent again, not sent back, whatever finance
     still says until it arrives. */
  const { sentBack, resending, sentAgain, reason } = sendBackState(e);

  return (
    <motion.div
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-xl border border-border/50 bg-card p-4"
    >
      <div className="flex flex-wrap items-start justify-between gap-4">
        <div className="min-w-0">
          <div className="flex flex-wrap items-center gap-2">
            {/* Its own page: the steps, with who did each and when */}
            <Link href={`/enrolments/${e._id}`} className="font-semibold text-sm hover:text-primary hover:underline">{e.name}</Link>
            <span className="text-[10px] text-muted-foreground">{e.enrollmentNumber}</span>
            <ApprovalBadge enrolment={e} />
          </div>
          <p className="mt-0.5 text-xs text-muted-foreground">
            {course?.name ?? "No course"} · {fmtINR(e.totalFee)} · enrolled {String(e.enrollmentDate).slice(0, 10)}
          </p>

          {/* Sent again after a send-back: said, with when (the user, 2026-10-05). */}
          {(resending || sentAgain) && h?.resentAt && (
            <p className="mt-1 flex items-center gap-1.5 text-[11px] text-sky-400">
              <Send className="h-3 w-3 shrink-0" />
              Sent again {istTime(h.resentAt)}
              {(h.resends ?? 0) > 1 ? ` · ${h.resends} times` : ""}
              {resending ? " — on its way to finance" : inv?.approval === "pending" ? " — waiting for approval" : ""}
            </p>
          )}

          {/* Anything finance wants somebody to look at. */}
          {h?.flags?.length ? (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-violet-500/20 bg-violet-500/5 px-2.5 py-1.5">
              <FileWarning className="mt-0.5 h-3 w-3 shrink-0 text-violet-400" />
              <p className="text-[11px] text-violet-300">{h.flags.join(" · ")}</p>
            </div>
          ) : null}

          {/* Read from finance where it answered, and from what the outbox last
              heard where it did not — a send-back somebody has to act on should
              not vanish off the screen because finance is restarting. */}
          {sentBack && (reason || h?.returnedAt) && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-1.5">
              <Undo2 className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
              <div className="min-w-0">
                <p className="text-[11px] text-red-300">
                  Sent back{reason ? `: ${reason}` : " — no reason was given"}
                </p>
                <p className="mt-0.5 text-[10px] text-red-300/70">
                  Correct the enrolment, then send it again. It keeps the same invoice number.
                </p>
              </div>
            </div>
          )}

          {h?.status === "failed" && (
            <div className="mt-2 flex items-start gap-1.5 rounded-lg border border-red-500/20 bg-red-500/5 px-2.5 py-1.5">
              <AlertTriangle className="mt-0.5 h-3 w-3 shrink-0 text-red-400" />
              <p className="text-[11px] text-red-300">
                Could not reach finance after {h.attempts} {h.attempts === 1 ? "try" : "tries"}
                {h.lastError ? ` — ${h.lastError}` : ""}
              </p>
            </div>
          )}

        </div>

        <div className="flex shrink-0 items-center gap-2">
          {sentBack ? (
            <div className="flex flex-col items-end gap-1.5">
              {inv && <p className="text-xs font-semibold">{inv.invoiceNumber}</p>}
              {/* Everything the close took — course, fee, payments and their
                  receipts, the client — and saving sends it again. */}
              <Button size="sm" variant="outline" className="gap-2" onClick={onCorrect}>
                <Pencil className="h-3.5 w-3.5" /> Correct it
              </Button>
              <Button size="sm" className="gap-2" onClick={onGenerate} disabled={generating}>
                {generating
                  ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                  : <><Undo2 className="h-3.5 w-3.5" /> Send again</>}
              </Button>
            </div>
          ) : resending ? (
            <div className="text-right">
              {inv && <p className="text-xs font-semibold">{inv.invoiceNumber}</p>}
              <span className="inline-flex items-center gap-1.5 text-[11px] text-sky-400">
                <Loader2 className="h-3 w-3 animate-spin" /> Sending again…
              </span>
            </div>
          ) : inv ? (
            <div className="text-right">
              <p className="text-xs font-semibold">{inv.invoiceNumber}</p>
              <p className="text-[10px] text-muted-foreground">
                {inv.currency} {(inv.totalMinor / 100).toFixed(2)}
              </p>
            </div>
          ) : h?.status === "pending" ? (
            <span className="text-[11px] text-muted-foreground">Sending…</span>
          ) : (
            <Button size="sm" variant="outline" className="gap-2" onClick={onGenerate} disabled={generating}>
              {generating
                ? <><Loader2 className="h-3.5 w-3.5 animate-spin" /> Sending…</>
                : <><Receipt className="h-3.5 w-3.5" /> Generate invoice</>}
            </Button>
          )}
        </div>
      </div>

      {/* Finance approved → LMS account */}
      <EnrolmentStepsStrip steps={e.steps} />
    </motion.div>
  );
}

/**
 * Where this enrolment got to.
 *
 * "Not known" is its own answer: when finance cannot be reached the row still
 * shows, and saying nothing is better than showing a stale approval.
 */
function ApprovalBadge({ enrolment: e }: { enrolment: Enrolment }) {
  const base = "inline-flex items-center gap-1 rounded-full border px-2 py-0.5 text-[10px] font-medium";
  const sky = "border-sky-500/20 bg-sky-500/10 text-sky-400";
  const { resending, sentAgain } = sendBackState(e);

  // Sent again after a send-back, shown as plainly as the send-back was.
  if (resending) {
    return <span className={cn(base, sky)}><Loader2 className="h-2.5 w-2.5 animate-spin" /> Sending again</span>;
  }
  if (sentAgain && e.invoice?.approval === "pending") {
    return <span className={cn(base, sky)}><Send className="h-2.5 w-2.5" /> Sent again</span>;
  }

  if (!e.invoice) {
    if (e.handover?.status === "failed") {
      return <span className={cn(base, "border-red-500/20 bg-red-500/10 text-red-400")}><AlertTriangle className="h-2.5 w-2.5" /> Not delivered</span>;
    }
    if (e.handover?.status === "pending") {
      return <span className={cn(base, "border-border/50 bg-muted/30 text-muted-foreground")}><Clock className="h-2.5 w-2.5" /> Sending</span>;
    }
    return <span className={cn(base, "border-border/50 bg-muted/30 text-muted-foreground")}><Receipt className="h-2.5 w-2.5" /> No invoice</span>;
  }

  switch (e.invoice.approval) {
    case "approved":
      return <span className={cn(base, "border-green-500/20 bg-green-500/10 text-green-400")}><CheckCircle2 className="h-2.5 w-2.5" /> Approved</span>;
    case "returned":
      return <span className={cn(base, "border-red-500/20 bg-red-500/10 text-red-400")}><Undo2 className="h-2.5 w-2.5" /> Sent back</span>;
    case "pending":
      return <span className={cn(base, "border-amber-500/20 bg-amber-500/10 text-amber-400")}><Clock className="h-2.5 w-2.5" /> Waiting for approval</span>;
    default:
      return <span className={cn(base, "border-border/50 bg-muted/30 text-muted-foreground")}><ExternalLink className="h-2.5 w-2.5" /> Raised</span>;
  }
}
