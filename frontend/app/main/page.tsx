"use client";

import { useEffect, useRef } from "react";
import { useRouter } from "next/navigation";
import { useUser } from "@clerk/nextjs";
import { getSocket } from "../lib/socket";

export default function MainPage() {
  const { user, isSignedIn } = useUser();
  const router = useRouter();

  useEffect(() => {
    const socket = getSocket(); // your socket.io wrapper

    socket.on("matched", (data: { sessionId: string }) => {
      sessionStorage.setItem("username", user?.username || "");
      router.push(`/session/${data.sessionId}`);
    });

    return () => {
      socket.off("matched");
    };
  }, [router, user]);

  const handleJoin = () => {
    if (!user) return;

    const username =
      user.username ??
      user.primaryEmailAddress?.emailAddress ??
      `user-${user.id}`;

    sessionStorage.setItem("username", username);

    const socket = getSocket();
    socket.emit("join_with_username", username);
  };

  if (!isSignedIn) {
    return <div>Please sign in.</div>;
  }

  return (
    <div className="flex min-h-screen items-center justify-center">
      <div className="p-6 rounded-xl bg-white dark:bg-black shadow">
        <h1 className="text-lg mb-4">
          Welcome {user.username ?? user.firstName}
        </h1>

        <button
          className="px-4 py-2 bg-black text-white rounded"
          onClick={handleJoin}
        >
          Join 10-second session
        </button>
      </div>
    </div>
  );
}
