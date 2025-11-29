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

type Waiting = {
  socket: Socket;
  username: string;
};

// simple single waiting slot. For production use a queue.
let waitingUser: Waiting | null = null;

// track active sessions so we can cleanup safely
const sessions = new Map<
  string,
  { sockets: [Socket, Socket]; timeoutId: NodeJS.Timeout }
>();

io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  socket.on("join_with_username", (username: string) => {
    // sanitize / validate username in real app
    socket.data.username = username;

    // if nobody waiting, set as waiting
    if (!waitingUser) {
      waitingUser = { socket, username };
      socket.emit("waiting");
      console.log("user waiting:", username);
      return;
    }

    // if waiting user exists and it's not the same socket, match them
    if (waitingUser.socket.id === socket.id) {
      socket.emit("error_message", "Already waiting");
      return;
    }

    const partnerSocket = waitingUser.socket;
    const partnerName = waitingUser.username;
    waitingUser = null;

    // inside join_with_username
    const sessionId = "sess_" + randomBytes(6).toString("hex");
    const room = sessionId;

    socket.join(room);
    partnerSocket.join(room);

    const timeoutId = setTimeout(() => {
    io.to(room).emit("session_ended", { sessionId });
    try {
        socket.leave(room);
        partnerSocket.leave(room);
    } catch {}
    sessions.delete(sessionId);
    console.log("session ended:", sessionId);
    }, 10_000);

    sessions.set(sessionId, { sockets: [socket, partnerSocket], timeoutId });

    // --- separate events ---
    socket.emit("matched", { sessionId }); // main page navigation
    partnerSocket.emit("matched", { sessionId }); 

    // event for session page
    setTimeout(() => {
        io.to(room).emit("session_start", {
            sessionId,
            users: [socket.data.username, partnerName],
        })
    }, 400)

    console.log(`matched ${socket.data.username} <-> ${partnerName} in ${sessionId}`);
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

  socket.on("disconnect", () => {
    console.log("socket disconnected:", socket.id);
    // if disconnected user was waiting, clear waiting
    if (waitingUser && waitingUser.socket.id === socket.id) {
      waitingUser = null;
    }

    // optionally: if a socket in an active session disconnects early,
    // you might want to immediately end the session. Here we leave timer intact.
  });
});

const PORT = Number(process.env.PS_PORT || process.env.PORT || 3001);
server.listen(PORT, () => console.log(`Socket server listening on ${PORT}`));
