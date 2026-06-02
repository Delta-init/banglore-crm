"use client";

import { useState, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  PhoneCall, PhoneIncoming, PhoneOutgoing, PhoneMissed,
  Clock, Play, Pause, RefreshCw, Search, Filter,
  Phone, User, X, ArrowRight,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { cn } from "@/lib/utils";
import { useRecentCalls, fmtDuration, fmtCallTime, type RecentCallLog } from "@/hooks/useCalls";
import { ClickToCall } from "@/components/leads/ClickToCall";

// ─── Helpers ──────────────────────────────────────────────────────────────────

function callTypeColor(type: string) {
  switch (type) {
    case "Inbound":     return "text-blue-400 bg-blue-500/10 border-blue-500/20";
    case "Outbound":    return "text-green-400 bg-green-500/10 border-green-500/20";
    case "Missed":      return "text-red-400 bg-red-500/10 border-red-500/20";
    case "Notanswered": return "text-orange-400 bg-orange-500/10 border-orange-500/20";
    default:            return "text-muted-foreground bg-muted/50 border-border";
  }
}

function CallTypeIcon({ type }: { type: string }) {
  switch (type) {
    case "Missed":
    case "Notanswered": return <PhoneMissed className="h-3.5 w-3.5 text-red-400" />;
    case "Inbound":     return <PhoneIncoming className="h-3.5 w-3.5 text-blue-400" />;
    case "Outbound":    return <PhoneOutgoing className="h-3.5 w-3.5 text-green-400" />;
    default:            return <Phone className="h-3.5 w-3.5 text-muted-foreground" />;
  }
}

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

// ─── Stat Card ────────────────────────────────────────────────────────────────

function StatCard({
  label, value, icon: Icon, color, delay,
}: { label: string; value: number; icon: React.ElementType; color: string; delay: number }) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 12 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay }}
    >
      <Card className="border-border">
        <CardContent className="p-4 flex items-center gap-3">
          <div className={cn("rounded-lg p-2.5", color)}>
            <Icon className="h-4 w-4" />
          </div>
          <div>
            <p className="text-2xl font-bold">{value}</p>
            <p className="text-xs text-muted-foreground">{label}</p>
          </div>
        </CardContent>
      </Card>
    </motion.div>
  );
}

// ─── Table Row ────────────────────────────────────────────────────────────────

