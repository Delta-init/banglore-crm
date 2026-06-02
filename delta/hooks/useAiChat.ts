"use client";
import { useQuery, useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import api from "@/lib/axios";
import type { ApiResponse } from "@/types";

export interface AiMessage {
  role: "user" | "assistant";
  content: string;
  createdAt: string;
}

export type AiContextType = "lead" | "team" | "report";

function aiKey(contextType: AiContextType, contextId: string) {
  return ["ai-memory", contextType, contextId] as const;
}

function chatUrl(contextType: AiContextType, contextId: string) {
  if (contextType === "report") return "/ai/chat/report";
  return `/ai/chat/${contextType}/${contextId}`;
}

function memoryUrl(contextType: AiContextType, contextId: string) {
  return `/ai/memory/${contextType}/${contextId}`;
}

export const useAiMemory = (contextType: AiContextType, contextId: string) =>
  useQuery({
    queryKey: aiKey(contextType, contextId),
    queryFn: async () => {
      const res = await api.get<ApiResponse<{ messages: AiMessage[] }>>(
        memoryUrl(contextType, contextId)
      );
      return res.data.data?.messages ?? [];
    },
    enabled: !!contextId,
  });

export const useAiChat = (contextType: AiContextType, contextId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (message: string) => {
      const res = await api.post<ApiResponse<{ reply: string; messages: AiMessage[] }>>(
        chatUrl(contextType, contextId),
        { message }
      );
      return res.data.data!;
    },
    onSuccess: (data) => {
      qc.setQueryData(aiKey(contextType, contextId), data.messages);
    },
    onError: (e: unknown) => {
      const msg =
        (e as { response?: { data?: { message?: string } } })?.response?.data?.message ??
        "AI request failed";
      toast.error(msg);
    },
  });
};

export const useClearAiMemory = (contextType: AiContextType, contextId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async () => {
      await api.delete(memoryUrl(contextType, contextId));
    },
    onSuccess: () => {
      qc.setQueryData(aiKey(contextType, contextId), []);
      toast.success("Conversation cleared");
    },
    onError: () => toast.error("Failed to clear conversation"),
  });
};
