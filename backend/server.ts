// server.ts
import express from "express";
import http from "http";
import { Server as IOServer, Socket } from "socket.io";
import { randomBytes } from "crypto";
import SFTPClient from "ssh2-sftp-client";
import { join } from "path";

// sets up the app
const app = express();
const server = http.createServer(app);
const io = new IOServer(server, {
  cors: { origin: "*" }, // restrict for production
});

// sets up a type of each User to store
type User = {
  socket: Socket;
  username: string;
  role?: "artist" | "viewer";
};

// note, for the data structures of users, avaialble users, requests, and sesions, we used a hash map. It works best since the list
// doesn't need to be sorted, and just requires a quick lookup of data

// track online users
const onlineUsers = new Map<string, User>();

// track users on main page (to let artists see viewers)
const availableViewers = new Map<string, User>();

// track pending requests
const pendingRequests = new Map<
  string,
  { senderId: string; senderUsername: string; senderRole: "artist" }
>();

// track active sessions
const sessions = new Map<
  string,
  { artistSocket: Socket; viewerSocket: Socket }
>();

// track session readiness
const sessionReadiness = new Map<
  string,
  { artistReady: boolean; viewerReady: boolean }
>();

// waits until a client sonnectioon 
io.on("connection", (socket) => {
  console.log("socket connected:", socket.id);

  // user joins with username + role
  socket.on(
    "join_with_username",
    (data: { username: string; role: "artist" | "viewer" }) => {
      // set for the socket such data
      // sanitize / validate username in real app
      socket.data.username = data.username;
      socket.data.role = data.role;

      // in the online users section, track them as online
      onlineUsers.set(socket.id, {
        socket,
        username: data.username,
        role: data.role,
      });

      // track viewers that are available to receive requests, which should be only viewers
      if (data.role === "viewer") {
        availableViewers.set(socket.id, {
          socket,
          username: data.username,
          role: "viewer",
        });

        // broadcast updated available viewers list (for artists to see), since a new viewer joined
        io.emit(
          "online_users",
          Array.from(availableViewers.values()).map((u) => ({
            socketId: u.socket.id,
            username: u.username,
          }))
        );
      }
      // tell them that they'ren ow ready
      socket.emit("ready", { socketId: socket.id });
      console.log("user online:", data.username, "as", data.role);
    }
  );

  // user requests to connect with another user (artist sends request to viewer)
  socket.on("send_connection_request", (recipientSocketId: string) => {
    // get the other user
    const recipient = onlineUsers.get(recipientSocketId);
    if (!recipient) {
      socket.emit("error_message", "User not found or offline");
      return;
    }

    // if they sent it to themsevles somehow, raise error
    if (recipientSocketId === socket.id) {
      socket.emit("error_message", "Cannot connect with yourself");
      return;
    }

    // doesn't let viewers or non roles send connections
    if (socket.data.role !== "artist") {
      socket.emit("error_message", "Only artists can send connection requests");
      return;
    }

    // check if already pending
    if (pendingRequests.has(recipientSocketId)) {
      const existing = pendingRequests.get(recipientSocketId);
      // check though if they're the same sender
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

    // notify recipient by emitting it towards them
    recipient.socket.emit("connection_request", {
      senderId: socket.id,
      senderUsername: socket.data.username,
      senderRole: "artist",
    });

    console.log(
      `connection request: ${socket.data.username} (artist) -> ${recipient.username}`
    );
  });

  // recipient accepts the request
  socket.on("accept_connection_request", (senderId: string) => {
    // get the request
    const request = pendingRequests.get(socket.id);
    // make sure the request exists, and its from teh right sender
    if (!request || request.senderId !== senderId) {
      socket.emit("error_message", "Request not found");
      return;
    }

    //gets the socket of the sender
    const artistSocket = onlineUsers.get(senderId)?.socket;
    // makes sure it exists
    if (!artistSocket) {
      socket.emit("error_message", "Artist disconnected");
      pendingRequests.delete(socket.id);
      return;
    }

    // remove the request
    pendingRequests.delete(socket.id);

    // create session
    const sessionId = "sess_" + randomBytes(6).toString("hex");

    // to the socket tells them to join this room with the session id
    artistSocket.join(sessionId);
    socket.join(sessionId);

    // adds the session to the mapping
    sessions.set(sessionId, { artistSocket, viewerSocket: socket });

    // Initialize readiness tracking, cause we need to wait for them to all join it
    sessionReadiness.set(sessionId, {
      artistReady: false,
      viewerReady: false,
    });

    // notify both
    artistSocket.emit("matched", { sessionId });
    socket.emit("matched", { sessionId });

    console.log(
      `matched ${artistSocket.data.username} (artist) <-> ${socket.data.username} (viewer) in ${sessionId}`
    );
  });

  // recipient rejects the request
  socket.on("reject_connection_request", (senderId: string) => {
    // make sure the request exists and its the right pairing
    const request = pendingRequests.get(socket.id);
    if (!request || request.senderId !== senderId) {
      socket.emit("error_message", "Request not found");
      return;
    }

    // gets the artist stock, and messages them with the rejected connection
    const artistSocket = onlineUsers.get(senderId)?.socket;
    if (artistSocket) {
      artistSocket.emit("connection_rejected", {
        recipientUsername: socket.data.username,
      });
    }

    // the request has been resolved, so delete it now
    pendingRequests.delete(socket.id);
    console.log(
      `connection rejected: ${socket.data.username} rejected ${request.senderUsername}`
    );
  });

  // clients that navigated and need to rejoin (safety)
  socket.on(
    "rejoin_session",
    (payload: { sessionId: string; username: string }) => {
      // gets the details from the payload needed to rejoin
      const { sessionId, username } = payload;
      const s = sessions.get(sessionId);
      // make sure the session exists still
      if (!s) {
        socket.emit(
          "error_message",
          "Session not found or already ended"
        );
        return;
      }
      // join their socket with that connection. Note that this may not work since we make them leave almost immedietly after any disconnect
      socket.join(sessionId);
      socket.data.username = username;
      socket.emit("rejoined", { sessionId });
      console.log(`${username} rejoined ${sessionId}`);
    }
  );

  // user explicitly leaves a session
  socket.on("leave_session", (sessionId: string) => {
    // get the session they're in
    const session = sessions.get(sessionId);
    if (!session) return;

    // gets the other socket to let them know they left
    const { artistSocket, viewerSocket } = session;
    const otherSocket =
      artistSocket.id === socket.id ? viewerSocket : artistSocket;

    // notify the other user that this user left
    otherSocket.emit("partner_left", { sessionId });

    // remove both from room and session
    try {
      artistSocket.leave(sessionId);
      viewerSocket.leave(sessionId);
    } catch {}

    // delete this session
    sessions.delete(sessionId);
    console.log("session ended (user left):", sessionId);
  });

  // client signals they're ready on the session page
  socket.on("session_page_ready", (sessionId: string) => {
    // get the ssession and the readiness
    const session = sessions.get(sessionId);
    const readiness = sessionReadiness.get(sessionId);
    if (!session || !readiness) return;

    // gets both sockets
    const { artistSocket, viewerSocket } = session;

    // Mark which user is ready by whichever socket had sent it
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

  // artist sends selected image to viewer (by URL handled on frontend)
  socket.on("send_image", (payload: { sessionId: string; imageUrl: string }) => {
    // gets the session
    const { sessionId, imageUrl } = payload;
    const session = sessions.get(sessionId);
    if (!session) return;

    // gets the two sockets, makes sure only the artist can send it
    const { artistSocket, viewerSocket } = session;
    if (artistSocket.id !== socket.id) {
      socket.emit("error_message", "Only artists can send images");
      return;
    }

    // send image to viewer
    viewerSocket.emit("receive_image", { imageUrl });
    console.log(
      `${socket.data.username} sent image to viewer in ${sessionId}`
    );
  });

  // request portfolio images from a remote machine via SSH/SFTP
  socket.on(
    "request_portfolio_images",
    async (
      payload: {
        ipAddress: string;
        username: string;
        password: string;
        directoryPath: string;
      },
      callback: (
        images: Array<{ filename: string; data: string; mimeType: string }>
      ) => void
    ) => {
      // retrieves the 4 things required
      const { ipAddress, username, password, directoryPath } = payload;

      console.log(
        `Fetching images over SFTP - IP: ${ipAddress}, User: ${username}, Dir: ${directoryPath}`
      );

      const sftp = new SFTPClient();

      try {
        // 1) connect to the user's machine
        await sftp.connect({
          host: ipAddress,
          port: 22, // adjust if you ever need a non-default SSH port
          username,
          password,
        });

        // 2) list files in the given directory (non-recursive)
        const entries = await sftp.list(directoryPath);
        const imageExtensions = [".jpg", ".jpeg", ".png", ".gif", ".webp"];

        const images: Array<{
          filename: string;
          data: string;
          mimeType: string;
        }> = [];

        for (const entry of entries) {
          // only regular files (type "-" in ssh2-sftp-client)
          if (entry.type !== "-") continue;

          const lowerName = entry.name.toLowerCase();
          if (!imageExtensions.some((ext) => lowerName.endsWith(ext))) continue;

          const baseDir = directoryPath.replace(/\/$/, "");
          const remotePath = `${baseDir}/${entry.name}`;

          // 3) fetch file as Buffer
          const fileBuffer = (await sftp.get(remotePath)) as Buffer;
          const base64Data = fileBuffer.toString("base64");

          // 4) infer MIME type from extension
          const ext = lowerName.split(".").pop() || "";
          const mimeTypes: { [key: string]: string } = {
            jpg: "image/jpeg",
            jpeg: "image/jpeg",
            png: "image/png",
            gif: "image/gif",
            webp: "image/webp",
          };
          const mimeType = mimeTypes[ext] || "image/jpeg";

          images.push({
            filename: entry.name,
            data: base64Data,
            mimeType,
          });
        }

        console.log(`Found ${images.length} remote images`);
        callback(images);
        console.log(
          `Sent ${images.length} portfolio images to ${socket.data.username}`
        );
      } catch (error) {
        console.error("Error fetching portfolio images over SFTP:", error);
        callback([]);
      } finally {
        // terminate the hanging connection
        try {
          await sftp.end();
        } catch {
          // ignore
        }
      }
    }
  );

  // user leaves main page (navigates away)
  socket.on("leave_main_page", () => {
    // delete them from the available viewers, though checks if they were even able to be deleted, cause it is also emitted
    // for artsists too even though theyu're not in availableViewers
    const result = availableViewers.delete(socket.id);
    console.log(`If socket was deleted: ${result}`)

    // broadcast updated online users list
    io.emit(
      "online_users",
      Array.from(availableViewers.values()).map((u) => ({
        socketId: u.socket.id,
        username: u.username,
      }))
    );

    console.log("user left main page:", socket.data.username);
  });

  // happens on any unhandled disconnect, like closign the tab
  socket.on("disconnect", () => {
    console.log("socket disconnected:", socket.id);

    // remove from online users and available viewers
    onlineUsers.delete(socket.id);
    availableViewers.delete(socket.id);

    // remove any pending requests from this user
    pendingRequests.delete(socket.id);

    // if in a session, end it
    for (const [sessionId, session] of sessions.entries()) {
      const { artistSocket, viewerSocket } = session;
      // makes sure one of the artist/viewer id's is the same as the one that just disconnected
      if (artistSocket.id === socket.id || viewerSocket.id === socket.id) {
        io.to(sessionId).emit("session_ended", { sessionId });
        try {
          artistSocket.leave(sessionId);
          viewerSocket.leave(sessionId);
        } catch {}
        sessions.delete(sessionId);
        console.log("session ended (user disconnected):", sessionId);
        break;
      }
    }

    // broadcast updated online users list
    io.emit(
      "online_users",
      Array.from(availableViewers.values()).map((u) => ({
        socketId: u.socket.id,
        username: u.username,
      }))
    );
  });
});

// actually activates the server listening at that port. Rn it's not configured in the env so it defaults to 3001
const PORT = Number(process.env.PS_PORT || process.env.PORT || 3001);
server.listen(PORT, () =>
  console.log(`Socket server listening on ${PORT}`)
);
