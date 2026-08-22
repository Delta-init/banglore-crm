"use client";

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { CalendarDays, ChevronLeft, ChevronRight, Split, Users, Inbox } from "lucide-react";
import { useTeamDailySourceSplit } from "@/hooks/useTeams";
import { getInitials } from "@/lib/utils";

// ─── Source colours (stable per source across the day view) ──────────────────
const SOURCE_COLOURS = [
  "bg-blue-500", "bg-violet-500", "bg-orange-500", "bg-green-500",
  "bg-pink-500", "bg-teal-500", "bg-yellow-500", "bg-red-500",
];

// ─── Date helpers (IST day, matching the split scheduler timezone) ────────────
function todayIST(): string {
  return new Date().toLocaleDateString("en-CA", { timeZone: "Asia/Kolkata" });
}
function shiftDay(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
function formatDayLabel(date: string): string {
  return new Date(`${date}T12:00:00Z`).toLocaleDateString("en-GB", {
    weekday: "short", day: "2-digit", month: "short", year: "numeric", timeZone: "UTC",
  });
}

interface DailySplitTabProps {
  teamId: string;
}

export function DailySplitTab({ teamId }: DailySplitTabProps) {
  const [date, setDate] = useState<string>(todayIST());
  const { data, isLoading, error } = useTeamDailySourceSplit(teamId, date);

  const isToday = date === todayIST();

  const sourceColourMap = useMemo(() => {
    const map = new Map<string, string>();
    (data?.sourceTotals ?? []).forEach((s, i) => map.set(s.source, SOURCE_COLOURS[i % SOURCE_COLOURS.length]));
    return map;
  }, [data?.sourceTotals]);

  return (
    <motion.div initial={{ opacity: 0, y: 8 }} animate={{ opacity: 1, y: 0 }} className="space-y-4">
      {/* Header: title + date picker */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-2.5">
          <div className="flex h-9 w-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
            <Split className="h-4 w-4" />
          </div>
          <div>
            <h3 className="text-sm font-semibold text-foreground">Daily Split</h3>
            <p className="text-[11px] text-muted-foreground">
              Actual sources each member received on the selected day (IST)
            </p>
          </div>
        </div>

        <div className="flex items-center gap-1.5">
          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => setDate((d) => shiftDay(d, -1))}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors"
            aria-label="Previous day"
          >
            <ChevronLeft className="h-4 w-4" />
          </motion.button>

          <div className="relative flex items-center gap-2 rounded-lg border border-border/50 bg-card px-3 py-1.5">
            <CalendarDays className="h-3.5 w-3.5 text-primary shrink-0" />
            <span className="text-xs font-medium text-foreground whitespace-nowrap tabular-nums">
              {formatDayLabel(date)}
            </span>
            {isToday && (
              <span className="rounded-full bg-primary/10 border border-primary/20 px-1.5 py-px text-[9px] font-bold text-primary">
                TODAY
              </span>
            )}
            <input
              type="date"
              value={date}
              max={todayIST()}
              onChange={(e) => e.target.value && setDate(e.target.value)}
              className="absolute inset-0 cursor-pointer opacity-0 [color-scheme:dark]"
              aria-label="Pick date"
            />
          </div>

          <motion.button
            whileTap={{ scale: 0.94 }}
            onClick={() => setDate((d) => shiftDay(d, 1))}
            disabled={isToday}
            className="flex h-8 w-8 items-center justify-center rounded-lg border border-border/50 bg-card text-muted-foreground hover:text-foreground hover:bg-muted/40 transition-colors disabled:opacity-30 disabled:pointer-events-none"
            aria-label="Next day"
          >
            <ChevronRight className="h-4 w-4" />
          </motion.button>

          {!isToday && (
            <motion.button
              whileTap={{ scale: 0.96 }}
              onClick={() => setDate(todayIST())}
              className="rounded-lg border border-primary/30 bg-primary/10 px-2.5 py-1.5 text-[11px] font-semibold text-primary hover:bg-primary/15 transition-colors"
            >
              Today
            </motion.button>
          )}
        </div>
      </div>

      {/* Body */}
      {isLoading ? (
        <div className="space-y-2">
          {Array.from({ length: 5 }).map((_, i) => (
            <div key={i} className="h-14 animate-pulse rounded-xl border border-border/30 bg-muted/20" />
          ))}
        </div>
      ) : error ? (
        <div className="rounded-2xl border border-red-500/20 bg-red-500/5 p-6 text-center">
          <p className="text-sm text-red-400">Failed to load daily split</p>
          <p className="mt-1 text-[11px] text-muted-foreground">{(error as { message?: string })?.message ?? "Unknown error"}</p>
        </div>
      ) : !data || data.totalAssigned === 0 ? (
        <motion.div
          initial={{ opacity: 0, scale: 0.97 }}
          animate={{ opacity: 1, scale: 1 }}
          className="flex flex-col items-center justify-center rounded-2xl border border-border/40 bg-card py-14"
        >
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-muted/30 text-muted-foreground">
            <Inbox className="h-5 w-5" />
          </div>
          <p className="mt-3 text-sm font-medium text-foreground">No leads assigned this day</p>
          <p className="mt-0.5 text-[11px] text-muted-foreground">Nothing was distributed to members on {formatDayLabel(date)}</p>
        </motion.div>
      ) : (
        <div className="rounded-2xl border border-border/40 bg-card overflow-hidden">
          {/* Summary strip */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 border-b border-border/40 bg-muted/10 px-5 py-3">
            <div className="flex items-center gap-1.5">
              <Users className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground tabular-nums">{data.members.length}</span>
              <span className="text-[11px] text-muted-foreground">members</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Split className="h-3.5 w-3.5 text-primary" />
              <span className="text-xs font-semibold text-foreground tabular-nums">{data.totalAssigned}</span>
              <span className="text-[11px] text-muted-foreground">leads assigned</span>
            </div>
            <div className="flex flex-wrap items-center gap-1.5 ml-auto">
              {data.sourceTotals.map((s) => (
                <span
                  key={s.source}
                  className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${sourceColourMap.get(s.source) ?? "bg-gray-500"}`}
                >
                  {s.source}<span className="opacity-80">×{s.count}</span>
                </span>
              ))}
            </div>
          </div>

          {/* Member rows */}
          <div className="p-4 space-y-2">
            <AnimatePresence mode="popLayout">
              {data.members.map((m, idx) => (
                <motion.div
                  key={`${date}-${m.memberId}`}
                  initial={{ opacity: 0, x: -6 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0 }}
                  transition={{ delay: idx * 0.04 }}
                  className="flex items-center gap-3 rounded-xl border border-border/30 bg-muted/10 px-3 py-2.5"
                >
                  <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[10px] font-bold">
                    {getInitials(m.memberName)}
                  </div>
                  <div className="w-28 shrink-0 min-w-0">
                    <p className="truncate text-xs font-medium text-foreground">{m.memberName}</p>
                    {m.designation && <p className="truncate text-[10px] text-muted-foreground">{m.designation}</p>}
                  </div>
                  <div className="flex flex-wrap gap-1.5 flex-1 min-w-0">
                    {m.sources.map((s) => (
                      <motion.span
                        key={s.source}
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className={`inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[10px] font-semibold text-white ${sourceColourMap.get(s.source) ?? "bg-gray-500"}`}
                      >
                        {s.source}<span className="opacity-80">×{s.count}</span>
                      </motion.span>
                    ))}
                  </div>
                  <span className="shrink-0 rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[10px] font-bold text-primary">
                    +{m.total}
                  </span>
                </motion.div>
              ))}
            </AnimatePresence>
          </div>
        </div>
      )}
    </motion.div>
  );
}

export default DailySplitTab;
