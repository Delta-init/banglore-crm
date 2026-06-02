"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import api from "@/lib/axios";
import type { ApiResponse } from "@/types";
import type { ReminderWithLead } from "@/types/lead";

export const REMINDERS_KEY = ["reminders"] as const;

function errMsg(error: unknown, fallback: string) {
  return (
    (error as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
  );
}

// ─── Queries ──────────────────────────────────────────────────────────────────

export const useMyReminders = () =>
  useQuery({
    queryKey: REMINDERS_KEY,
    queryFn: async () => {
      const res = await api.get<ApiResponse<ReminderWithLead[]>>("/leads/reminders/mine");
      return res.data.data ?? [];
    },
    refetchInterval: 60_000, // refresh every minute for live status
  });

export const useMyReminderCount = () =>
  useQuery({
    queryKey: [...REMINDERS_KEY, "count"],
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ count: number }>>("/leads/reminders/count");
      return res.data.data?.count ?? 0;
    },
    refetchInterval: 60_000,
  });

// ─── Mutations ────────────────────────────────────────────────────────────────

export const useAddReminder = (leadId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { title?: string; note?: string; remindAt: string }) => {
      const res = await api.post(`/leads/${leadId}/reminders`, data);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", leadId] });
      qc.invalidateQueries({ queryKey: REMINDERS_KEY });
      toast.success("Reminder set");
    },
    onError: (e: unknown) => toast.error(errMsg(e, "Failed to add reminder")),
  });
};

export const useUpdateReminder = (leadId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      reminderId,
      data,
    }: {
      reminderId: string;
      data: { title?: string; note?: string; remindAt?: string; isDone?: boolean };
    }) => {
      const res = await api.put(`/leads/${leadId}/reminders/${reminderId}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", leadId] });
      qc.invalidateQueries({ queryKey: REMINDERS_KEY });
      toast.success("Reminder updated");
    },
    onError: (e: unknown) => toast.error(errMsg(e, "Failed to update reminder")),
  });
};

export const useDeleteReminder = (leadId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (reminderId: string) => {
      await api.delete(`/leads/${leadId}/reminders/${reminderId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", leadId] });
      qc.invalidateQueries({ queryKey: REMINDERS_KEY });
      toast.success("Reminder removed");
    },
    onError: (e: unknown) => toast.error(errMsg(e, "Failed to delete reminder")),
  });
};
