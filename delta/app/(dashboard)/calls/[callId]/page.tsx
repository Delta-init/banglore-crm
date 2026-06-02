"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PhoneIncoming, PhoneOutgoing, PhoneMissed, Phone,
  Clock, Calendar, User, Mic, MicOff, Star,
  ArrowLeft, CheckCircle2, Flag, MessageSquare,
  Building2, Hash,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import { Skeleton } from "@/components/ui/skeleton";
import { cn } from "@/lib/utils";
import {
  useCallById, useUpdateQc, fmtDuration, fmtCallTime,
  type RecentCallLog,
} from "@/hooks/useCalls";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function CallTypeBadge({ call }: { call: RecentCallLog }) {
  const cfg = {
    Inbound:     { icon: PhoneIncoming,  cls: "bg-blue-500/10 text-blue-400 border-blue-500/20",   label: "Inbound"    },
    Outbound:    { icon: PhoneOutgoing,  cls: "bg-green-500/10 text-green-400 border-green-500/20", label: "Outbound"   },
    Missed:      { icon: PhoneMissed,    cls: "bg-red-500/10 text-red-400 border-red-500/20",        label: "Missed"     },
    Notanswered: { icon: PhoneMissed,    cls: "bg-orange-500/10 text-orange-400 border-orange-500/20", label: "Not Answered" },
  }[call.callType] ?? { icon: Phone, cls: "bg-muted text-muted-foreground border-border", label: call.callType };

  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", cfg.cls)}>
      <Icon className="h-3.5 w-3.5" />
      {cfg.label}
    </span>
  );
}

function QcStatusBadge({ status }: { status: RecentCallLog["qcStatus"] }) {
  const cfg = {
    pending:  { cls: "bg-amber-500/10 text-amber-400 border-amber-500/20",  label: "Pending Review" },
    reviewed: { cls: "bg-green-500/10 text-green-400 border-green-500/20",  label: "Approved"       },
    flagged:  { cls: "bg-red-500/10 text-red-400 border-red-500/20",        label: "Flagged"        },
  }[status];
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", cfg.cls)}>
      {cfg.label}
    </span>
  );
}

function StarRating({
  value, onChange, disabled,
}: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const [hovered, setHovered] = useState(0);
  return (
    <div className="flex gap-1">
      {[1, 2, 3, 4, 5].map((star) => (
        <motion.button
          key={star}
          type="button"
          whileTap={{ scale: 0.85 }}
          disabled={disabled}
          onMouseEnter={() => !disabled && setHovered(star)}
          onMouseLeave={() => setHovered(0)}
          onClick={() => !disabled && onChange(star)}
          className="focus:outline-none disabled:opacity-50 disabled:cursor-not-allowed"
        >
          <Star
            className={cn(
              "h-6 w-6 transition-colors",
              (hovered || value) >= star
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30",
            )}
          />
        </motion.button>
      ))}
      {value > 0 && (
        <span className="ml-2 self-center text-sm text-muted-foreground">
          {value}/5
        </span>
      )}
    </div>
  );
}

// ─── Info row ─────────────────────────────────────────────────────────────────

function InfoRow({ icon: Icon, label, value, mono }: {
  icon: React.ElementType; label: string; value: string | null | undefined; mono?: boolean;
}) {
  if (!value) return null;
  return (
    <div className="flex items-start gap-3 py-2.5 border-b border-border/40 last:border-0">
      <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/60 mt-0.5">
        <Icon className="h-3.5 w-3.5 text-muted-foreground" />
      </div>
      <div className="min-w-0">
        <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">{label}</p>
        <p className={cn("text-sm text-foreground mt-0.5", mono && "font-mono")}>{value}</p>
      </div>
    </div>
  );
}

// ─── Loading skeleton ─────────────────────────────────────────────────────────

