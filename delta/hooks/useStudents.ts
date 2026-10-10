import { useEffect, useState } from "react";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { toast } from "@/lib/toast";
import type { ApiResponse } from "@/types";
import type { Student, StudentFilters, CreateStudentInput, StoredReceipt, EmailCheck } from "@/types/student";

const KEY = ["students"] as const;

/** Worth asking the server about: the shape of an email. Finance's own check is stricter still. */
const LOOKS_LIKE_EMAIL = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

/**
 * Whether an email can be this client's, or another client here already holds
 * it (one email, one client — 2026-10-10) — asked of the server for the lead
 * being closed or the enrolment being corrected (with the name and phone the
 * correction form now has, when they changed), a moment after typing stops.
 *
 * `taken` is the server's answer when the email is somebody else's, with the
 * message naming them. `checking` while the answer for what is in the box is
 * still to come. No answer — an error, a server from before — blocks nothing:
 * the close and the correction are checked again when they are saved.
 */
export function useEmailCheck(
  email: string,
  client: { leadId?: string; studentId?: string; name?: string; phone?: string },
  enabled = true,
) {
  const wanted = JSON.stringify({ email: email.trim().toLowerCase(), ...client });
  // The first one asked at once; then each change once typing pauses.
  const [asked, setAsked] = useState(wanted);
  useEffect(() => {
    const t = setTimeout(() => setAsked(wanted), 400);
    return () => clearTimeout(t);
  }, [wanted]);
  const params = JSON.parse(asked) as Record<string, string | undefined>;
  const askable = enabled && LOOKS_LIKE_EMAIL.test(params.email ?? "") && Boolean(params.leadId || params.studentId);
  const q = useQuery({
    queryKey: [...KEY, "email-check", asked],
    queryFn: async () => {
      const search = new URLSearchParams(Object.entries(params).filter((e): e is [string, string] => Boolean(e[1])));
      const res = await api.get<ApiResponse<EmailCheck>>(`/students/email-check?${search.toString()}`);
      return res.data.data ?? { ok: true };
    },
    enabled: askable,
    retry: false,
    staleTime: 30_000,
  });
  const settled = asked === wanted;
  return {
    taken: askable && settled && q.data?.ok === false ? q.data : null,
    checking: enabled && LOOKS_LIKE_EMAIL.test(email.trim()) && (!settled || q.isLoading),
  };
}

export const useStudents = (filters?: StudentFilters) =>
  useQuery({
    queryKey: [...KEY, filters],
    queryFn: async () => {
      const params = new URLSearchParams();
      if (filters) {
        Object.entries(filters).forEach(([k, v]) => {
          if (v !== undefined && v !== "" && v !== "all") params.set(k, String(v));
        });
      }
      const res = await api.get<{ success: boolean; data: Student[]; pagination: ApiResponse<Student>["pagination"] }>(
        `/students?${params.toString()}`,
      );
      return res.data;
    },
  });

export const useStudent = (id: string) =>
  useQuery({
    queryKey: [...KEY, id],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Student>>(`/students/${id}`);
      return res.data.data!;
    },
    enabled: !!id,
  });

export const useStudentByLeadId = (leadId: string) =>
  useQuery({
    queryKey: [...KEY, "by-lead", leadId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<Student | null>>(`/students/by-lead/${leadId}`);
      return res.data.data ?? null;
    },
    enabled: !!leadId,
  });

export const useCreateStudent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: CreateStudentInput) => {
      const res = await api.post<ApiResponse<Student>>("/students", data);
      return res.data.data!;
    },
    onSuccess: () => {
      toast.success("Student profile created");
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to create student";
      toast.error(msg);
    },
  });
};

export const useUpdateStudent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<CreateStudentInput> }) => {
      const res = await api.put<ApiResponse<Student>>(`/students/${id}`, data);
      return res.data.data!;
    },
    onSuccess: (_, { id }) => {
      toast.success("Student updated");
      qc.invalidateQueries({ queryKey: KEY });
      qc.invalidateQueries({ queryKey: [...KEY, id] });
    },
    onError: (err: unknown) => {
      const msg = (err as { response?: { data?: { message?: string } } })?.response?.data?.message ?? "Failed to update student";
      toast.error(msg);
    },
  });
};

export const useDeleteStudent = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/students/${id}`);
    },
    onSuccess: () => {
      toast.success("Student deleted");
      qc.invalidateQueries({ queryKey: KEY });
    },
    onError: () => toast.error("Failed to delete student"),
  });
};

/**
 * Put a payment receipt in storage, before the enrolment that will carry it.
 *
 * Its own request rather than part of the close: the close creates a student
 * and hands it to finance in one go, and a multipart body carrying both a file
 * and the enrolment would have to be unpicked before either could be checked.
 * This returns a stored file; the close stays the JSON it always was, naming it.
 */
export async function uploadReceipt(leadId: string, file: File): Promise<StoredReceipt> {
  const body = new FormData();
  body.append("file", file);
  const res = await api.post<{ success: boolean; data: StoredReceipt }>(
    `/students/receipts/${leadId}`,
    body,
    { headers: { "Content-Type": "multipart/form-data" } },
  );
  return res.data.data;
}
