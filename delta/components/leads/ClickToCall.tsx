"use client";

import { useState } from "react";
import { motion } from "framer-motion";
import { Phone, PhoneCall } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { toast } from "@/lib/toast";
import api from "@/lib/axios";

// ── Package of the in-house call recorder app ──────────────────────────────────
const CALL_RECORDER_PACKAGE = "com.callrecorder";

function cleanPhone(raw: string): string {
  return raw.replace(/\s+/g, "").replace(/[()-]/g, "");
}

/** True when running on an Android browser (Chrome/WebView on device). */
function isAndroid(): boolean {
  if (typeof navigator === "undefined") return false;
  return /android/i.test(navigator.userAgent);
}

/**
 * Build the dial URL:
 * • Android → Intent URL that skips the app-chooser and opens
 *             com.callrecorder's DialerActivity directly with the number pre-filled.
 * • iOS / Desktop → plain tel: fallback (opens system dialer).
 */
function buildCallUrl(phone: string): string {
  if (isAndroid()) {
    // intent://<phone>#Intent;scheme=tel;action=DIAL;package=com.callrecorder;end
    // DialerActivity handles android.intent.action.DIAL + scheme "tel"
    return (
      `intent://${encodeURIComponent(phone)}` +
      `#Intent;scheme=tel;action=android.intent.action.DIAL` +
      `;package=${CALL_RECORDER_PACKAGE};end`
    );
  }
  return `tel:${phone}`;
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

  if (!phoneNumber) return null;

  const clean = cleanPhone(phoneNumber);

  function handleCall() {
    if (isDialing) return;
    setIsDialing(true);

    // Log click to backend — fire-and-forget, never blocks the call
    api
      .post(
        `/calls/click?phone_number=${encodeURIComponent(phoneNumber)}` +
        (leadId ? `&lead_id=${leadId}` : ""),
      )
      .catch(() => {/* non-fatal */});

    // Open CallRecorder app (Android) or system dialer (fallback)
    window.location.href = buildCallUrl(clean);

    toast.success(`Calling ${leadName || phoneNumber}…`, {
      description: isAndroid()
        ? "Opening CallRecorder app…"
        : "Opening phone dialer…",
      duration: 3000,
    });

    setTimeout(() => setIsDialing(false), 2500);
  }

  return (
    <TooltipProvider>
      <Tooltip>
        <TooltipTrigger asChild>
          <motion.div whileTap={{ scale: 0.97 }} style={{ display: "inline-flex" }}>
            <Button
              variant={variant}
              size={size}
              onClick={handleCall}
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
        <TooltipContent side="top">
          Call {leadName || phoneNumber}
        </TooltipContent>
      </Tooltip>
    </TooltipProvider>
  );
}
