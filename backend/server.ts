// server.ts
import express from "express";
import http from "http";
import { Server as IOServer, Socket } from "socket.io";
import { randomBytes } from "crypto";

const app = express();
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: "*" }, // restrict for production
});

type User = {
  socket: Socket;
  username: string;
};

// track online users: { socketId -> User }
const onlineUsers = new Map<string, User>();

// track users on main page: { socketId -> User }
const mainPageUsers = new Map<string, User>();

// track pending requests: { recipientSocketId -> { senderId, senderUsername } }
const pendingRequests = new Map<
  string,
  { senderId: string; senderUsername: string }
>();

// track active sessions: { sessionId -> { sockets: [Socket, Socket] } }
const sessions = new Map<
  string,
  { sockets: [Socket, Socket] }
>();

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  socket.on("join_with_username", (username: string) => {
    // sanitize / validate username in real app
    socket.data.username = username;
    onlineUsers.set(socket.id, { socket, username });
    mainPageUsers.set(socket.id, { socket, username });

    // broadcast updated online users list (only main page users)
    io.emit("online_users", Array.from(mainPageUsers.values()).map(u => ({
      socketId: u.socket.id,
      username: u.username,
    })));

    socket.emit("ready", { socketId: socket.id });
    console.log("user online:", username);
  });

  // user requests to connect with another user
  socket.on("send_connection_request", (recipientSocketId: string) => {
    const recipient = onlineUsers.get(recipientSocketId);
    if (!recipient) {
      socket.emit("error_message", "User not found or offline");
      return;
    }

    if (recipientSocketId === socket.id) {
      socket.emit("error_message", "Cannot connect with yourself");
      return;
    }

    // check if already pending
    if (pendingRequests.has(recipientSocketId)) {
      const existing = pendingRequests.get(recipientSocketId);
      if (existing?.senderId === socket.id) {
        socket.emit("error_message", "Request already sent");
        return;
      }
    }

    // store the request
    pendingRequests.set(recipientSocketId, {
      senderId: socket.id,
      senderUsername: socket.data.username,
    });

    // notify recipient
    recipient.socket.emit("connection_request", {
      senderId: socket.id,
      senderUsername: socket.data.username,
    });

    console.log(`connection request: ${socket.data.username} -> ${recipient.username}`);
  });

  // recipient accepts the request
  socket.on("accept_connection_request", (senderId: string) => {
    const request = pendingRequests.get(socket.id);
    if (!request || request.senderId !== senderId) {
      socket.emit("error_message", "Request not found");
      return;
    }

    const senderSocket = onlineUsers.get(senderId)?.socket;
    if (!senderSocket) {
      socket.emit("error_message", "Requester disconnected");
      pendingRequests.delete(socket.id);
      return;
    }

    // remove the request
    pendingRequests.delete(socket.id);

    // create session
    const sessionId = "sess_" + randomBytes(6).toString("hex");
    const room = sessionId;

    senderSocket.join(room);
    socket.join(room);

    sessions.set(sessionId, { sockets: [senderSocket, socket] });

    // notify both
    senderSocket.emit("matched", { sessionId });
    socket.emit("matched", { sessionId });

    // event for session page
    setTimeout(() => {
      io.to(room).emit("session_start", {
        sessionId,
        users: [senderSocket.data.username, socket.data.username],
      });
    }, 400);

    console.log(
      `matched ${senderSocket.data.username} <-> ${socket.data.username} in ${sessionId}`
    );
  });

  // recipient rejects the request
  socket.on("reject_connection_request", (senderId: string) => {
    const request = pendingRequests.get(socket.id);
    if (!request || request.senderId !== senderId) {
      socket.emit("error_message", "Request not found");
      return;
    }

    const senderSocket = onlineUsers.get(senderId)?.socket;
    if (senderSocket) {
      senderSocket.emit("connection_rejected", {
        recipientUsername: socket.data.username,
      });
    }

    pendingRequests.delete(socket.id);
    console.log(`connection rejected: ${socket.data.username} rejected ${request.senderUsername}`);
  });

  // clients that navigated and need to rejoin (safety)
  socket.on("rejoin_session", (payload: { sessionId: string; username: string }) => {
    const { sessionId, username } = payload;
    const s = sessions.get(sessionId);
    if (!s) {
      socket.emit("error_message", "Session not found or already ended");
      return;
    }
    socket.join(sessionId);
    socket.data.username = username;
    socket.emit("rejoined", { sessionId });
    console.log(`${username} rejoined ${sessionId}`);
  });

  // user explicitly leaves a session
  socket.on("leave_session", (sessionId: string) => {
    const session = sessions.get(sessionId);
    if (!session) return;

    const [socket1, socket2] = session.sockets;
    const otherSocket = socket1.id === socket.id ? socket2 : socket1;

    // notify the other user that this user left
    otherSocket.emit("partner_left", { sessionId });

    // remove both from room and session
    try {
      socket1.leave(sessionId);
      socket2.leave(sessionId);
    } catch {}
    
    sessions.delete(sessionId);
    console.log("session ended (user left):", sessionId);
  });

  // user leaves main page (navigates away)
  socket.on("leave_main_page", () => {
    mainPageUsers.delete(socket.id);
    
    // broadcast updated online users list
    io.emit("online_users", Array.from(mainPageUsers.values()).map(u => ({
      socketId: u.socket.id,
      username: u.username,
    })));
    
    console.log("user left main page:", socket.data.username);
  });

  socket.on("disconnect", () => {
    console.log("socket disconnected:", socket.id);

    // remove from online users and main page users
    onlineUsers.delete(socket.id);
    mainPageUsers.delete(socket.id);

    // remove any pending requests from this user
    pendingRequests.delete(socket.id);

    // if in a session, end it
    for (const [sessionId, session] of sessions.entries()) {
      const [socket1, socket2] = session.sockets;
      if (socket1.id === socket.id || socket2.id === socket.id) {
        io.to(sessionId).emit("session_ended", { sessionId });
        try {
          socket1.leave(sessionId);
          socket2.leave(sessionId);
        } catch {}
        sessions.delete(sessionId);
        console.log("session ended (user disconnected):", sessionId);
        break;
      }
    }

    // broadcast updated online users list
    io.emit("online_users", Array.from(mainPageUsers.values()).map(u => ({
      socketId: u.socket.id,
      username: u.username,
    })));
  });
});

const PORT = Number(process.env.PS_PORT || process.env.PORT || 3001);
server.listen(PORT, () => console.log(`Socket server listening on ${PORT}`));