"use client"
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthUser } from "@/types";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  updateUser: (user: AuthUser) => void;
  clearAuth: () => void;
  hasPermission: (module: string, action: string) => boolean;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: typeof window !== "undefined" ? localStorage.getItem("crm-auth") !== null? JSON.parse(localStorage.getItem("crm-auth")!)?.state?.isAuthenticated : false : false,

      setAuth: (user, accessToken, refreshToken) => {
        // Also store tokens in localStorage for Axios interceptor
        if (typeof window !== "undefined") {
          localStorage.setItem("accessToken", accessToken);
          localStorage.setItem("refreshToken", refreshToken);
        }
        set({ user, accessToken, refreshToken, isAuthenticated: true });
      },

      updateUser: (user) => set({ user }),

      clearAuth: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
        }
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false });
      },

      hasPermission: (module, action) => {
        const { user } = get();
        if (!user) return false;

        const role = user.role;
        if (!role) return false;

        // Super Admin has full access
        if (role.isSystemRole && role.roleName === "Super Admin") return true;

        const modulePerms = role.permissions?.[module as keyof typeof role.permissions];
        if (!modulePerms) return false;

        return modulePerms[action as keyof typeof modulePerms] === true;
      },
    }),
    {
      name: "crm-auth",
      storage: createJSONStorage(() => localStorage),
      partialize: (state) => ({
        user: state.user,
        accessToken: state.accessToken,
        refreshToken: state.refreshToken,
        isAuthenticated: state.isAuthenticated,
      }),
    }
  )
);
