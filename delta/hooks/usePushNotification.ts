"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import api from "@/lib/axios";

// urlBase64ToUint8Array — converts VAPID public key to the format required by the browser
function urlBase64ToUint8Array(base64String: string): Uint8Array {
  const padding = "=".repeat((4 - (base64String.length % 4)) % 4);
  const base64 = (base64String + padding).replace(/-/g, "+").replace(/_/g, "/");
  const rawData = atob(base64);
  const output = new Uint8Array(rawData.length);
  for (let i = 0; i < rawData.length; i++) {
    output[i] = rawData.charCodeAt(i);
  }
  return output;
}

export type NotificationPermission = "default" | "granted" | "denied";

export interface UsePushNotificationReturn {
  permission: NotificationPermission;
  isSubscribed: boolean;
  isLoading: boolean;
  requestPermission: () => Promise<void>;
  unsubscribe: () => Promise<void>;
}

export function usePushNotification(): UsePushNotificationReturn {
  const [permission, setPermission] = useState<NotificationPermission>("default");
  const [isSubscribed, setIsSubscribed] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const swRef = useRef<ServiceWorkerRegistration | null>(null);

  // ── Init: register SW and check existing subscription ─────────────────────
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!("serviceWorker" in navigator) || !("PushManager" in window)) return;

    setPermission(Notification.permission as NotificationPermission);

    navigator.serviceWorker
      .register("/push-sw.js")
      .then(async (reg) => {
        swRef.current = reg;
        const existing = await reg.pushManager.getSubscription();
        setIsSubscribed(!!existing);
      })
      .catch(() => null);
  }, []);

  // ── Request permission + subscribe ────────────────────────────────────────
  const requestPermission = useCallback(async () => {
    if (!("Notification" in window) || !("serviceWorker" in navigator)) return;

    setIsLoading(true);
    try {
      const result = await Notification.requestPermission();
      setPermission(result as NotificationPermission);
      if (result !== "granted") return;

      // Get SW registration
      let reg = swRef.current;
      if (!reg) {
        reg = await navigator.serviceWorker.register("/push-sw.js");
        swRef.current = reg;
      }

      // Get VAPID public key from backend
      const { data: vapidData } = await api.get<{ data: { publicKey: string } }>(
        "/push/vapid-public-key"
      );
      const applicationServerKey = urlBase64ToUint8Array(vapidData.data.publicKey);

      // Subscribe
      const subscription = await reg.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: applicationServerKey.buffer as ArrayBuffer,
      });

      // Send subscription to backend
      const sub = subscription.toJSON();
      await api.post("/push/subscribe", {
        endpoint: sub.endpoint,
        keys: sub.keys,
      });

      setIsSubscribed(true);
    } catch (err) {
      console.error("Push subscription failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  // ── Unsubscribe ───────────────────────────────────────────────────────────
  const unsubscribe = useCallback(async () => {
    setIsLoading(true);
    try {
      const reg = swRef.current;
      if (!reg) return;

      const sub = await reg.pushManager.getSubscription();
      if (!sub) return;

      const subJson = sub.toJSON();
      await sub.unsubscribe();

      await api.delete("/push/unsubscribe", {
        data: { endpoint: subJson.endpoint },
      });

      setIsSubscribed(false);
    } catch (err) {
      console.error("Unsubscribe failed:", err);
    } finally {
      setIsLoading(false);
    }
  }, []);

  return { permission, isSubscribed, isLoading, requestPermission, unsubscribe };
}
