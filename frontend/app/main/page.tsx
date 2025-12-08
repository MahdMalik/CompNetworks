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

//the main page where people can connect to each other via the server acting as a middleman
export default function MainPage() {
  
  // gets user info
  const { user, isSignedIn } = useUser();
  // router used for navigation
  const router = useRouter();
  const svgRef = useRef<SVGSVGElement>(null);
  // sets the role of the user
  const [role, setRole] = useState<"artist" | "viewer" | null>(null);
  // list of all online users currently to display to the artist
  const [onlineUsers, setOnlineUsers] = useState<OnlineUser[]>([]);
  // if the user has an incoming request
  const [incomingRequest, setIncomingRequest] = useState<ConnectionRequest | null>(null);
  // the username that the artist is planning to send  to
  const [targetUsername, setTargetUsername] = useState("");
  // sets any error
  const [error, setError] = useState("");
  //set if the error should be fading away
  const [errorFading, setErrorFading] = useState(false);
  // set if a request has been sent
  const [requestSent, setRequestSent] = useState(false);
  // set if the request confirmation should be fading
  const [requestFading, setRequestFading] = useState(false);
  // set if they're sending a request
  const [sendingRequest, setSendingRequest] = useState(false);
  const socketRef = useRef(getSocket());

  // Initialize particle animation. Mainly frontend stuff using the library for particles
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    // list of all the aprticles
    const particles: Array<{ x: number; y: number; vx: number; vy: number }> = [];
    const particleCount = 120;
    
    // set particle position and speed
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * el.clientWidth,
        y: Math.random() * el.clientHeight,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      });
    }

    // animate it by moving the pixels, connectiong them if they close, etc
    const animate = () => {
      const svg = el;
      svg.innerHTML = '';
      
      particles.forEach((p, i) => {
        p.x += p.vx;
        p.y += p.vy;
        
        if (p.x < 0) p.x = svg.clientWidth;
        if (p.x > svg.clientWidth) p.x = 0;
        if (p.y < 0) p.y = svg.clientHeight;
        if (p.y > svg.clientHeight) p.y = 0;

        particles.forEach((p2, j) => {
          if (i !== j) {
            const dx = p2.x - p.x;
            const dy = p2.y - p.y;
            const dist = Math.sqrt(dx * dx + dy * dy);
            
            if (dist < 120) {
              const line = document.createElementNS('http://www.w3.org/2000/svg', 'line');
              line.setAttribute('x1', String(p.x));
              line.setAttribute('y1', String(p.y));
              line.setAttribute('x2', String(p2.x));
              line.setAttribute('y2', String(p2.y));
              line.setAttribute('stroke', '#c084fc');
              line.setAttribute('stroke-opacity', String((1 - dist / 120) * 0.3));
              line.setAttribute('stroke-width', '0.5');
              svg.appendChild(line);
            }
          }
        });

        // the circle representing each dot
        const circle = document.createElementNS('http://www.w3.org/2000/svg', 'circle');
        circle.setAttribute('cx', String(p.x));
        circle.setAttribute('cy', String(p.y));
        circle.setAttribute('r', '3');
        circle.setAttribute('fill', '#ef4444');
        circle.setAttribute('opacity', '0.7');
        svg.appendChild(circle);
      });

      requestAnimationFrame(animate);
    };

    animate();
  }, []);

  // Auto-clear error after 3 seconds with fade
  useEffect(() => {
    // happens when there's any error. Set no fading, wait for some time to set it to fading, and then clear it fully
    if (error) {
      setErrorFading(false);
      const fadeTimer = setTimeout(() => setErrorFading(true), 2700);
      const clearTimer = setTimeout(() => {
        // actually clears it
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
    // first set fadign to not true, set it to true 1.7 seconds after, then clear after 2 seconds
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

  // does fun socket stuff
  useEffect(() => {
    // makes sure the socket ocnnection is possible, outside breaks out
    if(socketRef === null)
    {
      return;
    }
    const socket = socketRef.current;
    if(socket === null)
    {
      return;
    }

    // when the user exists and they try to get a role (artist or viewer), then set it in session storage and send that to the socket
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

    // matched and ready for session. Log time for latency debugging, then send them to the session page
    socket.on("matched", (data: { sessionId: string }) => {
      const now = Date.now();
      console.log(`CURRENT TIME IS ${now}`)

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

    // cleanup basically to emit that they're leaving the main page, then disabling the listening
    return () => {
      socket.emit("leave_main_page");
      socket.off("online_users");
      socket.off("connection_request");
      socket.off("matched");
      socket.off("connection_rejected");
      socket.off("error_message");
    };
  }, [router, user, isSignedIn, role]);

  // when the artist wants to send a request to the viewer, run this function
  const handleSendRequest = () => {
    // get the target user from the set target username
    const targetUser = onlineUsers.find(u => u.username === targetUsername);
    // if the other user doesn't exist, return error
    if (!targetUser) {
      setError("Artist not found");
      return;
    }

    // make sure a socket connection exists first
    if(socketRef === null)
    {
      return;
    }

    const socket = socketRef.current;

    if(socket === null)
    {
      return;
    }

    // now emit connection request to that socket id
    socket.emit("send_connection_request", targetUser.socketId);
    setTargetUsername("");
    // set this to true to display confirmation of request being sent
    setRequestSent(true);
  };

  // when user is a viewer and accepts a request from an artist, want to send that they've accepted it it and
  // with the sender they've accepted
  const handleAcceptRequest = () => {
    // for latency debugging
    const now = Date.now();
    console.log(`CURRENT TIME IS ${now}`)

    // if no incoming request, shouldn't be running this
    if (!incomingRequest) return;

    // make sure there's a socket
    if(socketRef === null)
    {
      return;
    }

    const socket = socketRef.current;

    if(socket === null)
    {
      return;
    }
    
    // send that they've accepted that sender's request
    socket.emit("accept_connection_request", incomingRequest.senderId);
    // delete the incmoing request
    setIncomingRequest(null);
  };

  // handles when a viewer rejects a request from an artist
  const handleRejectRequest = () => {
    // check if there even is a request
    if (!incomingRequest) return;

    // check to make sure the socket connection exists
    if(socketRef === null)
    {
      return;
    }

    const socket = socketRef.current;

    if(socket === null)
    {
      return;
    }
    
    // sends message to server of rejecting that sender
    socket.emit("reject_connection_request", incomingRequest.senderId);
    setIncomingRequest(null);
  };

  // if they're not signed in, send them back to the main page
  if (!isSignedIn) {
    router.push("/")
  }

  // Role selection screen, to let them select between an artist or viewer
  if (!role) {
    return (
      <div className="flex min-h-screen items-center justify-center font-sans relative overflow-hidden bg-gradient-to-br from-purple-950 via-slate-950 to-purple-900">
        <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none" ref={svgRef} />
        
        <div className="relative z-10">
          <div className="p-8 rounded-xl bg-white dark:bg-slate-900 shadow-2xl dark:shadow-xl max-w-md w-full border-2 border-purple-300 dark:border-purple-700 transition-all duration-300 hover:scale-105 hover:[box-shadow:0_0_50px_rgba(239,68,68,0.5)]">
            <h1 className="text-2xl font-bold mb-6 bg-gradient-to-r from-purple-700 to-red-600 bg-clip-text text-transparent">Welcome {user?.username ?? user?.firstName}</h1>
            <p className="text-gray-600 dark:text-gray-300 mb-6 font-medium">What's your role?</p>
            
            {/* The buttons to set the role of artist or viewer for them */}
            <div className="space-y-3">
              <button
                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/50 font-medium transition-all"
                onClick={() => setRole("artist")}
              >
                🎨 I'm an Artist - Show My Portfolio
              </button>
              <button
                className="w-full px-4 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:shadow-lg hover:shadow-red-500/50 font-medium transition-all"
                onClick={() => setRole("viewer")}
              >
                👁️ I'm a Viewer - Browse Portfolios
              </button>
            </div>
          </div>
        </div>
      </div>
    );
  }

  // the display page after a role is selected
  return (
    <div className="flex min-h-screen items-center justify-center font-sans relative overflow-hidden bg-gradient-to-br from-purple-950 via-slate-950 to-purple-900">
      <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none" ref={svgRef} />
      
      <div className="relative z-10">
        <div className="p-8 rounded-xl bg-white dark:bg-slate-900 shadow-2xl dark:shadow-xl max-w-md w-full border-2 border-purple-300 dark:border-purple-700 transition-all duration-300 hover:scale-105 hover:[box-shadow:0_0_50px_rgba(239,68,68,0.5)]">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold bg-gradient-to-r from-purple-700 to-red-600 bg-clip-text text-transparent">
              Welcome {user?.username ?? user?.firstName}
            </h1>
            {/* Lets them switch their role */}
            <button
              className="text-sm px-3 py-1 bg-purple-100 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded hover:bg-purple-200 dark:hover:bg-purple-900 transition"
              onClick={() => setRole(null)}
            >
              Change Role
            </button>
          </div>

          <div className="mb-6 p-3 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/40 dark:to-purple-900/40 rounded-lg border border-purple-200 dark:border-purple-800">
            <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
              {role === "artist" ? "🎨 Showing Your Portfolio" : "👁️ Browsing Portfolios"}
            </p>
          </div>

          {/* This basically display the stuff for the artist, like who's available and who can send a request */}
          {role === "artist" ? (
            // Artist view
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Available Viewers</h2>
              <div className="flex gap-2 mb-4">
                {/* This lets the user set the target username, and upon pressing the button send teh request to them */}
                <input
                  type="text"
                  placeholder="Enter viewer username..."
                  value={targetUsername}
                  onChange={(e) => setTargetUsername(e.target.value)}
                  className="flex-1 px-3 py-2 border border-purple-300 dark:border-purple-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-400 dark:placeholder-gray-500 focus:outline-none focus:ring-2 focus:ring-purple-500"
                  onKeyDown={(e) => e.key === "Enter" && handleSendRequest()}
                />
                <button
                  className="px-4 py-2 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/50 disabled:bg-gray-400 font-medium transition-all"
                  onClick={handleSendRequest}
                  disabled={sendingRequest}
                >
                  Send
                </button>
              </div>

              {/* After sending the request, for a brief bit display the confirmation of such */}
              {requestSent && (
                <div className={`p-3 bg-green-100 dark:bg-green-950/40 text-green-700 dark:text-green-200 rounded-lg mb-3 text-sm transition-opacity duration-300 border border-green-300 dark:border-green-800 ${requestFading ? 'opacity-0' : 'opacity-100'}`}>
                  ✓ Request sent! Waiting for response...
                </div>
              )}

              {/* This displays all online users, not including the current user, and also only if they're a viewer */}
              <div className="text-sm text-gray-600 dark:text-gray-300 mb-3">
                <p className="font-medium mb-2">Online viewers:</p>
                <div className="space-y-1 max-h-32 overflow-y-auto bg-purple-50 dark:bg-purple-950/30 p-2 rounded-lg border border-purple-200 dark:border-purple-800">
                  {onlineUsers.length > 0 ? (
                    onlineUsers
                      .map((u) => (
                        <div key={u.socketId} className="text-xs text-gray-600 dark:text-gray-400 px-2 py-1">
                          • {u.username}
                        </div>
                      ))
                  ) : (
                    <p className="text-xs text-gray-400 dark:text-gray-500 px-2 py-1">No viewers online</p>
                  )}
                </div>
              </div>
            </div>
          ) : (
            // Viewer side view
            <div className="mb-6">
              <h2 className="text-lg font-semibold mb-3 text-gray-900 dark:text-white">Available Artists</h2>
              <p className="text-sm text-gray-600 dark:text-gray-300 mb-4">
                Wait for artists to send you requests, or search for one below.
              </p>
              
              {/* If they have a reviewer request, notify them of such */}
              {incomingRequest ? (
                <p className="text-sm text-purple-600 dark:text-purple-300 font-medium">You have a pending request above</p>
              ) : (
                <p className="text-sm text-gray-400 dark:text-gray-500">No pending requests</p>
              )}
            </div>
          )}

          {/* Incoming request section. Gives 2 buttons to either accept or reject */}
          {incomingRequest && (
            <div className="mb-6 p-4 border-l-4 border-red-600 bg-red-50 dark:bg-red-950/40 rounded-lg">
              <p className="font-medium mb-3 text-red-900 dark:text-red-100">
                {incomingRequest.senderUsername} wants to show you their portfolio
              </p>
              <div className="flex gap-2">
                <button
                  className="flex-1 px-3 py-2 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:shadow-lg hover:shadow-red-500/50 font-medium transition-all"
                  onClick={handleAcceptRequest}
                >
                  Accept
                </button>
                <button
                  className="flex-1 px-3 py-2 bg-purple-200 dark:bg-purple-900/50 text-purple-700 dark:text-purple-300 rounded-lg hover:bg-purple-300 dark:hover:bg-purple-900 font-medium transition-all"
                  onClick={handleRejectRequest}
                >
                  Reject
                </button>
              </div>
            </div>
          )}

          {/* Error message */}
          {error && (
            <div className={`p-3 bg-red-100 dark:bg-red-950/40 text-red-700 dark:text-red-200 rounded-lg mb-4 text-sm transition-opacity duration-300 border border-red-300 dark:border-red-800 ${errorFading ? 'opacity-0' : 'opacity-100'}`}>
              {error}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}