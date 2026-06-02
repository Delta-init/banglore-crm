"use client";
import { useEffect, useState, useMemo } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, Search, X, Check, UsersRound } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { useCreateTeam, useUpdateTeam, useTeams } from "@/hooks/useTeams";
import { useUsers } from "@/hooks/useUsers";
import type { Team } from "@/types/team";
import type { User } from "@/types";
import { cn } from "@/lib/utils";

const teamSchema = z.object({
  name: z.string().min(1, "Team name is required").max(100),
  description: z.string().max(300).optional(),
  status: z.enum(["active", "inactive"]).optional(),
  leaders: z.array(z.string()).optional(),
  members: z.array(z.string()).optional(),
});

type TeamFormValues = z.infer<typeof teamSchema>;

interface TeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team?: Team | null;
}

// ─── Multi-user picker ────────────────────────────────────────────────────────
function UserPicker({
  label,
  selected,
  onChange,
  allUsers,
  disabledIds,
  userTeamMap = {},
}: {
  label: string;
  selected: string[];
  onChange: (ids: string[]) => void;
  allUsers: User[];
  disabledIds: string[];
  userTeamMap?: Record<string, string>;
}) {
  const [search, setSearch] = useState("");

  const filtered = useMemo(
    () =>
      allUsers.filter(
        (u) =>
          u.name.toLowerCase().includes(search.toLowerCase()) ||
          u.email.toLowerCase().includes(search.toLowerCase()),
      ),
    [allUsers, search],
  );

  const toggle = (id: string) => {
    if (selected.includes(id)) {
      onChange(selected.filter((s) => s !== id));
    } else {
      onChange([...selected, id]);
    }
  };

  const selectedUsers = allUsers.filter((u) => selected.includes(u._id));

  return (
    <div className="space-y-2">
      <Label>{label}</Label>

      {selectedUsers.length > 0 && (
        <div className="flex flex-wrap gap-1">
          {selectedUsers.map((u) => (
            <Badge key={u._id} variant="secondary" className="gap-1 pr-1">
              {u.name}
              {userTeamMap[u._id] && (
                <span className="ml-0.5 text-[10px] text-amber-500">({userTeamMap[u._id]})</span>
              )}
              <button
                type="button"
                onClick={() => toggle(u._id)}
                className="ml-1 rounded-full hover:bg-muted p-0.5"
              >
                <X className="h-3 w-3" />
              </button>
            </Badge>
          ))}
        </div>
      )}

      <div className="border rounded-md">
        <div className="flex items-center border-b px-3">
          <Search className="h-4 w-4 shrink-0 text-muted-foreground" />
          <input
            className="flex-1 bg-transparent py-2 px-2 text-sm outline-none placeholder:text-muted-foreground"
            placeholder="Search users..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>
        <div className="h-44 overflow-y-auto">
          {filtered.length === 0 ? (
            <p className="py-4 text-center text-sm text-muted-foreground">No users found</p>
          ) : (
            filtered.map((u) => {
              const isSelected   = selected.includes(u._id);
              const existsInTeam = userTeamMap[u._id];
              const isDisabled   = disabledIds.includes(u._id) || !!existsInTeam;
              return (
                <button
                  key={u._id}
                  type="button"
                  disabled={isDisabled}
                  onClick={() => !isDisabled && toggle(u._id)}
                  className={cn(
                    "flex w-full items-center gap-3 px-3 py-2 text-sm transition-colors",
                    isSelected && "bg-primary/10",
                    isDisabled && "opacity-40 cursor-not-allowed",
                    !isDisabled && !isSelected && "hover:bg-muted",
                  )}
                >
                  <div className="flex h-7 w-7 items-center justify-center rounded-full bg-muted text-xs font-semibold shrink-0">
                    {u.name[0]}
                  </div>
                  <div className="flex-1 text-left min-w-0">
                    <div className="flex items-center gap-1.5 flex-wrap">
                      <p className="font-medium">{u.name}</p>
                      {existsInTeam && (
                        <span className="inline-flex items-center gap-0.5 rounded-full bg-amber-500/15 px-1.5 py-0.5 text-[10px] font-medium text-amber-500 border border-amber-500/25 leading-none shrink-0">
                          <UsersRound className="h-2.5 w-2.5" />
                          {existsInTeam}
                        </span>
                      )}
                    </div>
                    <p className="text-xs text-muted-foreground truncate">{u.email}</p>
                  </div>
                  {isSelected && <Check className="h-4 w-4 text-primary shrink-0" />}
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

// ─── Main Dialog ──────────────────────────────────────────────────────────────
export function TeamDialog({ open, onOpenChange, team }: TeamDialogProps) {
  const isEdit = !!team;
  const { mutate: createTeam, isPending: creating } = useCreateTeam();
  const { mutate: updateTeam, isPending: updating } = useUpdateTeam();
  const isPending = creating || updating;

  const { data: usersResult } = useUsers({ limit: "200", status: "active" });
  const allUsers: User[] = usersResult?.data ?? [];

  const { data: teamsResult } = useTeams({ limit: "200" } as never);
  const allTeams = teamsResult?.data ?? [];

  const userTeamMap = useMemo<Record<string, string>>(() => {
    const map: Record<string, string> = {};
    for (const t of allTeams) {
      if (isEdit && team && t._id === team._id) continue;
      for (const u of [...(t.leaders ?? []), ...(t.members ?? [])]) {
        const id = typeof u === "string" ? u : u._id;
        if (id && !map[id]) map[id] = t.name;
      }
    }
    return map;
  }, [allTeams, isEdit, team]);

  const {
    register,
    handleSubmit,
    control,
    reset,
    watch,
    formState: { errors },
  } = useForm<TeamFormValues>({
    resolver: zodResolver(teamSchema),
    defaultValues: {
      name: "",
      description: "",
      status: "active",
      leaders: [],
      members: [],
    },
  });

  const leaders = watch("leaders") ?? [];
  const members = watch("members") ?? [];

  useEffect(() => {
    if (open) {
      reset({
        name: team?.name ?? "",
        description: team?.description ?? "",
        status: team?.status ?? "active",
        leaders: team?.leaders?.map((l) => (typeof l === "string" ? l : l._id)) ?? [],
        members: team?.members?.map((m) => (typeof m === "string" ? m : m._id)) ?? [],
      });
    }
  }, [open, team, reset]);

  const onSubmit = (values: TeamFormValues) => {
    if (isEdit && team) {
      updateTeam(
        { id: team._id, data: values },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createTeam(values, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <ResponsiveDialog  open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent height="calc(92dvh - 60px)" desktopClassName="max-w-lg max-h-[90vh] overflow-y-auto">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>{isEdit ? "Edit Team" : "Create Team"}</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 px-4 sm:px-0">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Team Name *</Label>
            <Input id="name" {...register("name")} placeholder="e.g. Sales North" />
            {errors.name && (
              <p className="text-xs text-destructive">{errors.name.message}</p>
            )}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="description">Description</Label>
            <Input
              id="description"
              {...register("description")}
              placeholder="Optional team description"
            />
          </div>

          {/* Status */}
          <div className="space-y-1.5">
            <Label>Status</Label>
            <select
              {...register("status")}
              className="flex h-9 w-full rounded-md border border-input bg-transparent px-3 py-1 text-sm shadow-sm transition-colors focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-ring"
            >
              <option value="active">Active</option>
              <option value="inactive">Inactive</option>
            </select>
          </div>

          {/* Leaders picker */}
          <Controller
            control={control}
            name="leaders"
            render={({ field }) => (
              <UserPicker
                label="Team Leaders (Managers)"
                selected={field.value ?? []}
                onChange={field.onChange}
                allUsers={allUsers}
                disabledIds={members}
                userTeamMap={userTeamMap}
              />
            )}
          />

          {/* Members picker */}
          <Controller
            control={control}
            name="members"
            render={({ field }) => (
              <UserPicker
                label="Team Members (Sales)"
                selected={field.value ?? []}
                onChange={field.onChange}
                allUsers={allUsers}
                disabledIds={leaders}
                userTeamMap={userTeamMap}
              />
            )}
          />

          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
              {isEdit ? "Save Changes" : "Create Team"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export default TeamDialog;
