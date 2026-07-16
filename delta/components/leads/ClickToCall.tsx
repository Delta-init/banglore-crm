"use client";

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { Phone, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { toast } from "@/lib/toast";
import { useAuthStore } from "@/lib/store/authStore";

// ── Package of the in-house call recorder app ──────────────────────────────────
const CALL_RECORDER_PACKAGE = "com.callrecorder";
const CX3_BASE_URL          = "https://deltainstitutions.3cx.ae:5002";

function cleanPhone(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/[()-]/g, "");
}

/** True when running on an Android browser (Chrome/WebView on device). */
function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

/**
 * Normal call URL:
 * • Android → Intent URL targeting com.callrecorder directly.
 * • iOS / Desktop → plain tel: fallback.
 */
function buildNormalCallUrl(phone: string): string {
  if (isAndroid()) {
    return (
      `intent://${phone}` +
      `#Intent;scheme=tel;action=android.intent.action.DIAL` +
      `;package=${CALL_RECORDER_PACKAGE};end`
    );
  }
  return `tel:${phone}`;
}

/** 3CX web-client click-to-call URL */
function build3cxUrl(phone: string): string {
  return `${CX3_BASE_URL}/webclient/#/call?phone=${encodeURIComponent(phone)}`;
}

// ─────────────────────────────────────────────────────────────────────────────

interface ClickToCallProps {
  phoneNumber: string;
  leadId?: string;
  leadName?: string;
  variant?: "ghost" | "outline";
  size?: "icon" | "sm";
  showLabel?: boolean;
  className?: string;
}

export function ClickToCall({
  phoneNumber,
  leadId,
  leadName,
  variant = "ghost",
  size = "icon",
  showLabel = false,
  className = "",
}: ClickToCallProps) {
  const [isDialing, setIsDialing] = useState(false);
  const [open, setOpen]           = useState(false);
  const user                      = useAuthStore((s) => s.user);
  const hasExtension              = Boolean(user?.extension);

  if (!phoneNumber) return null;

  const clean = cleanPhone(phoneNumber);

  function handleNormalCall() {
    if (isDialing) return;
    setOpen(false);
    setIsDialing(true);
    window.location.href = buildNormalCallUrl(clean);
    toast.success(`Calling ${leadName || phoneNumber}…`, {
      description: isAndroid() ? "Opening CallRecorder app…" : "Opening phone dialer…",
      duration: 3000,
    });
    setTimeout(() => setIsDialing(false), 2500);
  }

  function handle3cxCall() {
    if (isDialing) return;
    setOpen(false);
    setIsDialing(true);
    window.open(build3cxUrl(clean), "_blank", "noopener,noreferrer");
    toast.success(`Calling via 3CX…`, {
      description: `${leadName || phoneNumber} — Ext ${user?.extension}`,
      duration: 3000,
    });
    setTimeout(() => setIsDialing(false), 2500);
  }

  // ── No extension → single direct-dial button (existing behaviour) ──────────

  if (!hasExtension) {
    return (
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <motion.div whileTap={{ scale: 0.97 }} style={{ display: "inline-flex" }}>
              <Button
                variant={variant}
                size={size}
                onClick={handleNormalCall}
                disabled={isDialing}
                className={`${className} text-green-400 hover:text-green-300 hover:bg-green-500/10 ${isDialing ? "animate-pulse" : ""}`}
              >
                {isDialing ? (
                  <PhoneCall className="h-4 w-4 animate-bounce" />
                ) : (
                  <Phone className="h-4 w-4" />
                )}
                {showLabel && (
                  <span className="ml-2">{isDialing ? "Calling…" : "Call"}</span>
                )}
              </Button>
            </motion.div>
          </TooltipTrigger>
          <TooltipContent side="top">Call {leadName || phoneNumber}</TooltipContent>
        </Tooltip>
      </TooltipProvider>
    );
  }

  // ── Has extension → show picker popover ───────────────────────────────────

  return (
    <Popover open={open} onOpenChange={setOpen}>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <PopoverTrigger asChild>
              <motion.div whileTap={{ scale: 0.97 }} style={{ display: "inline-flex" }}>
                <Button
                  variant={variant}
                  size={size}
                  disabled={isDialing}
                  className={`${className} text-green-400 hover:text-green-300 hover:bg-green-500/10 ${isDialing ? "animate-pulse" : ""}`}
                >
                  {isDialing ? (
                    <PhoneCall className="h-4 w-4 animate-bounce" />
                  ) : (
                    <Phone className="h-4 w-4" />
                  )}
                  {showLabel && (
                    <span className="ml-2">{isDialing ? "Calling…" : "Call"}</span>
                  )}
                </Button>
              </motion.div>
            </PopoverTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">Call {leadName || phoneNumber}</TooltipContent>
        </Tooltip>
      </TooltipProvider>

      <PopoverContent
        side="top"
        align="center"
        className="w-48 p-1.5"
        sideOffset={6}
      >
        <AnimatePresence>
          {open && (
            <motion.div
              initial={{ opacity: 0, scale: 0.95, y: 4 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.95, y: 4 }}
              transition={{ duration: 0.12 }}
              className="flex flex-col gap-1"
            >
              <p className="px-2 py-1 text-[10px] font-semibold text-muted-foreground uppercase tracking-wide">
                Choose method
              </p>

              {/* Normal call */}
              <motion.button
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.97 }}
                onClick={handleNormalCall}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-left hover:bg-muted transition-colors"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-green-500/15">
                  <Phone className="h-3.5 w-3.5 text-green-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium leading-none">Normal Call</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Via CallRecorder app</p>
                </div>
              </motion.button>

              {/* 3CX call */}
              <motion.button
                whileHover={{ x: 2 }}
                whileTap={{ scale: 0.97 }}
                onClick={handle3cxCall}
                className="flex items-center gap-2.5 rounded-md px-2.5 py-2 text-sm text-left hover:bg-muted transition-colors"
              >
                <div className="flex h-7 w-7 shrink-0 items-center justify-center rounded-full bg-blue-500/15">
                  <PhoneCall className="h-3.5 w-3.5 text-blue-400" />
                </div>
                <div className="min-w-0">
                  <p className="font-medium leading-none">3CX</p>
                  <p className="text-[11px] text-muted-foreground mt-0.5">Ext {user?.extension}</p>
                </div>
              </motion.button>
            </motion.div>
          )}
        </AnimatePresence>
      </PopoverContent>
    </Popover>
  );
}
