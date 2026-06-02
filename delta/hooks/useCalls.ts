"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import api from "@/lib/axios";
import type { ApiResponse } from "@/types";

export interface CallLog {
  id:           string;
  startTime:    string;
  duration:     number;       // seconds
  direction:    "inbound" | "outbound";
  status:       string;
  callerNumber: string;
  calleeNumber: string;
  agentName:    string | null;
  recordingUrl: string | null;
}

export interface RecentCallLog {
  _id:           string;
  leadId:        { _id: string; name: string; phone: string } | null;
  contactName:   string | null;
  phoneNumber:   string;
  callType:      "Inbound" | "Outbound" | "Missed" | "Notanswered";
  callDirection: "inbound" | "outbound";
  callDuration:  number;
  callDate:      string;
  recordingUrl:  string | null;
  agentExtension: string | null;
  agentName:     string | null;
  initiatedBy:   { _id: string; name: string } | null;
  source:        string;
  qcStatus:      "pending" | "reviewed" | "flagged";
  qcRating:      number | null;
  qcNotes:       string | null;
  qcReviewedBy:  { _id: string; name: string } | null;
  qcReviewedAt:  string | null;
}

interface CallsResponse {
  calls: CallLog[];
  phone: string;
  total: number;
  hint?: string;
}

export const useLeadCalls = (leadId: string, enabled = true) =>
  useQuery({
    queryKey: ["calls", leadId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<CallsResponse>>(`/calls/lead/${leadId}`);
      return res.data.data ?? { calls: [], phone: "", total: 0 };
    },
    enabled: !!leadId && enabled,
    staleTime: 60_000,   // cache 1 min — call logs don't change that fast
    refetchOnWindowFocus: false,
  });

interface RecentCallsResponse {
  calls: RecentCallLog[];
  total: number;
}

export interface RecentCallsFilters {
  limit?:     number;
  direction?: "inbound" | "outbound" | "all";
  callType?:  string;
  agent?:     string;
}

export const useRecentCalls = (filters: RecentCallsFilters = {}) =>
  useQuery({
    queryKey: ["calls", "recent", filters],
    queryFn: async () => {
      const params: Record<string, string> = {
        limit: String(filters.limit ?? 100),
      };
      const res = await api.get<ApiResponse<RecentCallsResponse>>("/calls/recent", { params });
      return res.data.data ?? { calls: [], total: 0 };
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

interface QcQueueResponse {
  calls: RecentCallLog[];
  total: number;
  page:  number;
  limit: number;
}

export const useQcQueue = (status: "pending" | "reviewed" | "flagged" | "all" = "pending") =>
  useQuery({
    queryKey: ["calls", "qc-queue", status],
    queryFn: async () => {
      const res = await api.get<ApiResponse<QcQueueResponse>>("/calls/qc-queue", {
        params: { status, limit: 100 },
      });
      return res.data.data ?? { calls: [], total: 0, page: 1, limit: 100 };
    },
    staleTime: 30_000,
    refetchOnWindowFocus: false,
  });

export interface QcUpdatePayload {
  callId:    string;
  qcRating?: number;
  qcNotes?:  string;
  qcStatus?: "pending" | "reviewed" | "flagged";
}

export const useUpdateQc = () => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: ({ callId, ...data }: QcUpdatePayload) =>
      api.put(`/calls/${callId}/qc`, data),
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["calls", "qc-queue"] });
      qc.invalidateQueries({ queryKey: ["calls", "recent"] });
    },
  });
};

export const useCallById = (callId: string | null) =>
  useQuery({
    queryKey: ["calls", "detail", callId],
    queryFn: async () => {
      const res = await api.get<ApiResponse<RecentCallLog>>(`/calls/${callId}`);
      return res.data.data ?? null;
    },
    enabled: !!callId,
    staleTime: 60_000,
  });

/** Format seconds → "2m 34s" or "45s" */
export function fmtDuration(seconds: number): string {
  if (!seconds || seconds < 1) return "0s";
  const m = Math.floor(seconds / 60);
  const s = seconds % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Format ISO to readable date+time GST (AED, UTC+4) */
export function fmtCallTime(iso: string): string {
  return new Date(iso).toLocaleString("en-AE", {
    timeZone: "Asia/Dubai",
    day: "2-digit", month: "short", year: "numeric",
    hour: "2-digit", minute: "2-digit", hour12: true,
  });
}
