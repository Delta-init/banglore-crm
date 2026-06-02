"use client";

import { useEffect, useRef, useState, useMemo, useCallback } from "react";
import { useRouter, usePathname } from "next/navigation";
import { motion, AnimatePresence } from "framer-motion";
import * as DialogPrimitive from "@radix-ui/react-dialog";
import { useTheme } from "next-themes";
import {
  Search, Clock, Sun, Moon, Monitor, ArrowRight, CornerDownLeft,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/lib/store/authStore";
import { navItems } from "@/components/layout/Sidebar";
import { Drawer, DrawerContent } from "@/components/ui/drawer";

// ─── Recent pages ──────────────────────────────────────────────────────────────
const RECENT_KEY = "crm_recent_pages";
const MAX_RECENT = 5;

export type RecentItem = { href: string; label: string };

function loadRecent(): RecentItem[] {
  if (typeof window === "undefined") return [];
  try { return JSON.parse(localStorage.getItem(RECENT_KEY) ?? "[]"); }
  catch { return []; }
}

export function saveToRecent(item: RecentItem) {
  if (typeof window === "undefined") return;
  const list = loadRecent().filter(r => r.href !== item.href);
  list.unshift(item);
  localStorage.setItem(RECENT_KEY, JSON.stringify(list.slice(0, MAX_RECENT)));
}

// ─── Theme actions ─────────────────────────────────────────────────────────────
const THEME_ACTIONS = [
  { id: "light",  label: "Light Mode",   icon: Sun,     kw: "light bright white" },
  { id: "dark",   label: "Dark Mode",    icon: Moon,    kw: "dark night black" },
  { id: "system", label: "System Theme", icon: Monitor, kw: "system auto default" },
] as const;

// ─── useIsMobile ───────────────────────────────────────────────────────────────
function useIsMobile(breakpoint = 768) {
  const [isMobile, setIsMobile] = useState(false);
  useEffect(() => {
    const check = () => setIsMobile(window.innerWidth < breakpoint);
    check();
    window.addEventListener("resize", check, { passive: true });
    return () => window.removeEventListener("resize", check);
  }, [breakpoint]);
  return isMobile;
}

// ─── SectionLabel ──────────────────────────────────────────────────────────────
function SectionLabel({ label }: { label: string }) {
  return (
    <p className="px-4 pt-3 pb-1 text-[10px] font-semibold uppercase tracking-wider text-muted-foreground/60 select-none">
      {label}
    </p>
  );
}

// ─── PaletteContent (shared between modal + drawer) ───────────────────────────
interface PaletteContentProps {
  open: boolean;
  onClose: () => void;
  onNavigate: (href: string, label: string) => void;
}

function PaletteContent({ open, onClose, onNavigate }: PaletteContentProps) {
  const [query, setQuery]         = useState("");
  const [activeIdx, setActiveIdx] = useState(0);
  const inputRef                  = useRef<HTMLInputElement>(null);
  const { theme, setTheme }       = useTheme();
  const { hasPermission }         = useAuthStore();

  // Permitted nav items
  const allowedPages = useMemo(
    () => navItems.filter(item => item.permModule === null || hasPermission(item.permModule, "view")),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [],
  );

  // Recent pages (only permitted)
  const [recent, setRecent] = useState<RecentItem[]>([]);
  useEffect(() => {
    setRecent(
      loadRecent().filter(r => allowedPages.some(p => p.href === r.href)),
    );
  }, [allowedPages]);

  // Focus input whenever palette opens
  useEffect(() => {
    if (!open) return;
    setQuery("");
    setActiveIdx(0);
    const t = setTimeout(() => inputRef.current?.focus(), 80);
    return () => clearTimeout(t);
  }, [open]);

  // ── Build flat item list ───────────────────────────────────────────────────
  type FlatItem =
    | { kind: "theme";  id: string; label: string; icon: React.ElementType }
    | { kind: "recent"; href: string; label: string; icon: React.ElementType }
    | { kind: "page";   href: string; label: string; icon: React.ElementType };

  const allItems = useMemo<FlatItem[]>(() => {
    const q = query.trim().toLowerCase();

    const themeItems: FlatItem[] = THEME_ACTIONS
      .filter(t => !q || t.label.toLowerCase().includes(q) || t.kw.includes(q))
      .map(t => ({ kind: "theme", id: t.id, label: t.label, icon: t.icon }));

    const recentItems: FlatItem[] = recent
      .filter(r => !q || r.label.toLowerCase().includes(q))
      .map(r => ({
        kind:  "recent",
        href:  r.href,
        label: r.label,
        icon:  allowedPages.find(p => p.href === r.href)?.icon ?? Search,
      }));

    const usedHrefs = new Set(recent.map(r => r.href));
    const pageItems: FlatItem[] = allowedPages
      .filter(p => !usedHrefs.has(p.href) && (!q || p.label.toLowerCase().includes(q)))
      .map(p => ({ kind: "page", href: p.href, label: p.label, icon: p.icon }));

    return [...themeItems, ...recentItems, ...pageItems];
  }, [query, recent, allowedPages]);

  // Section offsets for keyboard navigation
  const themeCount  = allItems.filter(i => i.kind === "theme").length;
  const recentCount = allItems.filter(i => i.kind === "recent").length;
  const themeEnd    = themeCount;
  const recentEnd   = themeCount + recentCount;

  // Clamp activeIdx
  useEffect(() => {
    setActiveIdx(prev => Math.min(prev, Math.max(allItems.length - 1, 0)));
  }, [allItems.length]);

  // Scroll active item into view
  const listRef = useRef<HTMLDivElement>(null);
  useEffect(() => {
    if (!listRef.current) return;
    const active = listRef.current.querySelector<HTMLElement>("[data-active='true']");
    active?.scrollIntoView({ block: "nearest" });
  }, [activeIdx]);

  // ── Keyboard handler ───────────────────────────────────────────────────────
  function handleKeyDown(e: React.KeyboardEvent<HTMLInputElement>) {
    switch (e.key) {
      case "ArrowDown":
        e.preventDefault();
        setActiveIdx(i => (i + 1) % Math.max(allItems.length, 1));
        break;
      case "ArrowUp":
        e.preventDefault();
        setActiveIdx(i => (i - 1 + Math.max(allItems.length, 1)) % Math.max(allItems.length, 1));
        break;
      case "Enter": {
        e.preventDefault();
        const item = allItems[activeIdx];
        if (!item) break;
        if (item.kind === "theme") { setTheme(item.id); onClose(); }
        else onNavigate(item.href, item.label);
        break;
      }
    }
  }

  function handleSelect(item: FlatItem) {
    if (item.kind === "theme") { setTheme(item.id); onClose(); }
    else onNavigate((item as { href: string }).href, item.label);
  }

  // ── Render ─────────────────────────────────────────────────────────────────
  const themeItems  = allItems.slice(0, themeEnd);
  const recentItems = allItems.slice(themeEnd, recentEnd);
  const pageItems   = allItems.slice(recentEnd);

  function Item({ item, flatIdx }: { item: FlatItem; flatIdx: number }) {
    const Icon     = item.kind === "recent" ? Clock : item.icon;
    const isActive = activeIdx === flatIdx;
    const isCurrentTheme = item.kind === "theme" && theme === item.id;
    return (
      <button
        data-active={isActive}
        onClick={() => handleSelect(item)}
        onMouseEnter={() => setActiveIdx(flatIdx)}
        className={cn(
          "flex w-full items-center gap-3 px-3 mx-1 py-2 text-sm rounded-lg transition-colors text-left",
          isActive ? "bg-primary/10 text-primary" : "text-foreground hover:bg-muted/50",
        )}
        style={{ width: "calc(100% - 8px)" }}
      >
        <div className={cn(
          "flex h-7 w-7 shrink-0 items-center justify-center rounded-md",
          isActive ? "bg-primary/15" : "bg-muted/80",
        )}>
          <Icon className={cn("h-4 w-4", isActive ? "text-primary" : "text-muted-foreground")} />
        </div>
        <span className="flex-1 font-medium truncate">
          {item.label}
          {isCurrentTheme && <span className="ml-1.5 text-[10px] font-normal text-primary/70">(active)</span>}
        </span>
        {isActive && <ArrowRight className="h-3.5 w-3.5 shrink-0 text-primary/60" />}
      </button>
    );
  }

  return (
    <div className="flex flex-col bg-card rounded-2xl overflow-hidden">
      {/* ── Search input ───────────────────────────────────────────────── */}
      <div className="flex items-center gap-3 px-4 py-3.5 border-b border-border/30">
        <Search className="h-4 w-4 text-muted-foreground shrink-0" />
        <input
          ref={inputRef}
          value={query}
          onChange={e => { setQuery(e.target.value); setActiveIdx(0); }}
          onKeyDown={handleKeyDown}
          placeholder="Search pages or switch theme..."
          className="flex-1 bg-transparent text-sm text-foreground placeholder:text-muted-foreground focus:outline-none"
        />
        <kbd className="shrink-0 inline-flex items-center rounded border border-border bg-muted px-1.5 py-0.5 text-[10px] font-medium text-muted-foreground select-none">
          ESC
        </kbd>
      </div>

      {/* ── Results ────────────────────────────────────────────────────── */}
      <div ref={listRef} className="max-h-[340px] overflow-y-auto py-1.5">
        {allItems.length === 0 && (
          <div className="flex flex-col items-center justify-center gap-2 py-10 text-sm text-muted-foreground">
            <Search className="h-7 w-7 opacity-20" />
            <span>No results</span>
          </div>
        )}

        {themeItems.length > 0 && (
          <>
            <SectionLabel label="Theme" />
            {themeItems.map((item, i) => (
              <Item key={(item as {id:string}).id} item={item} flatIdx={i} />
            ))}
          </>
        )}

        {recentItems.length > 0 && (
          <>
            <SectionLabel label="Recent" />
            {recentItems.map((item, i) => (
              <Item key={(item as {href:string}).href + "-r"} item={item} flatIdx={themeEnd + i} />
            ))}
          </>
        )}

        {pageItems.length > 0 && (
          <>
            <SectionLabel label="Pages" />
            {pageItems.map((item, i) => (
              <Item key={(item as {href:string}).href} item={item} flatIdx={recentEnd + i} />
            ))}
          </>
        )}
      </div>

      {/* ── Footer hint bar ─────────────────────────────────────────────── */}
      <div className="border-t border-border/20 px-4 py-2 flex items-center gap-3 text-[10px] text-muted-foreground bg-muted/20">
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-background px-1 py-px font-mono">↑</kbd>
          <kbd className="rounded border border-border bg-background px-1 py-px font-mono">↓</kbd>
          navigate
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-background px-1 py-px font-mono">
            <CornerDownLeft className="h-2.5 w-2.5 inline" />
          </kbd>
          select
        </span>
        <span className="flex items-center gap-1">
          <kbd className="rounded border border-border bg-background px-1 py-px font-mono">esc</kbd>
          close
        </span>
      </div>
    </div>
  );
}

// ─── Main export ───────────────────────────────────────────────────────────────
interface CommandPaletteProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}

