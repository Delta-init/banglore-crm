"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Crown, Medal, Flame, Clock, Target,
  ChevronLeft, ChevronRight, RefreshCw, TrendingUp, Zap,
} from "lucide-react";
import axios from "axios";
import type { LeaderboardEntry, LeaderboardData } from "@/types/reports";
import { cn } from "@/lib/utils";

// ─── Config ────────────────────────────────────────────────────────────────────
const API_BASE       = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";
const REFETCH_MS     = 30_000;
const CALL_TARGET    = 100;

const STATUS_CHIPS = [
  { key: "new",           label: "New",      color: "bg-blue-500/15 text-blue-300 border-blue-500/25"      },
  { key: "followup",      label: "Followup", color: "bg-violet-500/15 text-violet-300 border-violet-500/25" },
  { key: "callback",      label: "Callback", color: "bg-amber-500/15 text-amber-300 border-amber-500/25"   },
  { key: "cnc",           label: "CNC",      color: "bg-orange-500/15 text-orange-300 border-orange-500/25"},
  { key: "not_connected", label: "Off",      color: "bg-slate-500/15 text-slate-300 border-slate-500/25"   },
  { key: "closed",        label: "Closed",   color: "bg-green-500/15 text-green-300 border-green-500/25"   },
  { key: "lost",          label: "Lost",     color: "bg-red-500/15 text-red-300 border-red-500/25"         },
] as const;

// ─── Helpers ───────────────────────────────────────────────────────────────────
function currentMonth() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function monthLabel(m: string) {
  const [y, mo] = m.split("-").map(Number);
  return new Date(y, mo - 1).toLocaleString("en-IN", { month: "long", year: "numeric" });
}
function prevMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo - 2);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function nextMonth(m: string) {
  const [y, mo] = m.split("-").map(Number);
  const d = new Date(y, mo);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}
function fmtMins(mins: number) {
  return mins >= 60 ? `${Math.floor(mins / 60)}h ${mins % 60}m` : `${mins}m`;
}

// ─── Rank badge ────────────────────────────────────────────────────────────────
function RankBadge({ rank }: { rank: number }) {
  if (rank === 1) return (
    <motion.div animate={{ rotate: [0,-8,8,-5,5,0], scale: [1,1.15,1] }}
      transition={{ duration:2, repeat:Infinity, repeatDelay:4 }}
      className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-yellow-300 to-amber-500 shadow-lg shadow-amber-500/40">
      <Crown className="h-6 w-6 text-amber-900" />
    </motion.div>
  );
  if (rank === 2) return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-slate-300 to-slate-400 shadow-lg shadow-slate-400/30">
      <Medal className="h-6 w-6 text-slate-700" />
    </div>
  );
  if (rank === 3) return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-gradient-to-br from-orange-300 to-orange-500 shadow-lg shadow-orange-400/30">
      <Medal className="h-6 w-6 text-orange-900" />
    </div>
  );
  return (
    <div className="flex h-12 w-12 items-center justify-center rounded-full bg-white/10 text-white/60 font-bold text-base">
      #{rank}
    </div>
  );
}

