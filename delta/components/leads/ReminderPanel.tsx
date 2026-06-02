"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Bell, Plus, Pencil, Trash2, Check, Clock, X, CalendarClock, AlarmClock,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import {
  AlertDialog, AlertDialogAction, AlertDialogCancel, AlertDialogContent,
  AlertDialogDescription, AlertDialogFooter, AlertDialogHeader, AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";
import type { Reminder } from "@/types/lead";
import {
  useAddReminder, useUpdateReminder, useDeleteReminder,
} from "@/hooks/useReminders";

// ── Helpers ───────────────────────────────────────────────────────────────────

function getReminderState(remindAt: string, isDone: boolean) {
  if (isDone) return "done" as const;
  const diff = new Date(remindAt).getTime() - Date.now();
  if (diff < 0) return "overdue" as const;
  if (diff <= 30 * 60 * 1000) return "soon" as const;
  return "upcoming" as const;
}

// Always display and compute reminder times in AED (Asia/Dubai, UTC+4)
// regardless of where the browser or server is running.

function formatReminderTime(remindAt: string) {
  return new Date(remindAt).toLocaleString("en-AE", {
    timeZone: "Asia/Dubai",
    day: "numeric", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  }) + " GST";
}

/** Convert an ISO UTC string → "YYYY-MM-DDTHH:mm" expressed in AED for datetime-local inputs */
function toDatetimeLocal(iso: string): string {
  // "sv-SE" locale gives a sortable "YYYY-MM-DD HH:mm:ss" format in the given timezone
  return new Date(iso)
    .toLocaleString("sv-SE", { timeZone: "Asia/Dubai" })
    .slice(0, 16)
    .replace(" ", "T");
}

/** Current AED time as "YYYY-MM-DDTHH:mm" — used as the min value on datetime-local inputs */
function nowIST(): string {
  return toDatetimeLocal(new Date().toISOString());
}

const STATE_STYLES = {
  overdue:  { ring: "border-red-500/50 bg-red-500/5",   badge: "bg-red-500/15 text-red-400 border-red-500/30",   icon: "text-red-400",    label: "Overdue"  },
  soon:     { ring: "border-amber-500/50 bg-amber-500/5", badge: "bg-amber-500/15 text-amber-400 border-amber-500/30", icon: "text-amber-400", label: "Due soon" },
  upcoming: { ring: "border-border bg-card",             badge: "bg-blue-500/15 text-blue-400 border-blue-500/30",   icon: "text-blue-400",   label: "Upcoming" },
  done:     { ring: "border-border/40 bg-muted/20",      badge: "bg-green-500/15 text-green-400 border-green-500/30", icon: "text-green-400",  label: "Done"     },
};

// ── Sub-form (shared for add + edit) ─────────────────────────────────────────

interface ReminderFormProps {
  initial?: { title: string; note: string; remindAt: string };
  onSave: (data: { title: string; note: string; remindAt: string }) => void;
  onCancel: () => void;
  saving: boolean;
}

