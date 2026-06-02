"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Star, Play, Pause, CheckCircle2, Flag, Clock,
  PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  User, RefreshCw, ChevronDown, MessageSquare, Shield, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import {
  useQcQueue, useUpdateQc, fmtDuration, fmtCallTime,
  type RecentCallLog,
} from "@/hooks/useCalls";

// ─── Star Rating ──────────────────────────────────────────────────────────────

function StarRating({
  value, onChange, disabled,
}: { value: number; onChange: (v: number) => void; disabled?: boolean }) {
  const [hovered, setHovered] = useState(0);

  return (
    <div className="flex gap-0.5">
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
              "h-5 w-5 transition-colors",
              (hovered || value) >= star
                ? "fill-yellow-400 text-yellow-400"
                : "text-muted-foreground/30",
            )}
          />
        </motion.button>
      ))}
    </div>
  );
}

// ─── Recording Player ─────────────────────────────────────────────────────────

function RecordingPlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const [audio] = useState(() => typeof window !== "undefined" ? new Audio(url) : null);

  function toggle() {
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else {
      audio.play().catch(() => toast.error("Could not play recording"));
      audio.onended = () => setPlaying(false);
      setPlaying(true);
    }
  }

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={toggle}
      className="inline-flex items-center gap-1.5 rounded-lg bg-primary/10 px-3 py-1.5 text-sm font-medium text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
    >
      {playing ? <Pause className="h-3.5 w-3.5" /> : <Play className="h-3.5 w-3.5" />}
      {playing ? "Pause" : "Play Recording"}
    </motion.button>
  );
}

// ─── Call Type Badge ──────────────────────────────────────────────────────────

function CallTypeBadge({ type }: { type: string }) {
  const map: Record<string, { icon: React.ElementType; class: string; label: string }> = {
    Inbound:     { icon: PhoneIncoming, class: "text-blue-400 bg-blue-500/10 border-blue-500/20",     label: "Inbound"   },
    Outbound:    { icon: PhoneOutgoing, class: "text-green-400 bg-green-500/10 border-green-500/20",  label: "Outbound"  },
    Missed:      { icon: PhoneMissed,   class: "text-red-400 bg-red-500/10 border-red-500/20",        label: "Missed"    },
    Notanswered: { icon: PhoneMissed,   class: "text-orange-400 bg-orange-500/10 border-orange-500/20", label: "No Answer" },
  };
  const cfg = map[type] ?? map.Inbound;
  const Icon = cfg.icon;
  return (
    <span className={cn("inline-flex items-center gap-1.5 rounded-full border px-2.5 py-0.5 text-xs font-medium", cfg.class)}>
      <Icon className="h-3 w-3" />
      {cfg.label}
    </span>
  );
}

// ─── QC Status Badge ─────────────────────────────────────────────────────────

function QcBadge({ status }: { status: string }) {
  const map: Record<string, string> = {
    pending:  "text-amber-400 bg-amber-500/10 border-amber-500/20",
    reviewed: "text-green-400 bg-green-500/10 border-green-500/20",
    flagged:  "text-red-400 bg-red-500/10 border-red-500/20",
  };
  return (
    <span className={cn("inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", map[status] ?? map.pending)}>
      {status}
    </span>
  );
}

// ─── QC Card ─────────────────────────────────────────────────────────────────

