"use client";

import { Suspense, useEffect, useRef, useState } from "react";
import { useRouter, useSearchParams } from "next/navigation";
import { Loader2, ShieldAlert } from "lucide-react";
import { api } from "@/lib/axios";
import { useAuthStore } from "@/lib/store/authStore";
import type { ApiResponse, LoginResponse } from "@/types";

/**
 * Landing page for a Root portal SSO handoff.
 *
 * The portal redirects here with a one-time token in the query string. That
 * token is POSTed to the backend immediately and never stored — the backend
 * verifies it with the portal, spends it, and returns a normal session.
 *
 * The URL is scrubbed via replaceState as soon as the token is read, so it
 * does not linger in the address bar, browser history or any Referer header
 * sent by a later navigation.
 */
function SsoHandoff() {
  const router = useRouter();
  const params = useSearchParams();
  const { setAuth } = useAuthStore();
  const [error, setError] = useState<string | null>(null);

  // React 18 StrictMode mounts effects twice in development. The token is
  // single-use, so a second POST would always fail and show a spurious error.
  const attempted = useRef(false);

  useEffect(() => {
    if (attempted.current) return;
    attempted.current = true;

    const token = params.get("token");

    if (typeof window !== "undefined") {
      window.history.replaceState({}, "", window.location.pathname);
    }

    if (!token) {
      setError("No SSO token was supplied.");
      return;
    }

    api
      .post<ApiResponse<LoginResponse>>("/auth/sso-login", { ssoToken: token })
      .then(({ data }) => {
        const session = data.data;
        if (!session) throw new Error("Empty SSO response");
        setAuth(session.user, session.accessToken, session.refreshToken);
        router.replace("/dashboard");
      })
      .catch((err: unknown) => {
        const message =
          (err as { response?: { data?: { message?: string } } })?.response?.data
            ?.message ?? "This sign-in link could not be used.";
        setError(message);
      });
  }, [params, router, setAuth]);

  if (error) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-background p-4">
        <div className="w-full max-w-sm text-center">
          <div className="mx-auto mb-4 flex h-12 w-12 items-center justify-center rounded-2xl bg-destructive/10">
            <ShieldAlert className="h-6 w-6 text-destructive" />
          </div>
          <h1 className="text-lg font-semibold">Could not sign you in</h1>
          <p className="mt-2 text-sm text-muted-foreground">{error}</p>
          <p className="mt-1 text-xs text-muted-foreground">
            Sign-in links are single-use and expire after a minute. Launch again
            from the Root portal.
          </p>
          <button
            onClick={() => router.replace("/login")}
            className="mt-6 text-sm font-medium text-primary hover:underline"
          >
            Go to login
          </button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-background">
      <div className="text-center">
        <Loader2 className="mx-auto h-6 w-6 animate-spin text-muted-foreground" />
        <p className="mt-3 text-sm text-muted-foreground">Signing you in…</p>
      </div>
    </div>
  );
}

// useSearchParams needs a Suspense boundary or the route opts out of static
// rendering and the build warns.
export default function SsoPage() {
  return (
    <Suspense
      fallback={
        <div className="flex min-h-screen items-center justify-center bg-background">
          <Loader2 className="h-6 w-6 animate-spin text-muted-foreground" />
        </div>
      }
    >
      <SsoHandoff />
    </Suspense>
  );
}
