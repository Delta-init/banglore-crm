"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, BellOff, Check, Clock, Search, User, ChevronLeft, ChevronRight,
  AlertCircle, Calendar, Filter, X,
} from "lucide-react";
import { useTeamReminders, type TeamRemindersFilters } from "@/hooks/useTeams";
import type { TeamReminderItem } from "@/types/team";

// ─── Status badge helper ───────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = {
  new:            "bg-blue-500/15 text-blue-400 border-blue-500/30",
  assigned:       "bg-yellow-500/15 text-yellow-400 border-yellow-500/30",
  followup:       "bg-orange-500/15 text-orange-400 border-orange-500/30",
  closed:         "bg-green-500/15 text-green-400 border-green-500/30",
  rejected:       "bg-red-500/15 text-red-400 border-red-500/30",
  cnc:            "bg-slate-500/15 text-slate-400 border-slate-500/30",
  booking:        "bg-teal-500/15 text-teal-400 border-teal-500/30",
  partialbooking: "bg-pink-500/15 text-pink-400 border-pink-500/30",
  interested:     "bg-violet-500/15 text-violet-400 border-violet-500/30",
  rnr:            "bg-amber-500/15 text-amber-400 border-amber-500/30",
  callback:       "bg-sky-500/15 text-sky-400 border-sky-500/30",
  whatsapp:       "bg-emerald-500/15 text-emerald-400 border-emerald-500/30",
  student:        "bg-indigo-500/15 text-indigo-400 border-indigo-500/30",
};

const STATUS_LABELS: Record<string, string> = {
  new: "New", assigned: "Assigned", followup: "Follow Up", closed: "Closed",
  rejected: "Rejected", cnc: "CNC", booking: "Booking",
  partialbooking: "Partial Booking", interested: "Interested",
  rnr: "RNR", callback: "Call Back", whatsapp: "WhatsApp", student: "Student",
};

