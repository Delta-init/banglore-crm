"use client";
import { Suspense, useState, useEffect, useRef } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import {
  BookOpen, Plus, Search, X, Edit2, Trash2,
  DollarSign, ChevronLeft, ChevronRight, BookMarked,
  TrendingUp, Package, Loader2,
} from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardFooter, CardHeader } from "@/components/ui/card";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useCourses } from "@/hooks/useCourses";
import { CourseDialog } from "@/components/courses/CourseDialog";
import { DeleteCourseDialog } from "@/components/courses/DeleteCourseDialog";
import type { Course } from "@/types/course";
import { useCurrencyStore } from "@/lib/store/currencyStore";
import { fmtCurrency } from "@/lib/currency";

// ─── Helpers ──────────────────────────────────────────────────────────────────

const formatAmount = fmtCurrency;

// ─── Skeleton Card ─────────────────────────────────────────────────────────────

function CourseCardSkeleton() {
  return (
    <Card className="overflow-hidden">
      <CardHeader className="pb-3">
        <div className="flex items-start justify-between">
          <Skeleton className="h-10 w-10 rounded-xl" />
          <Skeleton className="h-5 w-16 rounded-full" />
        </div>
        <Skeleton className="h-5 w-3/4 mt-3" />
        <Skeleton className="h-4 w-full mt-1" />
        <Skeleton className="h-4 w-2/3 mt-1" />
      </CardHeader>
      <CardFooter className="pt-0 border-t">
        <Skeleton className="h-4 w-24 mt-3" />
      </CardFooter>
    </Card>
  );
}

// ─── Course Card ──────────────────────────────────────────────────────────────

interface CourseCardProps {
  course: Course;
  onEdit: (c: Course) => void;
  onDelete: (c: Course) => void;
  index: number;
}

function CourseCard({ course, onEdit, onDelete, index }: CourseCardProps) {
  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, scale: 0.95 }}
      transition={{ duration: 0.3, delay: index * 0.04 }}
      layout
    >
      <Card className="group h-full overflow-hidden border-border/60 transition-all duration-200 hover:shadow-md hover:border-primary/30 flex flex-col">
        <CardHeader className="pb-3 flex-1">
          <div className="flex items-start justify-between">
            {/* Icon */}
            <div className="flex h-10 w-10 items-center justify-center rounded-xl bg-primary/10 text-primary group-hover:bg-primary group-hover:text-primary-foreground transition-colors duration-200 shrink-0">
              <BookOpen className="h-5 w-5" />
            </div>
            {/* Status badge */}
            <Badge
              variant={course.status === "active" ? "default" : "secondary"}
              className="text-xs"
            >
              {course.status === "active" ? "Active" : "Inactive"}
            </Badge>
          </div>

          {/* Name */}
          <h3 className="mt-3 font-semibold text-foreground leading-snug line-clamp-2">
            {course.name}
          </h3>

          {/* Description */}
          <p className="text-sm text-muted-foreground line-clamp-2 min-h-[2.5rem]">
            {course.description || (
              <span className="italic text-muted-foreground/50">No description</span>
            )}
          </p>
        </CardHeader>

        <CardContent className="pb-3">
          <div className="flex items-center gap-1 text-lg font-bold text-foreground">
            {formatAmount(course.amount)}
          </div>
          <p className="text-xs text-muted-foreground mt-0.5">Course fee</p>
        </CardContent>

        <CardFooter className="pt-3 border-t border-border/50 flex items-center justify-between gap-2">
          <p className="text-xs text-muted-foreground truncate">
            {new Date(course.createdAt).toLocaleDateString("en-AE", {
              day: "numeric",
              month: "short",
              year: "numeric",
              timeZone: "Asia/Dubai",
            })}
          </p>

          {/* Actions — always visible on mobile, hover-only on desktop */}
          <div className="flex items-center gap-1 sm:opacity-0 sm:group-hover:opacity-100 transition-opacity duration-150 shrink-0">
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-foreground"
              onClick={() => onEdit(course)}
            >
              <Edit2 className="h-3.5 w-3.5" />
            </Button>
            <Button
              size="icon"
              variant="ghost"
              className="h-7 w-7 text-muted-foreground hover:text-destructive"
              onClick={() => onDelete(course)}
            >
              <Trash2 className="h-3.5 w-3.5" />
            </Button>
          </div>
        </CardFooter>
      </Card>
    </motion.div>
  );
}

// ─── Main Page Content ────────────────────────────────────────────────────────

