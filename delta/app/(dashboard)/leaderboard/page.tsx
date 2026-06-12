"use client";

import { useState, useEffect, useRef, useCallback } from "react";
import { motion, AnimatePresence, useSpring, useTransform } from "framer-motion";
import {
  Trophy, Crown, Medal, Flame, Clock, TrendingUp, TrendingDown,
  Minus, Maximize2, Minimize2, RefreshCw, ChevronLeft, ChevronRight,
  Phone, IndianRupee, Target, Zap, Share2,
} from "lucide-react";
import { useLeaderboard } from "@/hooks/useReports";
import type { LeaderboardEntry } from "@/types/reports";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

// ─── Constants ────────────────────────────────────────────────────────────────

const REFETCH_INTERVAL_MS = 30_000;
const CALL_TARGET_MINS    = 100;

const STATUS_CHIP_CONFIG = [
  { key: "new",           label: "New",       color: "bg-blue-500/10 text-blue-400 border-blue-500/20"     },
  { key: "followup",      label: "Followup",  color: "bg-violet-500/10 text-violet-400 border-violet-500/20" },
  { key: "callback",      label: "Callback",  color: "bg-amber-500/10 text-amber-400 border-amber-500/20"  },
  { key: "cnc",           label: "CNC",       color: "bg-orange-500/10 text-orange-400 border-orange-500/20"},
  { key: "not_connected", label: "Off",       color: "bg-slate-500/10 text-slate-400 border-slate-500/20"  },
  { key: "closed",        label: "Closed",    color: "bg-green-500/10 text-green-400 border-green-500/20"  },
  { key: "lost",          label: "Lost",      color: "bg-red-500/10 text-red-400 border-red-500/20"        },
  { key: "assigned",      label: "Assigned",  color: "bg-cyan-500/10 text-cyan-400 border-cyan-500/20"     },
] as const;

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtAmount(n: number): string {
  if (n >= 100_000) return `₹${(n / 100_000).toFixed(1)}L`;
  if (n >= 1_000)   return `₹${(n / 1_000).toFixed(1)}K`;
  return `₹${n}`;
}

function fmtMins(mins: number): string {
  if (mins >= 60) return `${Math.floor(mins / 60)}h ${mins % 60}m`;
  return `${mins}m`;
}

function currentMonthStr(): string {
  // Use IST to match server-side month boundary
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
}

function monthLabel(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1, 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}

function prevMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

function nextMonth(m: string): string {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo, 1);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

// ─── Rank medal ───────────────────────────────────────────────────────────────

function RankBadge({ rank }: { rank: number }) {
  if (rank === 1)
    return (
      <motion.div
        animate={{ rotate: [0, -8, 8, -5, 5, 0], scale: [1, 1.15, 1] }}
        transition={{ duration: 2, repeat: Infinity, repeatDelay: 4 }}
        className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 shadow-lg shadow-amber-500/40"
      >
        <Crown className="h-5 w-5 text-amber-900" />
      </motion.div>
    );
  if (rank === 2)
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-400 shadow-lg shadow-slate-400/30">
        <Medal className="h-5 w-5 text-slate-700" />
      </div>
    );
  if (rank === 3)
    return (
      <div className="flex h-10 w-10 items-center justify-center rounded-full bg-gradient-to-br from-orange-300 to-orange-500 shadow-lg shadow-orange-400/30">
        <Medal className="h-5 w-5 text-orange-900" />
      </div>
    );
  return (
    <div className="flex h-10 w-10 items-center justify-center rounded-full bg-muted text-muted-foreground font-bold text-sm">
      #{rank}
    </div>
  );
}

// ─── Rank change badge ────────────────────────────────────────────────────────

function RankChange({ delta }: { delta: number }) {
  if (delta === 0) return null;

  const up = delta > 0;
  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.5, y: up ? 10 : -10 }}
      animate={{ opacity: 1, scale: 1, y: 0 }}
      exit={{ opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 20 }}
      className={cn(
        "flex items-center gap-0.5 rounded-full px-2 py-0.5 text-[11px] font-bold",
        up
          ? "bg-green-500/20 text-green-400 border border-green-500/30"
          : "bg-red-500/20 text-red-400 border border-red-500/30",
      )}
    >
      {up ? <TrendingUp className="h-3 w-3" /> : <TrendingDown className="h-3 w-3" />}
      {up ? `+${delta}` : delta}
    </motion.div>
  );
}

