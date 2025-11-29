"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { getSocket } from "../../lib/socket";

export default function SessionPage() {
    const router = useRouter();
    const params = useParams();
    const sessionId = params?.id || "";
    const [partnerNames, setPartnerNames] = useState<string[] | null>(null);
    const [timeLeft, setTimeLeft] = useState<number | null>(null);
    const timerRef = useRef<number | null>(null);

    // detect strict mode mount
    const effectRan = useRef(false);

    useEffect(() => {
        // In dev mode, skip first mount (React StrictMode)
        if (process.env.NODE_ENV === "development" && !effectRan.current) {
            effectRan.current = true;
            console.log("Skipping first strict-mode run in dev");
            return;
        }

        console.log("Effect running normally");
        const socket = getSocket();
        const username = sessionStorage.getItem("username");

        if (!username) {
            alert("Username missing; returning to home.");
            router.push("/");
            return;
        }

        const joinedKey = `joined_${sessionId}`;
        const hasJoined = sessionStorage.getItem(joinedKey);

        if (hasJoined) {
            // This is a genuine rejoin
            socket.emit("rejoin_session", { sessionId, username });
        } else {
            // First time on this session page
            sessionStorage.setItem(joinedKey, "true");
        }

        socket.on("rejoined", () => console.log("rejoined session"));

        socket.on("session_start", (data: { sessionId: string; users: string[] }) => {
            if (!username) return;
            setPartnerNames(data.users.filter((u) => u !== username));
            setTimeLeft(10);
            console.log("Session started with:", data.users);
        });

        socket.on("session_ended", () => {
            console.log("Ending session!");
            setTimeLeft(0);
            setTimeout(() => router.push("/"), 1000);
        });

        socket.on("error_message", (msg: string) => {
            alert(msg);
            router.push("/");
        });

        return () => {
            socket.off("rejoined");
            socket.off("matched");
            socket.off("session_ended");
            socket.off("error_message");
        };
    }, [router, sessionId]);

    useEffect(() => {
        if (timeLeft === null || timeLeft <= 0) return;

        timerRef.current = window.setInterval(() => {
            setTimeLeft((t) => {
                if (t === null) return null;
                if (t <= 1) {
                    if (timerRef.current) clearInterval(timerRef.current);
                    return 0;
                }
                return t - 1;
            });
        }, 1000);

        return () => {
            if (timerRef.current) clearInterval(timerRef.current);
        };
    }, [timeLeft]);

    return (
        <main className="flex min-h-screen items-center justify-center p-8">
            <div className="w-full max-w-lg text-center">
                <h1 className="text-2xl font-bold mb-4">Session: {sessionId}</h1>

                {partnerNames ? (
                    <>
                        <p>You are connected with: {partnerNames.join(", ")}</p>
                        <p className="mt-4">Time left: {timeLeft ?? "—"}s</p>
                    </>
                ) : (
                    <p>Waiting for other user to connect...</p>
                )}

                <div className="mt-6">
                    <button
                        className="px-4 py-2 bg-gray-300 rounded"
                        onClick={() => router.push("/")}
                    >
                        Leave
                    </button>
                </div>
            </div>
        </main>
    );
}