function CallRow({ call, index }: { call: RecentCallLog; index: number }) {
  const leadName = call.leadId?.name ?? call.contactName ?? "Unknown";
  const leadId   = call.leadId?._id ?? null;
  const phone    = call.phoneNumber;

  return (
    <motion.tr
      initial={{ opacity: 0, y: 6 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay: index * 0.025 }}
      className="group border-b border-border/50 hover:bg-muted/30 transition-colors"
    >
      {/* Date/Time */}
      <td className="px-4 py-3 whitespace-nowrap">
        <p className="text-xs font-medium text-foreground">{fmtCallTime(call.callDate)}</p>
      </td>

      {/* Lead */}
      <td className="px-4 py-3">
        {leadId ? (
          <Link href={`/leads/${leadId}`} className="flex items-center gap-1.5 group/link">
            <User className="h-3 w-3 text-muted-foreground shrink-0" />
            <span className="text-xs font-medium text-primary group-hover/link:underline truncate max-w-[140px]">
              {leadName}
            </span>
          </Link>
        ) : (
          <span className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <User className="h-3 w-3 shrink-0" />
            {leadName}
          </span>
        )}
      </td>

      {/* Phone */}
      <td className="px-4 py-3 hidden sm:table-cell">
        <div className="flex items-center gap-1.5">
          <span className="text-xs text-muted-foreground font-mono">{phone}</span>
          <ClickToCall
            phoneNumber={phone}
            leadId={leadId ?? undefined}
            leadName={leadName}
            size="icon"
            variant="ghost"
            className="h-6 w-6 opacity-0 group-hover:opacity-100 transition-opacity"
          />
        </div>
      </td>

      {/* Type */}
      <td className="px-4 py-3">
        <span className={cn(
          "inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-[11px] font-medium",
          callTypeColor(call.callType)
        )}>
          <CallTypeIcon type={call.callType} />
          {call.callType === "Notanswered" ? "No Answer" : call.callType}
        </span>
      </td>

      {/* Duration */}
      <td className="px-4 py-3 hidden md:table-cell">
        <span className="flex items-center gap-1 text-xs text-muted-foreground">
          <Clock className="h-3 w-3" />
          {fmtDuration(call.callDuration)}
        </span>
      </td>

      {/* Agent */}
      <td className="px-4 py-3 hidden lg:table-cell">
        <div className="text-xs text-muted-foreground">
          {call.agentName ?? "—"}
          {call.agentExtension && (
            <span className="ml-1.5 inline-flex items-center rounded-sm bg-primary/10 px-1.5 py-0.5 text-[10px] font-mono text-primary">
              #{call.agentExtension}
            </span>
          )}
        </div>
      </td>

      {/* Recording */}
      <td className="px-4 py-3">
        {call.recordingUrl
          ? <RecordingPlayer url={call.recordingUrl} />
          : <span className="text-[11px] text-muted-foreground/40">—</span>
        }
      </td>

      {/* View */}
      <td className="px-4 py-3">
        <Link href={`/calls/${call._id}`}>
          <motion.div whileTap={{ scale: 0.95 }}>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 opacity-0 group-hover:opacity-100 transition-opacity"
              title="View call details"
            >
              <ArrowRight className="h-3.5 w-3.5" />
            </Button>
          </motion.div>
        </Link>
      </td>
    </motion.tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function CallsPage() {
  const [search,    setSearch]    = useState("");
  const [typeFilter, setTypeFilter] = useState<string>("all");
  const [dirFilter,  setDirFilter]  = useState<string>("all");
  const [agentFilter, setAgentFilter] = useState<string>("all");

  const { data, isLoading, isFetching, refetch } = useRecentCalls({ limit: 200 });
  const allCalls = data?.calls ?? [];

  // All unique agents for filter
  const agentOptions = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of allCalls) {
      if (c.agentName) map.set(c.agentName, c.agentName);
    }
    return Array.from(map.values()).sort();
  }, [allCalls]);

  // Filtered calls
  const calls = useMemo(() => {
    return allCalls.filter((c) => {
      if (typeFilter !== "all" && c.callType !== typeFilter) return false;
      if (dirFilter  !== "all" && c.callDirection !== dirFilter) return false;
      if (agentFilter !== "all" && c.agentName !== agentFilter) return false;
      if (search) {
        const q = search.toLowerCase();
        const name   = (c.leadId?.name ?? c.contactName ?? "").toLowerCase();
        const phone  = c.phoneNumber.toLowerCase();
        const agent  = (c.agentName ?? "").toLowerCase();
        if (!name.includes(q) && !phone.includes(q) && !agent.includes(q)) return false;
      }
      return true;
    });
  }, [allCalls, typeFilter, dirFilter, agentFilter, search]);

  // Stats
  const stats = useMemo(() => ({
    total:      calls.length,
    inbound:    calls.filter(c => c.callType === "Inbound").length,
    outbound:   calls.filter(c => c.callType === "Outbound").length,
    missed:     calls.filter(c => c.callType === "Missed" || c.callType === "Notanswered").length,
    recordings: calls.filter(c => c.recordingUrl).length,
  }), [calls]);

  const hasFilters = typeFilter !== "all" || dirFilter !== "all" || agentFilter !== "all" || !!search;

  function clearFilters() {
    setTypeFilter("all");
    setDirFilter("all");
    setAgentFilter("all");
    setSearch("");
  }

  return (
    <div className="space-y-6">
      {/* Header */}
      <motion.div
        initial={{ opacity: 0, y: 12 }}
        animate={{ opacity: 1, y: 0 }}
        className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between"
      >
        <div>
          <h2 className="text-2xl font-bold">Call History</h2>
          <p className="text-muted-foreground text-sm mt-0.5">
            All inbound & outbound calls across every agent
          </p>
        </div>
        <Button
          variant="outline" size="sm"
          onClick={() => refetch()}
          disabled={isFetching}
          className="self-start sm:self-auto"
        >
          <RefreshCw className={cn("h-3.5 w-3.5 mr-2", isFetching && "animate-spin")} />
          Refresh
        </Button>
      </motion.div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 gap-3 sm:grid-cols-4 lg:grid-cols-5">
        <StatCard label="Total" value={stats.total} icon={PhoneCall}
          color="bg-primary/10 text-primary" delay={0.05} />
        <StatCard label="Inbound" value={stats.inbound} icon={PhoneIncoming}
          color="bg-blue-500/10 text-blue-400" delay={0.1} />
        <StatCard label="Outbound" value={stats.outbound} icon={PhoneOutgoing}
          color="bg-green-500/10 text-green-400" delay={0.15} />
        <StatCard label="Missed" value={stats.missed} icon={PhoneMissed}
          color="bg-red-500/10 text-red-400" delay={0.2} />
        <StatCard label="Recordings" value={stats.recordings} icon={Play}
          color="bg-purple-500/10 text-purple-400" delay={0.25} />
      </div>

      {/* Filters */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.15 }}
      >
        <Card className="border-border">
          <CardContent className="p-3">
            <div className="flex flex-wrap gap-2 items-center">
              {/* Search */}
              <div className="relative flex-1 min-w-[200px]">
                <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 h-3.5 w-3.5 text-muted-foreground" />
                <Input
                  value={search}
                  onChange={(e) => setSearch(e.target.value)}
                  placeholder="Search lead, phone, agent…"
                  className="pl-8 h-8 text-sm"
                />
              </div>

              {/* Call Type */}
              <Select value={typeFilter} onValueChange={setTypeFilter}>
                <SelectTrigger className="h-8 w-[140px] text-xs">
                  <Filter className="h-3 w-3 mr-1.5 text-muted-foreground" />
                  <SelectValue placeholder="Call type" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All types</SelectItem>
                  <SelectItem value="Inbound">Inbound</SelectItem>
                  <SelectItem value="Outbound">Outbound</SelectItem>
                  <SelectItem value="Missed">Missed</SelectItem>
                  <SelectItem value="Notanswered">No Answer</SelectItem>
                </SelectContent>
              </Select>

              {/* Direction */}
              <Select value={dirFilter} onValueChange={setDirFilter}>
                <SelectTrigger className="h-8 w-[130px] text-xs">
                  <SelectValue placeholder="Direction" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value="all">All directions</SelectItem>
                  <SelectItem value="inbound">Inbound</SelectItem>
                  <SelectItem value="outbound">Outbound</SelectItem>
                </SelectContent>
              </Select>

              {/* Agent */}
              {agentOptions.length > 0 && (
                <Select value={agentFilter} onValueChange={setAgentFilter}>
                  <SelectTrigger className="h-8 w-[150px] text-xs">
                    <SelectValue placeholder="Agent" />
                  </SelectTrigger>
                  <SelectContent>
                    <SelectItem value="all">All agents</SelectItem>
                    {agentOptions.map((a) => (
                      <SelectItem key={a} value={a}>{a}</SelectItem>
                    ))}
                  </SelectContent>
                </Select>
              )}

              {/* Clear filters */}
              <AnimatePresence>
                {hasFilters && (
                  <motion.div
                    initial={{ opacity: 0, scale: 0.9 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.9 }}
                  >
                    <Button variant="ghost" size="sm" className="h-8 text-xs" onClick={clearFilters}>
                      <X className="h-3 w-3 mr-1" />
                      Clear
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>
          </CardContent>
        </Card>
      </motion.div>

      {/* Table */}
      <motion.div
        initial={{ opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.2 }}
      >
        <Card className="border-border overflow-hidden">
          <CardHeader className="pb-0 pt-4 px-4">
            <div className="flex items-center justify-between">
              <CardTitle className="text-sm font-semibold text-muted-foreground uppercase tracking-wide">
                {calls.length} call{calls.length !== 1 ? "s" : ""}
                {hasFilters && " (filtered)"}
              </CardTitle>
            </div>
          </CardHeader>

          <CardContent className="p-0 mt-2">
            {/* Loading */}
            {isLoading && (
              <div className="p-4 space-y-2">
                {[1,2,3,4,5].map(i => (
                  <div key={i} className="h-10 rounded-lg bg-muted/40 animate-pulse" />
                ))}
              </div>
            )}

            {/* Empty */}
            {!isLoading && calls.length === 0 && (
              <div className="flex flex-col items-center gap-3 py-16 text-center">
                <div className="rounded-full bg-muted/60 p-4">
                  <PhoneCall className="h-6 w-6 text-muted-foreground" />
                </div>
                <div>
                  <p className="text-sm font-medium text-foreground">No calls yet</p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {hasFilters
                      ? "No calls match your current filters"
                      : "Calls will appear here once the 3CX integration is active"}
                  </p>
                </div>
                {hasFilters && (
                  <Button variant="outline" size="sm" onClick={clearFilters}>
                    Clear filters
                  </Button>
                )}
              </div>
            )}

            {/* Table */}
            {!isLoading && calls.length > 0 && (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30 text-xs text-muted-foreground uppercase tracking-wide">
                      <th className="px-4 py-2.5 text-left font-medium">Date / Time</th>
                      <th className="px-4 py-2.5 text-left font-medium">Lead</th>
                      <th className="px-4 py-2.5 text-left font-medium hidden sm:table-cell">Phone</th>
                      <th className="px-4 py-2.5 text-left font-medium">Type</th>
                      <th className="px-4 py-2.5 text-left font-medium hidden md:table-cell">Duration</th>
                      <th className="px-4 py-2.5 text-left font-medium hidden lg:table-cell">Agent</th>
                      <th className="px-4 py-2.5 text-left font-medium">Recording</th>
                      <th className="px-4 py-2.5 text-left font-medium w-10"></th>
                    </tr>
                  </thead>
                  <tbody>
                    <AnimatePresence>
                      {calls.map((call, i) => (
                        <CallRow key={call._id} call={call} index={i} />
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}
