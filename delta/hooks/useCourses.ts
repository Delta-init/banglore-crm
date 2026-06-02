"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import api from "@/lib/axios";
import type { ApiResponse } from "@/types";
import type { Course, CourseFilters } from "@/types/course";

const COURSES_KEY = ["courses"] as const;

function errMsg(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
  );
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const useCourses = (filters?: CourseFilters) => {
  return useQuery({
    queryKey: [...COURSES_KEY, filters],
    queryFn: async () => {
      const params: Record<string, string> = {};
      if (filters?.page)   params.page   = String(filters.page);
      if (filters?.limit)  params.limit  = String(filters.limit);
      if (filters?.status) params.status = filters.status;
      if (filters?.search) params.search = filters.search;
      const response = await api.get<ApiResponse<Course[]>>("/courses", { params });
      return { data: response.data.data ?? [], pagination: response.data.pagination };
    },
  });
};

/** Fetch all active courses (for dropdowns) */
export const useAllCourses = () => {
  return useQuery({
    queryKey: [...COURSES_KEY, "all"],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Course[]>>("/courses/all");
      return response.data.data ?? [];
    },
  });
};

export const useCourse = (id: string) => {
  return useQuery({
    queryKey: [...COURSES_KEY, id],
    queryFn: async () => {
      const response = await api.get<ApiResponse<Course>>(`/courses/${id}`);
      return response.data.data!;
    },
    enabled: !!id,
  });
};

// ─── Mutations ────────────────────────────────────────────────────────────────

export const useCreateCourse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (data: { name: string; description?: string; amount: number; status?: string }) => {
      const response = await api.post<ApiResponse<Course>>("/courses", data);
      return response.data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COURSES_KEY });
      toast.success("Course created successfully");
    },
    onError: (error: unknown) => toast.error(errMsg(error, "Failed to create course")),
  });
};

export const useUpdateCourse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async ({ id, data }: { id: string; data: Partial<{ name: string; description: string; amount: number; status: string }> }) => {
      const response = await api.put<ApiResponse<Course>>(`/courses/${id}`, data);
      return response.data.data!;
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COURSES_KEY });
      toast.success("Course updated successfully");
    },
    onError: (error: unknown) => toast.error(errMsg(error, "Failed to update course")),
  });
};

export const useDeleteCourse = () => {
  const queryClient = useQueryClient();
  return useMutation({
    mutationFn: async (id: string) => {
      await api.delete(`/courses/${id}`);
    },
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: COURSES_KEY });
      toast.success("Course deleted successfully");
    },
    onError: (error: unknown) => toast.error(errMsg(error, "Failed to delete course")),
  });
};
