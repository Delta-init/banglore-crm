"use client";

import { useState, useEffect } from "react";
import { motion, Reorder, useDragControls } from "framer-motion";
import { Settings, Shuffle, Users, CheckCircle2, Loader2, RefreshCw, Info, Clock, CalendarDays, RotateCcw, Zap, GripVertical, Plus, X } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { Switch } from "@/components/ui/switch";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Input } from "@/components/ui/input";
import { useTeamSettings, useUpdateTeamSettings, useAutoAssignTeamLeads } from "@/hooks/useTeams";
import type { Team } from "@/types/team";
import type { User } from "@/types";

interface Props {
  teamId: string;
  team: Team;
  isLeaderOrAdmin: boolean;
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.07 } },
};
const itemVariants = {
  hidden: { opacity: 0, y: 12 },
  show: { opacity: 1, y: 0, transition: { duration: 0.25, ease: "easeOut" } },
};

// ── Draggable member row ───────────────────────────────────────────────────────
interface DraggableMemberRowProps {
  member: User;
  index: number;
  isInactive: boolean;
  isLeaderOrAdmin: boolean;
  onRemove: (id: string) => void;
}

function DraggableMemberRow({ member, index, isInactive, isLeaderOrAdmin, onRemove }: DraggableMemberRowProps) {
  const controls = useDragControls();
  return (
    <Reorder.Item
      value={member}
      dragListener={false}
      dragControls={controls}
      className="rounded-xl border border-primary/30 bg-primary/5 select-none"
      whileDrag={{ scale: 1.02, boxShadow: "0 8px 24px rgba(0,0,0,0.25)", zIndex: 50 }}
    >
      <div className="flex items-center gap-3 p-3">
        {/* Drag handle */}
        <button
          className={[
            "touch-none shrink-0 text-muted-foreground",
            isLeaderOrAdmin ? "cursor-grab active:cursor-grabbing hover:text-foreground" : "cursor-default opacity-40",
          ].join(" ")}
          onPointerDown={(e) => isLeaderOrAdmin && controls.start(e)}
        >
          <GripVertical className="h-4 w-4" />
        </button>

        {/* Position badge */}
        <span className="w-5 shrink-0 text-center text-xs font-bold text-primary">
          {index + 1}
        </span>

        {/* Avatar */}
        <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-primary/20 text-primary text-xs font-bold">
          {member.name.slice(0, 2).toUpperCase()}
        </div>

        {/* Name */}
        <div className="min-w-0 flex-1">
          <p className="text-sm font-medium text-foreground truncate">{member.name}</p>
          {isInactive && (
            <span className="text-[10px] text-amber-400">Inactive for auto-assign</span>
          )}
        </div>

        {/* Remove button */}
        {isLeaderOrAdmin && (
          <button
            onClick={() => onRemove(member._id)}
            className="shrink-0 text-muted-foreground hover:text-destructive transition-colors p-0.5 rounded"
          >
            <X className="h-3.5 w-3.5" />
          </button>
        )}
      </div>
    </Reorder.Item>
  );
}

