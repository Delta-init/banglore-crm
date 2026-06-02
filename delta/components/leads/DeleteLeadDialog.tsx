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
import { useDeleteLead } from "@/hooks/useLeads";
import type { Lead } from "@/types/lead";

interface DeleteLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
}

export function DeleteLeadDialog({ open, onOpenChange, lead }: DeleteLeadDialogProps) {
  const { mutate: deleteLead, isPending } = useDeleteLead();

  const handleDelete = () => {
    if (!lead) return;
    deleteLead(lead._id, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent desktopClassName="max-w-sm">
        <ResponsiveDialogHeader>
          <div className="flex items-center gap-3 px-4 sm:px-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-destructive/10">
              <AlertTriangle className="h-5 w-5 text-destructive" />
            </div>
            <ResponsiveDialogTitle>Delete Lead</ResponsiveDialogTitle>
          </div>
          <ResponsiveDialogDescription className="pt-2 px-4 sm:px-0">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{lead?.name}</span>? This action cannot
            be undone.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="destructive" onClick={handleDelete} disabled={isPending}>
            {isPending && <Loader2 className="h-4 w-4 animate-spin" />}
            Delete Lead
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