function ReminderForm({ initial, onSave, onCancel, saving }: ReminderFormProps) {
  // Default to 30 minutes from now in GST
  const defaultDt = toDatetimeLocal(new Date(Date.now() + 30 * 60 * 1000).toISOString());

  const [title,    setTitle]    = useState(initial?.title    ?? "");
  const [note,     setNote]     = useState(initial?.note     ?? "");
  const [remindAt, setRemindAt] = useState(initial?.remindAt ?? defaultDt);
  const [timeError, setTimeError] = useState("");

  function handleSave() {
    // remindAt is "YYYY-MM-DDTHH:mm" in AED.
    // Appending "+04:00" makes JS parse it as AED (GST) explicitly,
    // regardless of the browser's actual local timezone.
    const pickedIST = new Date(`${remindAt}:00+04:00`);
    if (isNaN(pickedIST.getTime())) {
      setTimeError("Invalid date/time");
      return;
    }
    if (pickedIST.getTime() <= Date.now() - 60_000) {
      setTimeError("Please choose a future time (GST)");
      return;
    }
    setTimeError("");
    onSave({ title, note, remindAt: pickedIST.toISOString() });
  }

  return (
    <motion.div
      initial={{ opacity: 0, y: -8 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -8 }}
      className="rounded-xl border border-primary/30 bg-primary/5 p-4 space-y-3"
    >
      <Input
        placeholder="Title (optional)"
        value={title}
        onChange={(e) => setTitle(e.target.value)}
        className="h-8 text-sm"
      />
      <Textarea
        placeholder="Notes (optional)"
        value={note}
        onChange={(e) => setNote(e.target.value)}
        className="text-sm resize-none min-h-[60px]"
        rows={2}
      />
      <div className="space-y-1">
        <p className="text-xs text-muted-foreground flex items-center gap-1.5">
          <AlarmClock className="h-3.5 w-3.5" /> Remind at
          <span className="ml-auto text-[10px] text-muted-foreground/60">GST (UTC+4)</span>
        </p>
        <Input
          type="datetime-local"
          value={remindAt}
          min={nowIST()}
          onChange={(e) => { setRemindAt(e.target.value); setTimeError(""); }}
          className="h-8 text-sm"
        />
        {timeError && <p className="text-xs text-red-400">{timeError}</p>}
      </div>
      <div className="flex justify-end gap-2">
        <Button variant="ghost" size="sm" onClick={onCancel} disabled={saving}>
          Cancel
        </Button>
        <Button
          size="sm"
          disabled={!remindAt || saving}
          onClick={handleSave}
        >
          {saving ? "Saving…" : initial ? "Update" : "Set Reminder"}
        </Button>
      </div>
    </motion.div>
  );
}

// ── Main Panel ────────────────────────────────────────────────────────────────

interface ReminderPanelProps {
  leadId: string;
  reminders: Reminder[];
  canEdit: boolean;
}

