"use client";
import React from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  LayoutDashboard,
  Users,
  Shield,
  ChevronLeft,
  ChevronRight,
  Zap,
  FileText,
  UsersRound,
  BookOpen,
  BarChart2,
  TrendingUp,
  Trophy,
  X,
  Bell,
  Settings,
  GraduationCap,
  PhoneCall,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useUiStore } from "@/lib/store/uiStore";
import {
  Tooltip,
  TooltipContent,
  TooltipTrigger,
  TooltipProvider,
} from "@/components/ui/tooltip";
import {
  Drawer,
  DrawerContent,
} from "@/components/ui/drawer";
import { useAuthStore } from "@/lib/store/authStore";
import { toast } from "@/lib/toast";
import { useUserLeadStats } from "@/hooks/useLeads";
import { useMyReminderCount } from "@/hooks/useReminders";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";

export const navItems: { href: string; label: string; icon: React.ElementType; permModule: string | null }[] = [
  { href: "/dashboard", label: "Dashboard",          icon: LayoutDashboard, permModule: "dashboard" },
  { href: "/leads",     label: "Leads",              icon: FileText,        permModule: "leads"     },
  { href: "/calls",     label: "Calls",              icon: PhoneCall,       permModule: "leads"     },
  { href: "/reminders", label: "Reminders",          icon: Bell,            permModule: "reminders" },
  { href: "/teams",     label: "Teams",              icon: UsersRound,      permModule: "teams"     },
  { href: "/courses",   label: "Courses",            icon: BookOpen,        permModule: "courses"   },
  { href: "/reports",     label: "Reports",            icon: BarChart2,       permModule: "reports"   },
  { href: "/leaderboard", label: "Leaderboard",        icon: Trophy,          permModule: "reports"   },
  { href: "/users",     label: "Users",              icon: Users,           permModule: "users"     },
  { href: "/students",  label: "Students",           icon: GraduationCap,   permModule: "students"  },
  { href: "/roles",     label: "Roles & Permissions",icon: Shield,          permModule: "roles"     },
  { href: "/settings",  label: "Settings",           icon: Settings,        permModule: null        },
];

interface NavLinksProps {
  collapsed?: boolean;
  onNavigate?: () => void;
}