function StatusBadge({ status }: { status: string }) {
  return (
    <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs font-medium ${STATUS_COLORS[status] ?? "bg-muted text-muted-foreground border-border"}`}>
      {STATUS_LABELS[status] ?? status}
    </span>
  );
}

function formatIST(iso: string) {
  return new Date(iso).toLocaleString("en-IN", {
    timeZone: "Asia/Kolkata",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }) + " IST";
}

function isOverdue(remindAt: string, isDone: boolean) {
  return !isDone && new Date(remindAt) < new Date();
}

// ─── Animation variants ────────────────────────────────────────────────────────

const listContainerVariants = {
  hidden: { opacity: 0 },
  visible: { opacity: 1, transition: { staggerChildren: 0.05 } },
};

const listItemVariants = {
  hidden: { opacity: 0, y: 12 },
  visible: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

// ─── Member select helper ──────────────────────────────────────────────────────

interface TeamMember {
  _id: string;
  name: string;
}

// ─── Props ─────────────────────────────────────────────────────────────────────

interface TeamRemindersTabProps {
  teamId: string;
  members: TeamMember[];
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function TeamRemindersTab({ teamId, members }: TeamRemindersTabProps) {
  const [search, setSearch]       = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  const [memberId, setMemberId]   = useState("");
  const [isDone, setIsDone]       = useState<"" | "true" | "false">("");
  const [page, setPage]           = useState(1);

  // Debounce search
  const handleSearch = (val: string) => {
    setSearch(val);
    clearTimeout((handleSearch as { _t?: ReturnType<typeof setTimeout> })._t);
    (handleSearch as { _t?: ReturnType<typeof setTimeout> })._t = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  const filters: TeamRemindersFilters = {
    search:   debouncedSearch || undefined,
    memberId: memberId || undefined,
    isDone:   isDone || undefined,
    page,
    limit:    20,
  };

  const { data, isLoading, error } = useTeamReminders(teamId, filters);
  const reminders = data?.data ?? [];
  const pagination = data?.pagination;

  const activeFilters = [memberId, isDone].filter(Boolean).length;

  const clearFilters = () => {
    setMemberId("");
    setIsDone("");
    setPage(1);
  };

  return (
    <motion.div
      variants={listContainerVariants}
      initial="hidden"
      animate="visible"
      className="space-y-4"
    >
      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="flex flex-col sm:flex-row gap-3">
        {/* Search */}
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
          <input
            value={search}
            onChange={(e) => handleSearch(e.target.value)}
            placeholder="Search by name, phone or reminder…"
            className="w-full rounded-lg border border-border bg-background pl-9 pr-4 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
          />
        </div>

        {/* Member filter */}
        <select
          value={memberId}
          onChange={(e) => { setMemberId(e.target.value); setPage(1); }}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[160px]"
        >
          <option value="">All Members</option>
          {members.map((m) => (
            <option key={m._id} value={m._id}>{m.name}</option>
          ))}
        </select>

        {/* Status filter */}
        <select
          value={isDone}
          onChange={(e) => { setIsDone(e.target.value as "" | "true" | "false"); setPage(1); }}
          className="rounded-lg border border-border bg-background px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring min-w-[140px]"
        >
          <option value="">All Status</option>
          <option value="false">Pending</option>
          <option value="true">Done</option>
        </select>

        {/* Clear filters */}
        <AnimatePresence>
          {activeFilters > 0 && (
            <motion.button
              initial={{ opacity: 0, scale: 0.9 }}
              animate={{ opacity: 1, scale: 1 }}
              exit={{ opacity: 0, scale: 0.9 }}
              onClick={clearFilters}
              className="flex items-center gap-1.5 rounded-lg border border-border bg-muted px-3 py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
            >
              <X className="h-3.5 w-3.5" />
              Clear ({activeFilters})
            </motion.button>
          )}
        </AnimatePresence>
      </div>

      {/* ── Content ─────────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {isLoading ? (
          <motion.div key="loading" initial={{ opacity: 0 }} animate={{ opacity: 1 }} exit={{ opacity: 0 }}
            className="space-y-3"
          >
            {Array.from({ length: 5 }).map((_, i) => (
              <div key={i} className="h-20 rounded-xl bg-muted animate-pulse" />
            ))}
          </motion.div>
        ) : error ? (
          <motion.div key="error" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 py-16 text-center"
          >
            <AlertCircle className="h-10 w-10 text-destructive/60" />
            <p className="text-sm text-muted-foreground">Failed to load reminders</p>
          </motion.div>
        ) : reminders.length === 0 ? (
          <motion.div key="empty" initial={{ opacity: 0 }} animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-3 py-16 text-center"
          >
            <Bell className="h-10 w-10 text-muted-foreground/40" />
            <p className="text-base font-medium text-muted-foreground">No reminders found</p>
            <p className="text-sm text-muted-foreground/60">
              {activeFilters > 0 ? "Try adjusting your filters" : "No reminders set for this team yet"}
            </p>
          </motion.div>
        ) : (
          <motion.div key="list" variants={listContainerVariants} initial="hidden" animate="visible"
            className="space-y-2"
          >
            {reminders.map((item) => (
              <ReminderRow key={item.reminder._id} item={item} />
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* ── Pagination ───────────────────────────────────────────────────────── */}
      {pagination && pagination.totalPages > 1 && (
        <motion.div variants={listItemVariants} className="flex items-center justify-between pt-2">
          <p className="text-xs text-muted-foreground">
            {pagination.total} reminder{pagination.total !== 1 ? "s" : ""}
          </p>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setPage((p) => Math.max(1, p - 1))}
              disabled={page <= 1}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
            >
              <ChevronLeft className="h-4 w-4" />
            </button>
            <span className="text-sm text-muted-foreground">
              {page} / {pagination.totalPages}
            </span>
            <button
              onClick={() => setPage((p) => Math.min(pagination.totalPages, p + 1))}
              disabled={page >= pagination.totalPages}
              className="flex h-8 w-8 items-center justify-center rounded-lg border border-border bg-background text-muted-foreground hover:text-foreground disabled:opacity-40 transition-colors"
            >
              <ChevronRight className="h-4 w-4" />
            </button>
          </div>
        </motion.div>
      )}
    </motion.div>
  );
}

// ─── Single reminder row ───────────────────────────────────────────────────────

function ReminderRow({ item }: { item: TeamReminderItem }) {
  const { reminder, lead } = item;
  const overdue = isOverdue(reminder.remindAt, reminder.isDone);

  const assignedName =
    lead.assignedTo && typeof lead.assignedTo === "object"
      ? lead.assignedTo.name
      : null;

  return (
    <motion.div
      variants={listItemVariants}
      whileHover={{ x: 2 }}
      className={`flex items-start gap-4 rounded-xl border p-4 transition-colors ${
        reminder.isDone
          ? "border-border bg-muted/30 opacity-70"
          : overdue
          ? "border-red-500/30 bg-red-500/5"
          : "border-border bg-card hover:border-primary/20"
      }`}
    >
      {/* Icon */}
      <div className={`mt-0.5 flex h-8 w-8 shrink-0 items-center justify-center rounded-lg ${
        reminder.isDone ? "bg-green-500/10" : overdue ? "bg-red-500/10" : "bg-primary/10"
      }`}>
        {reminder.isDone ? (
          <Check className="h-4 w-4 text-green-400" />
        ) : overdue ? (
          <AlertCircle className="h-4 w-4 text-red-400" />
        ) : (
          <Bell className="h-4 w-4 text-primary" />
        )}
      </div>

      {/* Content */}
      <div className="min-w-0 flex-1">
        <div className="flex flex-wrap items-center gap-2 mb-1">
          <span className="text-sm font-medium text-foreground truncate">
            {reminder.title || "Reminder"}
          </span>
          {overdue && (
            <span className="text-xs font-medium text-red-400 bg-red-500/10 border border-red-500/20 rounded-full px-2 py-0.5">
              Overdue
            </span>
          )}
          {reminder.isDone && (
            <span className="text-xs font-medium text-green-400 bg-green-500/10 border border-green-500/20 rounded-full px-2 py-0.5">
              Done
            </span>
          )}
        </div>

        {reminder.note && (
          <p className="text-xs text-muted-foreground mb-1.5 line-clamp-1">{reminder.note}</p>
        )}

        <div className="flex flex-wrap items-center gap-3 text-xs text-muted-foreground">
          {/* Lead name + phone + status */}
          <span className="flex items-center gap-1.5 flex-wrap">
            <span className="font-medium text-foreground">{lead.name}</span>
            {lead.phone && (
              <span className="font-mono text-[11px] tracking-tight text-muted-foreground bg-muted px-1.5 py-0.5 rounded">
                {lead.phone}
              </span>
            )}
            <StatusBadge status={lead.status} />
          </span>

          {/* Assigned to */}
          {assignedName && (
            <span className="flex items-center gap-1">
              <User className="h-3 w-3" />
              {assignedName}
            </span>
          )}

          {/* Time */}
          <span className={`flex items-center gap-1 ${overdue ? "text-red-400" : ""}`}>
            <Clock className="h-3 w-3" />
            {formatIST(reminder.remindAt)}
          </span>
        </div>
      </div>
    </motion.div>
  );
}
