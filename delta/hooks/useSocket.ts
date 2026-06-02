"use client";

import { useEffect, useRef } from "react";
import { io, type Socket } from "socket.io-client";
import { useAuthStore } from "@/lib/store/authStore";

let globalSocket: Socket | null = null;

/** Returns a singleton socket connected with the current user's token */
export function useSocket(): Socket | null {
  const { accessToken: token } = useAuthStore();
  const socketRef = useRef<Socket | null>(null);

  useEffect(() => {
    if (!token || typeof window === "undefined") return;

    // Reuse existing connected socket
    if (globalSocket?.connected) {
      socketRef.current = globalSocket;
      return;
    }

    const serverUrl = process.env.NEXT_PUBLIC_API_URL?.replace("/api/v1", "") ?? "http://localhost:5000";

    const socket = io(serverUrl, {
      auth: { token },
      transports: ["websocket", "polling"],
      reconnectionAttempts: 5,
      reconnectionDelay: 2000,
    });

    globalSocket = socket;
    socketRef.current = socket;

    socket.on("connect_error", (err) => {
      console.warn("Socket connect error:", err.message);
    });

    return () => {
      // Don't disconnect — keep the global socket alive across page navigations
    };
  }, [token]);

  return socketRef.current;
}

/** Join a specific team room */
export function useTeamSocket(teamId: string | undefined): Socket | null {
  const socket = useSocket();

  useEffect(() => {
    if (!socket || !teamId) return;

    const join = () => socket.emit("join:team", teamId);

    if (socket.connected) {
      join();
    } else {
      socket.on("connect", join);
    }

    return () => {
      socket.emit("leave:team", teamId);
      socket.off("connect", join);
    };
  }, [socket, teamId]);

  return socket;
}
