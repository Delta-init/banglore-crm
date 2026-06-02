"use client";
import { useState } from "react";
import { Loader2, Shuffle } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useAssignLead, useAutoAssignLeads } from "@/hooks/useLeads";
import { useUsers } from "@/hooks/useUsers";
import type { Lead } from "@/types/lead";

interface AssignLeadDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  lead: Lead | null;
}

export function AssignLeadDialog({ open, onOpenChange, lead }: AssignLeadDialogProps) {
  const [selectedUser, setSelectedUser] = useState<string>("");
  const { mutate: assignLead, isPending: assigning } = useAssignLead();
  const { mutate: autoAssign, isPending: autoAssigning } = useAutoAssignLeads();
  const { data: usersData } = useUsers({ status: "active", limit: "100" });
  const users = usersData?.data ?? [];

  const handleAssign = () => {
    if (!lead || !selectedUser) return;
    assignLead(
      { id: lead._id, userId: selectedUser },
      { onSuccess: () => { setSelectedUser(""); onOpenChange(false); } }
    );
  };

  const handleAutoAssign = () => {
    autoAssign(undefined, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={(v) => { setSelectedUser(""); onOpenChange(v); }}>
      <ResponsiveDialogContent desktopClassName="max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle>Assign Lead</ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <div className="space-y-4 py-2 px-4 sm:px-0">
          <div className="space-y-1.5">
            <Label>Assign to User</Label>
            <Select value={selectedUser} onValueChange={setSelectedUser}>
              <SelectTrigger>
                <SelectValue placeholder="Select a user" />
              </SelectTrigger>
              <SelectContent>
                {users.map((user) => (
                  <SelectItem key={user._id} value={user._id}>
                    {user.name}
                    {user.designation ? ` — ${user.designation}` : ""}
                  </SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="relative flex items-center gap-3">
            <div className="flex-1 border-t border-border" />
            <span className="text-xs text-muted-foreground">or</span>
            <div className="flex-1 border-t border-border" />
          </div>

          <Button
            variant="outline"
            className="w-full gap-2"
            onClick={handleAutoAssign}
            disabled={autoAssigning || assigning}
          >
            {autoAssigning ? (
              <Loader2 className="h-4 w-4 animate-spin" />
            ) : (
              <Shuffle className="h-4 w-4" />
            )}
            Auto Assign All Unassigned
          </Button>
        </div>

        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button onClick={handleAssign} disabled={!selectedUser || assigning || autoAssigning}>
            {assigning && <Loader2 className="h-4 w-4 animate-spin" />}
            Assign
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}