export function CommandPalette({ open, onOpenChange }: CommandPaletteProps) {
  const router   = useRouter();
  const isMobile = useIsMobile();

  const handleNavigate = useCallback((href: string, label: string) => {
    saveToRecent({ href, label });
    onOpenChange(false);
    router.push(href);
  }, [router, onOpenChange]);

  const handleClose = useCallback(() => onOpenChange(false), [onOpenChange]);

  const content = (
    <PaletteContent open={open} onClose={handleClose} onNavigate={handleNavigate} />
  );

  // ── Mobile: Vaul Drawer (slides up from bottom) ───────────────────────────
  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        <DrawerContent className="pb-6 bg-card border-t border-border/50" hideHandle={false}>
          {content}
        </DrawerContent>
      </Drawer>
    );
  }

  // ── Desktop: Radix Dialog (centered modal) ────────────────────────────────
  return (
    <DialogPrimitive.Root open={open} onOpenChange={onOpenChange}>
      <DialogPrimitive.Portal>
        {/* Backdrop */}
        <DialogPrimitive.Overlay className="fixed inset-0 z-50 bg-black/40 backdrop-blur-sm data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0" />

        {/* Panel */}
        <DialogPrimitive.Content
          className="fixed left-1/2 top-[13%] z-50 w-[calc(100vw-2rem)] max-w-[500px] -translate-x-1/2 outline-none data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0 data-[state=closed]:zoom-out-95 data-[state=open]:zoom-in-95 data-[state=closed]:slide-out-to-top-4 data-[state=open]:slide-in-from-top-4"
          aria-describedby={undefined}
        >
          <DialogPrimitive.Title className="sr-only">Search</DialogPrimitive.Title>
          <div className="rounded-2xl border border-border/50 shadow-[0_24px_60px_rgba(0,0,0,0.3)] overflow-hidden">
            {content}
          </div>
        </DialogPrimitive.Content>
      </DialogPrimitive.Portal>
    </DialogPrimitive.Root>
  );
}

// ─── Auto-track page visits ───────────────────────────────────────────────────
/** Drop this in any layout component to auto-save every page visit to recent */
export function RecentPageTracker() {
  const pathname = usePathname();
  useEffect(() => {
    const nav = navItems.find(
      item => pathname === item.href || pathname.startsWith(item.href + "/"),
    );
    if (nav) saveToRecent({ href: nav.href, label: nav.label });
  }, [pathname]);
  return null;
}
