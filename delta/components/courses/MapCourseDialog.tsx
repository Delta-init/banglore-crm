"use client";

import { useEffect, useMemo, useState } from "react";
import { Link2, Sparkles, Loader2, AlertTriangle } from "lucide-react";
import type { Course, LmsCourse } from "@/types/course";
import { lmsCoursesOf } from "@/types/course";
import { Button } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Checkbox } from "@/components/ui/checkbox";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle, DialogDescription, DialogFooter,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useFinanceItems, useLmsCourses, useMapCourse, type FinanceItem } from "@/hooks/useCourses";

/** Radix reads "" as unset, so "not mapped" needs a value of its own. */
const NONE = "__none__";

/** Letters and digits only: "MMC (Market Making Cycle)" and "mmc market making cycle" are one name. */
const normalise = (v: string) => v.toLowerCase().replace(/[^a-z0-9]/g, "");

/**
 * Where a course goes when it is sold — the same screen as Draw's.
 *
 *   Finance product — the Delta Finance catalogue item the invoice line bills
 *   against. Unmapped, the line carries the course's name and price as typed.
 *
 *   LMS courses — what the student gets once accounts approve the sale. A
 *   bundle opens more than one ("MBT + DWT"), in the order ticked. Finance
 *   opens a product's own LMS courses when it has some, and these otherwise —
 *   so a bundle billed against a single-course product would open one course.
 *
 * A same-name match is offered, never applied: "Digital Marketing" and
 * "Digital Marketing (Evening)" are one course to a comparison and two to
 * anybody reading them.
 */
