"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { FileText, Loader2, Calendar, Download, X } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { cn } from "@/lib/utils";
import api from "@/lib/axios";

// ── Types ─────────────────────────────────────────────────────────────────────

type QuickPeriod = "today" | "week" | "month" | "year" | "custom";

interface ExportPdfDialogProps {
  /** "overall" → /reports/export/pdf, "team" → /teams/:id/export-pdf, "user" → /users/:id/export-pdf */
  type: "overall" | "team" | "user";
  entityId?: string;
  entityName?: string;
  trigger?: React.ReactNode;
}

// ── Period helpers ─────────────────────────────────────────────────────────────

function toISO(d: Date) { return d.toISOString().slice(0, 10); }

function getRange(p: QuickPeriod): { from: string; to: string } {
  const now   = new Date();
  const today = toISO(now);
  switch (p) {
    case "today":
      return { from: today, to: today };
    case "week": {
      const mon = new Date(now);
      mon.setDate(now.getDate() - ((now.getDay() + 6) % 7));
      return { from: toISO(mon), to: today };
    }
    case "month":
      return { from: toISO(new Date(now.getFullYear(), now.getMonth(), 1)), to: today };
    case "year":
      return { from: toISO(new Date(now.getFullYear(), 0, 1)), to: today };
    default:
      return { from: "", to: "" };
  }
}

const QUICK_BTNS: { id: QuickPeriod; label: string }[] = [
  { id: "today",  label: "Today"      },
  { id: "week",   label: "This Week"  },
  { id: "month",  label: "This Month" },
  { id: "year",   label: "This Year"  },
  { id: "custom", label: "Custom"     },
];

// ── Component ──────────────────────────────────────────────────────────────────

export function ExportPdfDialog({
  type,
  entityId,
  entityName,
  trigger,
}: ExportPdfDialogProps) {
  const [open,        setOpen]        = useState(false);
  const [period,      setPeriod]      = useState<QuickPeriod>("month");
  const [customFrom,  setCustomFrom]  = useState("");
  const [customTo,    setCustomTo]    = useState("");
  const [downloading, setDownloading] = useState(false);
  const [error,       setError]       = useState("");

  function computeRange() {
    if (period === "custom") return { from: customFrom, to: customTo };
    return getRange(period);
  }

  function buildUrl() {
    const { from, to } = computeRange();
    const p = new URLSearchParams();
    if (from) p.set("dateFrom", from);
    if (to)   p.set("dateTo",   to);
    const qs = p.toString() ? `?${p.toString()}` : "";

    switch (type) {
      case "overall": return `/reports/export/pdf${qs}`;
      case "team":    return `/teams/${entityId}/export-pdf${qs}`;
      case "user":    return `/users/${entityId}/export-pdf${qs}`;
    }
  }

  async function handleDownload() {
    if (period === "custom" && (!customFrom || !customTo)) {
      setError("Please select both start and end dates.");
      return;
    }
    setError("");
    setDownloading(true);
    try {
      const url  = buildUrl();
      const res  = await api.get(url, { responseType: "blob" });
      const blob = new Blob([res.data], { type: "application/pdf" });
      const href = URL.createObjectURL(blob);
      const a    = document.createElement("a");
      a.href     = href;
      const { from, to } = computeRange();
      const label = from && to ? `${from}_${to}` : new Date().toISOString().slice(0, 10);
      const slug  = entityName
        ? entityName.toLowerCase().replace(/\s+/g, "-") + "-"
        : "";
      a.download = `${slug}report-${label}.pdf`;
      a.click();
      URL.revokeObjectURL(href);
      setOpen(false);
    } catch {
      setError("Failed to generate PDF. Please try again.");
    } finally {
      setDownloading(false);
    }
  }

  const dialogTitle = entityName
    ? `Export Report — ${entityName}`
    : "Export Report";

  return (
    <>
      {/* Trigger */}
      <div onClick={() => setOpen(true)}>
        {trigger ?? (
          <Button size="sm" variant="outline" className="gap-2 border-red-500/40 text-red-500 hover:bg-red-500/10 hover:text-red-400">
            <FileText className="h-3.5 w-3.5" />
            Export PDF
          </Button>
        )}
      </div>

      <ResponsiveDialog open={open} onOpenChange={setOpen}>
        <ResponsiveDialogContent desktopClassName="max-w-sm">
          <ResponsiveDialogHeader>
            <ResponsiveDialogTitle className="flex items-center gap-2">
              <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-red-500/10">
                <FileText className="h-4 w-4 text-red-500" />
              </div>
              {dialogTitle}
            </ResponsiveDialogTitle>
          </ResponsiveDialogHeader>

          <div className="space-y-4 pt-1 px-4 sm:px-0">
            {/* Period picker */}
            <div className="space-y-2">
              <p className="text-xs font-medium text-muted-foreground uppercase tracking-wider">
                Select Period
              </p>
              <div className="flex flex-wrap gap-2">
                {QUICK_BTNS.map((b) => (
                  <button
                    key={b.id}
                    type="button"
                    onClick={() => { setPeriod(b.id); setError(""); }}
                    className={cn(
                      "rounded-lg px-3 py-1.5 text-xs font-medium transition-all",
                      period === b.id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-muted text-muted-foreground hover:bg-muted/80 hover:text-foreground",
                    )}
                  >
                    {b.label}
                  </button>
                ))}
              </div>
            </div>

            {/* Custom date pickers */}
            <AnimatePresence>
              {period === "custom" && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: "auto", opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="overflow-hidden"
                >
                  <div className="space-y-2 pb-1">
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">From</span>
                      <input
                        type="date"
                        value={customFrom}
                        onChange={(e) => { setCustomFrom(e.target.value); setError(""); }}
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 [color-scheme:dark]"
                      />
                    </div>
                    <div className="flex items-center gap-2">
                      <Calendar className="h-3.5 w-3.5 text-muted-foreground shrink-0" />
                      <span className="text-xs text-muted-foreground">To</span>
                      <input
                        type="date"
                        value={customTo}
                        onChange={(e) => { setCustomTo(e.target.value); setError(""); }}
                        className="flex-1 rounded-lg border border-border bg-background px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-primary/30 [color-scheme:dark]"
                      />
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Period preview */}
            {period !== "custom" && (
              <div className="rounded-lg bg-muted/40 px-3 py-2 text-xs text-muted-foreground">
                {(() => {
                  const { from, to } = getRange(period);
                  return from === to ? from : `${from}  →  ${to}`;
                })()}
              </div>
            )}

            {/* Error */}
            {error && (
              <p className="text-xs text-destructive flex items-center gap-1">
                <X className="h-3 w-3" /> {error}
              </p>
            )}
          </div>

          <ResponsiveDialogFooter>
            <Button
              variant="outline"
              size="sm"
              className="flex-1 sm:flex-none"
              onClick={() => setOpen(false)}
            >
              Cancel
            </Button>
            <Button
              size="sm"
              className="flex-1 sm:flex-none gap-2 bg-red-600 hover:bg-red-700 text-white"
              onClick={handleDownload}
              disabled={downloading}
            >
              {downloading
                ? <Loader2 className="h-3.5 w-3.5 animate-spin" />
                : <Download className="h-3.5 w-3.5" />
              }
              {downloading ? "Generating…" : "Download PDF"}
            </Button>
          </ResponsiveDialogFooter>
        </ResponsiveDialogContent>
      </ResponsiveDialog>
    </>
  );
}

export default ExportPdfDialog;
