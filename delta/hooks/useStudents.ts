import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import { toast } from "@/lib/toast";
import type { ApiResponse } from "@/types";
import type { Student, StudentFilters, CreateStudentInput, StoredReceipt } from "@/types/student";

const KEY = ["students"] as const;

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