export function MapCourseDialog({
  course,
  open,
  onClose,
}: {
  course: Course | null;
  open: boolean;
  onClose: () => void;
}) {
  const items = useFinanceItems(open);
  const lms = useLmsCourses(open);
  const save = useMapCourse();
  const [itemId, setItemId] = useState<string>(NONE);
  const [slugs, setSlugs] = useState<string[]>([]);

  useEffect(() => {
    if (!open || !course) return;
    setItemId(course.financeItemId || NONE);
    setSlugs(lmsCoursesOf(course));
  }, [open, course]);

  const itemSuggestion = useMemo<FinanceItem | undefined>(
    () => (course ? (items.data ?? []).find((i) => normalise(i.name) === normalise(course.name)) : undefined),
    [course, items.data],
  );
  const lmsSuggestion = useMemo<LmsCourse | undefined>(
    () => (course ? (lms.data ?? []).find((c) => normalise(c.title) === normalise(course.name)) : undefined),
    [course, lms.data],
  );

  if (!course) return null;

  const financeOff = !items.isLoading && !items.isError && (items.data?.length ?? 0) === 0;
  const lmsOff = !lms.isLoading && !lms.isError && (lms.data?.length ?? 0) === 0;
  const titleOf = (slug: string) => lms.data?.find((c) => c.slug === slug)?.title ?? slug;
  const toggle = (slug: string, on: boolean) =>
    setSlugs((current) => (on ? (current.includes(slug) ? current : [...current, slug]) : current.filter((s) => s !== slug)));
  const bundleWithProduct = itemId !== NONE && slugs.length > 1;

  async function submit() {
    await save.mutateAsync({ id: course!._id, financeItemId: itemId === NONE ? "" : itemId, lmsCourseSlugs: slugs });
    onClose();
  }

  return (
    <Dialog open={open} onOpenChange={(o) => { if (!o) onClose(); }}>
      <DialogContent className="sm:max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2">
            <Link2 className="h-4 w-4 text-muted-foreground" /> Map course
          </DialogTitle>
          <DialogDescription>
            Where <span className="font-medium text-foreground">{course.name}</span> goes when it is sold: the product
            finance bills it as, and the LMS course(s) the student gets once the sale is approved.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-5">
          {/* ── Finance product ── */}
          <div className="space-y-1.5">
            <Label>Finance product</Label>
            {items.isError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                Delta Finance could not be read just now. Try again in a moment.
              </p>
            ) : financeOff ? (
              <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                This server is not connected to Delta Finance yet, so there are no products to choose from.
              </p>
            ) : (
              <Select value={itemId} onValueChange={setItemId} disabled={items.isLoading}>
                <SelectTrigger>
                  <SelectValue placeholder={items.isLoading ? "Loading…" : "Not mapped"} />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={NONE}>Not mapped</SelectItem>
                  {(items.data ?? []).map((i) => (
                    <SelectItem key={i.id} value={i.id}>
                      {i.name}{i.sku ? ` · ${i.sku}` : ""} · {(i.unitPriceMinor / 100).toLocaleString()}
                    </SelectItem>
                  ))}
                </SelectContent>
              </Select>
            )}
            {itemSuggestion && itemId !== itemSuggestion.id && (
              <button
                type="button"
                onClick={() => setItemId(itemSuggestion.id)}
                className="flex w-full items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-left text-sm hover:bg-primary/10"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>
                  Same name in finance: <span className="font-medium">{itemSuggestion.name}</span>
                  {itemSuggestion.sku ? ` (${itemSuggestion.sku})` : ""} — use it?
                </span>
              </button>
            )}
          </div>

          {/* ── LMS courses ── */}
          <div className="space-y-1.5">
            <Label>LMS course(s)</Label>
            <p className="text-xs text-muted-foreground">
              Tick every course a student gets for this one — two for a bundle. They are opened in the order ticked.
            </p>
            {lms.isLoading ? (
              <p className="flex items-center gap-2 py-2 text-sm text-muted-foreground"><Loader2 className="h-4 w-4 animate-spin" /> Loading…</p>
            ) : lms.isError ? (
              <p className="rounded-md border border-destructive/30 bg-destructive/5 p-3 text-sm text-destructive">
                The LMS could not be read just now. Try again in a moment.
              </p>
            ) : lmsOff ? (
              <p className="rounded-md border border-border bg-muted/40 p-3 text-sm text-muted-foreground">
                The LMS has no published courses to choose from.
              </p>
            ) : (
              <div className="max-h-56 space-y-1 overflow-y-auto rounded-md border border-border p-2">
                {(lms.data ?? []).map((c) => {
                  const at = slugs.indexOf(c.slug);
                  return (
                    <label key={c.slug} className="flex cursor-pointer items-center gap-2 rounded px-2 py-1.5 text-sm hover:bg-muted/50">
                      <Checkbox checked={at >= 0} onCheckedChange={(v) => toggle(c.slug, v === true)} />
                      <span className="min-w-0 flex-1 truncate">{c.title}</span>
                      {at >= 0 && slugs.length > 1 && (
                        <span className="shrink-0 rounded-full bg-primary/10 px-1.5 text-xs font-medium text-primary">{at + 1}</span>
                      )}
                    </label>
                  );
                })}
              </div>
            )}
            {slugs.length > 0 && (
              <p className="text-xs text-muted-foreground">
                Opens: <span className="font-medium text-foreground">{slugs.map(titleOf).join(" + ")}</span>
              </p>
            )}
            {lmsSuggestion && !slugs.includes(lmsSuggestion.slug) && (
              <button
                type="button"
                onClick={() => toggle(lmsSuggestion.slug, true)}
                className="flex w-full items-center gap-2 rounded-md border border-primary/30 bg-primary/5 px-3 py-2 text-left text-sm hover:bg-primary/10"
              >
                <Sparkles className="h-3.5 w-3.5 shrink-0 text-primary" />
                <span>Same name in the LMS: <span className="font-medium">{lmsSuggestion.title}</span> — add it?</span>
              </button>
            )}
            {bundleWithProduct && (
              <p className="flex items-start gap-2 rounded-md border border-amber-500/30 bg-amber-500/5 p-3 text-xs text-amber-600 dark:text-amber-400">
                <AlertTriangle className="mt-0.5 h-3.5 w-3.5 shrink-0" />
                <span>
                  Finance opens the LMS courses set on its product when the product has any, instead of these. For a
                  bundle, choose a product that opens all of them in finance — or leave the product unmapped, and
                  these are opened.
                </span>
              </p>
            )}
          </div>
        </div>

        <DialogFooter>
          <Button variant="outline" onClick={onClose}>Cancel</Button>
          <Button onClick={submit} disabled={save.isPending}>
            {save.isPending ? "Saving…" : "Save mapping"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