// ─── Call duration progress bar ───────────────────────────────────────────────

function CallBar({ mins, hit }: { mins: number; hit: boolean }) {
  const pct = Math.min((mins / CALL_TARGET_MINS) * 100, 100);
  const over = mins > CALL_TARGET_MINS;

  return (
    <div className="flex items-center gap-2 min-w-0">
      <div className="flex items-center gap-1 shrink-0">
        {hit ? (
          <motion.div
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          >
            <Flame className="h-3.5 w-3.5 text-orange-400" />
          </motion.div>
        ) : (
          <Clock className="h-3.5 w-3.5 text-muted-foreground" />
        )}
        <span className={cn(
          "text-sm font-semibold tabular-nums",
          hit ? "text-orange-400" : "text-muted-foreground",
        )}>
          {fmtMins(mins)}
        </span>
      </div>

      <div className="flex-1 h-1.5 bg-muted/50 rounded-full overflow-hidden min-w-[60px]">
        <motion.div
          className={cn(
            "h-full rounded-full",
            hit
              ? over
                ? "bg-gradient-to-r from-orange-400 to-red-500"
                : "bg-gradient-to-r from-green-400 to-emerald-500"
              : "bg-gradient-to-r from-blue-400/60 to-blue-500/60",
          )}
          initial={{ width: 0 }}
          animate={{ width: `${pct}%` }}
          transition={{ duration: 1, ease: "easeOut" }}
        />
      </div>

      <span className="text-[10px] text-muted-foreground shrink-0">
        {hit ? "✓" : `${CALL_TARGET_MINS}m`}
      </span>
    </div>
  );
}

// ─── Live countdown ───────────────────────────────────────────────────────────

function LiveCountdown({ intervalMs, onRefetch }: { intervalMs: number; onRefetch: () => void }) {
  const total = Math.round(intervalMs / 1000);
  const [rem, setRem] = useState(total);

  useEffect(() => {
    setRem(total);
    const t = setInterval(() => {
      setRem((prev) => {
        if (prev <= 1) { setRem(total); return total; }
        return prev - 1;
      });
    }, 1000);
    return () => clearInterval(t);
  }, [total, onRefetch]);

  const pct = ((total - rem) / total) * 100;

  return (
    <div className="flex items-center gap-2 text-xs text-muted-foreground">
      <div className="relative h-5 w-5">
        <svg className="h-5 w-5 -rotate-90" viewBox="0 0 20 20">
          <circle cx="10" cy="10" r="8" fill="none" stroke="currentColor" strokeWidth="2" className="opacity-20" />
          <circle
            cx="10" cy="10" r="8"
            fill="none" stroke="currentColor" strokeWidth="2"
            strokeDasharray={`${2 * Math.PI * 8}`}
            strokeDashoffset={`${2 * Math.PI * 8 * (1 - pct / 100)}`}
            className="text-primary transition-all duration-1000"
          />
        </svg>
      </div>
      <span>Refreshing in <span className="tabular-nums font-medium text-foreground">{rem}s</span></span>
    </div>
  );
}

// ─── Leaderboard card ─────────────────────────────────────────────────────────

interface CardProps {
  entry:      LeaderboardEntry;
  delta:      number;
  index:      number;
  isFullscreen: boolean;
}

