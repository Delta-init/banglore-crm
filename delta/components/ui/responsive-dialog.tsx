"use client";

/**
 * ResponsiveDialog
 * ─────────────────────────────────────────────────────────────────────────────
 * On mobile (< 640 px)  → renders a bottom-sheet Drawer (vaul / shadcn Drawer)
 * On desktop (≥ 640 px) → renders a centred Dialog
 *
 * The Drawer uses a shadcn <ScrollArea> for its body with:
 *   • min-height  → 200px  (drawer is never collapsed smaller than this)
 *   • height      → auto   (grows with content)
 *   • max-height  → calc(92dvh - 60px) (leaves room for the drag handle)
 */

import * as React from "react";
import { useIsMobile } from "@/hooks/useIsMobile";
import {
  Dialog,
  DialogContent,
  DialogHeader,
  DialogTitle,
  DialogDescription,
  DialogFooter,
} from "@/components/ui/dialog";
import {
  Drawer,
  DrawerContent,
  DrawerHeader,
  DrawerTitle,
  DrawerDescription,
  DrawerFooter,
} from "@/components/ui/drawer";
import { ScrollArea } from "@/components/ui/scroll-area";

// ─── Root ─────────────────────────────────────────────────────────────────────

interface ResponsiveDialogProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  children: React.ReactNode;
}

export function ResponsiveDialog({ open, onOpenChange, children }: ResponsiveDialogProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <Drawer open={open} onOpenChange={onOpenChange}>
        {children}
      </Drawer>
    );
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      {children}
    </Dialog>
  );
}

// ─── Content ──────────────────────────────────────────────────────────────────

interface ResponsiveDialogContentProps extends React.HTMLAttributes<HTMLDivElement> {
  children: React.ReactNode;
  /** Extra className forwarded to DialogContent only (desktop) */
  className?: string;
  /** Max-width + any extra classes applied on desktop only */
  desktopClassName?: string;
  /** Height of the dialog */
  height?: string;
}

export function ResponsiveDialogContent({
  children,
  className,
  desktopClassName,
  height="auto",
  ...props
}: ResponsiveDialogContentProps) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      /*
       * DrawerContent renders the drag handle automatically.
       * We keep it as a flex column and let the inner ScrollArea
       * manage all scrolling.
       */
      <DrawerContent className="flex flex-col px-0">
        <ScrollArea
          className="w-full"
          style={{
            // minimum height so short content doesn't look too cramped
            minHeight: "200px",
            // grows with content up to the max
            height: height,
            // 92dvh minus ~60px for the drag handle + safe area
            maxHeight: "calc(92dvh - 60px)",
          }}
        >
          <div className="pb-[env(safe-area-inset-bottom,16px)]">
            {children}
          </div>
        </ScrollArea>
      </DrawerContent>
    );
  }

  return (
    <DialogContent
      className={[desktopClassName ?? "max-w-lg", className].filter(Boolean).join(" ")}
      {...(props as React.ComponentPropsWithoutRef<typeof DialogContent>)}
    >
      {children}
    </DialogContent>
  );
}

// ─── Header ───────────────────────────────────────────────────────────────────

export function ResponsiveDialogHeader({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerHeader
        className={["text-left px-4", className].filter(Boolean).join(" ")}
        {...props}
      >
        {children}
      </DrawerHeader>
    );
  }

  return (
    <DialogHeader className={className} {...props}>
      {children}
    </DialogHeader>
  );
}

// ─── Title ────────────────────────────────────────────────────────────────────

export function ResponsiveDialogTitle({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLHeadingElement>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerTitle
        className={className}
        {...(props as React.ComponentPropsWithoutRef<typeof DrawerTitle>)}
      >
        {children}
      </DrawerTitle>
    );
  }

  return (
    <DialogTitle
      className={className}
      {...(props as React.ComponentPropsWithoutRef<typeof DialogTitle>)}
    >
      {children}
    </DialogTitle>
  );
}

// ─── Description ─────────────────────────────────────────────────────────────

export function ResponsiveDialogDescription({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLParagraphElement>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerDescription
        className={className}
        {...(props as React.ComponentPropsWithoutRef<typeof DrawerDescription>)}
      >
        {children}
      </DrawerDescription>
    );
  }

  return (
    <DialogDescription
      className={className}
      {...(props as React.ComponentPropsWithoutRef<typeof DialogDescription>)}
    >
      {children}
    </DialogDescription>
  );
}

// ─── Footer ───────────────────────────────────────────────────────────────────

export function ResponsiveDialogFooter({
  children,
  className,
  ...props
}: React.HTMLAttributes<HTMLDivElement>) {
  const isMobile = useIsMobile();

  if (isMobile) {
    return (
      <DrawerFooter
        className={["flex-row justify-end px-4 border-t border-border pt-3 mt-2", className]
          .filter(Boolean)
          .join(" ")}
        {...props}
      >
        {children}
      </DrawerFooter>
    );
  }

  return (
    <DialogFooter className={className} {...props}>
      {children}
    </DialogFooter>
  );
}
