"use client"
import { create } from "zustand";
import { persist, createJSONStorage } from "zustand/middleware";
import type { AuthUser } from "@/types";

const IMPERSONATE_KEY = "crm-impersonate-origin";

interface AuthState {
  user: AuthUser | null;
  accessToken: string | null;
  refreshToken: string | null;
  isAuthenticated: boolean;
  isImpersonating: boolean;
  setAuth: (user: AuthUser, accessToken: string, refreshToken: string) => void;
  updateUser: (user: AuthUser) => void;
  clearAuth: () => void;
  hasPermission: (module: string, action: string) => boolean;
  startImpersonation: (targetUser: AuthUser, targetAccessToken: string) => void;
  exitImpersonation: () => void;
}

export const useAuthStore = create<AuthState>()(
  persist(
    (set, get) => ({
      user: null,
      accessToken: null,
      refreshToken: null,
      isAuthenticated: typeof window !== "undefined" ? localStorage.getItem("crm-auth") !== null? JSON.parse(localStorage.getItem("crm-auth")!)?.state?.isAuthenticated : false : false,
      isImpersonating: false,

      setAuth: (user, accessToken, refreshToken) => {
        if (typeof window !== "undefined") {
          localStorage.setItem("accessToken", accessToken);
          localStorage.setItem("refreshToken", refreshToken);
        }
        set({ user, accessToken, refreshToken, isAuthenticated: true, isImpersonating: false });
      },

      updateUser: (user) => set({ user }),

      clearAuth: () => {
        if (typeof window !== "undefined") {
          localStorage.removeItem("accessToken");
          localStorage.removeItem("refreshToken");
          sessionStorage.removeItem(IMPERSONATE_KEY);
        }
        set({ user: null, accessToken: null, refreshToken: null, isAuthenticated: false, isImpersonating: false });
      },

      hasPermission: (module, action) => {
        const { user } = get();
        if (!user) return false;
        const role = user.role;
        if (!role) return false;
        if (role.isSystemRole && role.roleName === "Super Admin") return true;
        const modulePerms = role.permissions?.[module as keyof typeof role.permissions];
        if (!modulePerms) return false;
        return modulePerms[action as keyof typeof modulePerms] === true;
      },

      startImpersonation: (targetUser, targetAccessToken) => {
        const { user, accessToken, refreshToken } = get();
        // Snapshot the admin's session so we can restore it later
        if (typeof window !== "undefined") {
          sessionStorage.setItem(
            IMPERSONATE_KEY,
            JSON.stringify({ user, accessToken, refreshToken }),
          );
          localStorage.setItem("accessToken", targetAccessToken);
          // Clear refresh token — we only have an access token for the impersonated user
          localStorage.removeItem("refreshToken");
        }
        set({ user: targetUser, accessToken: targetAccessToken, refreshToken: null, isImpersonating: true });
      },

      exitImpersonation: () => {
        if (typeof window === "undefined") return;
        const raw = sessionStorage.getItem(IMPERSONATE_KEY);
        if (!raw) return;
        const { user, accessToken, refreshToken } = JSON.parse(raw) as {
          user: AuthUser;
          accessToken: string;
          refreshToken: string;
        };
        sessionStorage.removeItem(IMPERSONATE_KEY);
        localStorage.setItem("accessToken", accessToken);
        if (refreshToken) localStorage.setItem("refreshToken", refreshToken);
        set({ user, accessToken, refreshToken, isImpersonating: false });
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
        isImpersonating: state.isImpersonating,
      }),
    }
  )
);