export function ReminderPanel({ leadId, reminders, canEdit }: ReminderPanelProps) {
  const [adding,        setAdding]        = useState(false);
  const [editingId,     setEditingId]     = useState<string | null>(null);
  const [deleteId,      setDeleteId]      = useState<string | null>(null);

  const addMut    = useAddReminder(leadId);
  const updateMut = useUpdateReminder(leadId);
  const deleteMut = useDeleteReminder(leadId);

  const sorted = [...reminders].sort(
    (a, b) => new Date(a.remindAt).getTime() - new Date(b.remindAt).getTime(),
  );

  return (
    <Card className="border-border/50">
      <CardHeader className="pb-3 px-4 pt-4">
        <CardTitle className="text-sm font-semibold flex items-center justify-between">
          <span className="flex items-center gap-2">
            <CalendarClock className="h-4 w-4 text-muted-foreground" />
            Reminders
            {reminders.filter((r) => !r.isDone).length > 0 && (
              <span className="flex h-5 min-w-[20px] items-center justify-center rounded-full bg-primary/15 px-1.5 text-[10px] font-bold text-primary">
                {reminders.filter((r) => !r.isDone).length}
              </span>
            )}
          </span>
          {canEdit && !adding && (
            <Button
              variant="ghost" size="icon"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => setAdding(true)}
            >
              <Plus className="h-4 w-4" />
            </Button>
          )}
        </CardTitle>
      </CardHeader>

      <CardContent className="px-4 pb-4 space-y-2">
        {/* Add form */}
        <AnimatePresence>
          {adding && (
            <ReminderForm
              onSave={(d) =>
                addMut.mutate(d, { onSuccess: () => setAdding(false) })
              }
              onCancel={() => setAdding(false)}
              saving={addMut.isPending}
            />
          )}
        </AnimatePresence>

        {/* Empty state */}
        {sorted.length === 0 && !adding && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col items-center gap-2 py-6 text-center"
          >
            <Bell className="h-8 w-8 text-muted-foreground/30" />
            <p className="text-xs text-muted-foreground">No reminders yet</p>
            {canEdit && (
              <Button variant="outline" size="sm" className="mt-1 h-7 text-xs" onClick={() => setAdding(true)}>
                <Plus className="h-3.5 w-3.5 mr-1" /> Add reminder
              </Button>
            )}
          </motion.div>
        )}

        {/* Reminder cards */}
        <AnimatePresence initial={false}>
          {sorted.map((r) => {
            const state = getReminderState(r.remindAt, r.isDone);
            const styles = STATE_STYLES[state];
            const isEditing = editingId === r._id;

            return (
              <motion.div
                key={r._id}
                initial={{ opacity: 0, y: 6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0, x: -10 }}
                layout
              >
                {isEditing ? (
                  <ReminderForm
                    initial={{
                      title: r.title ?? "",
                      note: r.note ?? "",
                      remindAt: toDatetimeLocal(r.remindAt),
                    }}
                    onSave={(d) =>
                      updateMut.mutate(
                        { reminderId: r._id, data: d },
                        { onSuccess: () => setEditingId(null) },
                      )
                    }
                    onCancel={() => setEditingId(null)}
                    saving={updateMut.isPending}
                  />
                ) : (
                  <div className={cn("rounded-xl border p-3 transition-colors", styles.ring)}>
                    <div className="flex items-start justify-between gap-2">
                      <div className="flex-1 min-w-0 space-y-1">
                        {r.title && (
                          <p className={cn("text-sm font-medium leading-tight", r.isDone && "line-through text-muted-foreground")}>
                            {r.title}
                          </p>
                        )}
                        {r.note && (
                          <p className="text-xs text-muted-foreground leading-snug">{r.note}</p>
                        )}
                        <div className="flex items-center gap-1.5 flex-wrap mt-1">
                          <Clock className={cn("h-3 w-3 shrink-0", styles.icon)} />
                          <span className="text-xs text-muted-foreground">{formatReminderTime(r.remindAt)}</span>
                          <span className={cn("inline-flex items-center rounded-full border px-1.5 py-0.5 text-[10px] font-medium", styles.badge)}>
                            {styles.label}
                          </span>
                        </div>
                      </div>

                      {canEdit && (
                        <div className="flex items-center gap-0.5 shrink-0">
                          {/* Mark done / undone */}
                          <Button
                            variant="ghost" size="icon"
                            className={cn(
                              "h-6 w-6",
                              r.isDone ? "text-muted-foreground" : "text-green-400 hover:text-green-300",
                            )}
                            title={r.isDone ? "Mark undone" : "Mark done"}
                            onClick={() =>
                              updateMut.mutate({ reminderId: r._id, data: { isDone: !r.isDone } })
                            }
                          >
                            <Check className="h-3.5 w-3.5" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-foreground"
                            title="Edit"
                            onClick={() => setEditingId(r._id)}
                          >
                            <Pencil className="h-3 w-3" />
                          </Button>
                          <Button
                            variant="ghost" size="icon"
                            className="h-6 w-6 text-muted-foreground hover:text-red-400"
                            title="Delete"
                            onClick={() => setDeleteId(r._id)}
                          >
                            <Trash2 className="h-3 w-3" />
                          </Button>
                        </div>
                      )}
                    </div>
                  </div>
                )}
              </motion.div>
            );
          })}
        </AnimatePresence>
      </CardContent>

      {/* Delete confirm */}
      <AlertDialog open={!!deleteId} onOpenChange={(o) => !o && setDeleteId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>Delete reminder?</AlertDialogTitle>
            <AlertDialogDescription>This action cannot be undone.</AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancel</AlertDialogCancel>
            <AlertDialogAction
              className="bg-destructive hover:bg-destructive/90"
              onClick={() => {
                if (deleteId) {
                  deleteMut.mutate(deleteId, { onSuccess: () => setDeleteId(null) });
                }
              }}
            >
              Delete
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </Card>
  );
}
