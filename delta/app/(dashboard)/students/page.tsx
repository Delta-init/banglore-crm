"use client";

import { useState, useRef, useCallback, useMemo, useEffect, Suspense } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  GraduationCap, Search, X, Filter, ChevronDown, ExternalLink,
  Loader2, Columns3, GripVertical, Plus, Trash2, Pencil,
  BookOpen, Phone, Mail, User2, Calendar, DollarSign, Users,
  ChevronLeft, ChevronRight,
} from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader } from "@/components/ui/card";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Checkbox } from "@/components/ui/checkbox";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu, DropdownMenuContent, DropdownMenuItem,
  DropdownMenuTrigger, DropdownMenuSeparator,
} from "@/components/ui/dropdown-menu";
import { cn } from "@/lib/utils";
import { fmtFull } from "@/lib/currency";
import { useStudents, useDeleteStudent } from "@/hooks/useStudents";
import { useAllCourses } from "@/hooks/useCourses";
import { useTeams } from "@/hooks/useTeams";
import { useUsers } from "@/hooks/useUsers";
import { INITIAL_RESPONSE_CONFIG, PRIMARY_CONCERN_CONFIG, FOLLOWUP_STRATEGY_CONFIG } from "@/lib/leadConfig";
import type { Student, StudentStatus, FeeStatus } from "@/types/student";
import type { User } from "@/types";
import type { Course } from "@/types/course";

// ─── Column definitions ───────────────────────────────────────────────────────

interface ColDef { id: string; label: string; defaultVisible: boolean; alwaysVisible?: boolean }

const ALL_COLUMNS: ColDef[] = [
  { id: "enrollmentNumber", label: "Enroll #",         defaultVisible: true,  alwaysVisible: true },
  { id: "name",             label: "Student",          defaultVisible: true,  alwaysVisible: true },
  { id: "contact",          label: "Contact",          defaultVisible: true  },
  { id: "course",           label: "Course",           defaultVisible: true  },
  { id: "counsellor",       label: "Counsellor",       defaultVisible: true  },
  { id: "team",             label: "Team",             defaultVisible: false },
  { id: "status",           label: "Status",           defaultVisible: true  },
  { id: "feeStatus",        label: "Fee Status",       defaultVisible: true  },
  { id: "totalFee",         label: "Total Fee",        defaultVisible: false },
  { id: "paidAmount",       label: "Paid",             defaultVisible: true  },
  { id: "pendingAmount",    label: "Pending",          defaultVisible: true  },
  { id: "initialResponse",  label: "Response",         defaultVisible: false },
  { id: "primaryConcern",   label: "Concern",          defaultVisible: false },
  { id: "strategy",         label: "Strategy",         defaultVisible: false },
  { id: "demo",             label: "Demo",             defaultVisible: false },
  { id: "firstContact",     label: "First Contact",    defaultVisible: false },
  { id: "lastFollowup",     label: "Last Followup",    defaultVisible: false },
  { id: "enrollmentDate",   label: "Enrolled",         defaultVisible: true  },
];

const DEFAULT_VISIBLE = new Set(ALL_COLUMNS.filter((c) => c.defaultVisible).map((c) => c.id));

// ─── Config maps ─────────────────────────────────────────────────────────────

const STUDENT_STATUS_CONFIG: Record<StudentStatus, { label: string; color: string }> = {
  active:    { label: "Active",    color: "bg-green-500/15 text-green-400 border-green-500/30"   },
  inactive:  { label: "Inactive",  color: "bg-slate-500/15 text-slate-400 border-slate-500/30"   },
  graduated: { label: "Graduated", color: "bg-violet-500/15 text-violet-400 border-violet-500/30"},
  dropped:   { label: "Dropped",   color: "bg-red-500/15 text-red-400 border-red-500/30"         },
};

