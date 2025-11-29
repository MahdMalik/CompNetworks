"use client";

import { useEffect, useRef, useState } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { getSocket } from "../lib/socket";

type OnlineUser = {
  socketId: string;
  username: string;
};

type ConnectionRequest = {
  senderId: string;
  senderUsername: string;
};

export default function MainPage() {
  const { user, isSignedIn } = useUser();
  const router = useRouter();
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [incomingRequest, setIncomingRequest] = useState<ConnectionRequest | null>(null);
  const [targetUsername, setTargetUsername] = useState("");
  const [error, setError] = useState("");
  const socketRef = useRef(getSocket());

  useEffect(() => {
    const socket = socketRef.current;

    // join with username on load
    if (user && isSignedIn) {
      const username =
        user.username ??
        user.primaryEmailAddress?.emailAddress ??
        `user-${user.id}`;

      sessionStorage.setItem("username", username);
      socket.emit("join_with_username", username);
    }

    // receive updated online users list
    socket.on("online_users", (users: OnlineUser[]) => {
      setOnlineUsers(users);
    });

    // receive incoming connection request
    socket.on("connection_request", (req: ConnectionRequest) => {
      setIncomingRequest(req);
      setError("");
    });

    // matched and ready for session
    socket.on("matched", (data: { sessionId: string }) => {
      sessionStorage.setItem("username", user?.username || "");
      router.push(`/session/${data.sessionId}`);
    });

    // connection was rejected
    socket.on("connection_rejected", (data: { recipientUsername: string }) => {
      setError(`${data.recipientUsername} rejected your request`);
    });

    // error message
    socket.on("error_message", (msg: string) => {
      setError(msg);
    });

    return () => {
      socket.emit("leave_main_page");
      socket.off("online_users");
      socket.off("connection_request");
      socket.off("matched");
      socket.off("connection_rejected");
      socket.off("error_message");
    };
  }, [router, user, isSignedIn]);

  const handleSendRequest = () => {
    const targetUser = onlineUsers.find(u => u.username === targetUsername);
    if (!targetUser) {
      setError("User not found");
      return;
    }

    const socket = socketRef.current;
    socket.emit("send_connection_request", targetUser.socketId);
    setTargetUsername("");
  };

  const handleAcceptRequest = () => {
    if (!incomingRequest) return;

    const socket = socketRef.current;
    socket.emit("accept_connection_request", incomingRequest.senderId);
    setIncomingRequest(null);
  };

  const handleRejectRequest = () => {
    if (!incomingRequest) return;

    const socket = socketRef.current;
    socket.emit("reject_connection_request", incomingRequest.senderId);
    setIncomingRequest(null);
  };

  if (!isSignedIn) {
    return <div>Please sign in.</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="p-8 rounded-xl bg-white shadow-lg max-w-md w-full">
        <h1 className="text-2xl font-bold mb-6">
          Welcome {user?.username ?? user?.firstName}
        </h1>

        {/* Send request section */}
        <div className="mb-6">
          <h2 className="text-lg font-semibold mb-3">Connect with someone</h2>
          <div className="flex gap-2 mb-4">
            <input
              type="text"
              placeholder="Enter username..."
              value={targetUsername}
              onChange={(e) => setTargetUsername(e.target.value)}
              className="flex-1 px-3 py-2 border rounded bg-white"
              onKeyDown={(e) => e.key === "Enter" && handleSendRequest()}
            />
            <button
              className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700"
              onClick={handleSendRequest}
            >
              Send
            </button>
          </div>

          {/* Online users list */}
          <div className="text-sm text-gray-600 mb-3">
            <p className="font-medium mb-2">Online users:</p>
            <div className="space-y-1 max-h-32 overflow-y-auto">
              {onlineUsers.length > 0 ? (
                onlineUsers.map((u) => (
                  <div key={u.socketId} className="text-xs text-gray-500">
                    {u.username}
                  </div>
                ))
              ) : (
                <p className="text-xs text-gray-400">None online</p>
              )}
            </div>
          </div>
        </div>

        {/* Incoming request section */}
        {incomingRequest && (
          <div className="mb-6 p-4 border-l-4 border-green-500 bg-green-50 rounded">
            <p className="font-medium mb-3">
              {incomingRequest.senderUsername} wants to connect
            </p>
            <div className="flex gap-2">
              <button
                className="flex-1 px-3 py-2 bg-green-600 text-white rounded hover:bg-green-700"
                onClick={handleAcceptRequest}
              >
                Accept
              </button>
              <button
                className="flex-1 px-3 py-2 bg-gray-400 text-white rounded hover:bg-gray-500"
                onClick={handleRejectRequest}
              >
                Reject
              </button>
            </div>
          </div>
        )}

        {/* Error message */}
        {error && (
          <div className="p-3 bg-red-100 text-red-700 rounded mb-4 text-sm">
            {error}
          </div>
        )}
      </div>
    </div>
  );
}