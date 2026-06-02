"use client";

import { useEffect, useRef } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { getSocket } from "@/lib/socket";
import { useAuthStore } from "@/lib/store/authStore";
import type { TeamUpdateItem } from "@/types/team";

/**
 * Connects to the Socket.IO server, joins the given team room,
 * and invalidates the updates query whenever a team:update event arrives.
 *
 * Returns the socket connection state for optional UI indicators.
 */
export function useTeamSocket(teamId: string) {
  const { accessToken } = useAuthStore();
  const queryClient     = useQueryClient();
  const joinedRef       = useRef(false);

  useEffect(() => {
    if (!teamId || !accessToken) return;

    const socket = getSocket(accessToken);

    function joinRoom() {
      if (!joinedRef.current) {
        socket.emit("join:team", teamId);
        joinedRef.current = true;
      }
    }

    // Join immediately if already connected, otherwise wait for connect
    if (socket.connected) {
      joinRoom();
    } else {
      socket.once("connect", joinRoom);
    }

    // On every team:update event — prepend item to the first page cache
    // and also invalidate so next refetch is fresh
    function handleUpdate({ item }: { teamId: string; item: TeamUpdateItem }) {
      // Optimistically prepend the new item to the first page of the feed
      queryClient.setQueriesData<{ data: TeamUpdateItem[]; pagination: unknown }>(
        { queryKey: ["teams", teamId, "updates"] },
        (old) => {
          if (!old) return old;
          // Avoid duplicates (item may already arrive via refetch)
          const exists = old.data.some((d) => d._id === item._id);
          if (exists) return old;
          return { ...old, data: [item, ...old.data] };
        },
      );
    }

    socket.on("team:update", handleUpdate);

    return () => {
      socket.off("connect",     joinRoom);
      socket.off("team:update", handleUpdate);
      socket.emit("leave:team", teamId);
      joinedRef.current = false;
    };
  }, [teamId, accessToken, queryClient]);
}
