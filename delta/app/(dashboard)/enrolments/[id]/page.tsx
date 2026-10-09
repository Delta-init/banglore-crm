"use client";

import { useState } from "react";
import Link from "next/link";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import { AlertTriangle, ArrowLeft, GraduationCap, ListChecks, Loader2, Pencil, Send, Undo2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/skeleton";
import { fmtINR } from "@/lib/currency";
import { useAuthStore } from "@/lib/store/authStore";
import { useEnrolment, useRequestInvoice, sendBackState, istTime, type EnrolmentDetail } from "@/hooks/useEnrolments";
import { EnrolmentStepsList } from "@/components/students/EnrolmentSteps";
import { CorrectEnrolmentDialog } from "@/components/students/CorrectEnrolmentDialog";
import type { Course } from "@/types/course";

/**
 * One enrolment: its steps after the close — finance approved, LMS account —
 * with who did each and when. Opened from a
 * My Enrolments card. The closer sees their own; anyone who may view students,
 * any.
 */
export default function EnrolmentPage() {
  const { id } = useParams<{ id: string }>();
  const { data: e, isLoading, isError, error } = useEnrolment(id);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="mx-auto flex max-w-3xl flex-col gap-5 pb-6">
      <Link href="/enrolments" className="inline-flex w-fit items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground">
        <ArrowLeft className="h-4 w-4" /> My Enrolments
      </Link>

      {isLoading ? (
        <div className="space-y-3">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-72 rounded-xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : isError || !e ? (
        <div className="flex items-start gap-2 rounded-xl border border-red-500/20 bg-red-500/5 p-4 text-sm text-red-700 dark:text-red-300">
          <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
          {(error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Couldn't load this enrolment."}
        </div>
      ) : (
        <>
          <Header e={e} />
          <section className="rounded-xl border border-border/50 bg-card p-5">
            <p className="mb-4 flex items-center gap-2 text-sm font-semibold text-foreground">
              <span className="flex h-7 w-7 items-center justify-center rounded-lg bg-primary/10 text-primary"><ListChecks className="h-4 w-4" /></span>
              After the close
            </p>
            <EnrolmentStepsList steps={e.steps} />
          </section>
        </>
      )}
    </motion.div>
  );
}

function Header({ e }: { e: EnrolmentDetail }) {
  const course = e.course && typeof e.course === "object" ? (e.course as Course) : null;
  const closer = e.assignedTo && typeof e.assignedTo === "object" ? (e.assignedTo as { name?: string }).name : null;
  const invoice = e.invoice?.invoiceNumber || e.handover?.invoiceNumber;
  const { sentBack, resending, sentAgain, reason } = sendBackState(e);
  const h = e.handover;
  // Correcting and sending again are for whoever may act on enrolments; the server decides whose.
  const { hasPermission } = useAuthStore();
  const mayAct = hasPermission("enrolments", "edit");
  const resend = useRequestInvoice();
  const [correcting, setCorrecting] = useState(false);
  return (
    <section className="rounded-xl border border-border/50 bg-card p-5">
      <div className="flex items-start gap-3">
        <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
          <GraduationCap className="h-5 w-5 text-primary" />
        </div>
        <div className="min-w-0">
          <h1 className="text-lg font-bold text-foreground">{e.name}</h1>
          <p className="text-xs text-muted-foreground">
            {[e.enrollmentNumber, course?.name ?? "No course", fmtINR(e.totalFee), invoice ? `Invoice ${invoice}` : "", closer ? `Closed by ${closer}` : "",
              e.enrollmentDate ? `Enrolled ${new Date(e.enrollmentDate).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric", timeZone: "Asia/Kolkata" })}` : ""]
              .filter(Boolean).join(" · ")}
          </p>
        </div>
      </div>

      {/* Sent back: why, and the two ways on — correct it, or send it again as it stands. */}
      {sentBack && (
        <div className="mt-4 flex flex-wrap items-start justify-between gap-3 rounded-lg border border-red-500/20 bg-red-500/5 px-3 py-2.5">
          <p className="flex min-w-0 items-start gap-1.5 text-xs text-red-700 dark:text-red-300">
            <Undo2 className="mt-0.5 h-3.5 w-3.5 shrink-0" />
            Sent back{reason ? `: ${reason}` : " — no reason was given"}
          </p>
          {mayAct && (
            <div className="flex shrink-0 gap-2">
              <Button size="sm" variant="outline" className="h-7 gap-1.5 text-xs" onClick={() => setCorrecting(true)}>
                <Pencil className="h-3 w-3" /> Correct it
              </Button>
              <Button size="sm" className="h-7 gap-1.5 text-xs" onClick={() => resend.mutate(e._id)} disabled={resend.isPending}>
                {resend.isPending ? <Loader2 className="h-3 w-3 animate-spin" /> : <Undo2 className="h-3 w-3" />} Send again
              </Button>
            </div>
          )}
        </div>
      )}
      {(resending || sentAgain) && h?.resentAt && (
        <p className="mt-3 flex items-center gap-1.5 text-xs text-sky-600 dark:text-sky-400">
          {resending ? <Loader2 className="h-3.5 w-3.5 animate-spin" /> : <Send className="h-3.5 w-3.5" />}
          Sent again {istTime(h.resentAt)}
          {(h.resends ?? 0) > 1 ? ` · ${h.resends} times` : ""}
          {resending ? " — on its way to finance" : e.invoice?.approval === "pending" ? " — waiting for approval" : ""}
        </p>
      )}
      {correcting && <CorrectEnrolmentDialog studentId={e._id} open onClose={() => setCorrecting(false)} />}
    </section>
  );
}
