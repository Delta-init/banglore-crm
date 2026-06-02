"use client";
import { Loader2, Trash2 } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogDescription,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { useDeleteCourse } from "@/hooks/useCourses";
import type { Course } from "@/types/course";

interface DeleteCourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course: Course | null;
}

export function DeleteCourseDialog({ open, onOpenChange, course }: DeleteCourseDialogProps) {
  const { mutate: deleteCourse, isPending } = useDeleteCourse();

  const handleDelete = () => {
    if (!course) return;
    deleteCourse(course._id, { onSuccess: () => onOpenChange(false) });
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent desktopClassName="max-w-sm">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2 px-4 sm:px-0">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-destructive/10">
              <Trash2 className="h-4 w-4 text-destructive" />
            </div>
            Delete Course
          </ResponsiveDialogTitle>
          <ResponsiveDialogDescription className="px-4 sm:px-0">
            Are you sure you want to delete{" "}
            <span className="font-semibold text-foreground">{course?.name}</span>?
            {" "}This action cannot be undone. Leads assigned to this course will not be affected.
          </ResponsiveDialogDescription>
        </ResponsiveDialogHeader>
        <ResponsiveDialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancel
          </Button>
          <Button
            variant="destructive"
            onClick={handleDelete}
            disabled={isPending}
          >
            {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
            Delete
          </Button>
        </ResponsiveDialogFooter>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export default DeleteCourseDialog;