function LeaderboardCard({ entry, delta, index, isFullscreen }: CardProps) {
  const isTop3 = entry.rank <= 3;

  const cardBg =
    entry.rank === 1
      ? "bg-gradient-to-r from-amber-500/10 via-yellow-500/5 to-transparent border-amber-500/30"
      : entry.rank === 2
      ? "bg-gradient-to-r from-slate-400/10 via-slate-300/5 to-transparent border-slate-400/30"
      : entry.rank === 3
      ? "bg-gradient-to-r from-orange-400/10 via-orange-300/5 to-transparent border-orange-400/30"
      : "bg-card border-border hover:border-primary/20";

  return (
    <motion.div
      layout
      layoutId={entry.userId}
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type: "spring", stiffness: 260, damping: 28, delay: index * 0.03 }}
      whileHover={{ scale: 1.005, y: -1 }}
      className={cn(
        "relative rounded-xl border px-4 py-3 transition-colors",
        cardBg,
        isFullscreen ? "py-4" : "",
      )}
    >
      {/* Rank-1 glow */}
      {entry.rank === 1 && (
        <motion.div
          className="pointer-events-none absolute inset-0 rounded-xl"
          animate={{ opacity: [0.3, 0.6, 0.3] }}
          transition={{ duration: 2.5, repeat: Infinity }}
          style={{ boxShadow: "inset 0 0 30px rgba(245,158,11,0.08)" }}
        />
      )}

      <div className="flex items-center gap-3">
        {/* Rank badge */}
        <RankBadge rank={entry.rank} />

        {/* Name + email */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className={cn(
              "font-semibold truncate",
              isFullscreen ? "text-lg" : "text-sm",
              entry.rank === 1 ? "text-amber-400" : "text-foreground",
            )}>
              {entry.name}
            </span>
            <AnimatePresence mode="popLayout">
              {delta !== 0 && <RankChange key={`${entry.userId}-delta`} delta={delta} />}
            </AnimatePresence>
          </div>
          {entry.extension && (
            <span className="text-[11px] text-muted-foreground">Ext {entry.extension}</span>
          )}
        </div>

        {/* Stats row */}
        <div className={cn(
          "flex items-center gap-4",
          isFullscreen ? "gap-6" : "gap-3 md:gap-5",
        )}>
          {/* Closings */}
          <div className="flex flex-col items-center">
            <div className="flex items-center gap-1">
              <Target className="h-3.5 w-3.5 text-primary/70" />
              <span className={cn(
                "font-bold tabular-nums",
                isFullscreen ? "text-2xl" : "text-lg",
                entry.closings > 0 ? "text-primary" : "text-muted-foreground",
              )}>
                {entry.closings}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">closings</span>
          </div>

          {/* Call count */}
          <div className="flex flex-col items-center hidden sm:flex">
            <div className="flex items-center gap-1">
              <Phone className="h-3.5 w-3.5 text-blue-400/70" />
              <span className={cn(
                "font-bold tabular-nums",
                isFullscreen ? "text-2xl" : "text-lg",
                entry.callCount > 0 ? "text-blue-400" : "text-muted-foreground",
              )}>
                {entry.callCount}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">calls</span>
          </div>

          {/* Amount */}
          <div className="flex flex-col items-center hidden sm:flex">
            <div className="flex items-center gap-0.5">
              <IndianRupee className="h-3 w-3 text-green-500/70" />
              <span className={cn(
                "font-bold tabular-nums",
                isFullscreen ? "text-2xl" : "text-lg",
                entry.closingAmount > 0 ? "text-green-400" : "text-muted-foreground",
              )}>
                {fmtAmount(entry.closingAmount).replace("₹", "")}
              </span>
            </div>
            <span className="text-[10px] text-muted-foreground">revenue</span>
          </div>

          {/* Call duration */}
          <div className={cn("hidden md:block", isFullscreen ? "w-44" : "w-32")}>
            <CallBar mins={entry.callDurationMins} hit={entry.callDurationHit} />
          </div>
        </div>
      </div>

      {/* ── Lead status chips ─────────────────────────────────────────────── */}
      {entry.totalLeads > 0 && (
        <div className="mt-2.5 flex flex-wrap gap-1.5 pl-[52px]">
          {STATUS_CHIP_CONFIG.map(({ key, label, color }) => {
            const count = entry.leadCounts?.[key] ?? 0;
            if (count === 0) return null;
            return (
              <motion.span
                key={key}
                initial={{ scale: 0, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ type: "spring", stiffness: 400, damping: 20, delay: 0.05 }}
                className={cn(
                  "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                  color,
                )}
              >
                <span>{count}</span>
                <span className="opacity-80">{label}</span>
              </motion.span>
            );
          })}
          <span className="inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-semibold bg-muted/60 text-muted-foreground border border-border">
            {entry.totalLeads} total
          </span>
        </div>
      )}
    </motion.div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function LeaderboardPage() {
  const [month, setMonth]           = useState(currentMonthStr);
  const [isFullscreen, setIsFullscreen] = useState(false);
  const prevRanksRef = useRef<Map<string, number>>(new Map());
  const [rankDeltas, setRankDeltas] = useState<Map<string, number>>(new Map());

  const { data, isLoading, error, refetch, isFetching } = useLeaderboard(
    month,
    REFETCH_INTERVAL_MS,
  );

  // Track rank changes on every data refresh
  useEffect(() => {
    if (!data?.entries?.length) return;

    // Compute deltas vs previous snapshot FIRST
    const deltas = new Map<string, number>();
    data.entries.forEach((e) => {
      const prev = prevRanksRef.current.get(e.userId);
      if (prev != null && prev !== e.rank) {
        deltas.set(e.userId, prev - e.rank); // +ve = moved up
      }
    });

    // Always update the snapshot so next refresh compares against current ranks
    prevRanksRef.current = new Map(data.entries.map((e) => [e.userId, e.rank]));

    if (deltas.size > 0) {
      setRankDeltas(deltas);
      const t = setTimeout(() => setRankDeltas(new Map()), 6000);
      return () => clearTimeout(t);
    }
  }, [data]);

  // Fullscreen API
  const toggleFullscreen = useCallback(() => {
    if (!document.fullscreenElement) {
      document.documentElement.requestFullscreen?.().catch(() => {});
      setIsFullscreen(true);
    } else {
      document.exitFullscreen?.().catch(() => {});
      setIsFullscreen(false);
    }
  }, []);

  useEffect(() => {
    const handler = () => setIsFullscreen(!!document.fullscreenElement);
    document.addEventListener("fullscreenchange", handler);
    return () => document.removeEventListener("fullscreenchange", handler);
  }, []);

  const canGoNext = month < currentMonthStr();

  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.4 }}
      className={cn(
        "flex flex-col min-h-screen",
        isFullscreen ? "fixed inset-0 z-50 bg-background overflow-auto p-6" : "p-4 md:p-6",
      )}
    >
      {/* ── Header ─────────────────────────────────────────────────────────── */}
      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3">
          <motion.div
            animate={{ rotate: [0, -5, 5, 0] }}
            transition={{ duration: 3, repeat: Infinity, repeatDelay: 5 }}
            className="flex h-10 w-10 items-center justify-center rounded-xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-lg shadow-amber-500/30"
          >
            <Trophy className="h-5 w-5 text-white" />
          </motion.div>
          <div>
            <h1 className={cn("font-bold", isFullscreen ? "text-3xl" : "text-xl")}>
              Leaderboard
            </h1>
            <p className="text-xs text-muted-foreground">{monthLabel(month)}</p>
          </div>

          {/* LIVE badge */}
          <motion.div
            animate={{ opacity: [1, 0.5, 1] }}
            transition={{ duration: 1.5, repeat: Infinity }}
            className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-2.5 py-1 text-xs font-bold text-red-400"
          >
            <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
            LIVE
          </motion.div>
        </div>

        {/* Controls */}
        <div className="flex items-center gap-2 flex-wrap">
          {/* Month nav */}
          <div className="flex items-center gap-1 rounded-lg border border-border bg-muted/40 p-1">
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7"
              onClick={() => setMonth(prevMonth)}
            >
              <ChevronLeft className="h-3.5 w-3.5" />
            </Button>
            <span className="px-2 text-xs font-medium tabular-nums">{monthLabel(month)}</span>
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7"
              disabled={!canGoNext}
              onClick={() => setMonth(nextMonth)}
            >
              <ChevronRight className="h-3.5 w-3.5" />
            </Button>
          </div>

          {/* Countdown */}
          <LiveCountdown intervalMs={REFETCH_INTERVAL_MS} onRefetch={refetch} />

          {/* Manual refresh */}
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8"
            onClick={() => refetch()}
            disabled={isFetching}
            title="Refresh now"
          >
            <RefreshCw className={cn("h-3.5 w-3.5", isFetching && "animate-spin")} />
          </Button>

          {/* Fullscreen */}
          <Button
            variant="ghost" size="icon"
            className="h-8 w-8"
            onClick={toggleFullscreen}
            title={isFullscreen ? "Exit fullscreen" : "Fullscreen (TV mode)"}
          >
            {isFullscreen
              ? <Minimize2 className="h-3.5 w-3.5" />
              : <Maximize2 className="h-3.5 w-3.5" />
            }
          </Button>

          {/* Public link */}
          <Button
            variant="outline" size="sm"
            className="h-8 gap-1.5 text-xs"
            onClick={() => {
              const url = `${window.location.origin}/public/leaderboard`;
              navigator.clipboard?.writeText(url);
              window.open(url, "_blank");
            }}
            title="Open public leaderboard (shareable link)"
          >
            <Share2 className="h-3.5 w-3.5" />
            Public Link
          </Button>
        </div>
      </div>

      {/* ── Legend ─────────────────────────────────────────────────────────── */}
      <div className="mb-4 flex flex-wrap items-center gap-3 text-[11px] text-muted-foreground">
        <span className="flex items-center gap-1"><Target className="h-3 w-3 text-primary" /> Closings this month</span>
        <span className="flex items-center gap-1"><Phone className="h-3 w-3 text-blue-400" /> Total calls this month</span>
        <span className="flex items-center gap-1"><IndianRupee className="h-3 w-3 text-green-400" /> Revenue collected</span>
        <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-orange-400" /> ≥{CALL_TARGET_MINS} min call target</span>
        <span className="flex items-center gap-1 ml-auto">
          <Zap className="h-3 w-3 text-amber-400" />
          Sorted by closings → revenue → call time
        </span>
      </div>

      {/* ── Loading ─────────────────────────────────────────────────────────── */}
      {isLoading && (
        <div className="space-y-3">
          {Array.from({ length: 5 }).map((_, i) => (
            <motion.div
              key={i}
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: i * 0.08 }}
              className="h-16 rounded-xl bg-muted/40 animate-pulse"
            />
          ))}
        </div>
      )}

      {/* ── Error ───────────────────────────────────────────────────────────── */}
      {error && (
        <div className="rounded-xl border border-destructive/30 bg-destructive/10 p-6 text-center">
          <p className="text-sm text-destructive">Failed to load leaderboard — check backend connection.</p>
          <Button variant="outline" size="sm" className="mt-3" onClick={() => refetch()}>
            Try again
          </Button>
        </div>
      )}

      {/* ── Empty ───────────────────────────────────────────────────────────── */}
      {!isLoading && !error && data?.entries?.length === 0 && (
        <motion.div
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col items-center gap-4 py-20 text-center"
        >
          <div className="rounded-full bg-muted/60 p-6">
            <Trophy className="h-10 w-10 text-muted-foreground" />
          </div>
          <p className="text-muted-foreground">No activity recorded for {monthLabel(month)} yet.</p>
          <p className="text-xs text-muted-foreground">Rankings appear once agents log closings or calls.</p>
        </motion.div>
      )}

      {/* ── Leaderboard list ─────────────────────────────────────────────────── */}
      {!isLoading && !error && data?.entries && data.entries.length > 0 && (
        <div className="space-y-2 flex-1">
          <AnimatePresence mode="popLayout">
            {data.entries.map((entry, index) => (
              <LeaderboardCard
                key={entry.userId}
                entry={entry}
                delta={rankDeltas.get(entry.userId) ?? 0}
                index={index}
                isFullscreen={isFullscreen}
              />
            ))}
          </AnimatePresence>
        </div>
      )}

      {/* ── Footer ──────────────────────────────────────────────────────────── */}
      {data?.updatedAt && (
        <motion.p
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          className="mt-6 text-center text-[10px] text-muted-foreground"
        >
          Last updated:{" "}
          {new Date(data.updatedAt).toLocaleTimeString("en-IN", {
            timeZone: "Asia/Kolkata",
            hour: "2-digit",
            minute: "2-digit",
            second: "2-digit",
            hour12: true,
          })}{" "}
          IST
        </motion.p>
      )}
    </motion.div>
  );
}