function DetailSkeleton() {
  return (
    <div className="space-y-6">
      <div className="flex items-center gap-3">
        <Skeleton className="h-8 w-8 rounded-full" />
        <Skeleton className="h-6 w-40" />
      </div>
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-xl" />
          <Skeleton className="h-56 rounded-xl" />
        </div>
        <Skeleton className="h-80 rounded-xl" />
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CallDetailPage({ params }: { params: { callId: string } }) {
  const { callId } = params;
  const { data: call, isLoading, error } = useCallById(callId);
  const { mutate: updateQc, isPending } = useUpdateQc();

  const [rating, setRating] = useState(0);
  const [notes, setNotes]   = useState("");
  const [initialised, setInitialised] = useState(false);

  // Seed local state once call loads
  if (call && !initialised) {
    setRating(call.qcRating ?? 0);
    setNotes(call.qcNotes ?? "");
    setInitialised(true);
  }

  function save(status?: "reviewed" | "flagged") {
    if (!call) return;
    updateQc(
      { callId: call._id, qcRating: rating || undefined, qcNotes: notes || undefined, qcStatus: status },
      {
        onSuccess: () => toast.success(
          status === "reviewed" ? "Call approved ✓" :
          status === "flagged"  ? "Call flagged"    :
          "Draft saved"
        ),
        onError: () => toast.error("Failed to save QC"),
      },
    );
  }

  if (isLoading) return <DetailSkeleton />;

  if (error || !call) {
    return (
      <div className="flex flex-col items-center gap-4 py-24 text-center">
        <div className="rounded-full bg-muted/60 p-5">
          <Phone className="h-8 w-8 text-muted-foreground" />
        </div>
        <p className="text-sm font-medium">Call not found</p>
        <Link href="/calls">
          <Button variant="outline" size="sm">
            <ArrowLeft className="h-3.5 w-3.5 mr-2" />
            Back to Calls
          </Button>
        </Link>
      </div>
    );
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      className="space-y-6 pb-10"
    >
      {/* Breadcrumb / back */}
      <div className="flex items-center gap-2 text-sm">
        <Link
          href="/calls"
          className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors"
        >
          <ArrowLeft className="h-3.5 w-3.5" />
          Calls
        </Link>
        <span className="text-muted-foreground/40">/</span>
        <span className="text-foreground font-medium font-mono text-xs">{call._id.slice(-8).toUpperCase()}</span>
      </div>

      {/* Hero header */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
      >
        <div className="flex items-center gap-4">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 shrink-0">
            {call.callType === "Inbound"
              ? <PhoneIncoming className="h-6 w-6 text-primary" />
              : call.callType === "Outbound"
              ? <PhoneOutgoing className="h-6 w-6 text-primary" />
              : <PhoneMissed className="h-6 w-6 text-red-400" />
            }
          </div>
          <div>
            <h1 className="text-xl font-bold leading-tight">
              {call.contactName ?? call.phoneNumber}
            </h1>
            <div className="flex flex-wrap items-center gap-2 mt-1.5">
              <CallTypeBadge call={call} />
              <QcStatusBadge status={call.qcStatus} />
              {call.recordingUrl && (
                <span className="inline-flex items-center gap-1 rounded-full border border-primary/20 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
                  <Mic className="h-3 w-3" />
                  Recording
                </span>
              )}
            </div>
          </div>
        </div>
        <Link href="/calls/qc">
          <Button variant="outline" size="sm" className="gap-2">
            <Star className="h-3.5 w-3.5" />
            QC Queue
          </Button>
        </Link>
      </motion.div>

      {/* Main grid */}
      <div className="grid gap-6 lg:grid-cols-[1fr_380px]">

        {/* Left — call info + recording */}
        <div className="space-y-4">

          {/* Call details card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.1 }}
          >
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                  Call Details
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4 divide-y divide-border/40">
                <InfoRow icon={Calendar}  label="Date & Time"  value={fmtCallTime(call.callDate)} />
                <InfoRow icon={Clock}     label="Duration"     value={fmtDuration(call.callDuration)} />
                <InfoRow icon={Phone}     label="Phone Number" value={call.phoneNumber} mono />
                <InfoRow icon={User}      label="Agent"        value={call.agentName ?? undefined} />
                <InfoRow icon={Hash}      label="Extension"    value={call.agentExtension ?? undefined} mono />
                <InfoRow icon={User}      label="Initiated By" value={(call.initiatedBy as { name?: string } | null)?.name ?? undefined} />
                <InfoRow icon={Building2} label="Source"       value={call.source} />
                {call.leadId && (
                  <div className="flex items-start gap-3 py-2.5">
                    <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-md bg-muted/60 mt-0.5">
                      <User className="h-3.5 w-3.5 text-muted-foreground" />
                    </div>
                    <div className="min-w-0">
                      <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground">Lead</p>
                      <Link
                        href={`/leads/${(call.leadId as { _id: string })._id}`}
                        className="text-sm text-primary hover:underline mt-0.5 block"
                      >
                        {(call.leadId as { name: string }).name}
                      </Link>
                    </div>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>

          {/* Recording card */}
          <motion.div
            initial={{ opacity: 0, y: 8 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.15 }}
          >
            <Card className="border-border/50">
              <CardHeader className="pb-2 pt-4 px-4">
                <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                  <Mic className="h-3.5 w-3.5" />
                  Recording
                </CardTitle>
              </CardHeader>
              <CardContent className="px-4 pb-4">
                {call.recordingUrl ? (
                  <audio
                    controls
                    src={call.recordingUrl}
                    className="w-full h-10 rounded-lg"
                    onError={() => toast.error("Recording unavailable")}
                  />
                ) : (
                  <div className="flex items-center gap-3 py-4 text-muted-foreground">
                    <MicOff className="h-5 w-5 shrink-0" />
                    <p className="text-sm">No recording available for this call</p>
                  </div>
                )}
              </CardContent>
            </Card>
          </motion.div>
        </div>

        {/* Right — QC review panel */}
        <motion.div
          initial={{ opacity: 0, x: 12 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ delay: 0.18 }}
        >
          <Card className="border-border/50 sticky top-6">
            <CardHeader className="pb-3 pt-4 px-4 border-b border-border/40">
              <CardTitle className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-2">
                <Star className="h-3.5 w-3.5 text-yellow-400" />
                QC Review
              </CardTitle>
            </CardHeader>
            <CardContent className="px-4 pb-4 pt-4 space-y-5">

              {/* Current status */}
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2">Current Status</p>
                <QcStatusBadge status={call.qcStatus} />
                {call.qcReviewedBy && (
                  <p className="text-xs text-muted-foreground mt-2">
                    Reviewed by {(call.qcReviewedBy as { name?: string })?.name}
                    {call.qcReviewedAt && ` · ${fmtCallTime(call.qcReviewedAt)}`}
                  </p>
                )}
              </div>

              {/* Star rating */}
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2.5">Call Rating</p>
                <StarRating value={rating} onChange={setRating} disabled={isPending} />
              </div>

              {/* Notes */}
              <div>
                <p className="text-[10px] font-medium uppercase tracking-wider text-muted-foreground mb-2 flex items-center gap-1.5">
                  <MessageSquare className="h-3 w-3" />
                  QC Notes
                </p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add review notes, feedback, or issues found…"
                  className="text-sm resize-none min-h-[100px]"
                  disabled={isPending}
                />
              </div>

              {/* Action buttons */}
              <div className="flex flex-col gap-2">
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button
                    className="w-full gap-2"
                    disabled={isPending}
                    onClick={() => save("reviewed")}
                  >
                    <CheckCircle2 className="h-4 w-4" />
                    Approve Call
                  </Button>
                </motion.div>
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button
                    variant="outline"
                    className="w-full gap-2 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
                    disabled={isPending}
                    onClick={() => save("flagged")}
                  >
                    <Flag className="h-4 w-4" />
                    Flag Issue
                  </Button>
                </motion.div>
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button
                    variant="ghost"
                    className="w-full gap-2 text-muted-foreground"
                    disabled={isPending}
                    onClick={() => save()}
                  >
                    Save Draft
                  </Button>
                </motion.div>
              </div>

            </CardContent>
          </Card>
        </motion.div>

      </div>
    </motion.div>
  );
}
