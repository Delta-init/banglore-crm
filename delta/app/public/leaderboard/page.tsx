"use client";

import { useState, useEffect, useCallback } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy, Crown, Medal, Flame, Clock, Target, Phone,
  ChevronLeft, ChevronRight, RefreshCw, TrendingUp, Zap, Sun, Moon,
} from "lucide-react";
import axios from "axios";
import type { LeaderboardEntry, LeaderboardData } from "@/types/reports";
import { cn } from "@/lib/utils";

// ─── Config ────────────────────────────────────────────────────────────────────
const API_BASE    = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5000/api/v1";
const REFETCH_MS  = 30_000;
const CALL_TARGET = 100;

const STATUS_CHIPS: Array<{ key: string; label: string; dark: string; light: string }> = [
  { key: "new",           label: "New",      dark: "bg-blue-500/15 text-blue-300 border-blue-500/25",       light: "bg-blue-100 text-blue-700 border-blue-200"     },
  { key: "followup",      label: "Followup", dark: "bg-violet-500/15 text-violet-300 border-violet-500/25", light: "bg-violet-100 text-violet-700 border-violet-200" },
  { key: "callback",      label: "Callback", dark: "bg-amber-500/15 text-amber-300 border-amber-500/25",    light: "bg-amber-100 text-amber-700 border-amber-200"   },
  { key: "cnc",           label: "CNC",      dark: "bg-orange-500/15 text-orange-300 border-orange-500/25", light: "bg-orange-100 text-orange-700 border-orange-200" },
  { key: "not_connected", label: "Off",      dark: "bg-slate-500/15 text-slate-300 border-slate-500/25",    light: "bg-slate-100 text-slate-600 border-slate-200"   },
  { key: "closed",        label: "Closed",   dark: "bg-green-500/15 text-green-300 border-green-500/25",    light: "bg-green-100 text-green-700 border-green-200"   },
  { key: "lost",          label: "Lost",     dark: "bg-red-500/15 text-red-300 border-red-500/25",          light: "bg-red-100 text-red-700 border-red-200"         },
];

// ─── Helpers ───────────────────────────────────────────────────────────────────
function currentMonth() {
  const ist = new Date(Date.now() + 5.5 * 60 * 60 * 1000);
  return `${ist.getUTCFullYear()}-${String(ist.getUTCMonth() + 1).padStart(2, "0")}`;
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
function RankBadge({ rank, isDark }: { rank: number; isDark: boolean }) {
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
    <div className={cn(
      "flex h-12 w-12 items-center justify-center rounded-full font-bold text-base",
      isDark ? "bg-white/10 text-white/60" : "bg-gray-100 text-gray-500",
    )}>
      #{rank}
    </div>
  );
}

