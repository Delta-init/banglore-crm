"use client";
import { Loader2, AlertTriangle } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteTeam } from "@/hooks/useTeams";
import type { Team } from "@/types/team";

interface DeleteTeamDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  team: Team | null;
}

export function DeleteTeamDialog({ open, onOpenChange, team }: DeleteTeamDialogProps) {
  const { mutate: deleteTeam, isPending } = useDeleteTeam();

  const handleDelete = () => {
    if (!team) return;
    deleteTeam(team._id, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent desktopClassName="max-w-sm">
        <ResponsiveDialogHeader>
          <div className="flex items-center gap-3 px-4 sm:px-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <ResponsiveDialogTitle>Delete Team</ResponsiveDialogTitle>
          </div>
          <ResponsiveDialogDescription className="pt-2 px-4 sm:px-0">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{team?.name}</span>? All leads
            assigned to this team will be unlinked. This action cannot be undone.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete Team
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export default DeleteTeamDialog;
