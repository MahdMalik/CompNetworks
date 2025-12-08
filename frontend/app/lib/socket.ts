// lib/socket.ts
"use client";

import { io, Socket } from "socket.io-client";

// persistent socket instance
let socket: Socket | null = null;

// this funciton allows us to get a socket that connects to the server side
export function getSocket(): Socket | null {
  //we have to do this due to weird Server side rendering issue, wehre "window" doesn't exist on the server side and only the client side.
  // As for the host condition, basically it makes sure the ip address it connects to on teh backend is the same one as on the frontend, which
  // may not be the same as the device's ip address, for example if a phone connects to the frontend server, here instead of using the phone's ip addr
  // to connect to the server (which it'd try to do with localhost), it uses the same ip address as the frontend server.
  const host : String = typeof window === "undefined" ? "localhost" : window.location.hostname

  // basically, this dynamically sets the socket to the host as mentioned above
  if (!socket && typeof window !== "undefined") {
    socket = io(process.env.NEXT_PUBLIC_WS_URL || `http://${host}:3001`, {
      autoConnect: true,
    });

    // Adding connect/disconnect logging for debugging
    socket.on("connect", () => {
      console.log("Socket connected:", socket?.id);
    });
    socket.on("disconnect", () => {
      console.log("Socket disconnected");
    });
  }

  return socket;
}