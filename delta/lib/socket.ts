import { io, type Socket } from "socket.io-client";

// Derive the socket server URL from the API URL (strip /api/v1)
const SOCKET_URL = (
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:5001/api/v1"
).replace(/\/api\/v1\/?$/, "");

let socket: Socket | null = null;

export function getSocket(token: string): Socket {
  if (socket && socket.connected) return socket;

  // Disconnect stale instance if token changed
  if (socket) {
    socket.disconnect();
    socket = null;
  }

  socket = io(SOCKET_URL, {
    auth: { token },
    transports: ["websocket", "polling"],
    autoConnect: true,
    reconnection: true,
    reconnectionAttempts: 5,
    reconnectionDelay: 2000,
  });

  socket.on("connect", () => {
    console.log("[Socket] ✅ Connected — id:", socket?.id);
  });
  socket.on("connect_error", (err) => {
    console.warn("[Socket] ❌ Connect error:", err.message);
  });
  socket.on("disconnect", (reason) => {
    console.log("[Socket] 🔌 Disconnected:", reason);
  });
  socket.on("notification", (payload) => {
    console.log("[Socket] 🔔 notification event received:", payload);
  });

  return socket;
}

export function disconnectSocket(): void {
  if (socket) {
    socket.disconnect();
    socket = null;
  }
}