function NavLinks({ collapsed = false, onNavigate }: NavLinksProps) {
  const pathname = usePathname();
  const { hasPermission, user } = useAuthStore();
  const userId = user?._id ?? "";
  const { data: myStats } = useUserLeadStats(userId);
  const newLeadsCount = myStats?.assigned ?? 0;
  const { data: reminderCount = 0 } = useMyReminderCount();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!userId || typeof window === "undefined") return;
    const { accessToken } = useAuthStore.getState();
    if (!accessToken) return;
    const socket = getSocket(accessToken);

    function handleNotification(payload: { data?: { type?: string } }) {
      if (payload?.data?.type === "lead_assigned") {
        queryClient.invalidateQueries({ queryKey: ["leads", "stats", userId] });
      }
    }

    socket.on("notification", handleNotification);
    return () => {
      socket.off("notification", handleNotification);
    };
  }, [userId, queryClient]);

  if (typeof window === "undefined") return null;

  return (
    <nav className="flex-1 overflow-y-auto px-2 py-4 space-y-1">
      {navItems.map(({ href, label, icon: Icon, permModule }) => {
        const isActive = pathname === href || pathname.startsWith(href + "/");
        const allowed = permModule === null ? true : hasPermission(permModule ?? href.split("/")[1], "view");
        const badgeCount = href === "/leads" ? newLeadsCount : href === "/reminders" ? reminderCount : 0;
        const showBadge = badgeCount > 0;

        const linkEl = (
          <Link
            href={href}
            onClick={(e) => {
              if (!allowed) {
                e.preventDefault();
                toast.error("You don't have permission to access this page");
                return;
              }
              onNavigate?.();
            }}
            className={cn(
              "relative flex items-center gap-3 rounded-lg px-3 py-2.5 text-sm font-medium transition-colors duration-150",
              isActive
                ? "text-sidebar-primary-foreground"
                : "text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground",
              !allowed && "opacity-50 cursor-not-allowed hidden",
            )}
          >
            {isActive && (
              <motion.div
                layoutId="nav-active-pill"
                className="absolute inset-0 rounded-lg bg-sidebar-primary shadow-sm"
                transition={{ type: "spring", stiffness: 500, damping: 40, mass: 0.8 }}
              />
            )}

            <span className="relative z-10 shrink-0">
              <Icon className="h-5 w-5" />
              {showBadge && collapsed && (
                <motion.span
                  initial={{ scale: 0 }}
                  animate={{ scale: 1 }}
                  className="absolute -right-1 -top-1 flex h-3.5 w-3.5 items-center justify-center rounded-full bg-red-900 text-[8px] font-bold text-white"
                >
                  {badgeCount > 9 ? "9+" : badgeCount}
                </motion.span>
              )}
            </span>

            <AnimatePresence>
              {!collapsed && (
                <motion.span
                  initial={{ opacity: 0, x: -8 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: -8 }}
                  transition={{ duration: 0.15 }}
                  className="relative z-10 flex flex-1 items-center justify-between whitespace-nowrap overflow-hidden"
                >
                  {label}
                  {showBadge && (
                    <motion.span
                      initial={{ scale: 0 }}
                      animate={{ scale: 1 }}
                      className="ml-auto flex h-5 min-w-[20px] items-center justify-center rounded-full px-1.5 text-[10px] font-bold bg-red-900 text-white"
                    >
                      {badgeCount > 99 ? "99+" : badgeCount}
                    </motion.span>
                  )}
                </motion.span>
              )}
            </AnimatePresence>
          </Link>
        );

        return (
          <Tooltip key={href}>
            <TooltipTrigger asChild>{linkEl}</TooltipTrigger>
            {collapsed && (
              <TooltipContent side="right">
                <span className="flex items-center gap-1.5">
                  {label}
                  {showBadge && (
                    <span className="rounded-full bg-red-900 px-1.5 py-0.5 text-[9px] font-bold text-white">
                      {badgeCount}
                    </span>
                  )}
                </span>
              </TooltipContent>
            )}
          </Tooltip>
        );
      })}
    </nav>
  );
}

