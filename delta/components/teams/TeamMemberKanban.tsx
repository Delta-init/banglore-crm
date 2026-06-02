"use client";

import { useState, useCallback, useEffect, useRef, useMemo } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  DndContext, DragOverlay, PointerSensor, KeyboardSensor,
  useSensor, useSensors, useDroppable, useDraggable,
  closestCenter, rectIntersection, pointerWithin,
  type DragStartEvent, type DragEndEvent,
  type CollisionDetection,
} from "@dnd-kit/core";
import {
  SortableContext, useSortable, arrayMove, horizontalListSortingStrategy,
} from "@dnd-kit/sortable";
import { CSS } from "@dnd-kit/utilities";
import {
  Eye, Loader2, Phone, PhoneOff, StickyNote, Bell, Users,
  Search, Filter, X, CalendarDays, LayoutGrid,
} from "lucide-react";
import { useTeamLeads, useAssignLeadToMember } from "@/hooks/useTeams";
import { useAllCourses } from "@/hooks/useCourses";
import { KanbanBoard } from "@/components/leads/KanbanBoard";
import { LeadPreviewPopup } from "@/components/leads/KanbanBoard";
import { TodayLeadsButton } from "@/components/leads/LeadsDateFilter";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { getInitials } from "@/lib/utils";
import type { Lead } from "@/types/lead";
import { LEAD_STATUSES, STATUS_META, type LeadStatus } from "@/lib/statusConfig";
import type { Team } from "@/types/team";
import type { User } from "@/types";

// ─── Status options ───────────────────────────────────────────────────────────

const STATUS_OPTIONS: { value: LeadStatus | "all"; label: string }[] = [
  { value: "all", label: "All Status" },
  ...LEAD_STATUSES.map((s) => ({ value: s as LeadStatus, label: STATUS_META[s].label })),
];

// ─── Status colours ───────────────────────────────────────────────────────────

const STATUS_COLORS: Record<string, string> = Object.fromEntries(
  LEAD_STATUSES.map((s) => [s, STATUS_META[s].color]),
);
const STATUS_LABEL: Record<string, string> = Object.fromEntries(
  LEAD_STATUSES.map((s) => [s, STATUS_META[s].label]),
);

// ─── Member colour palette ────────────────────────────────────────────────────

const MEMBER_COLORS = [
  { header: "bg-indigo-500/15 text-indigo-400",   border: "border-indigo-500/25",   drop: "border-indigo-500/50 bg-indigo-500/5",   dot: "bg-indigo-400"   },
  { header: "bg-violet-500/15 text-violet-400",   border: "border-violet-500/25",   drop: "border-violet-500/50 bg-violet-500/5",   dot: "bg-violet-400"   },
  { header: "bg-teal-500/15 text-teal-400",       border: "border-teal-500/25",     drop: "border-teal-500/50 bg-teal-500/5",       dot: "bg-teal-400"     },
  { header: "bg-orange-500/15 text-orange-400",   border: "border-orange-500/25",   drop: "border-orange-500/50 bg-orange-500/5",   dot: "bg-orange-400"   },
  { header: "bg-sky-500/15 text-sky-400",         border: "border-sky-500/25",      drop: "border-sky-500/50 bg-sky-500/5",         dot: "bg-sky-400"      },
  { header: "bg-pink-500/15 text-pink-400",       border: "border-pink-500/25",     drop: "border-pink-500/50 bg-pink-500/5",       dot: "bg-pink-400"     },
  { header: "bg-amber-500/15 text-amber-400",     border: "border-amber-500/25",    drop: "border-amber-500/50 bg-amber-500/5",     dot: "bg-amber-400"    },
  { header: "bg-emerald-500/15 text-emerald-400", border: "border-emerald-500/25",  drop: "border-emerald-500/50 bg-emerald-500/5", dot: "bg-emerald-400"  },
];

