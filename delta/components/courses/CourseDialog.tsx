"use client";
import { useEffect } from "react";
import { useForm, Controller } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { Loader2, BookOpen } from "lucide-react";
import {
  ResponsiveDialog,
  ResponsiveDialogContent,
  ResponsiveDialogHeader,
  ResponsiveDialogTitle,
  ResponsiveDialogFooter,
} from "@/components/ui/responsive-dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useCreateCourse, useUpdateCourse } from "@/hooks/useCourses";
import type { Course } from "@/types/course";
import { getCurrencySymbol } from "@/lib/currency";

const courseSchema = z.object({
  name: z.string().min(1, "Course name is required").max(150),
  description: z.string().max(1000).optional(),
  amount: z.coerce.number({ required_error: "Amount is required" }).min(0, "Amount cannot be negative"),
  status: z.enum(["active", "inactive"]).default("active"),
});

type CourseFormValues = z.infer<typeof courseSchema>;

interface CourseDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  course?: Course | null;
}

export function CourseDialog({ open, onOpenChange, course }: CourseDialogProps) {
  const isEditing = !!course;
  const { mutate: createCourse, isPending: creating } = useCreateCourse();
  const { mutate: updateCourse, isPending: updating } = useUpdateCourse();
  const isPending = creating || updating;

  const {
    register,
    handleSubmit,
    control,
    reset,
    formState: { errors },
  } = useForm<CourseFormValues>({
    resolver: zodResolver(courseSchema),
    defaultValues: { name: "", description: "", amount: 0, status: "active" },
  });

  useEffect(() => {
    if (open) {
      if (course) {
        reset({
          name: course.name,
          description: course.description ?? "",
          amount: course.amount,
          status: course.status,
        });
      } else {
        reset({ name: "", description: "", amount: 0, status: "active" });
      }
    }
  }, [open, course, reset]);

  const onSubmit = (data: CourseFormValues) => {
    const payload = {
      ...data,
      description: data.description || undefined,
    };
    if (isEditing && course) {
      updateCourse(
        { id: course._id, data: payload },
        { onSuccess: () => onOpenChange(false) },
      );
    } else {
      createCourse(payload, { onSuccess: () => onOpenChange(false) });
    }
  };

  return (
    <ResponsiveDialog open={open} onOpenChange={onOpenChange}>
      <ResponsiveDialogContent desktopClassName="max-w-md">
        <ResponsiveDialogHeader>
          <ResponsiveDialogTitle className="flex items-center gap-2">
            <div className="flex h-8 w-8 items-center justify-center rounded-lg bg-primary/10">
              <BookOpen className="h-4 w-4 text-primary" />
            </div>
            {isEditing ? "Edit Course" : "Add New Course"}
          </ResponsiveDialogTitle>
        </ResponsiveDialogHeader>

        <form onSubmit={handleSubmit(onSubmit)} className="space-y-4 pt-2 px-4 sm:px-0">
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="course-name">Course Name *</Label>
            <Input id="course-name" placeholder="e.g. Full Stack Development" {...register("name")} />
            {errors.name && <p className="text-xs text-destructive">{errors.name.message}</p>}
          </div>

          {/* Description */}
          <div className="space-y-1.5">
            <Label htmlFor="course-description">Description</Label>
            <Textarea
              id="course-description"
              placeholder="Brief description of this course..."
              rows={3}
              className="resize-none"
              {...register("description")}
            />
            {errors.description && (
              <p className="text-xs text-destructive">{errors.description.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-4">
            {/* Amount */}
            <div className="space-y-1.5">
              <Label htmlFor="course-amount">Amount ({getCurrencySymbol().trim()}) *</Label>
              <Input
                id="course-amount"
                type="number"
                min={0}
                step={1}
                placeholder="0"
                {...register("amount")}
              />
              {errors.amount && (
                <p className="text-xs text-destructive">{errors.amount.message}</p>
              )}
            </div>

            {/* Status */}
            <div className="space-y-1.5">
              <Label>Status</Label>
              <Controller
                name="status"
                control={control}
                render={({ field }) => (
                  <Select value={field.value} onValueChange={field.onChange}>
                    <SelectTrigger>
                      <SelectValue placeholder="Status" />
                    </SelectTrigger>
                    <SelectContent>
                      <SelectItem value="active">Active</SelectItem>
                      <SelectItem value="inactive">Inactive</SelectItem>
                    </SelectContent>
                  </Select>
                )}
              />
            </div>
          </div>

          <ResponsiveDialogFooter>
            <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
              Cancel
            </Button>
            <Button type="submit" disabled={isPending}>
              {isPending && <Loader2 className="h-4 w-4 animate-spin mr-1" />}
              {isEditing ? "Save Changes" : "Create Course"}
            </Button>
          </ResponsiveDialogFooter>
        </form>
      </ResponsiveDialogContent>
    </ResponsiveDialog>
  );
}

export default CourseDialog;
