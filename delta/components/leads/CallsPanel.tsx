"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Phone, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Clock, Play, Pause, RefreshCw, PhoneCall, Info,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";
import { useLeadCalls, fmtDuration, fmtCallTime } from "@/hooks/useCalls";
import type { CallLog } from "@/hooks/useCalls";
import { ClickToCall } from "@/components/leads/ClickToCall";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function statusColor(status: string) {
  const s = status.toLowerCase();
  if (s.includes("answer") && !s.includes("no")) return "text-green-400 bg-green-500/10 border-green-500/20";
  if (s.includes("no") || s.includes("miss")) return "text-red-400 bg-red-500/10 border-red-500/20";
  if (s.includes("busy")) return "text-orange-400 bg-orange-500/10 border-orange-500/20";
  return "text-muted-foreground bg-muted/50 border-border";
}

function DirectionIcon({ direction, status }: { direction: string; status: string }) {
  const missed = status.toLowerCase().includes("no") || status.toLowerCase().includes("miss");
  if (missed) return <PhoneMissed className="h-3.5 w-3.5 text-red-400" />;
  if (direction === "inbound") return <PhoneIncoming className="h-3.5 w-3.5 text-blue-400" />;
  return <PhoneOutgoing className="h-3.5 w-3.5 text-green-400" />;
}

// ─── Audio Player ─────────────────────────────────────────────────────────────

function RecordingPlayer({ url }: { url: string }) {
  const [playing, setPlaying] = useState(false);
  const [audio] = useState(() => typeof window !== "undefined" ? new Audio(url) : null);

  function toggle() {
    if (!audio) return;
    if (playing) { audio.pause(); setPlaying(false); }
    else {
      audio.play().catch(() => {});
      audio.onended = () => setPlaying(false);
      setPlaying(true);
    }
  }

  return (
    <motion.button
      whileTap={{ scale: 0.95 }}
      onClick={toggle}
      className="inline-flex items-center gap-1.5 rounded-md bg-primary/10 px-2 py-1 text-xs font-medium text-primary border border-primary/20 hover:bg-primary/20 transition-colors"
    >
      {playing ? <Pause className="h-3 w-3" /> : <Play className="h-3 w-3" />}
      {playing ? "Pause" : "Play"}
    </motion.button>
  );
}

// ─── Single Call Row ──────────────────────────────────────────────────────────

function CallRow({ call, index }: { call: CallLog; index: number }) {
  return (
    <motion.div
      key={call.id}
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.04 }}
      className="flex flex-col gap-2 rounded-lg border border-border bg-card/50 p-3 hover:bg-muted/30 transition-colors"
    >
      {/* Top row */}
      <div className="flex items-start justify-between gap-2">
        <div className="flex items-center gap-2 min-w-0">
          <div className="shrink-0 rounded-md bg-muted/60 p-1.5">
            <DirectionIcon direction={call.direction} status={call.status} />
          </div>
          <div className="min-w-0">
            <p className="text-xs font-medium text-foreground capitalize">
              {call.direction} call
              {call.agentName && (
                <span className="text-muted-foreground font-normal"> · {call.agentName}</span>
              )}
            </p>
            <p className="text-[11px] text-muted-foreground">{fmtCallTime(call.startTime)}</p>
          </div>
        </div>

        <span className={cn("shrink-0 inline-flex items-center rounded-full border px-2 py-0.5 text-[11px] font-medium capitalize", statusColor(call.status))}>
          {call.status}
        </span>
      </div>

      {/* Bottom row */}
      <div className="flex items-center justify-between gap-2 pl-8">
        <div className="flex items-center gap-3">
          <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
            <Clock className="h-3 w-3" />
            {fmtDuration(call.duration)}
          </span>
          <span className="text-[11px] text-muted-foreground truncate">
            {call.callerNumber} → {call.calleeNumber}
          </span>
        </div>

        {call.recordingUrl && <RecordingPlayer url={call.recordingUrl} />}
      </div>
    </motion.div>
  );
}

// ─── Main Panel ───────────────────────────────────────────────────────────────

interface CallsPanelProps {
  leadId:  string;
  phone:   string;
  leadName?: string;
}

