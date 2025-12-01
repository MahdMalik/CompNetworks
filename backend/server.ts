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
  role?: "artist" | "viewer";
};

// track online users: { socketId -> User }
const onlineUsers = new Map<string, User>();

// track users on main page: { socketId -> User }
// Artists can see all viewers, viewers don't see anyone
const availableViewers = new Map<string, User>();

// track pending requests: { recipientSocketId -> { senderId, senderUsername, senderRole } }
const pendingRequests = new Map<
  string,
  { senderId: string; senderUsername: string; senderRole: "artist" }
>();

// track active sessions: { sessionId -> { artistSocket: Socket, viewerSocket: Socket } }
const sessions = new Map<
  string,
  { artistSocket: Socket; viewerSocket: Socket }
>();

// track session readiness: { sessionId -> { artistReady: boolean, viewerReady: boolean } }
const sessionReadiness = new Map<
  string,
  { artistReady: boolean; viewerReady: boolean }
>();

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  socket.on("join_with_username", (data: { username: string; role: "artist" | "viewer" }) => {
    // sanitize / validate username in real app
    socket.data.username = data.username;
    socket.data.role = data.role;

    onlineUsers.set(socket.id, { socket, username: data.username, role: data.role });
    
    // track viewers that are available to receive requests
    if (data.role === "viewer") {
      availableViewers.set(socket.id, { socket, username: data.username, role: "viewer" });
    }

    // broadcast updated available viewers list (for artists to see)
    io.emit("online_users", Array.from(availableViewers.values()).map(u => ({
      socketId: u.socket.id,
      username: u.username,
    })));

    socket.emit("ready", { socketId: socket.id });
    console.log("user online:", data.username, "as", data.role);
  });

  // user requests to connect with another user (artist sends request to viewer)
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

    if (socket.data.role !== "artist") {
      socket.emit("error_message", "Only artists can send connection requests");
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
      senderRole: "artist",
    });

    // notify recipient
    recipient.socket.emit("connection_request", {
      senderId: socket.id,
      senderUsername: socket.data.username,
      senderRole: "artist",
    });

    console.log(`connection request: ${socket.data.username} (artist) -> ${recipient.username}`);
  });

  // recipient accepts the request
  socket.on("accept_connection_request", (senderId: string) => {
    const request = pendingRequests.get(socket.id);
    if (!request || request.senderId !== senderId) {
      socket.emit("error_message", "Request not found");
      return;
    }

    const artistSocket = onlineUsers.get(senderId)?.socket;
    if (!artistSocket) {
      socket.emit("error_message", "Artist disconnected");
      pendingRequests.delete(socket.id);
      return;
    }

    // remove the request
    pendingRequests.delete(socket.id);

    // create session
    const sessionId = "sess_" + randomBytes(6).toString("hex");
    const room = sessionId;

    artistSocket.join(room);
    socket.join(room);

    sessions.set(sessionId, { artistSocket, viewerSocket: socket });

    // Initialize readiness tracking
    sessionReadiness.set(sessionId, { artistReady: false, viewerReady: false });

    // notify both
    artistSocket.emit("matched", { sessionId });
    socket.emit("matched", { sessionId });

    console.log(
      `matched ${artistSocket.data.username} (artist) <-> ${socket.data.username} (viewer) in ${sessionId}`
    );
  });

  // recipient rejects the request
  socket.on("reject_connection_request", (senderId: string) => {
    const request = pendingRequests.get(socket.id);
    if (!request || request.senderId !== senderId) {
      socket.emit("error_message", "Request not found");
      return;
    }

    const artistSocket = onlineUsers.get(senderId)?.socket;
    if (artistSocket) {
      artistSocket.emit("connection_rejected", {
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

  const handleLeaveSession = (session, sessionId) => {
    const { artistSocket, viewerSocket } = session;
    const otherSocket = artistSocket.id === socket.id ? viewerSocket : artistSocket;

    // notify the other user that this user left
    otherSocket.emit("partner_left", { sessionId });

    // remove both from room and session
    try {
      artistSocket.leave(sessionId);
      viewerSocket.leave(sessionId);
    } catch {}
    
    sessions.delete(sessionId);
    console.log("session ended (user left):", sessionId);

  }

  // user explicitly leaves a session
  socket.on("leave_session", (sessionId: string) => {
    const session = sessions.get(sessionId);
    if (!session) return;
    handleLeaveSession(session, sessionId)
  });

  // client signals they're ready on the session page
  socket.on("session_page_ready", (sessionId: string) => {
    const session = sessions.get(sessionId);
    const readiness = sessionReadiness.get(sessionId);
    if (!session || !readiness) return;

    const { artistSocket, viewerSocket } = session;

    // Mark which user is ready
    if (artistSocket.id === socket.id) {
      readiness.artistReady = true;
    } else if (viewerSocket.id === socket.id) {
      readiness.viewerReady = true;
    }

    // If both are ready, emit session_start
    if (readiness.artistReady && readiness.viewerReady) {
      io.to(sessionId).emit("session_start", {
        sessionId,
        artistName: artistSocket.data.username,
        viewerName: viewerSocket.data.username,
      });
      console.log("Both clients ready, starting session:", sessionId);
    }
  });

  // artist sends selected image to viewer
  socket.on("send_image", (payload: { sessionId: string; imageUrl: string }) => {
    const { sessionId, imageUrl } = payload;
    const session = sessions.get(sessionId);
    if (!session) return;

    const { artistSocket, viewerSocket } = session;
    if (artistSocket.id !== socket.id) {
      socket.emit("error_message", "Only artists can send images");
      return;
    }

    // send image to viewer
    viewerSocket.emit("receive_image", { imageUrl });
    console.log(`${socket.data.username} sent image to viewer in ${sessionId}`);
  });

  // user leaves main page (navigates away)
  socket.on("leave_main_page", () => {
    availableViewers.delete(socket.id);
    
    // broadcast updated online users list
    io.emit("online_users", Array.from(availableViewers.values()).map(u => ({
      socketId: u.socket.id,
      username: u.username,
    })));
    
    console.log("user left main page:", socket.data.username);
  });

  socket.on("disconnect", () => {
    console.log("socket disconnected:", socket.id);

    // remove from online users and available viewers
    onlineUsers.delete(socket.id);
    availableViewers.delete(socket.id);

    // remove any pending requests from this user
    pendingRequests.delete(socket.id);

    // if in a session, end it
    for (const [sessionId, session] of sessions.entries()) {
      handleLeaveSession(session, sessionId)
    }

    // broadcast updated online users list
    io.emit("online_users", Array.from(availableViewers.values()).map(u => ({
      socketId: u.socket.id,
      username: u.username,
    })));
  });
});

const PORT = Number(process.env.PS_PORT || process.env.PORT || 3001);
server.listen(PORT, () => console.log(`Socket server listening on ${PORT}`));