// ── Main settings tab ─────────────────────────────────────────────────────────
export function TeamSettingsTab({ teamId, team, isLeaderOrAdmin }: Props) {
  const { data: settings, isLoading } = useTeamSettings(teamId);
  const { mutate: save, isPending: saving } = useUpdateTeamSettings(teamId);
  const { mutate: splitNow, isPending: splitting } = useAutoAssignTeamLeads(teamId);

  const [autoAssign, setAutoAssign]         = useState(false);
  const [splitMode, setSplitMode]           = useState<"round_robin" | "equal_load">("round_robin");
  const [splitTime, setSplitTime]           = useState<string>("");
  const [roundRobinStartDate, setStartDate] = useState<string>("");

  // orderedPool = the ordered list of User objects currently selected for auto-split
  const [orderedPool, setOrderedPool] = useState<User[]>([]);

  // All members pool (leaders + members, deduped)
  const allMembers: User[] = [
    ...(team.leaders ?? []),
    ...(team.members ?? []).filter((m) => !(team.leaders ?? []).some((l) => l._id === m._id)),
  ];

  // Derive includedMembers (ID array) from orderedPool
  const includedMembers = orderedPool.map((m) => m._id);

  // Members not yet in the ordered pool
  const unselectedMembers = allMembers.filter((m) => !includedMembers.includes(m._id));

  useEffect(() => {
    if (!settings) return;
    setAutoAssign(settings.autoAssign ?? false);
    setSplitMode(settings.splitMode ?? "round_robin");
    setSplitTime(settings.splitTime ?? "");
    setStartDate(
      settings.roundRobinStartDate
        ? settings.roundRobinStartDate.slice(0, 10)
        : "",
    );
    // Build ordered User list from saved includedMembers order
    const savedIds = settings.includedMembers ?? [];
    if (savedIds.length > 0) {
      const ordered = savedIds
        .map((id) => allMembers.find((m) => m._id === id))
        .filter((m): m is User => Boolean(m));
      setOrderedPool(ordered);
    } else {
      setOrderedPool([]);
    }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [settings]);

  function addMember(member: User) {
    setOrderedPool((prev) => [...prev, member]);
  }

  function removeMember(id: string) {
    setOrderedPool((prev) => prev.filter((m) => m._id !== id));
  }

  function handleSave() {
    save({
      autoAssign,
      splitMode,
      includedMembers,
      splitTime: splitTime || null,
      roundRobinStartDate: roundRobinStartDate || null,
    });
  }

  if (isLoading) {
    return (
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
      </div>
    );
  }

  const effectivePool = orderedPool.length > 0
    ? orderedPool.filter((m) => !team.inactiveMembers.includes(m._id))
    : allMembers.filter((m) => !team.inactiveMembers.includes(m._id));

  return (
    <motion.div variants={containerVariants} initial="hidden" animate="show" className="space-y-5 max-w-2xl">

      {/* Auto-assign toggle */}
      <motion.div variants={itemVariants}>
        <Card className="border-border/50">
          <CardHeader className="pb-3">
            <CardTitle className="flex items-center gap-2 text-base">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
                <Settings className="h-4 w-4 text-primary" />
              </div>
              Lead Assignment Mode
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="flex items-center justify-between rounded-xl border border-border/50 bg-muted/20 p-4">
              <div className="space-y-0.5">
                <Label className="text-sm font-medium">Auto-Split Leads</Label>
                <p className="text-xs text-muted-foreground">
                  When enabled, new leads assigned to this team are automatically distributed to members
                </p>
              </div>
              <Switch
                checked={autoAssign}
                onCheckedChange={isLeaderOrAdmin ? setAutoAssign : undefined}
                disabled={!isLeaderOrAdmin}
              />
            </div>

            {!autoAssign && (
              <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/20 bg-amber-500/5 p-3">
                <Info className="h-4 w-4 text-amber-400 shrink-0 mt-0.5" />
                <p className="text-xs text-amber-300/80">
                  Manual mode — leaders and admins assign leads to members from the unassigned pool.
                </p>
              </div>
            )}
          </CardContent>
        </Card>
      </motion.div>

      {/* Algorithm — only shown when auto is on */}
      {autoAssign && (
        <motion.div variants={itemVariants}>
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-violet-500/10">
                  <Shuffle className="h-4 w-4 text-violet-400" />
                </div>
                Distribution Algorithm
              </CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {[
                {
                  id: "round_robin" as const,
                  label: "Round Robin",
                  description: "Members take turns receiving leads in rotation",
                  color: "primary",
                },
                {
                  id: "equal_load" as const,
                  label: "Equal Load",
                  description: "New lead always goes to the member with fewest active leads",
                  color: "teal",
                },
              ].map((opt) => {
                const active = splitMode === opt.id;
                return (
                  <motion.button
                    key={opt.id}
                    whileTap={{ scale: 0.97 }}
                    onClick={() => isLeaderOrAdmin && setSplitMode(opt.id)}
                    disabled={!isLeaderOrAdmin}
                    className={[
                      "text-left rounded-xl border p-4 transition-all",
                      active
                        ? "border-primary/40 bg-primary/5 ring-1 ring-primary/20"
                        : "border-border/50 hover:border-border hover:bg-muted/20",
                      !isLeaderOrAdmin ? "cursor-default opacity-70" : "cursor-pointer",
                    ].join(" ")}
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <span className="text-sm font-semibold text-foreground">{opt.label}</span>
                      {active && (
                        <CheckCircle2 className="h-4 w-4 text-primary" />
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground">{opt.description}</p>
                  </motion.button>
                );
              })}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Scheduled split time */}
      {autoAssign && (
        <motion.div variants={itemVariants}>
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-orange-500/10">
                  <Clock className="h-4 w-4 text-orange-400" />
                </div>
                Daily Auto-Split Time
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                At this time (GST) every day, all unassigned leads in this team will be automatically distributed. Leave blank to disable the scheduled split.
              </p>
              <div className="flex items-center gap-3">
                <Input
                  type="time"
                  value={splitTime}
                  onChange={(e) => isLeaderOrAdmin && setSplitTime(e.target.value)}
                  disabled={!isLeaderOrAdmin}
                  className="w-36"
                />
                {splitTime && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    onClick={() => setSplitTime("")}
                    disabled={!isLeaderOrAdmin}
                    className="text-xs text-muted-foreground"
                  >
                    Clear
                  </Button>
                )}
              </div>
              {splitTime && (
                <p className="text-xs text-primary/80">
                  Leads will be auto-split daily at <span className="font-semibold">{splitTime} GST</span>
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Round-robin start date */}
      {autoAssign && splitMode === "round_robin" && (
        <motion.div variants={itemVariants}>
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-teal-500/10">
                  <CalendarDays className="h-4 w-4 text-teal-400" />
                </div>
                Round-Robin Start Date
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              <p className="text-xs text-muted-foreground">
                Count each member's leads from this date to determine who receives the next lead in round-robin mode. Set to today to reset fairness from a clean slate.
              </p>
              <div className="flex items-center gap-3">
                <Input
                  type="date"
                  value={roundRobinStartDate}
                  onChange={(e) => isLeaderOrAdmin && setStartDate(e.target.value)}
                  disabled={!isLeaderOrAdmin}
                  className="w-44"
                />
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  onClick={() => setStartDate(new Date().toISOString().slice(0, 10))}
                  disabled={!isLeaderOrAdmin}
                  className="gap-1.5 text-xs"
                >
                  <RotateCcw className="h-3 w-3" />
                  Reset to today
                </Button>
              </div>
              {roundRobinStartDate && (
                <p className="text-xs text-teal-500/80">
                  Counting leads from <span className="font-semibold">{roundRobinStartDate}</span>
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Member inclusion + reorder — only shown when auto is on */}
      {autoAssign && (
        <motion.div variants={itemVariants}>
          <Card className="border-border/50">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center gap-2 text-base">
                <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-blue-500/10">
                  <Users className="h-4 w-4 text-blue-400" />
                </div>
                Participating Members
                <Badge variant="secondary" className="ml-auto text-xs font-normal">
                  {effectivePool.length} active
                </Badge>
              </CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <p className="text-xs text-muted-foreground">
                Drag to set the rotation order. Members at the top receive leads first. Leave all unselected to include every active member in default order.
              </p>

              {/* ── Ordered / selected members (draggable) ── */}
              {orderedPool.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
                    Rotation Order
                  </p>
                  <Reorder.Group
                    axis="y"
                    values={orderedPool}
                    onReorder={isLeaderOrAdmin ? setOrderedPool : () => {}}
                    className="space-y-2"
                  >
                    {orderedPool.map((member, index) => (
                      <DraggableMemberRow
                        key={member._id}
                        member={member}
                        index={index}
                        isInactive={team.inactiveMembers.includes(member._id)}
                        isLeaderOrAdmin={isLeaderOrAdmin}
                        onRemove={removeMember}
                      />
                    ))}
                  </Reorder.Group>
                </div>
              )}

              {/* ── Unselected members (click to add) ── */}
              {unselectedMembers.length > 0 && (
                <div className="space-y-1.5">
                  <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground px-1">
                    {orderedPool.length > 0 ? "Not Included" : "All Members (default order)"}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    {unselectedMembers.map((member) => {
                      const isInactive = team.inactiveMembers.includes(member._id);
                      return (
                        <motion.button
                          key={member._id}
                          whileTap={{ scale: 0.97 }}
                          onClick={() => isLeaderOrAdmin && addMember(member)}
                          disabled={!isLeaderOrAdmin}
                          className={[
                            "flex items-center gap-3 rounded-xl border border-dashed border-border/50 p-3 text-left transition-all",
                            isLeaderOrAdmin
                              ? "hover:border-primary/40 hover:bg-primary/5 cursor-pointer"
                              : "cursor-default opacity-60",
                          ].join(" ")}
                        >
                          <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-muted text-muted-foreground text-xs font-bold">
                            {member.name.slice(0, 2).toUpperCase()}
                          </div>
                          <div className="min-w-0 flex-1">
                            <p className="text-sm font-medium text-muted-foreground truncate">{member.name}</p>
                            {isInactive && (
                              <span className="text-[10px] text-amber-400">Inactive for auto-assign</span>
                            )}
                          </div>
                          {isLeaderOrAdmin && (
                            <Plus className="h-4 w-4 text-muted-foreground shrink-0" />
                          )}
                        </motion.button>
                      );
                    })}
                  </div>
                </div>
              )}

              {/* Empty state — no one selected, everyone included */}
              {orderedPool.length === 0 && unselectedMembers.length === 0 && (
                <p className="text-xs text-muted-foreground italic text-center py-2">
                  No members in this team yet.
                </p>
              )}
            </CardContent>
          </Card>
        </motion.div>
      )}

      {/* Current round-robin position indicator */}
      {autoAssign && splitMode === "round_robin" && settings && (
        <motion.div variants={itemVariants}>
          <div className="flex items-center gap-2 rounded-xl border border-border/40 bg-muted/20 px-4 py-3">
            <RefreshCw className="h-4 w-4 text-muted-foreground" />
            <p className="text-xs text-muted-foreground">
              Next lead goes to:{" "}
              <span className="font-medium text-foreground">
                {effectivePool.length > 0
                  ? (effectivePool[(settings.roundRobinIndex ?? 0) % effectivePool.length]?.name ?? "—")
                  : "No eligible members"}
              </span>
            </p>
          </div>
        </motion.div>
      )}

      {/* Save + Split Now */}
      {isLeaderOrAdmin && (
        <motion.div variants={itemVariants} className="flex flex-wrap items-center gap-3">
          <Button onClick={handleSave} disabled={saving} className="gap-2">
            {saving ? <Loader2 className="h-4 w-4 animate-spin" /> : <CheckCircle2 className="h-4 w-4" />}
            Save Settings
          </Button>

          {autoAssign && (
            <Button
              variant="outline"
              onClick={() => splitNow(undefined)}
              disabled={splitting}
              className="gap-2 border-primary/30 text-primary hover:bg-primary/10"
            >
              {splitting ? <Loader2 className="h-4 w-4 animate-spin" /> : <Zap className="h-4 w-4" />}
              Split Now
            </Button>
          )}
        </motion.div>
      )}
    </motion.div>
  );
}
