"use client";
import { useMutation, useQueryClient } from "@tanstack/react-query";
import { useRouter } from "next/navigation";
import { toast } from "@/lib/toast";
import api from "@/lib/axios";
import { useAuthStore } from "@/lib/store/authStore";
import type { LoginFormValues } from "@/lib/validations/authSchema";
import type { ApiResponse, LoginResponse } from "@/types";

export const useLogin = () => {
  const { setAuth } = useAuthStore();
  const router = useRouter();

  return useMutation({
    mutationFn: async (data: LoginFormValues) => {
      const response = await api.post<ApiResponse<LoginResponse>>(
        "/auth/login",
        data,
      );
      return response.data.data!;
    },
    onSuccess: (data) => {
      setAuth(data.user, data.accessToken, data.refreshToken);
      toast.success("Welcome back!", {
        description: `Logged in as ${data.user.name}`,
      });
      router.push("/dashboard");
    },
    onError: (error: unknown) => {
      const message =
        (error as { response?: { data?: { message?: string } } })?.response
          ?.data?.message ?? "Login failed. Please check your credentials.";
      toast.error(message);
    },
  });
};

export const useLogout = () => {
  const { clearAuth } = useAuthStore();
  const router = useRouter();
  const queryClient = useQueryClient();

  return () => {
    // clearAuth();
    toast.success("Logged out successfully");
    if (typeof window !== "undefined") {
      localStorage.removeItem("crm-auth");
      localStorage.removeItem("accessToken");
      localStorage.removeItem("refreshToken");
      queryClient.clear();
      
    }

    router.push("/login");
  };
};