export function CallsPanel({ leadId, phone, leadName }: CallsPanelProps) {
  const { data, isLoading, error, refetch, isFetching } = useLeadCalls(leadId);

  const calls = data?.calls ?? [];
  const hint  = data?.hint;

  // Summary stats
  const answered  = calls.filter((c) => c.status.toLowerCase().includes("answer") && !c.status.toLowerCase().includes("no")).length;
  const missed    = calls.filter((c) => c.status.toLowerCase().includes("no") || c.status.toLowerCase().includes("miss")).length;
  const totalDur  = calls.reduce((sum, c) => sum + (c.duration ?? 0), 0);
  const hasRec    = calls.filter((c) => c.recordingUrl).length;

  return (
    <Card className="border-border">
      <CardHeader className="pb-3">
        <div className="flex items-center justify-between gap-2">
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <PhoneCall className="h-4 w-4 text-primary" />
            Call History
          </CardTitle>
          <div className="flex items-center gap-2">
            <ClickToCall
              phoneNumber={phone}
              leadId={leadId}
              leadName={leadName}
              variant="outline"
              size="sm"
              showLabel={true}
            />
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7"
              onClick={() => refetch()}
              disabled={isFetching}
              title="Refresh"
            >
              <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
            </Button>
          </div>
        </div>

        {/* Stats row */}
        {calls.length > 0 && (
          <motion.div
            initial={{ opacity: 0, y: 4 }}
            animate={{ opacity: 1, y: 0 }}
            className="flex flex-wrap gap-2 mt-2"
          >
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground">
              <Phone className="h-3 w-3" /> {calls.length} total
            </span>
            <span className="inline-flex items-center gap-1 rounded-full bg-green-500/10 px-2.5 py-0.5 text-xs text-green-400">
              <PhoneIncoming className="h-3 w-3" /> {answered} answered
            </span>
            {missed > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-red-500/10 px-2.5 py-0.5 text-xs text-red-400">
                <PhoneMissed className="h-3 w-3" /> {missed} missed
              </span>
            )}
            <span className="inline-flex items-center gap-1 rounded-full bg-muted/60 px-2.5 py-0.5 text-xs text-muted-foreground">
              <Clock className="h-3 w-3" /> {fmtDuration(totalDur)} total
            </span>
            {hasRec > 0 && (
              <span className="inline-flex items-center gap-1 rounded-full bg-primary/10 px-2.5 py-0.5 text-xs text-primary">
                <Play className="h-3 w-3" /> {hasRec} recording{hasRec > 1 ? "s" : ""}
              </span>
            )}
          </motion.div>
        )}
      </CardHeader>

      <CardContent className="space-y-2">
        {/* Loading */}
        {isLoading && (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-lg bg-muted/40 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {error && (
          <div className="rounded-lg bg-destructive/10 border border-destructive/20 p-3 text-sm text-destructive">
            Failed to load call logs. Check backend connection.
          </div>
        )}

        {/* API not ready hint */}
        {!isLoading && !error && hint && calls.length === 0 && (
          <div className="rounded-lg bg-amber-500/10 border border-amber-500/20 p-3 flex gap-2">
            <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
            <div>
              <p className="text-xs font-medium text-amber-400">3CX API access not ready</p>
              <p className="text-xs text-muted-foreground mt-0.5">
                In 3CX admin → Integrations → API → Edit Service Principal → change Role to <strong>Admin</strong> → Save
              </p>
            </div>
          </div>
        )}

        {/* Empty state */}
        {!isLoading && !error && !hint && calls.length === 0 && (
          <div className="flex flex-col items-center gap-2 py-8 text-center">
            <div className="rounded-full bg-muted/60 p-3">
              <Phone className="h-5 w-5 text-muted-foreground" />
            </div>
            <p className="text-sm text-muted-foreground">No calls recorded for this lead</p>
          </div>
        )}

        {/* Call list */}
        <AnimatePresence>
          {calls.map((call, i) => (
            <CallRow key={call.id} call={call} index={i} />
          ))}
        </AnimatePresence>
      </CardContent>
    </Card>
  );
}
