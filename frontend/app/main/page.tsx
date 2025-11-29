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
  const [role, setRole] = useState<"artist" | "viewer" | null>(null);
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  const [incomingRequest, setIncomingRequest] = useState<ConnectionRequest | null>(null);
  const [targetUsername, setTargetUsername] = useState("");
  const [error, setError] = useState("");
  const [errorFading, setErrorFading] = useState(false);
  const [requestSent, setRequestSent] = useState(false);
  const [requestFading, setRequestFading] = useState(false);
  const [sendingRequest, setSendingRequest] = useState(false);
  const socketRef = useRef(getSocket());

  // Auto-clear error after 3 seconds with fade
  useEffect(() => {
    if (error) {
      setErrorFading(false);
      const fadeTimer = setTimeout(() => setErrorFading(true), 2700);
      const clearTimer = setTimeout(() => {
        setError("");
      }, 3000);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [error]);

  // Auto-clear request after 2 seconds with fade
  useEffect(() => {
    if (requestSent) {
      setRequestFading(false);
      const fadeTimer = setTimeout(() => setRequestFading(true), 1700);
      const clearTimer = setTimeout(() => {
        setRequestSent(false);
      }, 2000);
      return () => {
        clearTimeout(fadeTimer);
        clearTimeout(clearTimer);
      };
    }
  }, [requestSent]);

  useEffect(() => {
    const socket = socketRef.current;

    // join with username on load
    if (user && isSignedIn && role) {
      const username =
        user.username ??
        user.primaryEmailAddress?.emailAddress ??
        `user-${user.id}`;

      sessionStorage.setItem("username", username);
      sessionStorage.setItem("role", role);
      socket.emit("join_with_username", { username, role });
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
      router.push(`/session/${data.sessionId}`);
    });

    // connection was rejected
    socket.on("connection_rejected", (data: { recipientUsername: string }) => {
      setError(`${data.recipientUsername} rejected your request`);
    });

    // error message
    socket.on("error_message", (msg: string) => {
      setError(msg);
      setSendingRequest(false);
    });

    return () => {
      socket.emit("leave_main_page");
      socket.off("online_users");
      socket.off("connection_request");
      socket.off("matched");
      socket.off("connection_rejected");
      socket.off("error_message");
    };
  }, [router, user, isSignedIn, role]);

  const handleSendRequest = () => {
    const targetUser = onlineUsers.find(u => u.username === targetUsername);
    if (!targetUser) {
      setError("Artist not found");
      return;
    }

    const socket = socketRef.current;
    socket.emit("send_connection_request", targetUser.socketId);
    setTargetUsername("");
    setRequestSent(true);
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

  // Role selection screen
  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-gray-100">
        <div className="p-8 rounded-xl bg-white shadow-lg max-w-md w-full">
          <h1 className="text-2xl font-bold mb-6">Welcome {user?.username ?? user?.firstName}</h1>
          <p className="text-gray-600 mb-6">What's your role?</p>
          
          <div className="space-y-3">
            <button
              className="w-full px-4 py-3 bg-blue-600 text-white rounded hover:bg-blue-700 font-medium"
              onClick={() => setRole("artist")}
            >
              I'm an Artist - Show My Portfolio
            </button>
            <button
              className="w-full px-4 py-3 bg-green-600 text-white rounded hover:bg-green-700 font-medium"
              onClick={() => setRole("viewer")}
            >
              I'm a Viewer - Browse Portfolios
            </button>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className="flex min-h-screen items-center justify-center bg-gray-100">
      <div className="p-8 rounded-xl bg-white shadow-lg max-w-md w-full">
        <div className="flex items-center justify-between mb-6">
          <h1 className="text-2xl font-bold">
            Welcome {user?.username ?? user?.firstName}
          </h1>
          <button
            className="text-sm px-3 py-1 bg-gray-200 rounded hover:bg-gray-300"
            onClick={() => setRole(null)}
          >
            Change Role
          </button>
        </div>

        <div className="mb-6 p-3 bg-blue-50 rounded">
          <p className="text-sm font-medium text-blue-900">
            {role === "artist" ? "🎨 Showing Your Portfolio" : "👁️ Browsing Portfolios"}
          </p>
        </div>

        {role === "artist" ? (
          // Artist view
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Available Viewers</h2>
            <div className="flex gap-2 mb-4">
              <input
                type="text"
                placeholder="Enter viewer username..."
                value={targetUsername}
                onChange={(e) => setTargetUsername(e.target.value)}
                className="flex-1 px-3 py-2 border rounded bg-white"
                onKeyDown={(e) => e.key === "Enter" && handleSendRequest()}
              />
              <button
                className="px-4 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 disabled:bg-gray-400"
                onClick={handleSendRequest}
                disabled={sendingRequest}
              >
                Send
              </button>
            </div>

            {requestSent && (
              <div className={`p-3 bg-green-100 text-green-700 rounded mb-3 text-sm transition-opacity duration-300 ${requestFading ? 'opacity-0' : 'opacity-100'}`}>
                ✓ Request sent! Waiting for response...
              </div>
            )}

            <div className="text-sm text-gray-600 mb-3">
              <p className="font-medium mb-2">Online viewers:</p>
              <div className="space-y-1 max-h-32 overflow-y-auto">
                {onlineUsers.filter(u => u.username !== user?.username).length > 0 ? (
                  onlineUsers
                    .filter(u => u.username !== user?.username)
                    .map((u) => (
                      <div key={u.socketId} className="text-xs text-gray-500">
                        {u.username}
                      </div>
                    ))
                ) : (
                  <p className="text-xs text-gray-400">No viewers online</p>
                )}
              </div>
            </div>
          </div>
        ) : (
          // Viewer view
          <div className="mb-6">
            <h2 className="text-lg font-semibold mb-3">Available Artists</h2>
            <p className="text-sm text-gray-600 mb-4">
              Wait for artists to send you requests, or search for one below.
            </p>
            
            {incomingRequest ? (
              <p className="text-sm text-gray-500">You have a pending request above</p>
            ) : (
              <p className="text-sm text-gray-400">No pending requests</p>
            )}
          </div>
        )}

        {/* Incoming request section */}
        {incomingRequest && (
          <div className="mb-6 p-4 border-l-4 border-green-500 bg-green-50 rounded">
            <p className="font-medium mb-3">
              {incomingRequest.senderUsername} wants to show you their portfolio
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
          <div className={`p-3 bg-red-100 text-red-700 rounded mb-4 text-sm transition-opacity duration-300 ${errorFading ? 'opacity-0' : 'opacity-100'}`}>
            {error}
          </div>
        )}
      </div>
    </div>
  );
}