// ─── Leaderboard Card ──────────────────────────────────────────────────────────
function LeaderCard({ entry, index }: { entry: LeaderboardEntry; index: number }) {
  const cardBg =
    entry.rank === 1 ? "bg-gradient-to-r from-amber-500/20 via-yellow-400/10 to-transparent border-amber-400/40" :
    entry.rank === 2 ? "bg-gradient-to-r from-slate-400/20 via-slate-300/10 to-transparent border-slate-400/30" :
    entry.rank === 3 ? "bg-gradient-to-r from-orange-400/20 via-orange-300/10 to-transparent border-orange-400/30" :
                       "bg-white/5 border-white/10 hover:border-white/20";

  const pct    = Math.min((entry.callDurationMins / CALL_TARGET) * 100, 100);
  const hitCall= entry.callDurationHit;

  return (
    <motion.div
      layout
      layoutId={entry.userId}
      initial={{ opacity: 0, x: -40 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 40 }}
      transition={{ type:"spring", stiffness:260, damping:28, delay: index * 0.04 }}
      className={cn("relative rounded-2xl border px-5 py-4 transition-colors", cardBg)}
    >
      {entry.rank === 1 && (
        <motion.div className="pointer-events-none absolute inset-0 rounded-2xl"
          animate={{ opacity: [0.3,0.7,0.3] }} transition={{ duration:2.5, repeat:Infinity }}
          style={{ boxShadow: "inset 0 0 40px rgba(245,158,11,0.12)" }} />
      )}

      <div className="flex items-center gap-4">
        <RankBadge rank={entry.rank} />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className={cn("font-bold truncate text-base",
            entry.rank === 1 ? "text-amber-300 text-lg" : "text-white"
          )}>
            {entry.name}
          </p>
          {entry.extension && (
            <p className="text-xs text-white/40">Ext {entry.extension}</p>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-5">
          {/* Closings */}
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center">
              <Target className="h-3.5 w-3.5 text-primary/70" />
              <span className={cn("text-xl font-bold tabular-nums",
                entry.closings > 0 ? "text-primary" : "text-white/30"
              )}>
                {entry.closings}
              </span>
            </div>
            <p className="text-[10px] text-white/40 mt-0.5">closings</p>
          </div>

          {/* Total leads */}
          <div className="text-center hidden sm:block">
            <div className="flex items-center gap-1 justify-center">
              <TrendingUp className="h-3.5 w-3.5 text-cyan-400/70" />
              <span className={cn("text-xl font-bold tabular-nums",
                entry.totalLeads > 0 ? "text-cyan-300" : "text-white/30"
              )}>
                {entry.totalLeads ?? 0}
              </span>
            </div>
            <p className="text-[10px] text-white/40 mt-0.5">leads</p>
          </div>

          {/* Call bar */}
          <div className="hidden md:flex flex-col gap-1 w-36">
            <div className="flex items-center gap-1.5">
              {hitCall
                ? <motion.div animate={{ scale:[1,1.2,1] }} transition={{ duration:1.5, repeat:Infinity }}>
                    <Flame className="h-3.5 w-3.5 text-orange-400" />
                  </motion.div>
                : <Clock className="h-3.5 w-3.5 text-white/30" />
              }
              <span className={cn("text-sm font-semibold tabular-nums",
                hitCall ? "text-orange-300" : "text-white/40"
              )}>
                {fmtMins(entry.callDurationMins)}
              </span>
            </div>
            <div className="h-1.5 bg-white/10 rounded-full overflow-hidden">
              <motion.div
                className={cn("h-full rounded-full",
                  hitCall ? "bg-gradient-to-r from-orange-400 to-red-500" : "bg-white/20"
                )}
                initial={{ width: 0 }}
                animate={{ width: `${pct}%` }}
                transition={{ duration: 1, ease: "easeOut" }}
              />
            </div>
          </div>
        </div>
      </div>

      {/* Status chips */}
      {(entry.totalLeads ?? 0) > 0 && (
        <div className="mt-3 flex flex-wrap gap-1.5 pl-16">
          {STATUS_CHIPS.map(({ key, label, color }) => {
            const count = entry.leadCounts?.[key] ?? 0;
            if (!count) return null;
            return (
              <span key={key} className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                color,
              )}>
                <span>{count}</span>
                <span className="opacity-70">{label}</span>
              </span>
            );
          })}
        </div>
      )}
    </motion.div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────
export default function PublicLeaderboardPage() {
  const [month, setMonth]     = useState(currentMonth);
  const [data,  setData]      = useState<LeaderboardData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error,   setError]   = useState(false);
  const [lastUpdated, setLastUpdated] = useState("");

  const fetchData = useCallback(async (m: string) => {
    try {
      setLoading(true); setError(false);
      const res = await axios.get<{ success: boolean; data: LeaderboardData }>(
        `${API_BASE}/public/leaderboard?month=${m}`
      );
      setData(res.data.data);
      setLastUpdated(new Date().toLocaleTimeString("en-IN", {
        timeZone: "Asia/Kolkata", hour: "2-digit", minute: "2-digit", second: "2-digit", hour12: true,
      }));
    } catch {
      setError(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => { fetchData(month); }, [month, fetchData]);

  // Auto-refresh every 30s
  useEffect(() => {
    const t = setInterval(() => fetchData(month), REFETCH_MS);
    return () => clearInterval(t);
  }, [month, fetchData]);

  const canNext = month < currentMonth();

  return (
    <div className="min-h-screen bg-[#0a0a14] text-white">
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className="absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full bg-amber-500/5 blur-[100px]" />
        <div className="absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full bg-primary/5 blur-[100px]" />
      </div>

      <div className="relative mx-auto max-w-3xl px-4 py-8">

        {/* ── Header ─────────────────────────────────────────────────────── */}
        <div className="mb-8 flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <motion.div
              animate={{ rotate: [0,-5,5,0] }}
              transition={{ duration:3, repeat:Infinity, repeatDelay:5 }}
              className="flex h-14 w-14 items-center justify-center rounded-2xl bg-gradient-to-br from-amber-400 to-orange-500 shadow-xl shadow-amber-500/30"
            >
              <Trophy className="h-7 w-7 text-white" />
            </motion.div>

            <div>
              <h1 className="text-2xl font-bold text-white">Leaderboard</h1>
              <p className="text-sm text-white/50">{monthLabel(month)}</p>
            </div>

            {/* LIVE badge */}
            <motion.div
              animate={{ opacity:[1,0.5,1] }} transition={{ duration:1.5, repeat:Infinity }}
              className="flex items-center gap-1.5 rounded-full border border-red-500/30 bg-red-500/10 px-3 py-1 text-xs font-bold text-red-400"
            >
              <span className="h-1.5 w-1.5 rounded-full bg-red-400" />
              LIVE
            </motion.div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            <div className="flex items-center gap-1 rounded-xl border border-white/10 bg-white/5 p-1">
              <button onClick={() => setMonth(prevMonth)}
                className="rounded-lg p-1.5 hover:bg-white/10 transition-colors">
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-sm font-medium">{monthLabel(month)}</span>
              <button onClick={() => setMonth(nextMonth)} disabled={!canNext}
                className="rounded-lg p-1.5 hover:bg-white/10 transition-colors disabled:opacity-30">
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            <button onClick={() => fetchData(month)}
              className="rounded-xl border border-white/10 bg-white/5 p-2 hover:bg-white/10 transition-colors">
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className="mb-5 flex flex-wrap gap-3 text-[11px] text-white/40">
          <span className="flex items-center gap-1"><Target className="h-3 w-3 text-primary/60" /> Closings this month</span>
          <span className="flex items-center gap-1"><TrendingUp className="h-3 w-3 text-cyan-400/60" /> Total assigned leads</span>
          <span className="flex items-center gap-1"><Flame className="h-3 w-3 text-orange-400/60" /> ≥{CALL_TARGET} min call target</span>
          <span className="flex items-center gap-1 ml-auto"><Zap className="h-3 w-3 text-amber-400/60" /> Delta Institutions CRM</span>
        </div>

        {/* Loading */}
        {loading && (
          <div className="space-y-3">
            {Array.from({ length: 6 }).map((_, i) => (
              <motion.div key={i} initial={{ opacity:0 }} animate={{ opacity:1 }}
                transition={{ delay: i * 0.07 }}
                className="h-20 rounded-2xl bg-white/5 animate-pulse" />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className="rounded-2xl border border-red-500/20 bg-red-500/10 p-8 text-center">
            <p className="text-red-400">Could not load leaderboard. Check your connection.</p>
            <button onClick={() => fetchData(month)}
              className="mt-3 rounded-lg bg-red-500/20 px-4 py-2 text-sm text-red-300 hover:bg-red-500/30">
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && (!data?.entries || data.entries.length === 0) && (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
            className="flex flex-col items-center gap-4 py-24 text-center">
            <div className="rounded-full bg-white/5 p-8">
              <Trophy className="h-12 w-12 text-white/20" />
            </div>
            <p className="text-white/40">No activity recorded for {monthLabel(month)} yet.</p>
          </motion.div>
        )}

        {/* Entries */}
        {!loading && !error && data?.entries && data.entries.length > 0 && (
          <div className="space-y-2.5">
            <AnimatePresence mode="popLayout">
              {data.entries.map((entry, i) => (
                <LeaderCard key={entry.userId} entry={entry} index={i} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Footer */}
        {lastUpdated && (
          <p className="mt-8 text-center text-[11px] text-white/25">
            Last updated: {lastUpdated} IST · Auto-refreshes every 30s
          </p>
        )}

        {/* Branding */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <div className="h-px w-16 bg-white/10" />
          <span className="text-[11px] text-white/20 font-medium tracking-wide uppercase">
            Delta Institutions CRM
          </span>
          <div className="h-px w-16 bg-white/10" />
        </div>

      </div>
    </div>
  );
}