function QcCard({ call, index }: { call: RecentCallLog; index: number }) {
  const [expanded,  setExpanded]  = useState(false);
  const [rating,    setRating]    = useState(call.qcRating ?? 0);
  const [notes,     setNotes]     = useState(call.qcNotes ?? "");
  const [status,    setStatus]    = useState<"pending" | "reviewed" | "flagged">(call.qcStatus ?? "pending");

  const { mutate: updateQc, isPending } = useUpdateQc();

  const leadName = (call.leadId as { name?: string } | null)?.name ?? call.contactName ?? "Unknown";
  const leadId   = (call.leadId as { _id?: string } | null)?._id ?? null;

  function save(newStatus?: "reviewed" | "flagged") {
    const finalStatus = newStatus ?? status;
    updateQc(
      { callId: call._id, qcRating: rating || undefined, qcNotes: notes || undefined, qcStatus: finalStatus },
      {
        onSuccess: () => toast.success(`Call marked as ${finalStatus}`),
        onError:   () => toast.error("Failed to save QC review"),
      },
    );
    setStatus(finalStatus);
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="rounded-xl border border-border bg-card overflow-hidden"
    >
      {/* Header row */}
      <div
        className="flex items-start gap-3 p-4 cursor-pointer hover:bg-muted/20 transition-colors"
        onClick={() => setExpanded((v) => !v)}
      >
        {/* Call type icon */}
        <div className="rounded-lg bg-muted/60 p-2 shrink-0 mt-0.5">
          <PhoneCall className="h-4 w-4 text-muted-foreground" />
        </div>

        {/* Main info */}
        <div className="flex-1 min-w-0">
          <div className="flex flex-wrap items-center gap-2 mb-1.5">
            <CallTypeBadge type={call.callType} />
            <QcBadge status={call.qcStatus ?? "pending"} />
            {call.qcRating ? (
              <span className="inline-flex items-center gap-0.5 text-xs text-yellow-400">
                {Array.from({ length: call.qcRating }).map((_, i) => (
                  <Star key={i} className="h-3 w-3 fill-yellow-400" />
                ))}
              </span>
            ) : null}
          </div>
          <div className="flex flex-wrap gap-x-4 gap-y-1 text-xs text-muted-foreground">
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {leadId
                ? <Link href={`/leads/${leadId}`} className="text-primary hover:underline" onClick={(e) => e.stopPropagation()}>{leadName}</Link>
                : leadName
              }
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {fmtCallTime(call.callDate)}
            </span>
            <span className="flex items-center gap-1">
              <Clock className="h-3 w-3" />
              {fmtDuration(call.callDuration)}
            </span>
            {call.agentName && (
              <span className="flex items-center gap-1">
                <Shield className="h-3 w-3" />
                {call.agentName}
                {call.agentExtension && (
                  <span className="rounded-sm bg-primary/10 px-1 text-[10px] font-mono text-primary">
                    #{call.agentExtension}
                  </span>
                )}
              </span>
            )}
            <span className="font-mono">{call.phoneNumber}</span>
          </div>
        </div>

        {/* Recording + view + expand */}
        <div className="flex items-center gap-2 shrink-0">
          {call.recordingUrl && (
            <div onClick={(e) => e.stopPropagation()}>
              <RecordingPlayer url={call.recordingUrl} />
            </div>
          )}
          <div onClick={(e) => e.stopPropagation()}>
            <Link href={`/calls/${call._id}`}>
              <Button size="icon" variant="ghost" className="h-7 w-7" title="View call details">
                <ArrowRight className="h-3.5 w-3.5 text-muted-foreground" />
              </Button>
            </Link>
          </div>
          <motion.div animate={{ rotate: expanded ? 180 : 0 }} transition={{ duration: 0.2 }}>
            <ChevronDown className="h-4 w-4 text-muted-foreground" />
          </motion.div>
        </div>
      </div>

      {/* Expanded QC panel */}
      <AnimatePresence>
        {expanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.22 }}
            className="overflow-hidden"
          >
            <div className="border-t border-border bg-muted/20 p-4 space-y-4">
              {/* Rating */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2">Call Rating</p>
                <StarRating value={rating} onChange={setRating} disabled={isPending} />
              </div>

              {/* Notes */}
              <div>
                <p className="text-xs font-medium text-muted-foreground mb-2 flex items-center gap-1.5">
                  <MessageSquare className="h-3.5 w-3.5" />
                  QC Notes
                </p>
                <Textarea
                  value={notes}
                  onChange={(e) => setNotes(e.target.value)}
                  placeholder="Add review notes, feedback, or issues found…"
                  className="text-sm resize-none min-h-[80px]"
                  disabled={isPending}
                />
              </div>

              {/* Action buttons */}
              <div className="flex flex-wrap gap-2">
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-green-500/30 text-green-400 hover:bg-green-500/10 hover:text-green-400"
                    disabled={isPending}
                    onClick={() => save("reviewed")}
                  >
                    <CheckCircle2 className="h-3.5 w-3.5" />
                    Approve
                  </Button>
                </motion.div>
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button
                    size="sm"
                    variant="outline"
                    className="gap-1.5 border-red-500/30 text-red-400 hover:bg-red-500/10 hover:text-red-400"
                    disabled={isPending}
                    onClick={() => save("flagged")}
                  >
                    <Flag className="h-3.5 w-3.5" />
                    Flag Issue
                  </Button>
                </motion.div>
                <motion.div whileTap={{ scale: 0.97 }}>
                  <Button
                    size="sm"
                    variant="ghost"
                    className="gap-1.5 text-muted-foreground"
                    disabled={isPending}
                    onClick={() => save()}
                  >
                    Save Draft
                  </Button>
                </motion.div>
              </div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function QcPage() {
  const [statusFilter, setStatusFilter] = useState<"pending" | "reviewed" | "flagged" | "all">("pending");
  const { data, isLoading, isFetching, refetch } = useQcQueue(statusFilter);
  const calls = data?.calls ?? [];
  const total = data?.total ?? 0;

  const pendingCount   = calls.filter(c => c.qcStatus === "pending").length;
  const reviewedCount  = calls.filter(c => c.qcStatus === "reviewed").length;
  const flaggedCount   = calls.filter(c => c.qcStatus === "flagged").length;

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold">QC Review</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            Listen to recordings · Rate calls · Approve or flag issues
          </p>
        </div>
        <div className="flex items-center gap-2">
          <Link href="/calls">
            <Button variant="outline" size="sm">All Calls</Button>
          </Link>
          <Button variant="outline" size="sm" onClick={() => refetch()} disabled={isFetching}>
            <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isFetching && "animate-spin")} />
            Refresh
          </Button>
        </div>
      </motion.div>

      {/* Stat row + filter */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.05 }}
        className="flex flex-wrap items-center justify-between gap-3"
      >
        {/* Mini stats */}
        <div className="flex flex-wrap gap-2">
          {[
            { label: "Pending Review", count: pendingCount,  color: "bg-amber-500/10 text-amber-400 border-amber-500/20"  },
            { label: "Approved",       count: reviewedCount, color: "bg-green-500/10 text-green-400 border-green-500/20"  },
            { label: "Flagged",        count: flaggedCount,  color: "bg-red-500/10 text-red-400 border-red-500/20"        },
          ].map(({ label, count, color }) => (
            <span key={label} className={cn("inline-flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-medium", color)}>
              {count} {label}
            </span>
          ))}
        </div>

        {/* Status filter */}
        <Select value={statusFilter} onValueChange={(v) => setStatusFilter(v as typeof statusFilter)}>
          <SelectTrigger className="h-8 w-[160px] text-xs">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="pending">Pending Review</SelectItem>
            <SelectItem value="reviewed">Approved</SelectItem>
            <SelectItem value="flagged">Flagged</SelectItem>
            <SelectItem value="all">All with Recordings</SelectItem>
          </SelectContent>
        </Select>
      </motion.div>

      {/* Content */}
      <Card className="border-border">
        <CardHeader className="pb-2 pt-4 px-4">
          <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
            {total} call{total !== 1 ? "s" : ""} with recordings
          </CardTitle>
        </CardHeader>
        <CardContent className="p-4 pt-2 space-y-3">
          {/* Loading */}
          {isLoading && (
            <div className="space-y-3">
              {[1, 2, 3].map((i) => (
                <div key={i} className="h-20 rounded-xl bg-muted/40 animate-pulse" />
              ))}
            </div>
          )}

          {/* Empty */}
          {!isLoading && calls.length === 0 && (
            <div className="flex flex-col items-center gap-3 py-14 text-center">
              <div className="rounded-full bg-muted/60 p-4">
                <Star className="h-6 w-6 text-muted-foreground" />
              </div>
              <div>
                <p className="text-sm font-medium">
                  {statusFilter === "pending" ? "No calls pending review" : `No ${statusFilter} calls`}
                </p>
                <p className="text-xs text-muted-foreground mt-1">
                  {statusFilter === "pending"
                    ? "All recordings have been reviewed — great work!"
                    : "Try changing the filter above"}
                </p>
              </div>
            </div>
          )}

          {/* QC Cards */}
          <AnimatePresence>
            {calls.map((call, i) => (
              <QcCard key={call._id} call={call} index={i} />
            ))}
          </AnimatePresence>
        </CardContent>
      </Card>
    </div>
  );
}
