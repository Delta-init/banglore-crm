"use client";

import { Repeat } from "lucide-react";

/*
 * "Came in again" — a lead whose number arrived again after the first time (2026-10-23): handed back to whoever holds
 * it as a new lead, the same record with all its history. ×N counts every time it came in, the first included.
 */
export function CameAgainTag({ count, last, className = "" }: { count?: number | null; last?: string | null; className?: string }) {
  if (!count || count < 1) return null;
  const when = last
    ? new Intl.DateTimeFormat("en-GB", { timeZone: "Asia/Dubai", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }).format(new Date(last))
    : null;
  return (
    <span
      title={`This number came in ${count + 1} times${when ? ` — last on ${when} GST` : ""}`}
      className={`inline-flex shrink-0 items-center gap-1 rounded-full border border-orange-500/30 bg-orange-500/10 px-1.5 py-px text-[10px] font-semibold text-orange-500 ${className}`}
    >
      <Repeat className="h-2.5 w-2.5" /> Came in again ×{count + 1}
    </span>
  );
}

export default CameAgainTag;
