"use client";
import { useCallback, useEffect } from "react";
import { usePathname, useRouter } from "next/navigation";
import { Sidebar } from "@/components/layout/Sidebar";
import { Header } from "@/components/layout/Header";
import { useAuthStore } from "@/lib/store/authStore";
import { navItems } from "@/components/layout/Sidebar";
import { useReminderNotifications } from "@/hooks/useReminderNotifications";
import { useCallRecordingNotifications } from "@/hooks/useCallRecordingNotifications";
import { RecentPageTracker } from "@/components/shared/CommandPalette";

export default function DashboardLayout({ children }: { children: React.ReactNode }) {
  const { isAuthenticated, hasPermission } = useAuthStore();
  const router = useRouter();
  useReminderNotifications();
  useCallRecordingNotifications();

  useEffect(() => {
    if (typeof window !== "undefined" && !isAuthenticated) {
      // alert("You are not authorized to access this page");
      router.replace("/login");

    }
  }, [isAuthenticated, router]);



  if (!isAuthenticated && typeof window !== "undefined") return null;

  const pathname = usePathname();

  const redirectPermisionPage = useCallback(() => {
    if (typeof window == "undefined") return;
    for (let i = 0; i < navItems.length; i++) {
      const item = navItems[i];
      if (hasPermission(item.href.split("/")[1], "view")) {
        router.push(item.href);
        break;
      }
    }
  }, [hasPermission]);
  useEffect(() => {
    if (pathname == "/login" || pathname == "/profile") return;
    if (!hasPermission(pathname.split("/")[1], "view")) {
      redirectPermisionPage();
    }
  }, [pathname]);

  return (
    <div className="flex h-dvh overflow-hidden bg-slate-200 dark:bg-background pwa-safe-top">
      <RecentPageTracker />
      <Sidebar />
      <div className="flex flex-1 flex-col overflow-hidden">
        <Header />
        <main className="flex-1 overflow-y-auto p-6">{children}</main>
      </div>
    </div>
  );
}
