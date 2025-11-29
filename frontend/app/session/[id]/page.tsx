"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { getSocket } from "../../lib/socket";

export default function SessionPage() {
    const router = useRouter();
    const params = useParams();
    const sessionId = params?.id || "";
    const [role, setRole] = useState<"artist" | "viewer" | null>(null);
    const [otherUsername, setOtherUsername] = useState<string | null>(null);
    const [portfolioImages, setPortfolioImages] = useState<string[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [loadingImages, setLoadingImages] = useState(false);

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
        const userRole = sessionStorage.getItem("role") as "artist" | "viewer" | null;

        if (!username || !userRole) {
            alert("Session info missing; returning to home.");
            router.push("/");
            return;
        }

        setRole(userRole);

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

        socket.on("session_start", (data: { sessionId: string; artistName: string; viewerName: string }) => {
            if (!username) return;
            
            if (userRole === "artist") {
                setOtherUsername(data.viewerName);
            } else {
                setOtherUsername(data.artistName);
            }
            
            console.log("Session started:", data);
        });

        socket.on("partner_left", () => {
            alert("Your partner has left the session");
            setTimeout(() => router.push("/"), 500);
        });

        socket.on("session_ended", () => {
            console.log("Session ended!");
            setTimeout(() => router.push("/"), 1000);
        });

        socket.on("error_message", (msg: string) => {
            alert(msg);
            router.push("/");
        });

        return () => {
            socket.emit("leave_main_page");
            socket.off("rejoined");
            socket.off("matched");
            socket.off("partner_left");
            socket.off("session_ended");
            socket.off("error_message");
        };
    }, [router, sessionId]);

    const handleLeave = () => {
        const socket = getSocket();
        socket.emit("leave_session", sessionId);
        router.push("/");
    };

    const handleGetImages = async () => {
        setLoadingImages(true);
        try {
            const response = await fetch("/api/portfolio-images");
            const data = await response.json();
            setPortfolioImages(data.images || []);
        } catch (error) {
            console.error("Failed to load portfolio images:", error);
        }
        setLoadingImages(false);
    };

    return (
        <main className="flex min-h-screen items-center justify-center p-8">
            <div className="w-full max-w-lg text-center">
                <h1 className="text-2xl font-bold mb-4">Session: {sessionId}</h1>

                {role && (
                    <div className="mb-4 p-3 bg-blue-50 rounded">
                        <p className="text-sm font-medium text-blue-900">
                            {role === "artist" ? "🎨 You're Showing Your Portfolio" : "👁️ You're Viewing a Portfolio"}
                        </p>
                    </div>
                )}

                {otherUsername ? (
                    <>
                        {role === "artist" ? (
                            <div className="mb-6">
                                <p className="text-lg mb-4">Showing portfolio to: <span className="font-bold">{otherUsername}</span></p>
                                <div className="p-4 bg-gray-100 rounded min-h-[300px] flex items-center justify-center mb-4">
                                    {selectedImage ? (
                                        <img src={selectedImage} alt="Selected portfolio" className="max-h-[300px] max-w-full object-contain" />
                                    ) : (
                                        <div className="text-center">
                                            <p className="text-gray-600 mb-2">📸 Your Portfolio</p>
                                            <p className="text-sm text-gray-500">(Select an image below)</p>
                                        </div>
                                    )}
                                </div>

                                {/* Portfolio Images Sidebar */}
                                <div className="bg-gray-50 rounded p-3 border">
                                    {portfolioImages.length === 0 ? (
                                        <button
                                            className="w-full px-3 py-2 bg-blue-600 text-white rounded hover:bg-blue-700 text-sm font-medium disabled:bg-gray-400"
                                            onClick={handleGetImages}
                                            disabled={loadingImages}
                                        >
                                            {loadingImages ? "Loading..." : "Get Images"}
                                        </button>
                                    ) : (
                                        <>
                                            <p className="text-xs font-medium text-gray-700 mb-2">Portfolio Images:</p>
                                            <div className="flex gap-2 overflow-x-auto pb-2">
                                                {portfolioImages.map((image, idx) => (
                                                    <button
                                                        key={idx}
                                                        onClick={() => setSelectedImage(image)}
                                                        className={`flex-shrink-0 w-16 h-16 rounded border-2 overflow-hidden transition-all ${
                                                            selectedImage === image
                                                                ? "border-blue-500 ring-2 ring-blue-300"
                                                                : "border-gray-300 hover:border-gray-400"
                                                        }`}
                                                    >
                                                        <img
                                                            src={image}
                                                            alt={`Portfolio ${idx}`}
                                                            className="w-full h-full object-cover"
                                                        />
                                                    </button>
                                                ))}
                                            </div>
                                        </>
                                    )}
                                </div>
                            </div>
                        ) : (
                            <div className="mb-6">
                                <p className="text-lg mb-4">Viewing portfolio from: <span className="font-bold">{otherUsername}</span></p>
                                <div className="p-4 bg-gray-100 rounded min-h-[300px] flex items-center justify-center">
                                    <div className="text-center">
                                        <p className="text-gray-600 mb-2">🖼️ {otherUsername}'s Portfolio</p>
                                        <p className="text-sm text-gray-500">(Waiting for images...)</p>
                                    </div>
                                </div>
                            </div>
                        )}
                    </>
                ) : (
                    <p>Waiting to connect...</p>
                )}

                <div className="mt-6">
                    <button
                        className="px-4 py-2 bg-gray-300 rounded hover:bg-gray-400"
                        onClick={handleLeave}
                    >
                        Leave Session
                    </button>
                </div>
            </div>
        </main>
    );
}