"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import api from "@/lib/axios";

function errMsg(e: unknown, fallback: string) {
  return (
    (e as { response?: { data?: { message?: string } } })?.response?.data?.message ?? fallback
  );
}

export const useAddPayment = (leadId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (data: { amount: number; note?: string; paidAt: string }) => {
      const res = await api.post(`/leads/${leadId}/payments`, data);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", leadId] });
      toast.success("Payment recorded");
    },
    onError: (e: unknown) => toast.error(errMsg(e, "Failed to add payment")),
  });
};

export const useUpdatePayment = (leadId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async ({
      paymentId,
      data,
    }: {
      paymentId: string;
      data: { amount?: number; note?: string; paidAt?: string };
    }) => {
      const res = await api.put(`/leads/${leadId}/payments/${paymentId}`, data);
      return res.data.data;
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", leadId] });
      toast.success("Payment updated");
    },
    onError: (e: unknown) => toast.error(errMsg(e, "Failed to update payment")),
  });
};

export const useDeletePayment = (leadId: string) => {
  const qc = useQueryClient();
  return useMutation({
    mutationFn: async (paymentId: string) => {
      await api.delete(`/leads/${leadId}/payments/${paymentId}`);
    },
    onSuccess: () => {
      qc.invalidateQueries({ queryKey: ["leads", leadId] });
      toast.success("Payment removed");
    },
    onError: (e: unknown) => toast.error(errMsg(e, "Failed to delete payment")),
  });
};
