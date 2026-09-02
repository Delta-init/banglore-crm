"use client";

import { useEffect, useState } from "react";
import { LOST_REASONS, LOST_REASON_LABELS, type LostReason } from "@/types/lead";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";

/**
 * Why a lead is being marked lost.
 *
 * Asked at the moment it happens, because that is the only moment anybody knows.
 * A reason filled in later is a guess, and a pipeline explained by guesses tells
 * whoever reads it the wrong thing about where deals go.
 *
 * The note is required alongside the reason: "Not interested" on its own tells
 * whoever picks the lead up in six months nothing they can act on.
 */
export function LostReasonDialog({
  open,
  count,
  busy,
  onCancel,
  onConfirm,
}: {
  open: boolean;
  /** How many leads this will mark lost — more than one when done in bulk. */
  count: number;
  busy?: boolean;
  onCancel: () => void;
  onConfirm: (reason: LostReason, notes: string) => void;
}) {
  const [reason, setReason] = useState<LostReason | "">("");
  const [notes, setNotes] = useState("");

  useEffect(() => {
    if (!open) return;
    setReason("");
    setNotes("");
  }, [open]);

  const ready = reason !== "" && notes.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onCancel(); }}>
      <DialogContent className="sm:max-w-md">
        <DialogHeader>
          <DialogTitle>
            {count > 1 ? `Mark ${count} leads as lost` : "Mark this lead as lost"}
          </DialogTitle>
          <DialogDescription>
            Both fields are needed. They are what the pipeline report is built from.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <div className="space-y-1.5">
            <Label>Reason</Label>
            <Select value={reason} onValueChange={(v) => setReason(v as LostReason)}>
              <SelectTrigger><SelectValue placeholder="Pick a reason" /></SelectTrigger>
              <SelectContent>
                {LOST_REASONS.map((r) => (
                  <SelectItem key={r} value={r}>{LOST_REASON_LABELS[r]}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="lost-notes">What happened?</Label>
            <Textarea
              id="lost-notes"
              value={notes}
              rows={3}
              maxLength={500}
              placeholder="Enough that somebody picking this up in six months knows what went on"
              onChange={(e) => setNotes(e.target.value)}
            />
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onCancel} disabled={busy}>Cancel</Button>
          <Button
            variant="destructive"
            disabled={!ready || busy}
            onClick={() => ready && onConfirm(reason as LostReason, notes.trim())}
          >
            {busy ? "Saving…" : "Mark as lost"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
