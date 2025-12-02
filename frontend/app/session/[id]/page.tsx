"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { getSocket } from "../../lib/socket";

export default function SessionPage() {
    const router = useRouter();
    const params = useParams();
    const sessionId = params?.id || "";
    const svgRef = useRef<SVGSVGElement>(null);
    const [role, setRole] = useState<"artist" | "viewer" | null>(null);
    const [otherUsername, setOtherUsername] = useState<string | null>(null);
    const [portfolioImages, setPortfolioImages] = useState<string[]>([]);
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    const [loadingImages, setLoadingImages] = useState(false);
    const [viewerImage, setViewerImage] = useState<string | null>(null);

    // detect strict mode mount
    const effectRan = useRef(false);

    // Initialize particle animation
    useEffect(() => {
        const el = svgRef.current;
        if (!el) return;

        const particles: Array<{ x: number; y: number; vx: number; vy: number }> = [];
        const particleCount = 120;
        
        for (let i = 0; i < particleCount; i++) {
          particles.push({
            x: Math.random() * el.clientWidth,
            y: Math.random() * el.clientHeight,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
          });
        }

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

        // Signal that this client is ready to receive session_start
        socket.emit("session_page_ready", sessionId);

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

        // viewer receives image from artist
        socket.on("receive_image", (data: { imageUrl: string }) => {
            setViewerImage(data.imageUrl);
        });

        return () => {
            socket.emit("leave_main_page");
            socket.off("rejoined");
            socket.off("matched");
            socket.off("partner_left");
            socket.off("session_ended");
            socket.off("error_message");
            socket.off("receive_image");
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

    const handleSelectImage = (imageUrl: string) => {
        setSelectedImage(imageUrl);
        // Send image to viewer through socket
        const socket = getSocket();
        socket.emit("send_image", { sessionId, imageUrl });
    };

    return (
        <main className="flex min-h-screen items-center justify-center p-8 font-sans relative overflow-hidden bg-gradient-to-br from-purple-950 via-slate-950 to-purple-900">
            <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none" ref={svgRef} />
            
            <div className="relative z-10 w-full max-w-2xl">
                <div className="rounded-xl bg-white dark:bg-slate-900 shadow-2xl dark:shadow-xl border-2 border-purple-300 dark:border-purple-700 transition-all duration-300 hover:scale-105 hover:[box-shadow:0_0_50px_rgba(239,68,68,0.5)] p-8">
                    <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-700 to-red-600 bg-clip-text text-transparent">Session: {sessionId}</h1>

                    {role && (
                        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/40 dark:to-purple-900/40 rounded-lg border border-purple-200 dark:border-purple-800">
                            <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                                {role === "artist" ? "🎨 You're Showing Your Portfolio" : "👁️ You're Viewing a Portfolio"}
                            </p>
                        </div>
                    )}

                    {otherUsername ? (
                        <>
                            {role === "artist" ? (
                                <div className="mb-6">
                                    <p className="text-lg mb-4 text-gray-900 dark:text-white">Showing portfolio to: <span className="font-bold bg-gradient-to-r from-purple-600 to-red-600 bg-clip-text text-transparent">{otherUsername}</span></p>
                                    <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/40 dark:to-purple-900/40 rounded-lg min-h-[300px] flex items-center justify-center mb-6 border-2 border-purple-200 dark:border-purple-800">
                                        {selectedImage ? (
                                            <img src={selectedImage} alt="Selected portfolio" className="max-h-[300px] max-w-full object-contain rounded-lg shadow-lg" />
                                        ) : (
                                            <div className="text-center">
                                                <p className="text-gray-600 dark:text-gray-300 mb-2 text-lg">📸 Your Portfolio</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">(Select an image below)</p>
                                            </div>
                                        )}
                                    </div>

                                    {/* Portfolio Images Sidebar */}
                                    <div className="bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/40 dark:to-purple-900/40 rounded-lg p-4 border-2 border-purple-200 dark:border-purple-800">
                                        {portfolioImages.length === 0 ? (
                                            <button
                                                className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/50 text-sm font-medium disabled:bg-gray-400 transition-all"
                                                onClick={handleGetImages}
                                                disabled={loadingImages}
                                            >
                                                {loadingImages ? "Loading..." : "Get Images"}
                                            </button>
                                        ) : (
                                            <>
                                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">Portfolio Images:</p>
                                                <div className="flex gap-3 overflow-x-auto pb-2">
                                                    {portfolioImages.map((image, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => handleSelectImage(image)}
                                                            className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden transition-all ${
                                                                selectedImage === image
                                                                    ? "border-red-500 ring-2 ring-red-300 dark:ring-red-700 shadow-lg"
                                                                    : "border-purple-300 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-600"
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
                                    <p className="text-lg mb-4 text-gray-900 dark:text-white">Viewing portfolio from: <span className="font-bold bg-gradient-to-r from-purple-600 to-red-600 bg-clip-text text-transparent">{otherUsername}</span></p>
                                    <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/40 dark:to-purple-900/40 rounded-lg min-h-[300px] flex items-center justify-center border-2 border-purple-200 dark:border-purple-800">
                                        {viewerImage ? (
                                            <img src={viewerImage} alt="Artist portfolio" className="max-h-[300px] max-w-full object-contain rounded-lg shadow-lg" />
                                        ) : (
                                            <div className="text-center">
                                                <p className="text-gray-600 dark:text-gray-300 mb-2 text-lg">🖼️ {otherUsername}'s Portfolio</p>
                                                <p className="text-sm text-gray-500 dark:text-gray-400">(Waiting for images...)</p>
                                            </div>
                                        )}
                                    </div>
                                </div>
                            )}
                        </>
                    ) : (
                        <p className="text-center text-gray-600 dark:text-gray-300 py-8">Waiting to connect...</p>
                    )}

                    <div className="mt-8 flex justify-center">
                        <button
                            className="px-6 py-3 bg-gradient-to-r from-red-600 to-red-700 text-white rounded-lg hover:shadow-lg hover:shadow-red-500/50 font-medium transition-all"
                            onClick={handleLeave}
                        >
                            Leave Session
                        </button>
                    </div>
                </div>
            </div>
        </main>
    );
}