const FEE_STATUS_CONFIG: Record<FeeStatus, { label: string; color: string }> = {
  paid:    { label: "Paid",    color: "bg-green-500/15 text-green-400 border-green-500/30"   },
  partial: { label: "Partial", color: "bg-amber-500/15 text-amber-400 border-amber-500/30"  },
  pending: { label: "Pending", color: "bg-red-500/15 text-red-400 border-red-500/30"         },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function formatIST(iso?: string | null) {
  if (!iso) return "—";
  return new Date(iso).toLocaleDateString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", year: "numeric" });
}

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      {label}
      <button onClick={onRemove} className="ml-0.5 hover:text-primary/60"><X className="h-3 w-3" /></button>
    </span>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

function StudentsPageContent() {
  const router = useRouter();
  const sp = useSearchParams();

  const [search,         setSearch]         = useState(() => sp.get("q")      ?? "");
  const [debouncedSearch,setDebouncedSearch] = useState(() => sp.get("q")      ?? "");
  const [statusFilter,   setStatusFilter]   = useState(() => sp.get("status") ?? "all");
  const [feeFilter,      setFeeFilter]      = useState(() => sp.get("fee")    ?? "all");
  const [courseFilter,   setCourseFilter]   = useState(() => sp.get("course") ?? "all");
  const [teamFilter,     setTeamFilter]     = useState(() => sp.get("team")   ?? "all");
  const [counsellorFilter, setCounsellorFilter] = useState(() => sp.get("assignedTo") ?? "all");
  const [responseFilter, setResponseFilter] = useState(() => sp.get("response") ?? "all");
  const [concernFilter,  setConcernFilter]  = useState(() => sp.get("concern")  ?? "all");
  const [strategyFilter, setStrategyFilter] = useState(() => sp.get("strategy") ?? "all");
  const [demoFilter,     setDemoFilter]     = useState(() => sp.get("demo")     ?? "all");
  const [enrollFrom,     setEnrollFrom]     = useState(() => sp.get("from")  ?? "");
  const [enrollTo,       setEnrollTo]       = useState(() => sp.get("to")    ?? "");
  const [showFilters,    setShowFilters]    = useState(false);
  const [page,           setPage]           = useState(() => Number(sp.get("page") ?? "1"));
  const [selectedIds,    setSelectedIds]    = useState<Set<string>>(new Set());

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── Column state (visibility + order) ────────────────────────────────────────
  const [visibleColumns, setVisibleColumns] = useState<Set<string>>(() => {
    if (typeof window === "undefined") return DEFAULT_VISIBLE;
    try { const s = localStorage.getItem("crm_students_columns"); if (s) return new Set(JSON.parse(s) as string[]); } catch {}
    return DEFAULT_VISIBLE;
  });

  const [columnOrder, setColumnOrder] = useState<string[]>(() => {
    if (typeof window === "undefined") return ALL_COLUMNS.map((c) => c.id);
    try {
      const s = localStorage.getItem("crm_students_column_order");
      if (s) {
        const parsed = JSON.parse(s) as string[];
        const all = ALL_COLUMNS.map((c) => c.id);
        const set = new Set(parsed);
        return [...parsed.filter((id) => all.includes(id)), ...all.filter((id) => !set.has(id))];
      }
    } catch {}
    return ALL_COLUMNS.map((c) => c.id);
  });

  const dragColId  = useRef<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  function onColDragStart(id: string) { dragColId.current = id; }
  function onColDragOver(e: React.DragEvent, id: string) { e.preventDefault(); if (dragColId.current !== id) setDragOverId(id); }
  function onColDrop(e: React.DragEvent, targetId: string) {
    e.preventDefault();
    const src = dragColId.current;
    if (!src || src === targetId) { setDragOverId(null); return; }
    setColumnOrder((prev) => {
      const next = [...prev];
      const from = next.indexOf(src), to = next.indexOf(targetId);
      if (from === -1 || to === -1) return prev;
      next.splice(from, 1); next.splice(to, 0, src);
      try { localStorage.setItem("crm_students_column_order", JSON.stringify(next)); } catch {}
      return next;
    });
    dragColId.current = null; setDragOverId(null);
  }
  function onColDragEnd() { dragColId.current = null; setDragOverId(null); }

  function toggleColumn(id: string) {
    setVisibleColumns((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      try { localStorage.setItem("crm_students_columns", JSON.stringify(Array.from(next))); } catch {}
      return next;
    });
  }

  const col = (id: string) => visibleColumns.has(id);
  const orderedColumns = columnOrder.map((id) => ALL_COLUMNS.find((c) => c.id === id)).filter(Boolean) as ColDef[];

  // ── Data queries ──────────────────────────────────────────────────────────────
  const filters = useMemo(() => ({
    ...(debouncedSearch    ? { search: debouncedSearch }          : {}),
    ...(statusFilter   !== "all" ? { status: statusFilter }       : {}),
    ...(feeFilter      !== "all" ? { feeStatus: feeFilter }       : {}),
    ...(courseFilter   !== "all" ? { course: courseFilter }       : {}),
    ...(teamFilter     !== "all" ? { team: teamFilter }           : {}),
    ...(counsellorFilter !== "all" ? { assignedTo: counsellorFilter } : {}),
    ...(responseFilter !== "all" ? { initialLeadResponse: responseFilter } : {}),
    ...(concernFilter  !== "all" ? { primaryConcern: concernFilter }       : {}),
    ...(strategyFilter !== "all" ? { followupStrategyType: strategyFilter } : {}),
    ...(demoFilter     !== "all" ? { demoScheduled: demoFilter }  : {}),
    ...(enrollFrom              ? { enrollmentFrom: enrollFrom }  : {}),
    ...(enrollTo                ? { enrollmentTo: enrollTo }      : {}),
    page, limit: 20,
  }), [debouncedSearch, statusFilter, feeFilter, courseFilter, teamFilter, counsellorFilter,
       responseFilter, concernFilter, strategyFilter, demoFilter, enrollFrom, enrollTo, page]);

  const { data, isLoading } = useStudents(filters);
  const { data: coursesData } = useAllCourses();
  const { data: teamsData   } = useTeams({ limit: 100 });
  const { data: usersData   } = useUsers({ limit: "200" });
  const deleteMut = useDeleteStudent();

  const students   = data?.data    ?? [];
  const pagination = data?.pagination;
  const allCourses = coursesData ?? [];
  const allTeams   = teamsData?.data ?? [];
  const allUsers   = usersData?.data ?? [];

  // Sync URL
  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (feeFilter    !== "all") params.set("fee",    feeFilter);
    if (courseFilter !== "all") params.set("course", courseFilter);
    if (page > 1) params.set("page", String(page));
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [debouncedSearch, statusFilter, feeFilter, courseFilter, page]);

  function handleSearch(v: string) {
    setSearch(v);
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => { setDebouncedSearch(v); setPage(1); }, 400);
  }

  const toggleId = useCallback((id: string) => {
    setSelectedIds((prev) => { const n = new Set(prev); if (n.has(id)) n.delete(id); else n.add(id); return n; });
  }, []);

  const activeFilterCount = [statusFilter, feeFilter, courseFilter, teamFilter, counsellorFilter,
    responseFilter, concernFilter, strategyFilter, demoFilter].filter((v) => v !== "all").length
    + (enrollFrom ? 1 : 0) + (enrollTo ? 1 : 0);

  // ── Column header renderer ────────────────────────────────────────────────────
  function renderHeader(colId: string) {
    const h: Record<string, string> = {
      enrollmentNumber: "px-4 py-3 text-left",
      name:             "px-4 py-3 text-left",
      contact:          "px-4 py-3 text-left",
      course:           "px-4 py-3 text-left hidden md:table-cell",
      counsellor:       "px-4 py-3 text-left hidden lg:table-cell",
      team:             "px-4 py-3 text-left hidden lg:table-cell",
      status:           "px-4 py-3 text-left",
      feeStatus:        "px-4 py-3 text-left",
      totalFee:         "px-4 py-3 text-right hidden xl:table-cell",
      paidAmount:       "px-4 py-3 text-right hidden lg:table-cell",
      pendingAmount:    "px-4 py-3 text-right hidden lg:table-cell",
      initialResponse:  "px-4 py-3 text-left hidden xl:table-cell",
      primaryConcern:   "px-4 py-3 text-left hidden xl:table-cell",
      strategy:         "px-4 py-3 text-left hidden xl:table-cell",
      demo:             "px-4 py-3 text-left hidden xl:table-cell",
      firstContact:     "px-4 py-3 text-left hidden xl:table-cell",
      lastFollowup:     "px-4 py-3 text-left hidden xl:table-cell",
      enrollmentDate:   "px-4 py-3 text-left hidden md:table-cell",
    };
    const colDef = ALL_COLUMNS.find((c) => c.id === colId);
    if (!colDef) return null;
    if (!colDef.alwaysVisible && !col(colId)) return null;
    return <th key={colId} className={`${h[colId] ?? "px-4 py-3 text-left"} font-medium text-muted-foreground text-[11px] uppercase tracking-wide`}>{colDef.label}</th>;
  }

  // ── Cell renderer ─────────────────────────────────────────────────────────────
  function renderCell(colId: string, s: Student) {
    const colDef = ALL_COLUMNS.find((c) => c.id === colId);
    if (!colDef || (!colDef.alwaysVisible && !col(colId))) return null;

    const courseObj = s.course && typeof s.course === "object" ? s.course as Course : null;
    const assignedObj = s.assignedTo && typeof s.assignedTo === "object" ? s.assignedTo as User : null;
    const teamObj = s.team && typeof s.team === "object" ? (s.team as { name: string }) : null;

    switch (colId) {
      case "enrollmentNumber": return (
        <td key="enrollmentNumber" className="px-4 py-3.5">
          <span className="font-mono text-xs font-semibold text-primary">{s.enrollmentNumber}</span>
        </td>
      );
      case "name": return (
        <td key="name" className="px-4 py-3.5">
          <div className="flex items-center gap-2.5">
            <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary font-bold text-xs uppercase">
              {s.name.charAt(0)}
            </div>
            <p className="font-medium text-sm">{s.name}</p>
          </div>
        </td>
      );
      case "contact": return (
        <td key="contact" className="px-4 py-3.5">
          <div className="space-y-0.5">
            {s.phone && <p className="text-xs text-muted-foreground flex items-center gap-1"><Phone className="h-3 w-3 shrink-0" />{s.phone}</p>}
            {s.email && <p className="text-xs text-muted-foreground flex items-center gap-1"><Mail className="h-3 w-3 shrink-0" />{s.email}</p>}
            {!s.phone && !s.email && <span className="text-xs text-muted-foreground/40">—</span>}
          </div>
        </td>
      );
      case "course": return (
        <td key="course" className="px-4 py-3.5 hidden md:table-cell">
          {courseObj
            ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><BookOpen className="h-3 w-3 shrink-0" />{courseObj.name}</span>
            : <span className="text-xs text-muted-foreground/40">—</span>}
        </td>
      );
      case "counsellor": return (
        <td key="counsellor" className="px-4 py-3.5 hidden lg:table-cell">
          {assignedObj
            ? <span className="inline-flex items-center gap-1 text-xs text-muted-foreground"><User2 className="h-3 w-3 shrink-0" />{assignedObj.name}</span>
            : <span className="text-xs text-muted-foreground/40">—</span>}
        </td>
      );
      case "team": return (
        <td key="team" className="px-4 py-3.5 hidden lg:table-cell">
          {teamObj
            ? <span className="inline-flex items-center rounded-full bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary"><Users className="h-3 w-3 mr-1" />{teamObj.name}</span>
            : <span className="text-xs text-muted-foreground/40">—</span>}
        </td>
      );
      case "status": return (
        <td key="status" className="px-4 py-3.5">
          {(() => { const cfg = STUDENT_STATUS_CONFIG[s.status]; return (
            <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
          );})()}
        </td>
      );
      case "feeStatus": return (
        <td key="feeStatus" className="px-4 py-3.5">
          {(() => { const cfg = FEE_STATUS_CONFIG[s.feeStatus]; return (
            <div className="space-y-1">
              <span className={`inline-flex items-center rounded-full border px-2.5 py-0.5 text-xs font-medium ${cfg.color}`}>{cfg.label}</span>
              {s.totalFee > 0 && (
                <div className="h-1 w-20 rounded-full bg-muted overflow-hidden">
                  <div className="h-full rounded-full bg-green-500" style={{ width: `${Math.min(100, (s.paidAmount / s.totalFee) * 100)}%` }} />
                </div>
              )}
            </div>
          );})()}
        </td>
      );
      case "totalFee": return (
        <td key="totalFee" className="px-4 py-3.5 hidden xl:table-cell text-right">
          <span className="text-sm tabular-nums text-muted-foreground">{fmtFull(s.totalFee)}</span>
        </td>
      );
      case "paidAmount": return (
        <td key="paidAmount" className="px-4 py-3.5 hidden lg:table-cell text-right">
          <span className="text-sm tabular-nums text-green-400 font-medium">{fmtFull(s.paidAmount)}</span>
        </td>
      );
      case "pendingAmount": return (
        <td key="pendingAmount" className="px-4 py-3.5 hidden lg:table-cell text-right">
          <span className={cn("text-sm tabular-nums font-medium", s.pendingAmount > 0 ? "text-amber-400" : "text-muted-foreground")}>{fmtFull(s.pendingAmount)}</span>
        </td>
      );
      case "initialResponse": return (
        <td key="initialResponse" className="px-4 py-3.5 hidden xl:table-cell">
          {s.initialLeadResponse ? (() => { const c = INITIAL_RESPONSE_CONFIG.find((x) => x.value === s.initialLeadResponse); return c ? <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${c.bg} ${c.color} ${c.border}`}>{c.label}</span> : null; })() : <span className="text-xs text-muted-foreground/40">—</span>}
        </td>
      );
      case "primaryConcern": return (
        <td key="primaryConcern" className="px-4 py-3.5 hidden xl:table-cell">
          {s.primaryConcern ? (() => { const c = PRIMARY_CONCERN_CONFIG.find((x) => x.value === s.primaryConcern); return c ? <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${c.bg} ${c.color} ${c.border}`}>{c.label}</span> : null; })() : <span className="text-xs text-muted-foreground/40">—</span>}
        </td>
      );
      case "strategy": return (
        <td key="strategy" className="px-4 py-3.5 hidden xl:table-cell">
          {s.followupStrategyType ? (() => { const c = FOLLOWUP_STRATEGY_CONFIG.find((x) => x.value === s.followupStrategyType); return c ? <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${c.bg} ${c.color} ${c.border}`}>{c.label}</span> : null; })() : <span className="text-xs text-muted-foreground/40">—</span>}
        </td>
      );
      case "demo": return (
        <td key="demo" className="px-4 py-3.5 hidden xl:table-cell">
          <div className="flex flex-col gap-0.5">
            <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium w-fit ${s.demoScheduled ? "bg-violet-500/10 text-violet-400" : "bg-muted/40 text-muted-foreground/50"}`}>
              {s.demoScheduled ? "✓ Scheduled" : "Not scheduled"}
            </span>
            {s.demoScheduled && <span className={`inline-flex items-center rounded-full px-2 py-0.5 text-[10px] font-medium w-fit ${s.demoAttended ? "bg-green-500/10 text-green-400" : "bg-amber-500/10 text-amber-400"}`}>{s.demoAttended ? "✓ Attended" : "Not attended"}</span>}
          </div>
        </td>
      );
      case "firstContact": return (
        <td key="firstContact" className="px-4 py-3.5 hidden xl:table-cell">
          <span className="text-xs text-muted-foreground">{s.firstContactTime ? new Date(s.firstContactTime).toLocaleString("en-IN", { timeZone: "Asia/Kolkata", day: "2-digit", month: "short", hour: "2-digit", minute: "2-digit", hour12: true }) : "—"}</span>
        </td>
      );
      case "lastFollowup": return (
        <td key="lastFollowup" className="px-4 py-3.5 hidden xl:table-cell">
          <span className="text-xs text-muted-foreground">{formatIST(s.lastFollowupDate)}</span>
        </td>
      );
      case "enrollmentDate": return (
        <td key="enrollmentDate" className="px-4 py-3.5 hidden md:table-cell">
          <span className="text-xs text-muted-foreground flex items-center gap-1"><Calendar className="h-3 w-3 shrink-0" />{formatIST(s.enrollmentDate)}</span>
        </td>
      );
      default: return null;
    }
  }

  return (
    <div className="space-y-6 pb-6">
      {/* Header */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
            <GraduationCap className="h-5 w-5 text-primary" />
          </div>
          <div className="min-w-0">
            <h1 className="text-xl font-bold text-foreground">Students</h1>
            <p className="text-sm text-muted-foreground truncate">Manage enrolled students</p>
          </div>
        </div>
        {pagination && (
          <div className="flex items-center gap-2 text-sm text-muted-foreground">
            <span className="font-semibold text-foreground">{pagination.total}</span> total students
          </div>
        )}
      </motion.div>

      {/* Table card */}
      <motion.div initial={{ opacity: 0, y: 12 }} animate={{ opacity: 1, y: 0 }} transition={{ delay: 0.05 }}>
        <Card className="border-border/50">
          <CardHeader className="pb-3 space-y-3">
            {/* Row 1 — search + toolbar */}
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div className="relative w-full sm:max-w-sm">
                <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
                <Input
                  placeholder="Search name, phone, email, enroll #…"
                  className="pl-9"
                  value={search}
                  onChange={(e) => handleSearch(e.target.value)}
                />
                {search && (
                  <button onClick={() => { setSearch(""); setDebouncedSearch(""); setPage(1); }} className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground">
                    <X className="h-3.5 w-3.5" />
                  </button>
                )}
              </div>
              <div className="flex items-center gap-2 flex-wrap">
                {/* Filters toggle */}
                <Button variant={showFilters ? "secondary" : "outline"} size="sm" className="gap-2 relative" onClick={() => setShowFilters((v) => !v)}>
                  <Filter className="h-3.5 w-3.5" />
                  Filters
                  {activeFilterCount > 0 && (
                    <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">{activeFilterCount}</span>
                  )}
                </Button>

                {/* Column picker */}
                <DropdownMenu>
                  <DropdownMenuTrigger asChild>
                    <Button variant="outline" size="sm" className="gap-2">
                      <Columns3 className="h-3.5 w-3.5" />
                      <span className="hidden sm:inline">Columns</span>
                    </Button>
                  </DropdownMenuTrigger>
                  <DropdownMenuContent align="end" className="w-56" onCloseAutoFocus={(e) => e.preventDefault()}>
                    <div className="px-2 py-1.5">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Columns</p>
                      <p className="text-[10px] text-muted-foreground/60 mt-0.5">Toggle · Drag to reorder</p>
                    </div>
                    <DropdownMenuSeparator />
                    <div className="py-1">
                      {orderedColumns.filter((c) => !c.alwaysVisible).map((c) => (
                        <div
                          key={c.id}
                          draggable
                          onDragStart={() => onColDragStart(c.id)}
                          onDragOver={(e) => onColDragOver(e, c.id)}
                          onDrop={(e) => onColDrop(e, c.id)}
                          onDragEnd={onColDragEnd}
                          className={cn(
                            "flex items-center gap-2 px-2 py-1.5 rounded mx-1 cursor-grab active:cursor-grabbing transition-colors select-none",
                            dragOverId === c.id ? "bg-primary/15 border border-primary/40" : "hover:bg-muted/60",
                          )}
                        >
                          <GripVertical className="h-3.5 w-3.5 text-muted-foreground/40 shrink-0" />
                          <span className="flex-1 text-sm cursor-pointer" onClick={() => toggleColumn(c.id)}>{c.label}</span>
                          <div className={cn("flex h-4 w-4 shrink-0 items-center justify-center rounded border transition-colors cursor-pointer", col(c.id) ? "bg-primary border-primary" : "border-border")} onClick={() => toggleColumn(c.id)}>
                            {col(c.id) && <svg className="h-2.5 w-2.5 text-primary-foreground" fill="none" stroke="currentColor" strokeWidth={3} viewBox="0 0 24 24"><path d="M5 13l4 4L19 7" /></svg>}
                          </div>
                        </div>
                      ))}
                    </div>
                    <DropdownMenuSeparator />
                    <DropdownMenuItem onSelect={(e) => { e.preventDefault(); setColumnOrder(ALL_COLUMNS.map((c) => c.id)); setVisibleColumns(new Set(DEFAULT_VISIBLE)); try { localStorage.setItem("crm_students_columns", JSON.stringify(Array.from(DEFAULT_VISIBLE))); localStorage.setItem("crm_students_column_order", JSON.stringify(ALL_COLUMNS.map((c) => c.id))); } catch {} }} className="text-xs text-muted-foreground">Reset to default</DropdownMenuItem>
                  </DropdownMenuContent>
                </DropdownMenu>
              </div>
            </div>

            {/* Filter panel */}
            <AnimatePresence>
              {showFilters && (
                <motion.div initial={{ height: 0, opacity: 0 }} animate={{ height: "auto", opacity: 1 }} exit={{ height: 0, opacity: 0 }} className="overflow-hidden">
                  <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-2 pt-2 border-t border-border/40">
                    {/* Status */}
                    <Select value={statusFilter} onValueChange={(v) => { setStatusFilter(v); setPage(1); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All Status</SelectItem>
                        {(Object.keys(STUDENT_STATUS_CONFIG) as StudentStatus[]).map((s) => <SelectItem key={s} value={s} className="text-xs">{STUDENT_STATUS_CONFIG[s].label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {/* Fee status */}
                    <Select value={feeFilter} onValueChange={(v) => { setFeeFilter(v); setPage(1); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Fee Status" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All Fee Status</SelectItem>
                        {(Object.keys(FEE_STATUS_CONFIG) as FeeStatus[]).map((s) => <SelectItem key={s} value={s} className="text-xs">{FEE_STATUS_CONFIG[s].label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {/* Course */}
                    <Select value={courseFilter} onValueChange={(v) => { setCourseFilter(v); setPage(1); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Course" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All Courses</SelectItem>
                        {allCourses.map((c) => <SelectItem key={c._id} value={c._id} className="text-xs">{c.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {/* Team */}
                    <Select value={teamFilter} onValueChange={(v) => { setTeamFilter(v); setPage(1); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Team" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All Teams</SelectItem>
                        {allTeams.map((t) => <SelectItem key={t._id} value={t._id} className="text-xs">{t.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {/* Counsellor */}
                    <Select value={counsellorFilter} onValueChange={(v) => { setCounsellorFilter(v); setPage(1); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Counsellor" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All Counsellors</SelectItem>
                        {allUsers.map((u) => <SelectItem key={u._id} value={u._id} className="text-xs">{u.name}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {/* Initial Response */}
                    <Select value={responseFilter} onValueChange={(v) => { setResponseFilter(v); setPage(1); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Lead Response" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All Responses</SelectItem>
                        {INITIAL_RESPONSE_CONFIG.map((c) => <SelectItem key={c.value} value={c.value} className={`text-xs ${c.color}`}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {/* Primary Concern */}
                    <Select value={concernFilter} onValueChange={(v) => { setConcernFilter(v); setPage(1); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Concern" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All Concerns</SelectItem>
                        {PRIMARY_CONCERN_CONFIG.map((c) => <SelectItem key={c.value} value={c.value} className={`text-xs ${c.color}`}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {/* Strategy */}
                    <Select value={strategyFilter} onValueChange={(v) => { setStrategyFilter(v); setPage(1); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Strategy" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All Strategies</SelectItem>
                        {FOLLOWUP_STRATEGY_CONFIG.map((c) => <SelectItem key={c.value} value={c.value} className={`text-xs ${c.color}`}>{c.label}</SelectItem>)}
                      </SelectContent>
                    </Select>
                    {/* Demo */}
                    <Select value={demoFilter} onValueChange={(v) => { setDemoFilter(v); setPage(1); }}>
                      <SelectTrigger className="h-8 text-xs"><SelectValue placeholder="Demo" /></SelectTrigger>
                      <SelectContent>
                        <SelectItem value="all" className="text-xs">All Demo Status</SelectItem>
                        <SelectItem value="true"  className="text-xs">Demo Scheduled</SelectItem>
                        <SelectItem value="false" className="text-xs">Not Scheduled</SelectItem>
                      </SelectContent>
                    </Select>
                    {/* Enrollment date range */}
                    <div className="flex items-center gap-1">
                      <Input type="date" className="h-8 text-xs [color-scheme:dark] flex-1" placeholder="From" value={enrollFrom} onChange={(e) => { setEnrollFrom(e.target.value); setPage(1); }} />
                    </div>
                    <div className="flex items-center gap-1">
                      <Input type="date" className="h-8 text-xs [color-scheme:dark] flex-1" placeholder="To" value={enrollTo} onChange={(e) => { setEnrollTo(e.target.value); setPage(1); }} />
                    </div>
                    {/* Clear all */}
                    <Button variant="ghost" size="sm" className="h-8 text-xs text-muted-foreground" onClick={() => { setStatusFilter("all"); setFeeFilter("all"); setCourseFilter("all"); setTeamFilter("all"); setCounsellorFilter("all"); setResponseFilter("all"); setConcernFilter("all"); setStrategyFilter("all"); setDemoFilter("all"); setEnrollFrom(""); setEnrollTo(""); setPage(1); }}>
                      <X className="h-3 w-3 mr-1" /> Clear all
                    </Button>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Active filter pills */}
            {activeFilterCount > 0 && (
              <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap gap-1.5">
                {statusFilter   !== "all" && <FilterPill label={`Status: ${STUDENT_STATUS_CONFIG[statusFilter as StudentStatus]?.label}`} onRemove={() => setStatusFilter("all")} />}
                {feeFilter      !== "all" && <FilterPill label={`Fee: ${FEE_STATUS_CONFIG[feeFilter as FeeStatus]?.label}`}               onRemove={() => setFeeFilter("all")} />}
                {courseFilter   !== "all" && <FilterPill label={`Course: ${allCourses.find((c) => c._id === courseFilter)?.name ?? courseFilter}`} onRemove={() => setCourseFilter("all")} />}
                {teamFilter     !== "all" && <FilterPill label={`Team: ${allTeams.find((t) => t._id === teamFilter)?.name ?? teamFilter}`} onRemove={() => setTeamFilter("all")} />}
                {counsellorFilter !== "all" && <FilterPill label={`Counsellor: ${allUsers.find((u) => u._id === counsellorFilter)?.name ?? counsellorFilter}`} onRemove={() => setCounsellorFilter("all")} />}
                {responseFilter !== "all" && <FilterPill label={`Response: ${INITIAL_RESPONSE_CONFIG.find((c) => c.value === responseFilter)?.label}`} onRemove={() => setResponseFilter("all")} />}
                {concernFilter  !== "all" && <FilterPill label={`Concern: ${PRIMARY_CONCERN_CONFIG.find((c) => c.value === concernFilter)?.label}`} onRemove={() => setConcernFilter("all")} />}
                {strategyFilter !== "all" && <FilterPill label={`Strategy: ${FOLLOWUP_STRATEGY_CONFIG.find((c) => c.value === strategyFilter)?.label}`} onRemove={() => setStrategyFilter("all")} />}
                {demoFilter     !== "all" && <FilterPill label={`Demo: ${demoFilter === "true" ? "Scheduled" : "Not Scheduled"}`} onRemove={() => setDemoFilter("all")} />}
                {enrollFrom && <FilterPill label={`From: ${enrollFrom}`} onRemove={() => setEnrollFrom("")} />}
                {enrollTo   && <FilterPill label={`To: ${enrollTo}`}     onRemove={() => setEnrollTo("")}   />}
              </motion.div>
            )}
          </CardHeader>

          <CardContent className="p-0">
            {isLoading ? (
              <div className="flex items-center justify-center py-20">
                <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
              </div>
            ) : students.length === 0 ? (
              <div className="py-20 text-center">
                <GraduationCap className="mx-auto h-12 w-12 text-muted-foreground/30 mb-3" />
                <p className="text-muted-foreground font-medium">No students found</p>
                <p className="text-sm text-muted-foreground/60 mt-1">Students are created when a lead is closed</p>
              </div>
            ) : (
              <div className="overflow-x-auto">
                <table className="w-full text-sm">
                  <thead>
                    <tr className="border-b border-border bg-muted/30">
                      <th className="pl-4 pr-2 py-3 w-10">
                        <Checkbox
                          checked={students.length > 0 && students.every((s) => selectedIds.has(s._id))}
                          onCheckedChange={() => {
                            if (students.every((s) => selectedIds.has(s._id))) setSelectedIds(new Set());
                            else setSelectedIds(new Set(students.map((s) => s._id)));
                          }}
                        />
                      </th>
                      {orderedColumns.map((c) => renderHeader(c.id))}
                      <th className="px-4 py-3 text-right text-[11px] uppercase tracking-wide font-medium text-muted-foreground">Actions</th>
                    </tr>
                  </thead>
                  <tbody className="divide-y divide-border">
                    <AnimatePresence>
                      {students.map((s, i) => (
                        <motion.tr
                          key={s._id}
                          initial={{ opacity: 0, x: -8 }}
                          animate={{ opacity: 1, x: 0 }}
                          exit={{ opacity: 0, x: 8 }}
                          transition={{ delay: i * 0.02 }}
                          className={`group hover:bg-muted/20 transition-colors ${selectedIds.has(s._id) ? "bg-primary/5" : ""}`}
                        >
                          <td className="pl-4 pr-2 py-3.5">
                            <Checkbox checked={selectedIds.has(s._id)} onCheckedChange={() => toggleId(s._id)} onClick={(e) => e.stopPropagation()} />
                          </td>
                          {orderedColumns.map((c) => renderCell(c.id, s))}
                          <td className="px-4 py-3.5">
                            <div className="flex items-center justify-end gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                              <Link href={`/students/${s._id}`}>
                                <Button variant="ghost" size="icon" className="h-7 w-7 text-primary" title="View">
                                  <ExternalLink className="h-3.5 w-3.5" />
                                </Button>
                              </Link>
                              <Button
                                variant="ghost" size="icon"
                                className="h-7 w-7 text-muted-foreground hover:text-destructive"
                                title="Delete"
                                onClick={() => { if (confirm(`Delete student "${s.name}"?`)) deleteMut.mutate(s._id); }}
                              >
                                <Trash2 className="h-3.5 w-3.5" />
                              </Button>
                            </div>
                          </td>
                        </motion.tr>
                      ))}
                    </AnimatePresence>
                  </tbody>
                </table>
              </div>
            )}

            {/* Pagination */}
            {pagination && pagination.totalPages > 1 && (
              <div className="flex items-center justify-between border-t border-border px-4 py-3">
                <p className="text-xs text-muted-foreground">
                  {((page - 1) * 20) + 1}–{Math.min(page * 20, pagination.total)} of {pagination.total}
                </p>
                <div className="flex items-center gap-1">
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!pagination.hasPrevPage} onClick={() => setPage((p) => p - 1)}>
                    <ChevronLeft className="h-4 w-4" />
                  </Button>
                  <span className="text-xs text-muted-foreground px-1">{page} / {pagination.totalPages}</span>
                  <Button variant="ghost" size="icon" className="h-7 w-7" disabled={!pagination.hasNextPage} onClick={() => setPage((p) => p + 1)}>
                    <ChevronRight className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>
    </div>
  );
}

export default function StudentsPage() {
  return (
    <Suspense fallback={<div className="flex items-center justify-center py-32"><Loader2 className="h-8 w-8 animate-spin text-muted-foreground" /></div>}>
      <StudentsPageContent />
    </Suspense>
  );
}
