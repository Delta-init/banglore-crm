"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, X, User2, Phone, Mail, BookOpen,
  Calendar, DollarSign, StickyNote, CheckCircle2, SkipForward,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";
import { fmtFull } from "@/lib/currency";
import { useCreateStudent } from "@/hooks/useStudents";
import type { Lead } from "@/types/lead";
import type { Course } from "@/types/course";
import type { FeeStatus } from "@/types/student";

interface Props {
  open: boolean;
  lead: Lead;
  onClose: () => void;
  onSkip: () => void;
  onCreated: () => void;
}

export function CreateStudentModal({ open, lead, onClose, onSkip, onCreated }: Props) {
  const courseObj = lead.course && typeof lead.course === "object" ? lead.course as Course : null;
  const totalFee  = courseObj?.amount ?? 0;
  const paidAmount = (lead.payments ?? []).reduce((s, p) => s + p.amount, 0);
  const pending   = Math.max(0, totalFee - paidAmount);

  const computedFeeStatus: FeeStatus =
    totalFee <= 0 || paidAmount <= 0 ? "pending"
    : paidAmount >= totalFee         ? "paid"
    :                                  "partial";

  const [notes, setNotes] = useState("");
  const [enrollmentDate, setEnrollmentDate] = useState(new Date().toISOString().slice(0, 10));
  const [feeStatus, setFeeStatus] = useState<FeeStatus>(computedFeeStatus);

  const createMut = useCreateStudent();

  function toIST(iso?: string | null) {
    if (!iso) return null;
    return new Date(iso).toLocaleString("en-IN", {
      timeZone: "Asia/Kolkata", day: "2-digit", month: "short",
      year: "numeric", hour: "2-digit", minute: "2-digit", hour12: true,
    }) + " IST";
  }

  async function handleCreate() {
    await createMut.mutateAsync({
      leadId: lead._id,
      name:   lead.name,
      phone:  lead.phone ?? undefined,
      email:  lead.email ?? undefined,
      course: courseObj?._id ?? null,
      team:   lead.team
        ? typeof lead.team === "object" ? (lead.team as { _id: string })._id : lead.team
        : null,
      assignedTo: lead.assignedTo
        ? typeof lead.assignedTo === "object" ? (lead.assignedTo as { _id: string })._id : lead.assignedTo
        : null,
      initialLeadResponse:  lead.initialLeadResponse  ?? null,
      primaryConcern:       lead.primaryConcern        ?? null,
      followupStrategyType: lead.followupStrategyType  ?? null,
      demoScheduled:    lead.demoScheduled  ?? false,
      demoAttended:     lead.demoAttended   ?? false,
      firstContactTime: lead.firstContactTime  ?? null,
      lastFollowupDate: lead.lastFollowupDate  ?? null,
      enrollmentDate: new Date(enrollmentDate).toISOString(),
      feeStatus,
      totalFee,
      paidAmount,
      notes: notes || undefined,
    });
    onCreated();
  }

  const assignedName = lead.assignedTo
    ? typeof lead.assignedTo === "object"
      ? (lead.assignedTo as { name: string }).name
      : lead.assignedTo
    : null;

  return (
    <AnimatePresence>
      {open && (
        <Dialog open={open} onOpenChange={onClose}>
          <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto p-0 gap-0">
            {/* Header */}
            <motion.div
              initial={{ opacity: 0, y: -10 }}
              animate={{ opacity: 1, y: 0 }}
              className="sticky top-0 z-10 flex items-center justify-between gap-3 border-b border-border/50 bg-card px-5 py-4"
            >
              <div className="flex items-center gap-3">
                <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10">
                  <GraduationCap className="h-5 w-5 text-primary" />
                </div>
                <div>
                  <DialogHeader>
                    <DialogTitle className="text-base font-bold">Create Student Profile</DialogTitle>
                  </DialogHeader>
                  <p className="text-xs text-muted-foreground">{lead.name} · Lead closed</p>
                </div>
              </div>
              <Button variant="ghost" size="icon" className="h-7 w-7 shrink-0" onClick={onClose}>
                <X className="h-4 w-4" />
              </Button>
            </motion.div>

            <div className="px-5 py-4 space-y-5">
              {/* Personal details strip */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Personal Details</p>
                <div className="rounded-xl border border-border/50 bg-muted/20 divide-y divide-border/30">
                  {[
                    { icon: User2, label: "Name",    value: lead.name },
                    { icon: Phone, label: "Phone",   value: lead.phone },
                    { icon: Mail,  label: "Email",   value: lead.email },
                    { icon: BookOpen, label: "Course", value: courseObj ? `${courseObj.name}${courseObj.amount ? ` · ${fmtFull(courseObj.amount)}` : ""}` : null },
                    { icon: User2, label: "Counsellor", value: assignedName },
                  ].filter((r) => r.value).map(({ icon: Icon, label, value }) => (
                    <div key={label} className="flex items-center gap-3 px-3 py-2.5">
                      <Icon className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-[11px] text-muted-foreground w-20 shrink-0">{label}</span>
                      <span className="text-xs font-medium text-foreground truncate">{value}</span>
                    </div>
                  ))}
                </div>
              </motion.div>

              {/* Lead insight badges */}
              {(lead.initialLeadResponse || lead.primaryConcern || lead.followupStrategyType ||
                lead.demoScheduled || lead.firstContactTime || lead.lastFollowupDate) && (
                <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.1 }}>
                  <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Lead Insights</p>
                  <div className="flex flex-wrap gap-2 rounded-xl border border-border/50 bg-muted/20 p-3">
                    {lead.initialLeadResponse && (
                      <span className="inline-flex items-center rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 text-[10px] font-medium text-violet-400">
                        {lead.initialLeadResponse.replace(/_/g, " ")}
                      </span>
                    )}
                    {lead.primaryConcern && (
                      <span className="inline-flex items-center rounded-full bg-amber-500/10 border border-amber-500/20 px-2.5 py-1 text-[10px] font-medium text-amber-400">
                        Concern: {lead.primaryConcern.replace(/_/g, " ")}
                      </span>
                    )}
                    {lead.followupStrategyType && (
                      <span className="inline-flex items-center rounded-full bg-sky-500/10 border border-sky-500/20 px-2.5 py-1 text-[10px] font-medium text-sky-400">
                        {lead.followupStrategyType.replace(/_/g, " ")}
                      </span>
                    )}
                    {lead.demoScheduled && (
                      <span className="inline-flex items-center rounded-full bg-violet-500/10 border border-violet-500/20 px-2.5 py-1 text-[10px] font-medium text-violet-400">
                        Demo {lead.demoAttended ? "Attended" : "Scheduled"}
                      </span>
                    )}
                    {lead.firstContactTime && (
                      <span className="text-[10px] text-muted-foreground">1st contact: {toIST(lead.firstContactTime)}</span>
                    )}
                  </div>
                </motion.div>
              )}

              {/* Fee section */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.12 }}>
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground mb-2">Fee Summary</p>
                <div className="rounded-xl border border-border/50 bg-muted/20 p-3 space-y-2">
                  <div className="grid grid-cols-3 gap-2 text-center">
                    <div className="rounded-lg bg-card p-2 border border-border/30">
                      <p className="text-sm font-bold text-foreground">{fmtFull(totalFee)}</p>
                      <p className="text-[10px] text-muted-foreground">Total Fee</p>
                    </div>
                    <div className="rounded-lg bg-card p-2 border border-border/30">
                      <p className="text-sm font-bold text-green-400">{fmtFull(paidAmount)}</p>
                      <p className="text-[10px] text-muted-foreground">Paid</p>
                    </div>
                    <div className="rounded-lg bg-card p-2 border border-border/30">
                      <p className={cn("text-sm font-bold", pending > 0 ? "text-amber-400" : "text-green-400")}>{fmtFull(pending)}</p>
                      <p className="text-[10px] text-muted-foreground">Pending</p>
                    </div>
                  </div>
                  {totalFee > 0 && (
                    <div className="h-1.5 rounded-full bg-muted overflow-hidden">
                      <motion.div
                        className="h-full rounded-full bg-green-500"
                        initial={{ width: 0 }}
                        animate={{ width: `${Math.min(100, (paidAmount / totalFee) * 100)}%` }}
                        transition={{ delay: 0.3, duration: 0.6 }}
                      />
                    </div>
                  )}
                </div>
              </motion.div>

              {/* Editable fields */}
              <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.15 }} className="space-y-3">
                <p className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground">Enrollment</p>

                <div className="grid grid-cols-2 gap-3">
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <Calendar className="h-3 w-3" /> Enrollment Date
                    </p>
                    <Input
                      type="date"
                      value={enrollmentDate}
                      onChange={(e) => setEnrollmentDate(e.target.value)}
                      className="h-8 text-xs [color-scheme:dark]"
                    />
                  </div>
                  <div className="space-y-1">
                    <p className="text-xs text-muted-foreground flex items-center gap-1">
                      <DollarSign className="h-3 w-3" /> Fee Status
                    </p>
                    <Select value={feeStatus} onValueChange={(v) => setFeeStatus(v as FeeStatus)}>
                      <SelectTrigger className="h-8 text-xs">
                        <SelectValue />
                      </SelectTrigger>
                      <SelectContent>
                        <SelectItem value="paid"    className="text-xs"><span className="text-green-400">Paid</span></SelectItem>
                        <SelectItem value="partial" className="text-xs"><span className="text-amber-400">Partial</span></SelectItem>
                        <SelectItem value="pending" className="text-xs"><span className="text-muted-foreground">Pending</span></SelectItem>
                      </SelectContent>
                    </Select>
                  </div>
                </div>

                <div className="space-y-1">
                  <p className="text-xs text-muted-foreground flex items-center gap-1">
                    <StickyNote className="h-3 w-3" /> Notes (optional)
                  </p>
                  <Textarea
                    value={notes}
                    onChange={(e) => setNotes(e.target.value)}
                    placeholder="Any additional notes about the student…"
                    className="resize-none text-xs min-h-[64px]"
                    rows={2}
                  />
                </div>
              </motion.div>
            </div>

            {/* Footer */}
            <motion.div
              initial={{ opacity: 0, y: 8 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.2 }}
              className="sticky bottom-0 flex items-center justify-between gap-3 border-t border-border/50 bg-card px-5 py-3"
            >
              <Button variant="ghost" size="sm" className="gap-2 text-muted-foreground" onClick={onSkip} disabled={createMut.isPending}>
                <SkipForward className="h-4 w-4" /> Skip for now
              </Button>
              <Button
                size="sm"
                className="gap-2"
                onClick={handleCreate}
                disabled={createMut.isPending}
              >
                {createMut.isPending ? (
                  <span className="flex items-center gap-1.5"><span className="h-3 w-3 animate-spin rounded-full border-2 border-current border-t-transparent" /> Creating…</span>
                ) : (
                  <><CheckCircle2 className="h-4 w-4" /> Create Student</>
                )}
              </Button>
            </motion.div>
          </DialogContent>
        </Dialog>
      )}
    </AnimatePresence>
  );
}
