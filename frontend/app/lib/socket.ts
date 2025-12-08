// lib/socket.ts
"use client";

import { io, Socket } from "socket.io-client";

// persistent socket instance
let socket: Socket | null = null;

export function getSocket(): Socket | null {
  const host : String = typeof window === "undefined" ? "localhost" : window.location.hostname

  if (!socket && typeof window !== "undefined") {
    socket = io(process.env.NEXT_PUBLIC_WS_URL || `http://${host}:3001`, {
      autoConnect: true,
    });

    // Optional: add global logging for debugging
    socket.on("connect", () => {
      console.log("Socket connected:", socket?.id);
    });
    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });
  }

  return socket;
}