const UNASSIGNED_COLOR = {
  header: "bg-slate-500/15 text-slate-400",
  border: "border-slate-500/25",
  drop:   "border-slate-500/50 bg-slate-500/5",
  dot:    "bg-slate-400",
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function getMemberId(user: User | string | null | undefined): string {
  if (!user) return "";
  return typeof user === "object" ? user._id : user;
}
function getMemberName(user: User | string | null | undefined): string {
  if (!user) return "";
  return typeof user === "object" ? user.name : user;
}
function todayISO() { return new Date().toISOString().slice(0, 10); }

function getRangeFor(period: string): { f: string; t: string } {
  const now = new Date(); const t = now.toISOString().slice(0, 10);
  if (period === "today") return { f: t, t };
  if (period === "week")  { const m = new Date(now); m.setDate(now.getDate() - ((now.getDay() + 6) % 7)); return { f: m.toISOString().slice(0, 10), t }; }
  if (period === "month") return { f: new Date(now.getFullYear(), now.getMonth(), 1).toISOString().slice(0, 10), t };
  return { f: new Date(now.getFullYear(), 0, 1).toISOString().slice(0, 10), t };
}

function getColorForIdx(idx: number) {
  return idx < 0 ? UNASSIGNED_COLOR : MEMBER_COLORS[idx % MEMBER_COLORS.length];
}

// ─── Filter pill ──────────────────────────────────────────────────────────────

function FilterPill({ label, onRemove }: { label: string; onRemove: () => void }) {
  return (
    <span className="inline-flex items-center gap-1 rounded-full border border-primary/30 bg-primary/10 px-2.5 py-0.5 text-xs font-medium text-primary">
      {label}
      <button onClick={onRemove} className="ml-0.5 hover:text-primary/60 transition-colors">
        <X className="h-3 w-3" />
      </button>
    </span>
  );
}

// ─── Ghost components (shown in DragOverlay) ──────────────────────────────────

function MemberCardGhost({ lead, accentDot }: { lead: Lead; accentDot: string }) {
  const statusColor = STATUS_COLORS[lead.status] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30";
  const statusLabel = STATUS_LABEL[lead.status] ?? lead.status;
  return (
    <div className="relative rounded-xl border border-border/40 bg-card shadow-2xl select-none overflow-hidden w-[232px] rotate-[1.5deg]">
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${accentDot}`} />
      <div className="p-3 pl-4">
        <div className="flex items-start gap-2 mb-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold mt-0.5">
            {getInitials(lead.name)}
          </div>
          <p className="flex-1 text-sm font-semibold text-foreground leading-tight break-words min-w-0">{lead.name}</p>
        </div>
        {lead.phone && (
          <div className="flex items-center gap-1.5 mb-2">
            <Phone className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            <span className="text-[11px] font-mono text-muted-foreground">{lead.phone}</span>
          </div>
        )}
        <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>
          {statusLabel}
        </span>
      </div>
    </div>
  );
}

function MemberColumnGhost({
  memberName, colorIdx, count,
}: { memberName: string; colorIdx: number; count: number }) {
  const colors = getColorForIdx(colorIdx);
  return (
    <div className="flex flex-col w-[240px] opacity-95 rotate-[1deg] shadow-2xl">
      <div className={`flex items-center justify-between gap-2 rounded-t-xl px-3 py-2.5 ${colors.header}`}>
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold bg-black/10">
            {getInitials(memberName)}
          </div>
          <span className="text-xs font-semibold truncate">{memberName}</span>
        </div>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold bg-black/10">{count}</span>
      </div>
      <div className="rounded-b-xl border-x border-b border-border/40 bg-muted/20 p-2" style={{ minHeight: 80 }} />
    </div>
  );
}

// ─── Lead Card (member kanban) ────────────────────────────────────────────────

interface MemberCardProps {
  lead: Lead;
  memberId: string;
  onPreview: (lead: Lead) => void;
  accentDot: string;
}

function MemberCard({ lead, memberId, onPreview, accentDot }: MemberCardProps) {
  const statusColor = STATUS_COLORS[lead.status] ?? "bg-gray-500/15 text-gray-400 border-gray-500/30";
  const statusLabel = STATUS_LABEL[lead.status] ?? lead.status;

  const { setNodeRef, listeners, attributes, isDragging } = useDraggable({
    id: lead._id,
    data: { type: "card", memberId },
  });

  return (
    <motion.div
      ref={setNodeRef}
      layout
      initial={{ opacity: 0, y: 8 }}
      animate={{ opacity: isDragging ? 0.3 : 1, y: 0, scale: isDragging ? 0.97 : 1 }}
      exit={{ opacity: 0, scale: 0.93, transition: { duration: 0.12 } }}
      transition={{ duration: 0.15 }}
      {...listeners}
      {...attributes}
      className="group relative rounded-xl border border-border/40 bg-card shadow-sm cursor-grab active:cursor-grabbing
        hover:shadow-md hover:-translate-y-0.5 transition-all duration-150 select-none overflow-hidden"
      style={{ touchAction: "none" }}
    >
      <div className={`absolute left-0 top-0 bottom-0 w-0.5 ${accentDot}`} />
      <div className="p-3 pl-4">
        {/* Name + eye */}
        <div className="flex items-start gap-2 mb-2">
          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/10 text-primary text-[11px] font-bold mt-0.5">
            {getInitials(lead.name)}
          </div>
          <p className="flex-1 text-sm font-semibold text-foreground leading-tight break-words min-w-0">{lead.name}</p>
          <button
            onPointerDown={(e) => e.stopPropagation()}
            onClick={(e) => { e.stopPropagation(); onPreview(lead); }}
            className="shrink-0 flex h-6 w-6 items-center justify-center rounded-md text-muted-foreground hover:text-primary hover:bg-primary/10 transition-colors sm:opacity-0 sm:group-hover:opacity-100 opacity-100"
            title="Quick view"
          >
            <Eye className="h-3.5 w-3.5" />
          </button>
        </div>

        {lead.phone && (
          <div className="flex items-center gap-1.5 mb-2">
            <Phone className="h-3 w-3 text-muted-foreground/50 shrink-0" />
            <span className="text-[11px] font-mono text-muted-foreground">{lead.phone}</span>
          </div>
        )}

        <div className="flex items-center justify-between gap-2">
          <span className={`inline-flex items-center rounded-full border px-2 py-0.5 text-[10px] font-medium ${statusColor}`}>
            {statusLabel}
          </span>
          {(lead.callNotConnected ?? 0) > 0 && (
            <div className="flex items-center gap-0.5 shrink-0">
              <PhoneOff className="h-3 w-3 text-orange-400" />
              <span className="text-[11px] font-bold text-orange-400">{lead.callNotConnected}</span>
            </div>
          )}
        </div>

        {((lead.notes?.length ?? 0) > 0 || (lead.reminders?.length ?? 0) > 0) && (
          <div className="flex items-center gap-2.5 mt-2 pt-2 border-t border-border/30">
            {(lead.notes?.length ?? 0) > 0 && (
              <div className="flex items-center gap-1">
                <StickyNote className="h-3 w-3 text-blue-400" />
                <span className="text-[10px] font-medium text-muted-foreground">{lead.notes!.length}</span>
              </div>
            )}
            {(lead.reminders?.length ?? 0) > 0 && (
              <div className="flex items-center gap-1">
                <Bell className="h-3 w-3 text-violet-400" />
                <span className="text-[10px] font-medium text-muted-foreground">{lead.reminders!.length}</span>
              </div>
            )}
          </div>
        )}
      </div>
    </motion.div>
  );
}

// ─── Member Column ────────────────────────────────────────────────────────────

interface MemberColumnProps {
  memberId: string;
  memberName: string;
  colorIdx: number;
  leads: Lead[];
  localOverrides: Record<string, string>;
  canEdit: boolean;
  onPreview: (lead: Lead) => void;
}

function MemberColumn({ memberId, memberName, colorIdx, leads, canEdit, onPreview }: MemberColumnProps) {
  const colors = getColorForIdx(colorIdx);

  // Column sortable (drag to reorder columns)
  const {
    attributes, listeners, setNodeRef: setSortRef,
    transform, transition, isDragging: isColDragging,
  } = useSortable({ id: `col:${memberId}`, data: { type: "column", memberId, memberName, colorIdx } });

  // Drop zone for cards
  const { setNodeRef: setDropRef, isOver: isCardOver } = useDroppable({
    id: `zone:${memberId}`,
    data: { type: "drop-zone", memberId },
  });

  const colStyle = {
    transform: CSS.Transform.toString(transform),
    transition,
    opacity: isColDragging ? 0.4 : 1,
    zIndex: isColDragging ? 50 : undefined,
  };

  return (
    <div
      ref={setSortRef}
      style={colStyle}
      className="flex flex-col w-[240px] sm:w-[220px] shrink-0 h-full snap-start"
    >
      {/* Header — drag handle for column reorder */}
      <div
        {...attributes}
        {...listeners}
        className={`flex items-center justify-between gap-2 rounded-t-xl px-3 py-2.5 cursor-grab active:cursor-grabbing select-none ${colors.header}`}
        style={{ touchAction: "none" }}
      >
        <div className="flex items-center gap-2 min-w-0">
          <div className="flex h-5 w-5 shrink-0 items-center justify-center rounded-full text-[9px] font-bold bg-black/10">
            {getInitials(memberName)}
          </div>
          <span className="text-xs font-semibold truncate">{memberName}</span>
        </div>
        <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold tabular-nums shrink-0 bg-black/10">
          {leads.length}
        </span>
      </div>

      {/* Body — drop zone */}
      <div
        ref={setDropRef}
        className={`flex-1 rounded-b-xl border-x border-b p-2 space-y-2 overflow-y-auto
          transition-all duration-150
          ${isCardOver
            ? `${colors.drop} border-2 ring-1 ring-inset`
            : "border-border/40 bg-muted/8"
          }`}
        style={{ maxHeight: "calc(100dvh - 420px)", minHeight: "120px" }}
      >
        <AnimatePresence initial={false}>
          {leads.map((lead) => (
            <MemberCard
              key={lead._id}
              lead={lead}
              memberId={memberId}
              onPreview={onPreview}
              accentDot={colors.dot}
            />
          ))}
        </AnimatePresence>

        <AnimatePresence>
          {leads.length === 0 && (
            <motion.div
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              exit={{ opacity: 0 }}
              className={`flex items-center justify-center py-8 text-xs rounded-lg border border-dashed transition-colors
                ${isCardOver
                  ? "border-current text-current opacity-70"
                  : "border-border/30 text-muted-foreground/40"
                }`}
            >
              {isCardOver ? "↓ Drop here" : "No leads"}
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </div>
  );
}

// ─── Collision detection ──────────────────────────────────────────────────────

const memberKanbanCollision: CollisionDetection = (args) => {
  const { active, droppableContainers } = args;
  if (active.data.current?.type === "column") {
    const cols = droppableContainers.filter((c) => String(c.id).startsWith("col:"));
    return closestCenter({ ...args, droppableContainers: cols });
  }
  const zones = droppableContainers.filter((c) => String(c.id).startsWith("zone:"));
  const pointer = pointerWithin({ ...args, droppableContainers: zones });
  return pointer.length > 0 ? pointer : rectIntersection({ ...args, droppableContainers: zones });
};

// ─── Member Kanban Board ──────────────────────────────────────────────────────

function MemberKanban({
  teamId, team, canEdit, filters, onPreview,
}: {
  teamId: string;
  team: Team;
  canEdit: boolean;
  filters: Record<string, string>;
  onPreview: (lead: Lead) => void;
}) {
  const [localOverrides, setLocalOverrides] = useState<Record<string, string>>({});
  const [activeCardId,      setActiveCardId]      = useState<string | null>(null);
  const [activeColMemberId, setActiveColMemberId] = useState<string | null>(null);

  const { mutate: assignToMember } = useAssignLeadToMember(teamId);
  const { data, isLoading } = useTeamLeads(teamId, { ...filters, limit: 500 } as Parameters<typeof useTeamLeads>[1]);
  const allLeads = data?.data ?? [];

  // Deduplicated member list: leaders first then members
  const members = useMemo<User[]>(() => {
    const seen = new Set<string>();
    const list: User[] = [];
    for (const u of [...(team.leaders ?? []), ...(team.members ?? [])]) {
      const id = typeof u === "object" ? u._id : u;
      if (!seen.has(id)) { seen.add(id); list.push(u as User); }
    }
    return list;
  }, [team]);

  // Column order for drag-to-reorder
  const [columnOrder, setColumnOrder] = useState<string[]>([]);

  // Keep columnOrder in sync when members change
  useEffect(() => {
    const memberIds = members.map((m) => m._id);
    setColumnOrder((prev) => {
      // add new, remove gone, preserve existing order
      const existing = prev.filter((id) => memberIds.includes(id));
      const added    = memberIds.filter((id) => !prev.includes(id));
      return [...existing, ...added];
    });
  }, [members]);

  // Ordered members (respects drag reorder)
  const orderedMembers = useMemo(() => {
    return columnOrder
      .map((id) => members.find((m) => m._id === id))
      .filter(Boolean) as User[];
  }, [columnOrder, members]);

  // Group leads by effective assignedTo
  const grouped = useMemo(() => {
    const g: Record<string, Lead[]> = { unassigned: [] };
    for (const m of members) g[m._id] = [];
    for (const lead of allLeads) {
      const eff = localOverrides[lead._id] ?? getMemberId(lead.assignedTo as User | string | null);
      if (!eff || !g[eff]) g["unassigned"].push(lead);
      else g[eff].push(lead);
    }
    return g;
  }, [allLeads, members, localOverrides]);

  const sensors = useSensors(
    useSensor(PointerSensor, { activationConstraint: { distance: 8 } }),
    useSensor(KeyboardSensor),
  );

  const activeCard = activeCardId ? allLeads.find((l) => l._id === activeCardId) ?? null : null;
  const activeColData = activeColMemberId
    ? { memberId: activeColMemberId, memberName: getMemberName(members.find((m) => m._id === activeColMemberId)), colorIdx: orderedMembers.findIndex((m) => m._id === activeColMemberId) }
    : null;

  function handleDragStart(e: DragStartEvent) {
    if (e.active.data.current?.type === "card")   setActiveCardId(e.active.id as string);
    if (e.active.data.current?.type === "column") setActiveColMemberId(e.active.data.current.memberId as string);
  }

  function handleDragEnd(e: DragEndEvent) {
    const { active, over } = e;
    setActiveCardId(null);
    setActiveColMemberId(null);
    if (!over) return;

    const activeType = active.data.current?.type;
    const overId = String(over.id);

    // Column reorder
    if (activeType === "column" && overId.startsWith("col:")) {
      const fromId = active.data.current!.memberId as string;
      const toId   = overId.replace("col:", "");
      if (fromId !== toId) {
        setColumnOrder((prev) =>
          arrayMove(prev, prev.indexOf(fromId), prev.indexOf(toId)),
        );
      }
      return;
    }

    // Card → drop zone (reassign to member)
    if (activeType === "card" && overId.startsWith("zone:")) {
      const leadId         = active.id as string;
      const targetMemberId = overId.replace("zone:", "");
      if (targetMemberId === "unassigned") return;        // can't drop to unassigned
      const lead = allLeads.find((l) => l._id === leadId);
      if (!lead) return;
      const currentMemberId = localOverrides[leadId] ?? getMemberId(lead.assignedTo as User | string | null);
      if (currentMemberId === targetMemberId) return;

      setLocalOverrides((prev) => ({ ...prev, [leadId]: targetMemberId }));
      assignToMember(
        { leadId, memberId: targetMemberId },
        {
          onSuccess: () => setLocalOverrides((p) => { const n = { ...p }; delete n[leadId]; return n; }),
          onError:   () => setLocalOverrides((p) => { const n = { ...p }; delete n[leadId]; return n; }),
        },
      );
    }
  }

  if (isLoading) {
    return (
      <div className="flex gap-3 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory">
        {[...Array(Math.min(members.length || 4, 5))].map((_, i) => (
          <div key={i} className="w-[240px] sm:w-[220px] shrink-0 snap-start animate-pulse">
            <div className={`h-9 rounded-t-xl ${MEMBER_COLORS[i % MEMBER_COLORS.length].header} opacity-60`} />
            <div className="rounded-b-xl border border-border/30 bg-muted/10 p-2 space-y-2" style={{ height: 200 }}>
              <div className="h-20 rounded-lg bg-muted/50" /><div className="h-16 rounded-lg bg-muted/40" />
            </div>
          </div>
        ))}
      </div>
    );
  }

  if (members.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 gap-3">
        <Users className="h-10 w-10 text-muted-foreground/30" />
        <p className="text-sm text-muted-foreground">No members in this team yet</p>
      </div>
    );
  }

  const hasUnassigned = grouped["unassigned"].length > 0;

  return (
    <DndContext
      sensors={sensors}
      collisionDetection={memberKanbanCollision}
      onDragStart={handleDragStart}
      onDragEnd={handleDragEnd}
      autoScroll={{ threshold: { x: 0.15, y: 0.15 }, acceleration: 20, interval: 5 }}
    >
      <SortableContext
        items={orderedMembers.map((m) => `col:${m._id}`)}
        strategy={horizontalListSortingStrategy}
      >
        <motion.div
          initial={{ opacity: 0 }} animate={{ opacity: 1 }} transition={{ duration: 0.18 }}
          className="flex gap-3 overflow-x-auto pb-4 pt-1 snap-x snap-mandatory sm:snap-none"
          style={{ scrollbarWidth: "thin", scrollbarColor: "hsl(var(--border)) transparent" }}
        >
          {orderedMembers.map((member, i) => (
            <motion.div
              key={member._id}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: i * 0.025 }}
              className="flex flex-col h-full"
            >
              <MemberColumn
                memberId={member._id}
                memberName={getMemberName(member)}
                colorIdx={i}
                leads={grouped[member._id] ?? []}
                localOverrides={localOverrides}
                canEdit={canEdit}
                onPreview={onPreview}
              />
            </motion.div>
          ))}

          {/* Unassigned column — always last, not sortable */}
          {hasUnassigned && (
            <motion.div
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: orderedMembers.length * 0.025 }}
              className="flex flex-col h-full"
            >
              <MemberColumn
                memberId="unassigned"
                memberName="Unassigned"
                colorIdx={-1}
                leads={grouped["unassigned"]}
                localOverrides={localOverrides}
                canEdit={false}
                onPreview={onPreview}
              />
            </motion.div>
          )}
        </motion.div>
      </SortableContext>

      <DragOverlay dropAnimation={{ duration: 180, easing: "cubic-bezier(0.18,0.67,0.6,1.22)" }}>
        {activeCard && (() => {
          const memberIdForCard = localOverrides[activeCard._id] ?? getMemberId(activeCard.assignedTo as User | string | null);
          const idx = orderedMembers.findIndex((m) => m._id === memberIdForCard);
          const colors = getColorForIdx(idx);
          return <MemberCardGhost lead={activeCard} accentDot={colors.dot} />;
        })()}
        {activeColData && (
          <MemberColumnGhost
            memberName={activeColData.memberName}
            colorIdx={activeColData.colorIdx}
            count={grouped[activeColData.memberId]?.length ?? 0}
          />
        )}
      </DragOverlay>
    </DndContext>
  );
}

// ─── TeamMemberKanban — Main export ──────────────────────────────────────────

export interface TeamMemberKanbanProps {
  teamId: string;
  team: Team;
  canEdit: boolean;
}

export function TeamMemberKanban({ teamId, team, canEdit }: TeamMemberKanbanProps) {
  // ── Filter state ───────────────────────────────────────────────────────────
  const [search,         setSearch]         = useState("");
  const [debouncedSearch,setDebouncedSearch] = useState("");
  const [status,         setStatus]         = useState("all");
  const [courseId,       setCourseId]       = useState("all");
  const [assignedTo,     setAssignedTo]     = useState("all");
  const [dateFrom,       setDateFrom]       = useState("");
  const [dateTo,         setDateTo]         = useState("");
  const [showFilters,    setShowFilters]    = useState(false);

  // ── View toggle: member columns vs status columns ──────────────────────────
  const [viewMode, setViewMode] = useState<"member" | "status">("member");

  // ── Preview popup state ───────────────────────────────────────────────────
  const [previewLead, setPreviewLead] = useState<Lead | null>(null);

  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const { data: allCourses = [] } = useAllCourses();

  // Debounce search
  useEffect(() => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    debounceRef.current = setTimeout(() => setDebouncedSearch(search), 400);
    return () => { if (debounceRef.current) clearTimeout(debounceRef.current); };
  }, [search]);

  // All team members + leaders as assignable targets
  const teamPeople = useMemo<User[]>(() => {
    const seen = new Set<string>();
    const list: User[] = [];
    for (const u of [...(team.leaders ?? []), ...(team.members ?? [])]) {
      const id = typeof u === "object" ? u._id : u;
      if (!seen.has(id)) { seen.add(id); list.push(u as User); }
    }
    return list;
  }, [team]);

  // Build filter objects
  const teamLeadFilters = useMemo(() => ({
    ...(debouncedSearch ? { search: debouncedSearch } : {}),
    ...(status   !== "all" ? { status }             : {}),
    ...(courseId !== "all" ? { course: courseId }   : {}),
    ...(assignedTo !== "all" ? { assignedTo }       : {}),
    ...(dateFrom ? { dateFrom } : {}),
    ...(dateTo   ? { dateTo }   : {}),
  }), [debouncedSearch, status, courseId, assignedTo, dateFrom, dateTo]);

  // For status-kanban: pass team + all active filters to KanbanBoard
  const statusKanbanFilters = useMemo(() => ({
    team: teamId,
    ...teamLeadFilters,
  }), [teamId, teamLeadFilters]);

  // ── Active filters ─────────────────────────────────────────────────────────
  const activeFilterCount = [
    status !== "all", courseId !== "all", assignedTo !== "all",
    !!dateFrom, !!dateTo, !!debouncedSearch,
  ].filter(Boolean).length;
  const hasActiveFilters = activeFilterCount > 0;

  const isTodayActive = dateFrom === todayISO() && dateTo === todayISO();
  function applyToday() {
    if (isTodayActive) { setDateFrom(""); setDateTo(""); }
    else { const t = todayISO(); setDateFrom(t); setDateTo(t); }
  }

  function clearAllFilters() {
    setStatus("all"); setCourseId("all"); setAssignedTo("all");
    setDateFrom(""); setDateTo(""); setSearch(""); setDebouncedSearch("");
  }

  function getCourseName(id: string) { return allCourses.find((c) => c._id === id)?.name ?? id; }
  function getMemberDisplay(id: string) { return teamPeople.find((u) => u._id === id)?.name ?? id; }
  function getStatusLabel(s: string) { return STATUS_OPTIONS.find((o) => o.value === s)?.label ?? s; }

  return (
    <div className="space-y-4">
      {/* ── Filter bar ──────────────────────────────────────────────────────── */}
      <div className="space-y-3">
        {/* Row 1 — Search + buttons */}
        <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
          {/* Search */}
          <div className="relative w-full sm:max-w-sm">
            <Search className="absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              placeholder="Search leads by name, phone, email…"
              className="pl-9 h-9"
              value={search}
              onChange={(e) => setSearch(e.target.value)}
            />
            {search && (
              <button
                onClick={() => setSearch("")}
                className="absolute right-3 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Right controls */}
          <div className="flex items-center gap-2 flex-wrap">
            <TodayLeadsButton active={isTodayActive} onClick={applyToday} />

            <Button
              variant={showFilters ? "secondary" : "outline"}
              size="sm"
              className="gap-2 relative"
              onClick={() => setShowFilters((v) => !v)}
            >
              <Filter className="h-3.5 w-3.5" />
              Filters
              {activeFilterCount > 0 && (
                <span className="absolute -top-1.5 -right-1.5 flex h-4 w-4 items-center justify-center rounded-full bg-primary text-[10px] font-bold text-primary-foreground">
                  {activeFilterCount}
                </span>
              )}
            </Button>

            {/* View toggle: Member | Status */}
            <div className="flex items-center rounded-lg border border-border/60 bg-muted/30 p-0.5 gap-0.5">
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => setViewMode("member")}
                title="Member kanban"
                className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium transition-all ${
                  viewMode === "member"
                    ? "bg-background text-foreground shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <Users className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Members</span>
              </motion.button>
              <motion.button
                whileTap={{ scale: 0.93 }}
                onClick={() => setViewMode("status")}
                title="Status kanban"
                className={`flex items-center gap-1.5 px-2.5 h-7 rounded-md text-xs font-medium transition-all ${
                  viewMode === "status"
                    ? "bg-background text-primary shadow-sm"
                    : "text-muted-foreground hover:text-foreground"
                }`}
              >
                <LayoutGrid className="h-3.5 w-3.5" />
                <span className="hidden sm:inline">Status</span>
              </motion.button>
            </div>

            {hasActiveFilters && (
              <Button variant="ghost" size="sm" onClick={clearAllFilters} className="gap-1.5 text-muted-foreground hover:text-foreground">
                <X className="h-3.5 w-3.5" /> Clear
              </Button>
            )}
          </div>
        </div>

        {/* Row 2 — Collapsible filter panel */}
        <AnimatePresence initial={false}>
          {showFilters && (
            <motion.div
              initial={{ opacity: 0, height: 0 }}
              animate={{ opacity: 1, height: "auto" }}
              exit={{ opacity: 0, height: 0 }}
              transition={{ duration: 0.2, ease: "easeInOut" }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-1 gap-3 pt-1 sm:grid-cols-2 lg:grid-cols-4">

                {/* Status */}
                <div className="space-y-1">
                  <p className="text-xs font-medium text-muted-foreground">Status</p>
                  <Select value={status} onValueChange={setStatus}>
                    <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Status" /></SelectTrigger>
                    <SelectContent>
                      {STATUS_OPTIONS.map((opt) => (
                        <SelectItem key={opt.value} value={opt.value}>{opt.label}</SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>

                {/* Assigned To — team members + leaders */}
                {teamPeople.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Assigned To</p>
                    <Select value={assignedTo} onValueChange={setAssignedTo}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Members" /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="all">All Members</SelectItem>
                        {teamPeople.map((u) => (
                          <SelectItem key={u._id} value={u._id}>{u.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Course */}
                {allCourses.length > 0 && (
                  <div className="space-y-1">
                    <p className="text-xs font-medium text-muted-foreground">Course</p>
                    <Select value={courseId} onValueChange={setCourseId}>
                      <SelectTrigger className="h-9 text-sm"><SelectValue placeholder="All Courses" /></SelectTrigger>
                      <SelectContent className="max-h-60">
                        <SelectItem value="all">All Courses</SelectItem>
                        {allCourses.map((c) => (
                          <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                        ))}
                      </SelectContent>
                    </Select>
                  </div>
                )}

                {/* Date range */}
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <CalendarDays className="h-3 w-3" /> Date Range
                  </p>
                  <div className="flex flex-wrap gap-1.5">
                    {(["today", "week", "month", "year"] as const).map((p) => {
                      const labels = { today: "Today", week: "Week", month: "Month", year: "Year" };
                      const range = getRangeFor(p);
                      const isActive = dateFrom === range.f && dateTo === range.t;
                      return (
                        <button
                          key={p} type="button"
                          onClick={() => { if (isActive) { setDateFrom(""); setDateTo(""); } else { setDateFrom(range.f); setDateTo(range.t); } }}
                          className={`rounded-lg px-2.5 py-1 text-xs font-medium transition-all ${isActive ? "bg-primary text-primary-foreground shadow-sm" : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground"}`}
                        >
                          {labels[p]}
                        </button>
                      );
                    })}
                  </div>
                  <div className="flex items-center gap-1.5">
                    <Input
                      type="date" value={dateFrom} max={dateTo || undefined}
                      onChange={(e) => setDateFrom(e.target.value)}
                      className="h-9 text-sm px-2 flex-1 [color-scheme:dark]"
                    />
                    <span className="text-xs text-muted-foreground shrink-0">to</span>
                    <Input
                      type="date" value={dateTo} min={dateFrom || undefined}
                      onChange={(e) => setDateTo(e.target.value)}
                      className="h-9 text-sm px-2 flex-1 [color-scheme:dark]"
                    />
                  </div>
                </div>

              </div>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Row 3 — Active filter pills */}
        {hasActiveFilters && (
          <motion.div initial={{ opacity: 0 }} animate={{ opacity: 1 }} className="flex flex-wrap items-center gap-1.5">
            {debouncedSearch && <FilterPill label={`Search: "${debouncedSearch}"`} onRemove={() => { setSearch(""); setDebouncedSearch(""); }} />}
            {status   !== "all" && <FilterPill label={getStatusLabel(status)}     onRemove={() => setStatus("all")} />}
            {assignedTo !== "all" && <FilterPill label={getMemberDisplay(assignedTo)} onRemove={() => setAssignedTo("all")} />}
            {courseId !== "all" && <FilterPill label={getCourseName(courseId)}    onRemove={() => setCourseId("all")} />}
            {dateFrom && <FilterPill label={`From ${dateFrom}`} onRemove={() => setDateFrom("")} />}
            {dateTo   && <FilterPill label={`To ${dateTo}`}     onRemove={() => setDateTo("")} />}
          </motion.div>
        )}
      </div>

      {/* ── Kanban board ────────────────────────────────────────────────────── */}
      <AnimatePresence mode="wait">
        {viewMode === "member" ? (
          <motion.div
            key="member"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <MemberKanban
              teamId={teamId}
              team={team}
              canEdit={canEdit}
              filters={teamLeadFilters as Record<string, string>}
              onPreview={setPreviewLead}
            />
          </motion.div>
        ) : (
          <motion.div
            key="status"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: -6 }}
            transition={{ duration: 0.18 }}
          >
            <KanbanBoard filters={statusKanbanFilters} canEdit={canEdit} />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Preview popup */}
      <LeadPreviewPopup
        lead={previewLead}
        open={!!previewLead}
        onClose={() => setPreviewLead(null)}
      />
    </div>
  );
}