function Logo({ collapsed = false }: { collapsed?: boolean }) {
  return (
    <div className="flex h-16 items-center gap-3 border-b border-sidebar-border/10 px-4 shrink-0">
      <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
        <Zap className="h-5 w-5 text-primary-foreground" />
      </div>
      <AnimatePresence>
        {!collapsed && (
          <motion.div
            initial={{ opacity: 0, x: -10 }}
            animate={{ opacity: 1, x: 0 }}
            exit={{ opacity: 0, x: -10 }}
            transition={{ duration: 0.15 }}
            className="overflow-hidden"
          >
            <p className="text-sm font-bold text-sidebar-foreground whitespace-nowrap">Delta</p>
            <p className="text-xs text-muted-foreground whitespace-nowrap">Phase 4</p>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function UserProfileSection({ collapsed = false }: { collapsed?: boolean }) {
  const { user } = useAuthStore();

  const name: string = user?.name ?? "User";
  const parts = name.trim().split(/\s+/).slice(0, 2);
  const initials = parts.map((p) => p[0]).join("").toUpperCase() || "U";
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const roleName: string = (user as any)?.role?.roleName ?? "User";

  return (
    <div className="border-t border-sidebar-border p-3 shrink-0">
      <AnimatePresence mode="wait">
        {collapsed ? (
          <motion.div
            key="avatar-only"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            transition={{ duration: 0.15 }}
            className="flex justify-center py-1"
          >
            <div className="flex h-9 w-9 items-center justify-center rounded-full bg-primary text-primary-foreground text-xs font-bold shadow-sm">
              {initials}
            </div>
          </motion.div>
        ) : (
          <motion.div
            key="profile-card"
            initial={{ opacity: 0, y: 6 }}
            animate={{ opacity: 1, y: 0 }}
            exit={{ opacity: 0, y: 6 }}
            transition={{ duration: 0.2 }}
            className="rounded-xl border border-sidebar-border bg-sidebar-accent/40 p-3 space-y-3"
          >
            <div className="flex items-center gap-3">
              <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-full bg-primary text-primary-foreground text-sm font-bold shadow-sm">
                {initials}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-semibold text-sidebar-foreground truncate leading-tight">
                  {name}
                </p>
                <p className="text-[11px] text-muted-foreground truncate leading-tight mt-0.5">
                  {roleName}
                </p>
              </div>
            </div>
            <button className="w-full rounded-lg bg-primary/10 px-3 py-2 text-xs font-semibold text-primary transition-colors hover:bg-primary/20 active:scale-[0.98]">
              <Link href="/profile">Profile Manage</Link>
            </button>
          </motion.div>
        )}
      </AnimatePresence>
    </div>
  );
}

function DesktopSidebar() {
  const { sidebarCollapsed, toggleSidebarCollapsed } = useUiStore();
  if (typeof window === "undefined") return null;
  return (
    <TooltipProvider delayDuration={0}>
      <motion.aside
        animate={{ width: sidebarCollapsed ? 72 : 260 }}
        transition={{ duration: 0.25, ease: "easeInOut" }}
        className="relative hidden md:flex h-full flex-col bg-sidebar overflow-hidden rounded-r-3xl shadow-[2px_0_30px_rgba(0,0,0,0.35)] dark:shadow-[4px_0_32px_rgba(0,0,0,0.45)]"
      >
        <Logo collapsed={sidebarCollapsed} />
        <NavLinks collapsed={sidebarCollapsed} />
        <UserProfileSection collapsed={sidebarCollapsed} />
        {/* <div className="border-t border-sidebar-border p-2 shrink-0">
          <button
            onClick={toggleSidebarCollapsed}
            className="flex w-full items-center justify-center rounded-lg p-2 text-muted-foreground transition-colors hover:bg-sidebar-accent hover:text-sidebar-foreground"
          >
            {sidebarCollapsed ? (
              <ChevronRight className="h-4 w-4" />
            ) : (
              <ChevronLeft className="h-4 w-4" />
            )}
          </button>
        </div> */}
      </motion.aside>
    </TooltipProvider>
  );
}

function MobileDrawer() {
  const { mobileDrawerOpen, setMobileDrawerOpen } = useUiStore();

  return (
    <Drawer direction="left" open={mobileDrawerOpen} onOpenChange={setMobileDrawerOpen}>
      <DrawerContent
        hideHandle
        className="inset-x-auto inset-y-0 left-0 right-auto mt-0 h-full w-72 rounded-none rounded-r-xl border-l-0 border-r border-sidebar-border bg-sidebar pwa-safe-top flex flex-col"
      >
        <div className="flex h-16 items-center justify-between border-b border-sidebar-border px-4 shrink-0">
          <div className="flex items-center gap-3">
            <div className="flex h-9 w-9 shrink-0 items-center justify-center rounded-lg bg-primary">
              <Zap className="h-5 w-5 text-primary-foreground" />
            </div>
            <div>
              <p className="text-sm font-bold text-sidebar-foreground">Delta</p>
              <p className="text-xs text-muted-foreground">Phase 4</p>
            </div>
          </div>
          <button
            onClick={() => setMobileDrawerOpen(false)}
            className="rounded-lg p-1.5 text-muted-foreground hover:bg-sidebar-accent hover:text-sidebar-foreground transition-colors"
          >
            <X className="h-4 w-4" />
          </button>
        </div>

        <TooltipProvider delayDuration={0}>
          <NavLinks onNavigate={() => setMobileDrawerOpen(false)} />
        </TooltipProvider>

        <UserProfileSection />
      </DrawerContent>
    </Drawer>
  );
}

export function Sidebar() {
  return (
    <>
      <DesktopSidebar />
      <MobileDrawer />
    </>
  );
}