// ─── Leaderboard Card ──────────────────────────────────────────────────────────
function LeaderCard({ entry, index, isDark }: { entry: LeaderboardEntry; index: number; isDark: boolean }) {
  const cardBg =
    entry.rank === 1
      ? (isDark
          ? "bg-gradient-to-r from-amber-500/20 via-yellow-400/10 to-transparent border-amber-400/40"
          : "bg-gradient-to-r from-amber-50 via-yellow-50/60 to-transparent border-amber-300 shadow-sm")
      : entry.rank === 2
      ? (isDark
          ? "bg-gradient-to-r from-slate-400/20 via-slate-300/10 to-transparent border-slate-400/30"
          : "bg-gradient-to-r from-gray-100 via-gray-50 to-transparent border-gray-300 shadow-sm")
      : entry.rank === 3
      ? (isDark
          ? "bg-gradient-to-r from-orange-400/20 via-orange-300/10 to-transparent border-orange-400/30"
          : "bg-gradient-to-r from-orange-50 via-amber-50/60 to-transparent border-orange-200 shadow-sm")
      : (isDark
          ? "bg-white/5 border-white/10 hover:border-white/20"
          : "bg-white border-gray-200 hover:border-gray-300 shadow-sm");

  const pct     = Math.min((entry.callDurationMins / CALL_TARGET) * 100, 100);
  const hitCall = entry.callDurationHit;

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
          style={{ boxShadow: isDark
            ? "inset 0 0 40px rgba(245,158,11,0.12)"
            : "inset 0 0 40px rgba(245,158,11,0.06)" }} />
      )}

      <div className="flex items-center gap-4">
        <RankBadge rank={entry.rank} isDark={isDark} />

        {/* Name */}
        <div className="flex-1 min-w-0">
          <p className={cn("font-bold truncate text-base",
            entry.rank === 1
              ? (isDark ? "text-amber-300 text-lg" : "text-amber-700 text-lg")
              : (isDark ? "text-white" : "text-gray-900"),
          )}>
            {entry.name}
          </p>
          {entry.extension && (
            <p className={cn("text-xs", isDark ? "text-white/40" : "text-gray-400")}>
              Ext {entry.extension}
            </p>
          )}
        </div>

        {/* Stats */}
        <div className="flex items-center gap-5">
          {/* Closings */}
          <div className="text-center">
            <div className="flex items-center gap-1 justify-center">
              <Target className="h-3.5 w-3.5 text-primary/70" />
              <span className={cn("text-xl font-bold tabular-nums",
                entry.closings > 0 ? "text-primary" : (isDark ? "text-white/30" : "text-gray-300"),
              )}>
                {entry.closings}
              </span>
            </div>
            <p className={cn("text-[10px] mt-0.5", isDark ? "text-white/40" : "text-gray-400")}>closings</p>
          </div>

          {/* Call count */}
          <div className="text-center hidden sm:block">
            <div className="flex items-center gap-1 justify-center">
              <Phone className="h-3.5 w-3.5 text-blue-400/70" />
              <span className={cn("text-xl font-bold tabular-nums",
                (entry.callCount ?? 0) > 0
                  ? (isDark ? "text-blue-300" : "text-blue-600")
                  : (isDark ? "text-white/30" : "text-gray-300"),
              )}>
                {entry.callCount ?? 0}
              </span>
            </div>
            <p className={cn("text-[10px] mt-0.5", isDark ? "text-white/40" : "text-gray-400")}>calls</p>
          </div>

          {/* Total leads */}
          <div className="text-center hidden sm:block">
            <div className="flex items-center gap-1 justify-center">
              <TrendingUp className="h-3.5 w-3.5 text-cyan-400/70" />
              <span className={cn("text-xl font-bold tabular-nums",
                entry.totalLeads > 0
                  ? (isDark ? "text-cyan-300" : "text-cyan-600")
                  : (isDark ? "text-white/30" : "text-gray-300"),
              )}>
                {entry.totalLeads ?? 0}
              </span>
            </div>
            <p className={cn("text-[10px] mt-0.5", isDark ? "text-white/40" : "text-gray-400")}>leads</p>
          </div>

          {/* Call bar */}
          <div className="hidden md:flex flex-col gap-1 w-36">
            <div className="flex items-center gap-1.5">
              {hitCall
                ? <motion.div animate={{ scale:[1,1.2,1] }} transition={{ duration:1.5, repeat:Infinity }}>
                    <Flame className="h-3.5 w-3.5 text-orange-400" />
                  </motion.div>
                : <Clock className={cn("h-3.5 w-3.5", isDark ? "text-white/30" : "text-gray-300")} />
              }
              <span className={cn("text-sm font-semibold tabular-nums",
                hitCall
                  ? (isDark ? "text-orange-300" : "text-orange-500")
                  : (isDark ? "text-white/40" : "text-gray-400"),
              )}>
                {fmtMins(entry.callDurationMins)}
              </span>
            </div>
            <div className={cn("h-1.5 rounded-full overflow-hidden", isDark ? "bg-white/10" : "bg-gray-200")}>
              <motion.div
                className={cn("h-full rounded-full",
                  hitCall
                    ? "bg-gradient-to-r from-orange-400 to-red-500"
                    : (isDark ? "bg-white/20" : "bg-gray-300"),
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
          {STATUS_CHIPS.map(({ key, label, dark, light }) => {
            const count = entry.leadCounts?.[key] ?? 0;
            if (!count) return null;
            return (
              <span key={key} className={cn(
                "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold border",
                isDark ? dark : light,
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
  const [isDark, setIsDark] = useState(true);
  const [month,  setMonth]  = useState(currentMonth);
  const [data,   setData]   = useState<LeaderboardData | null>(null);
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

  useEffect(() => {
    const t = setInterval(() => fetchData(month), REFETCH_MS);
    return () => clearInterval(t);
  }, [month, fetchData]);

  const canNext = month < currentMonth();

  return (
    <div className={cn(
      "min-h-screen transition-colors duration-300",
      isDark ? "bg-[#0a0a14] text-white" : "bg-gray-50 text-gray-900",
    )}>
      {/* Background */}
      <div className="pointer-events-none fixed inset-0 overflow-hidden">
        <div className={cn(
          "absolute -top-40 -left-40 h-[600px] w-[600px] rounded-full blur-[100px] transition-colors duration-300",
          isDark ? "bg-amber-500/5" : "bg-amber-500/10",
        )} />
        <div className={cn(
          "absolute -bottom-40 -right-40 h-[600px] w-[600px] rounded-full blur-[100px] transition-colors duration-300",
          isDark ? "bg-primary/5" : "bg-primary/8",
        )} />
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
              <h1 className="text-2xl font-bold">Leaderboard</h1>
              <p className={cn("text-sm", isDark ? "text-white/50" : "text-gray-500")}>{monthLabel(month)}</p>
            </div>

            {/* LIVE badge */}
            <motion.div
              animate={{ opacity:[1,0.5,1] }} transition={{ duration:1.5, repeat:Infinity }}
              className={cn(
                "flex items-center gap-1.5 rounded-full border px-3 py-1 text-xs font-bold",
                isDark ? "border-red-500/30 bg-red-500/10 text-red-400" : "border-red-300 bg-red-50 text-red-500",
              )}
            >
              <span className={cn("h-1.5 w-1.5 rounded-full", isDark ? "bg-red-400" : "bg-red-500")} />
              LIVE
            </motion.div>
          </div>

          {/* Controls */}
          <div className="flex items-center gap-2">
            {/* Month nav */}
            <div className={cn(
              "flex items-center gap-1 rounded-xl border p-1 transition-colors",
              isDark ? "border-white/10 bg-white/5" : "border-gray-200 bg-white shadow-sm",
            )}>
              <button
                onClick={() => setMonth(prevMonth)}
                className={cn("rounded-lg p-1.5 transition-colors", isDark ? "hover:bg-white/10" : "hover:bg-gray-100")}
              >
                <ChevronLeft className="h-4 w-4" />
              </button>
              <span className="px-2 text-sm font-medium">{monthLabel(month)}</span>
              <button
                onClick={() => setMonth(nextMonth)} disabled={!canNext}
                className={cn("rounded-lg p-1.5 transition-colors disabled:opacity-30", isDark ? "hover:bg-white/10" : "hover:bg-gray-100")}
              >
                <ChevronRight className="h-4 w-4" />
              </button>
            </div>

            {/* Refresh */}
            <button
              onClick={() => fetchData(month)}
              className={cn(
                "rounded-xl border p-2 transition-colors",
                isDark ? "border-white/10 bg-white/5 hover:bg-white/10" : "border-gray-200 bg-white shadow-sm hover:bg-gray-100",
              )}
            >
              <RefreshCw className={cn("h-4 w-4", loading && "animate-spin")} />
            </button>

            {/* Theme toggle */}
            <button
              onClick={() => setIsDark(d => !d)}
              title={isDark ? "Switch to light mode" : "Switch to dark mode"}
              className={cn(
                "rounded-xl border p-2 transition-colors",
                isDark
                  ? "border-white/10 bg-white/5 hover:bg-white/10 text-amber-300"
                  : "border-gray-200 bg-white shadow-sm hover:bg-gray-100 text-gray-500",
              )}
            >
              <AnimatePresence mode="wait" initial={false}>
                {isDark ? (
                  <motion.div key="sun"
                    initial={{ rotate: -90, opacity: 0, scale: 0.8 }}
                    animate={{ rotate: 0,   opacity: 1, scale: 1   }}
                    exit={{    rotate:  90, opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Sun className="h-4 w-4" />
                  </motion.div>
                ) : (
                  <motion.div key="moon"
                    initial={{ rotate:  90, opacity: 0, scale: 0.8 }}
                    animate={{ rotate:  0,  opacity: 1, scale: 1   }}
                    exit={{    rotate: -90, opacity: 0, scale: 0.8 }}
                    transition={{ duration: 0.2 }}
                  >
                    <Moon className="h-4 w-4" />
                  </motion.div>
                )}
              </AnimatePresence>
            </button>
          </div>
        </div>

        {/* Legend */}
        <div className={cn("mb-5 flex flex-wrap gap-3 text-[11px]", isDark ? "text-white/40" : "text-gray-400")}>
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
                className={cn("h-20 rounded-2xl animate-pulse", isDark ? "bg-white/5" : "bg-gray-100")}
              />
            ))}
          </div>
        )}

        {/* Error */}
        {!loading && error && (
          <div className={cn("rounded-2xl border p-8 text-center",
            isDark ? "border-red-500/20 bg-red-500/10" : "border-red-200 bg-red-50",
          )}>
            <p className={isDark ? "text-red-400" : "text-red-600"}>
              Could not load leaderboard. Check your connection.
            </p>
            <button
              onClick={() => fetchData(month)}
              className={cn("mt-3 rounded-lg px-4 py-2 text-sm",
                isDark ? "bg-red-500/20 text-red-300 hover:bg-red-500/30" : "bg-red-100 text-red-600 hover:bg-red-200",
              )}
            >
              Retry
            </button>
          </div>
        )}

        {/* Empty */}
        {!loading && !error && (!data?.entries || data.entries.length === 0) && (
          <motion.div initial={{ opacity:0, y:20 }} animate={{ opacity:1, y:0 }}
            className="flex flex-col items-center gap-4 py-24 text-center">
            <div className={cn("rounded-full p-8", isDark ? "bg-white/5" : "bg-gray-100")}>
              <Trophy className={cn("h-12 w-12", isDark ? "text-white/20" : "text-gray-300")} />
            </div>
            <p className={isDark ? "text-white/40" : "text-gray-400"}>
              No activity recorded for {monthLabel(month)} yet.
            </p>
          </motion.div>
        )}

        {/* Entries */}
        {!loading && !error && data?.entries && data.entries.length > 0 && (
          <div className="space-y-2.5">
            <AnimatePresence mode="popLayout">
              {data.entries.map((entry, i) => (
                <LeaderCard key={entry.userId} entry={entry} index={i} isDark={isDark} />
              ))}
            </AnimatePresence>
          </div>
        )}

        {/* Footer */}
        {lastUpdated && (
          <p className={cn("mt-8 text-center text-[11px]", isDark ? "text-white/25" : "text-gray-400")}>
            Last updated: {lastUpdated} IST · Auto-refreshes every 30s
          </p>
        )}

        {/* Branding */}
        <div className="mt-6 flex items-center justify-center gap-2">
          <div className={cn("h-px w-16", isDark ? "bg-white/10" : "bg-gray-200")} />
          <span className={cn("text-[11px] font-medium tracking-wide uppercase",
            isDark ? "text-white/20" : "text-gray-300",
          )}>
            Delta Institutions CRM
          </span>
          <div className={cn("h-px w-16", isDark ? "bg-white/10" : "bg-gray-200")} />
        </div>

      </div>
    </div>
  );
}
