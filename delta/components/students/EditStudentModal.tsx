"use client";

import { useEffect } from "react";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { z } from "zod";
import { motion } from "framer-motion";
import { GraduationCap, Loader2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import {
  Dialog, DialogContent, DialogHeader, DialogTitle,
} from "@/components/ui/dialog";
import {
  Select, SelectContent, SelectItem, SelectTrigger, SelectValue,
} from "@/components/ui/select";
import { useUpdateStudent } from "@/hooks/useStudents";
import { useCourses } from "@/hooks/useCourses";
import { useUsers } from "@/hooks/useUsers";
import { useTeams } from "@/hooks/useTeams";
import type { Student } from "@/types/student";
import type { Course } from "@/types/course";
import type { User } from "@/types";
import type { Team } from "@/types/team";

const schema = z.object({
  name:       z.string().min(1, "Name is required"),
  phone:      z.string().optional(),
  email:      z.string().email("Invalid email").optional().or(z.literal("")),
  course:     z.string().optional(),
  team:       z.string().optional(),
  assignedTo: z.string().optional(),
  totalFee:   z.coerce.number().min(0).optional(),
  paidAmount: z.coerce.number().min(0).optional(),
  notes:      z.string().optional(),
});

type FormValues = z.infer<typeof schema>;

interface Props {
  open: boolean;
  student: Student;
  onClose: () => void;
}

export function EditStudentModal({ open, student, onClose }: Props) {
  const updateMut = useUpdateStudent();

  const { data: coursesData }  = useCourses({ limit: 100 });
  const { data: usersData }    = useUsers({ limit: "100" });
  const { data: teamsData }    = useTeams({ limit: 100 });

  const courses: Course[] = coursesData?.data ?? [];
  const users:   User[]   = usersData?.data   ?? [];
  const teams:   Team[]   = teamsData?.data   ?? [];

  const courseId     = student.course     && typeof student.course     === "object" ? (student.course as Course)._id     : (student.course     as string | undefined);
  const teamId       = student.team       && typeof student.team       === "object" ? (student.team   as Team)._id       : (student.team       as string | undefined);
  const assignedToId = student.assignedTo && typeof student.assignedTo === "object" ? (student.assignedTo as User)._id  : (student.assignedTo as string | undefined);

  const form = useForm<FormValues>({
    resolver: zodResolver(schema),
    defaultValues: {
      name:       student.name,
      phone:      student.phone      ?? "",
      email:      student.email      ?? "",
      course:     courseId           ?? "",
      team:       teamId             ?? "",
      assignedTo: assignedToId       ?? "",
      totalFee:   student.totalFee,
      paidAmount: student.paidAmount,
      notes:      student.notes      ?? "",
    },
  });

  useEffect(() => {
    if (open) {
      form.reset({
        name:       student.name,
        phone:      student.phone      ?? "",
        email:      student.email      ?? "",
        course:     courseId           ?? "",
        team:       teamId             ?? "",
        assignedTo: assignedToId       ?? "",
        totalFee:   student.totalFee,
        paidAmount: student.paidAmount,
        notes:      student.notes      ?? "",
      });
    }
  }, [open, student]);

  function onSubmit(values: FormValues) {
    const payload: Record<string, unknown> = {
      name:   values.name,
      phone:  values.phone  || undefined,
      email:  values.email  || undefined,
      course: values.course || null,
      team:   values.team   || null,
      assignedTo: values.assignedTo || null,
      totalFee:   values.totalFee,
      paidAmount: values.paidAmount,
      notes:      values.notes || undefined,
    };

    updateMut.mutate(
      { id: student._id, data: payload as never },
      { onSuccess: () => onClose() },
    );
  }

  return (
    <Dialog open={open} onOpenChange={(v) => !v && onClose()}>
      <DialogContent className="max-w-lg max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-base">
            <GraduationCap className="h-5 w-5 text-primary" />
            Edit Student
          </DialogTitle>
        </DialogHeader>

        <motion.form
          initial={{ opacity: 0, y: 8 }}
          animate={{ opacity: 1, y: 0 }}
          onSubmit={form.handleSubmit(onSubmit)}
          className="space-y-4 pt-1"
        >
          {/* Name */}
          <div className="space-y-1.5">
            <Label htmlFor="name">Full Name <span className="text-destructive">*</span></Label>
            <Input id="name" {...form.register("name")} placeholder="Student name" />
            {form.formState.errors.name && (
              <p className="text-xs text-destructive">{form.formState.errors.name.message}</p>
            )}
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Phone */}
            <div className="space-y-1.5">
              <Label htmlFor="phone">Phone</Label>
              <Input id="phone" {...form.register("phone")} placeholder="+91 …" />
            </div>
            {/* Email */}
            <div className="space-y-1.5">
              <Label htmlFor="email">Email</Label>
              <Input id="email" type="email" {...form.register("email")} placeholder="email@…" />
              {form.formState.errors.email && (
                <p className="text-xs text-destructive">{form.formState.errors.email.message}</p>
              )}
            </div>
          </div>

          {/* Course */}
          <div className="space-y-1.5">
            <Label>Course</Label>
            <Select
              value={form.watch("course") ?? ""}
              onValueChange={(v) => form.setValue("course", v === "none" ? "" : v)}
            >
              <SelectTrigger><SelectValue placeholder="Select course" /></SelectTrigger>
              <SelectContent>
                <SelectItem value="none">— None —</SelectItem>
                {courses.map((c) => (
                  <SelectItem key={c._id} value={c._id}>{c.name}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Team */}
            <div className="space-y-1.5">
              <Label>Team</Label>
              <Select
                value={form.watch("team") ?? ""}
                onValueChange={(v) => form.setValue("team", v === "none" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="Select team" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {teams.map((t) => (
                    <SelectItem key={t._id} value={t._id}>{t.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>

            {/* Counsellor */}
            <div className="space-y-1.5">
              <Label>Counsellor</Label>
              <Select
                value={form.watch("assignedTo") ?? ""}
                onValueChange={(v) => form.setValue("assignedTo", v === "none" ? "" : v)}
              >
                <SelectTrigger><SelectValue placeholder="Select counsellor" /></SelectTrigger>
                <SelectContent>
                  <SelectItem value="none">— None —</SelectItem>
                  {users.map((u) => (
                    <SelectItem key={u._id} value={u._id}>{u.name}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Total fee */}
            <div className="space-y-1.5">
              <Label htmlFor="totalFee">Total Fee (₹)</Label>
              <Input id="totalFee" type="number" min={0} {...form.register("totalFee")} />
            </div>
            {/* Paid amount */}
            <div className="space-y-1.5">
              <Label htmlFor="paidAmount">Paid Amount (₹)</Label>
              <Input id="paidAmount" type="number" min={0} {...form.register("paidAmount")} />
            </div>
          </div>

          {/* Notes */}
          <div className="space-y-1.5">
            <Label htmlFor="notes">Notes</Label>
            <Textarea id="notes" {...form.register("notes")} placeholder="Any additional notes…" className="resize-none min-h-[72px]" />
          </div>

          <div className="flex justify-end gap-2 pt-1">
            <Button type="button" variant="outline" onClick={onClose} disabled={updateMut.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={updateMut.isPending}>
              {updateMut.isPending && <Loader2 className="h-4 w-4 mr-2 animate-spin" />}
              Save Changes
            </Button>
          </div>
        </motion.form>
      </DialogContent>
    </Dialog>
  );
}
