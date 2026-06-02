"use client";

import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { toast } from "@/lib/toast";
import { useSocket } from "@/hooks/useSocket";

// ─── Types ────────────────────────────────────────────────────────────────────

interface RecordingSavedPayload {
  callLogId:      string;
  phone:          string;
  contactName:    string | null;
  callType:       string;
  callDuration:   number;           // seconds
  recordingUrl:   string | null;
  agentExtension: string | null;
  agentName:      string | null;
  leadId:         string | null;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function fmtDuration(secs: number): string {
  if (!secs || secs < 1) return "0s";
  const m = Math.floor(secs / 60);
  const s = secs % 60;
  return m > 0 ? `${m}m ${s}s` : `${s}s`;
}

/** Fire a browser push notification. Uses ServiceWorker on mobile (required
 *  for Android Chrome) and falls back to new Notification() on desktop. */
async function fireBrowserNotification(title: string, body: string) {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission !== "granted") return;

  if ("serviceWorker" in navigator) {
    try {
      const reg = await navigator.serviceWorker.ready;
      reg.showNotification(title, {
        body,
        icon: "/icons/icon-192x192.png",
        badge: "/icons/icon-72x72.png",
        tag: "recording-saved",       // replaces previous notification of same tag
      });
    } catch {
      // ServiceWorker not available — silent fail
    }
  } else {
    new Notification(title, { body });
  }
}

function requestBrowserPermission() {
  if (typeof window === "undefined" || !("Notification" in window)) return;
  if (Notification.permission === "default") Notification.requestPermission();
}

// ─── Hook ─────────────────────────────────────────────────────────────────────

/**
 * Listens for `recording:saved` socket events emitted by the backend when
 * the CallRecorder Android app syncs a completed call.
 *
 * On each event:
 *  1. Shows an in-app toast with call details
 *  2. Fires a browser push notification (works even if tab is in background)
 *  3. Invalidates the calls query cache so CallsPanel + /calls page refresh
 */
export function useCallRecordingNotifications() {
  const socket      = useSocket();
  const queryClient = useQueryClient();

  // Request browser notification permission on mount
  useEffect(() => {
    requestBrowserPermission();
  }, []);

  useEffect(() => {
    if (!socket) return;

    function handleRecordingSaved(payload: RecordingSavedPayload) {
      const who      = payload.contactName || payload.phone || "Unknown";
      const duration = fmtDuration(payload.callDuration);
      const type     = payload.callType === "Inbound" || payload.callType === "incoming"
        ? "📞 Inbound"
        : "📤 Outbound";

      // ── In-app toast ───────────────────────────────────────────────────
      toast.success(`${type} call recorded`, {
        description: `${who}  •  ${duration}${payload.recordingUrl ? "  •  🎙 Recording saved" : ""}`,
        duration: 6000,
      });

      // ── Browser notification ───────────────────────────────────────────
      fireBrowserNotification(
        "📼 Call recorded & synced",
        `${who}  •  ${duration}  •  ${type}`,
      );

      // ── Invalidate call queries so the UI updates immediately ──────────
      queryClient.invalidateQueries({ queryKey: ["calls"] });

      // If the call is linked to a lead, also refresh that lead's data
      if (payload.leadId) {
        queryClient.invalidateQueries({ queryKey: ["calls", payload.leadId] });
        queryClient.invalidateQueries({ queryKey: ["leads", payload.leadId] });
      }
    }

    socket.on("recording:saved", handleRecordingSaved);
    return () => { socket.off("recording:saved", handleRecordingSaved); };
  }, [socket, queryClient]);
}
