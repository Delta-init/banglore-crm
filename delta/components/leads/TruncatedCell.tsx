"use client";

import { useState } from "react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { cn } from "@/lib/utils";

/**
 * A table cell that truncates long text and opens the full value in a dialog.
 *
 * A `title` tooltip is not enough here: it never appears on touch, and the
 * fields this is used for — a counsellor's note on why a lead was lost, the
 * exact concern they raised — are precisely the ones someone opens the table
 * to read.
 */
export function TruncatedCell({
  value,
  label,
  maxWidth = "max-w-[200px]",
  className,
}: {
  value?: string | null;
  /** Dialog heading, e.g. "Lost Notes" */
  label: string;
  maxWidth?: string;
  className?: string;
}) {
  const [open, setOpen] = useState(false);
  const text = (value ?? "").trim();

  if (!text) return <span className="text-xs text-muted-foreground/40">—</span>;

  // Only worth a dialog if something is actually being hidden. Short values stay
  // plain text so the table does not fill up with fake affordances.
  const isLong = text.length > 40 || text.includes("\n");

  if (!isLong) {
    return <span className={cn("text-xs text-foreground/80", className)}>{text}</span>;
  }

  return (
    <>
      <button
        type="button"
        onClick={(e) => {
          // The row itself opens the lead; without this, reading a note would
          // navigate away instead.
          e.stopPropagation();
          setOpen(true);
        }}
        title="Click to read in full"
        className={cn(
          "block truncate text-left text-xs text-foreground/80 underline-offset-2 hover:underline",
          maxWidth,
          className,
        )}
      >
        {text}
      </button>

      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent
          className="sm:max-w-lg"
          onClick={(e) => e.stopPropagation()}
        >
          <DialogHeader>
            <DialogTitle>{label}</DialogTitle>
          </DialogHeader>
          {/* whitespace-pre-wrap so line breaks a counsellor typed survive */}
          <p className="max-h-[60vh] overflow-y-auto whitespace-pre-wrap break-words text-sm leading-relaxed">
            {text}
          </p>
        </DialogContent>
      </Dialog>
    </>
  );
}