function CoursesPageContent() {
  useCurrencyStore(); // subscribe so component re-renders on currency change
  const sp     = useSearchParams();
  const router = useRouter();

  const [search, setSearch]                   = useState(() => sp.get("q") ?? "");
  const [debouncedSearch, setDebouncedSearch] = useState(() => sp.get("q") ?? "");
  const [statusFilter, setStatusFilter]       = useState<string>(() => sp.get("status") ?? "all");
  const [page, setPage]                       = useState(() => Number(sp.get("page") ?? "1"));
  const [dialogOpen, setDialogOpen]           = useState(false);
  const [editCourse, setEditCourse]           = useState<Course | null>(null);
  const [deleteDialogOpen, setDeleteDialogOpen] = useState(false);
  const [deleteCourse, setDeleteCourse]       = useState<Course | null>(null);
  const searchTimer = useRef<ReturnType<typeof setTimeout>>();

  useEffect(() => {
    const params = new URLSearchParams();
    if (debouncedSearch) params.set("q", debouncedSearch);
    if (statusFilter !== "all") params.set("status", statusFilter);
    if (page > 1) params.set("page", String(page));
    router.replace(`?${params.toString()}`, { scroll: false });
  }, [debouncedSearch, statusFilter, page]);

  const { data, isLoading } = useCourses({
    search: debouncedSearch || undefined,
    status: statusFilter === "all" ? undefined : statusFilter,
    page,
    limit: 12,
  });

  const courses    = data?.data ?? [];
  const pagination = data?.pagination;

  const handleSearchChange = (val: string) => {
    setSearch(val);
    clearTimeout(searchTimer.current);
    searchTimer.current = setTimeout(() => {
      setDebouncedSearch(val);
      setPage(1);
    }, 400);
  };

  const handleStatusChange = (val: string) => {
    setStatusFilter(val);
    setPage(1);
  };

  const openCreate = () => { setEditCourse(null); setDialogOpen(true); };
  const openEdit   = (c: Course) => { setEditCourse(c); setDialogOpen(true); };
  const openDelete = (c: Course) => { setDeleteCourse(c); setDeleteDialogOpen(true); };

  const totalCourses  = pagination?.total ?? 0;
  const activeCourses = courses.filter((c) => c.status === "active").length;
  const avgAmount     = courses.length
    ? courses.reduce((s, c) => s + c.amount, 0) / courses.length
    : 0;

  return (
    <>
      {/* ── Page wrapper — natural flow, parent main handles scrolling ───────── */}
      <div className="flex flex-col gap-6 pb-6">

        {/* ── Page header ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
          className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between"
        >
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-primary/10">
              <BookMarked className="h-5 w-5 text-primary" />
            </div>
            <div className="min-w-0">
              <h1 className="text-xl font-bold text-foreground">Courses</h1>
              <p className="text-sm text-muted-foreground truncate">
                Manage all available courses and programs
              </p>
            </div>
          </div>
          <Button onClick={openCreate} className="gap-2 shrink-0 w-full sm:w-auto">
            <Plus className="h-4 w-4" />
            Add Course
          </Button>
        </motion.div>

        {/* ── Stats strip ─────────────────────────────────────────────────────── */}
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.08 }}
          className="grid grid-cols-1 sm:grid-cols-3 gap-3"
        >
          {[
            {
              label: "Total Courses",
              value: totalCourses,
              icon: Package,
              color: "text-blue-500",
              bg: "bg-blue-500/10",
            },
            {
              label: "Active",
              value: activeCourses,
              icon: TrendingUp,
              color: "text-emerald-500",
              bg: "bg-emerald-500/10",
            },
            {
              label: "Avg. Fee",
              value: formatAmount(avgAmount),
              icon: DollarSign,
              color: "text-amber-500",
              bg: "bg-amber-500/10",
            },
          ].map(({ label, value, icon: Icon, color, bg }, i) => (
            <motion.div
              key={label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.08 + i * 0.05 }}
              className="flex items-center gap-3 rounded-xl border border-border/50 bg-card p-4"
            >
              <div className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-lg ${bg} ${color}`}>
                <Icon className="h-5 w-5" />
              </div>
              <div className="min-w-0">
                <p className="text-xs text-muted-foreground">{label}</p>
                <p className="text-xl font-bold text-foreground truncate">{value}</p>
              </div>
            </motion.div>
          ))}
        </motion.div>

        {/* ── Filters ─────────────────────────────────────────────────────────── */}
        <div className="flex flex-col sm:flex-row gap-3">
          {/* Search */}
          <div className="relative flex-1">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground pointer-events-none" />
            <Input
              placeholder="Search courses..."
              value={search}
              onChange={(e) => handleSearchChange(e.target.value)}
              className="pl-9 pr-8"
            />
            {search && (
              <button
                onClick={() => handleSearchChange("")}
                className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
              >
                <X className="h-3.5 w-3.5" />
              </button>
            )}
          </div>

          {/* Status filter */}
          <Select value={statusFilter} onValueChange={handleStatusChange}>
            <SelectTrigger className="w-full sm:w-[160px]">
              <SelectValue placeholder="All Status" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Status</SelectItem>
              <SelectItem value="active">Active</SelectItem>
              <SelectItem value="inactive">Inactive</SelectItem>
            </SelectContent>
          </Select>
        </div>

        {/* ── Content grid ────────────────────────────────────────────────────── */}
        {isLoading ? (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
            {Array.from({ length: 8 }).map((_, i) => (
              <CourseCardSkeleton key={i} />
            ))}
          </div>
        ) : courses.length === 0 ? (
          <motion.div
            initial={{ opacity: 0, scale: 0.95 }}
            animate={{ opacity: 1, scale: 1 }}
            className="flex flex-col items-center justify-center rounded-xl border border-dashed border-border/60 py-20 text-center"
          >
            <div className="flex h-16 w-16 items-center justify-center rounded-2xl bg-muted mb-4">
              <BookOpen className="h-8 w-8 text-muted-foreground" />
            </div>
            <h3 className="font-semibold text-foreground mb-1">No courses found</h3>
            <p className="text-sm text-muted-foreground max-w-xs px-4">
              {debouncedSearch || statusFilter !== "all"
                ? "Try adjusting your filters to see more courses."
                : "Get started by adding your first course."}
            </p>
            {!debouncedSearch && statusFilter === "all" && (
              <Button onClick={openCreate} className="mt-6 gap-2">
                <Plus className="h-4 w-4" />
                Add Course
              </Button>
            )}
          </motion.div>
        ) : (
          <AnimatePresence mode="popLayout">
            <motion.div
              layout
              className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4"
            >
              {courses.map((course, i) => (
                <CourseCard
                  key={course._id}
                  course={course}
                  onEdit={openEdit}
                  onDelete={openDelete}
                  index={i}
                />
              ))}
            </motion.div>
          </AnimatePresence>
        )}

        {/* ── Pagination ──────────────────────────────────────────────────────── */}
        {pagination && pagination.totalPages > 1 && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            className="flex flex-col-reverse sm:flex-row items-center justify-between gap-3 border-t border-border/40 pt-4"
          >
            {/* Page info */}
            <p className="text-sm text-muted-foreground text-center sm:text-left">
              Showing{" "}
              <span className="font-medium text-foreground">
                {(page - 1) * 12 + 1}–{Math.min(page * 12, pagination.total)}
              </span>{" "}
              of{" "}
              <span className="font-medium text-foreground">{pagination.total}</span>{" "}
              courses
            </p>

            {/* Prev / page counter / Next */}
            <div className="flex items-center gap-2">
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasPrevPage}
                onClick={() => setPage((p) => p - 1)}
                className="gap-1"
              >
                <ChevronLeft className="h-4 w-4" />
                <span className="hidden sm:inline">Prev</span>
              </Button>
              <span className="text-sm font-medium px-2 tabular-nums">
                {page} / {pagination.totalPages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={!pagination.hasNextPage}
                onClick={() => setPage((p) => p + 1)}
                className="gap-1"
              >
                <span className="hidden sm:inline">Next</span>
                <ChevronRight className="h-4 w-4" />
              </Button>
            </div>
          </motion.div>
        )}
      </div>

      {/* ── Dialogs ───────────────────────────────────────────────────────────── */}
      <CourseDialog
        open={dialogOpen}
        onOpenChange={setDialogOpen}
        course={editCourse}
      />
      <DeleteCourseDialog
        open={deleteDialogOpen}
        onOpenChange={setDeleteDialogOpen}
        course={deleteCourse}
      />
    </>
  );
}

export default function CoursesPage() {
  return (
    <Suspense fallback={
      <div className="flex items-center justify-center py-32">
        <Loader2 className="h-8 w-8 animate-spin text-muted-foreground" />
      </div>
    }>
      <CoursesPageContent />
    </Suspense>
  );
}
