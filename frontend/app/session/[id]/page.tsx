"use client";

import { useRouter, useParams } from "next/navigation";
import { useEffect, useState, useRef } from "react";
import { getSocket } from "../../lib/socket";

export default function SessionPage() {
    // the router used for page navigation
    const router = useRouter();

    // any parameters sent with the url link, primarily just used to get the session id
    const params = useParams();
    // the session id retrieved from the url parameters
    const sessionId = params?.id || "";
    const svgRef = useRef<SVGSVGElement>(null);
    // one of the two roles possible
    const [role, setRole] = useState<"artist" | "viewer" | null>(null);
    // the other user in the session
    const [otherUsername, setOtherUsername] = useState<string | null>(null);
    // the portfolio images retrieved by the artist
    const [portfolioImages, setPortfolioImages] = useState<Array<{ filename: string; data: string; mimeType: string }>>([]);
    // the current image selected to display to the viewer
    const [selectedImage, setSelectedImage] = useState<string | null>(null);
    // if images are loaded
    const [loadingImages, setLoadingImages] = useState(false);

    //these 4 are used on the artist side to retrieve the images from their remote linux server
    const [ipAddress, setIpAddress] = useState("");
    const [portUsername, setPortUsername] = useState("");
    const [portPassword, setPortPassword] = useState("");
    const [directoryPath, setDirectoryPath] = useState("");

    // detect strict mode mount
    const effectRan = useRef(false);

    // Initialize particle animation
    useEffect(() => {
        const el = svgRef.current;
        if (!el) return;

        // generate the array of particles
        const particles: Array<{ x: number; y: number; vx: number; vy: number }> = [];
        const particleCount = 120;
        
        // generate te particle position and starting velocities
        for (let i = 0; i < particleCount; i++) {
          particles.push({
            x: Math.random() * el.clientWidth,
            y: Math.random() * el.clientHeight,
            vx: (Math.random() - 0.5) * 2,
            vy: (Math.random() - 0.5) * 2,
          });
        }
        
        // animate particles by having them move in their direction, connecting them if they're a close enough distance
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

            // create the dots
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
        // make sure socket exists
        if(socket === null)
        {
            return;
        }

        // before we stored the username and role in session storage, now retrive them
        const username = sessionStorage.getItem("username");
        const userRole = sessionStorage.getItem("role") as "artist" | "viewer" | null;

        if (!username || !userRole) {
            alert("Session info missing; returning to home.");
            router.push("/");
            return;
        }

        // set their role here
        setRole(userRole);

        const joinedKey = `joined_${sessionId}`;
        // basically determines fi they've already joined before from session storage since that's persistent across refereshes and re-renders
        const hasJoined = sessionStorage.getItem(joinedKey);

        // notify them that they've rejoined
        if (hasJoined) {
            // This is a genuine rejoin
            socket.emit("rejoin_session", { sessionId, username });
        } else {
            // First time on this session page
            sessionStorage.setItem(joinedKey, "true");
        }

        // when they receive a signal from the server they've rejoined, just log it for now
        socket.on("rejoined", () => console.log("rejoined session"));

        // Signal that this client is ready to receive session_start
        socket.emit("session_page_ready", sessionId);

        // runs all of this as the session starts, after they've fully traveled to this page
        socket.on("session_start", (data: { sessionId: string; artistName: string; viewerName: string }) => {
            if (!username) return;
            
            // from the user role retrieved froms ssion storage, sets the roles
            if (userRole === "artist") {
                setOtherUsername(data.viewerName);
            } else {
                setOtherUsername(data.artistName);
            }
            
            console.log("Session started:", data);
        });

        // when the partner leaves, inform them via an alert and then send them back to the homepage
        socket.on("partner_left", () => {
            alert("Your partner has left the session");
            setTimeout(() => router.push("/"), 500);
        });

        // when the session ends otherwise (such as through a socket disconnect), notify them and then send them back to the homepage
        socket.on("session_ended", () => {
            alert("Session ended!");
            setTimeout(() => router.push("/"), 1000);
        });

        // when there's an error uncaught, alert them of such and send them back to the main page
        socket.on("error_message", (msg: string) => {
            alert(msg);
            router.push("/");
        });

        // viewer receives image from artist, and then will display it
        socket.on("receive_image", (data: { imageUrl: string }) => {
            setSelectedImage(data.imageUrl);
        });

        // upon leaving, stop listening to the emits
        return () => {
            socket.off("rejoined");
            socket.off("matched");
            socket.off("partner_left");
            socket.off("session_ended");
            socket.off("error_message");
            socket.off("receive_image");
        };
    }, [router, sessionId]);

    // when they want to leave, emit that and send them back
    const handleLeave = () => {
        const socket = getSocket();
        if(socket === null)
        {
            return;
        }

        socket.emit("leave_session", sessionId);
        router.push("/");
    };

    // for getting images on the artist side
    const handleGetImages = async () => {
        // first et that they are loading images
        setLoadingImages(true);

        // checks if the socket connection even exists
        const socket = getSocket();

        if(socket === null)
        {
            return;
        }
        
        // sends a request for the portfolio images, and specifies where toe save them upon returning
        socket.emit("request_portfolio_images", {
            ipAddress,
            username: portUsername,
            password: portPassword,
            directoryPath,
        }, (images: Array<{ filename: string; data: string; mimeType: string }>) => {
            console.log("Received images:", images);
            setPortfolioImages(images);
            setLoadingImages(false);
        });
    };

    // when the artists selects an image, selects that image to display and sends it to the server
    const handleSelectImage = (imageData: { filename: string; data: string; mimeType: string }) => {
        // gets the url of the image and the entirety of the image data  to send to the server
        const dataUrl = `data:${imageData.mimeType};base64,${imageData.data}`;
        setSelectedImage(dataUrl);
        // Send image to viewer through socket
        const socket = getSocket();

        if(socket === null)
        {
            return;
        }

        // sends the emit
        socket.emit("send_image", { sessionId, imageUrl: dataUrl });
    };

    // what the clients see
    return (
        <main className="flex min-h-screen items-center justify-center p-8 font-sans relative overflow-hidden bg-gradient-to-br from-purple-950 via-slate-950 to-purple-900">
            <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none" ref={svgRef} />
            
            <div className="relative z-10 w-full max-w-2xl">
                <div className="rounded-xl bg-white dark:bg-slate-900 shadow-2xl dark:shadow-xl border-2 border-purple-300 dark:border-purple-700 transition-all duration-300 hover:scale-105 hover:[box-shadow:0_0_50px_rgba(239,68,68,0.5)] p-8">
                    <h1 className="text-3xl font-bold mb-6 bg-gradient-to-r from-purple-700 to-red-600 bg-clip-text text-transparent">Session: {sessionId}</h1>

                    {/* Makes sure the role is already set, which it should be */}
                    {role && (
                        <div className="mb-6 p-4 bg-gradient-to-r from-purple-50 to-purple-100 dark:from-purple-950/40 dark:to-purple-900/40 rounded-lg border border-purple-200 dark:border-purple-800">
                            <p className="text-sm font-medium text-purple-900 dark:text-purple-100">
                                {role === "artist" ? "🎨 You're Showing Your Portfolio" : "👁️ You're Viewing a Portfolio"}
                            </p>
                        </div>
                    )}

                    {/* Waits utnil the other username is found, otherwise its waiting for it to load */}
                    {otherUsername ? (
                        <>
                            {/* Viewer side stuff */}
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
                                        {/* Displays this sidebar before images are retieved, letting the artist input their server data to put in */}
                                        {portfolioImages.length === 0 ? (
                                            <div className="space-y-3">
                                                <input
                                                    type="text"
                                                    placeholder="IP Address"
                                                    value={ipAddress}
                                                    onChange={(e) => setIpAddress(e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-purple-300 dark:border-purple-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Username"
                                                    value={portUsername}
                                                    onChange={(e) => setPortUsername(e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-purple-300 dark:border-purple-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                                                />
                                                <input
                                                    type="password"
                                                    placeholder="Password"
                                                    value={portPassword}
                                                    onChange={(e) => setPortPassword(e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-purple-300 dark:border-purple-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                                                />
                                                <input
                                                    type="text"
                                                    placeholder="Directory Path"
                                                    value={directoryPath}
                                                    onChange={(e) => setDirectoryPath(e.target.value)}
                                                    className="w-full px-3 py-2 text-sm border border-purple-300 dark:border-purple-700 rounded-lg bg-white dark:bg-slate-800 text-gray-900 dark:text-white placeholder-gray-500 dark:placeholder-gray-400"
                                                />
                                                <button
                                                    className="w-full px-4 py-3 bg-gradient-to-r from-purple-600 to-purple-700 text-white rounded-lg hover:shadow-lg hover:shadow-purple-500/50 text-sm font-medium disabled:bg-gray-400 transition-all"
                                                    onClick={handleGetImages}
                                                    disabled={loadingImages || !ipAddress || !portUsername || !portPassword || !directoryPath}
                                                >
                                                    {loadingImages ? "Loading..." : "Get Images"}
                                                </button>
                                            </div>
                                        ) : (
                                            <>
                                                {/* Otherwise once the images are found, display them in a sidebar, and show a button letting the user select which one
                                                 to display now */}
                                                <p className="text-xs font-medium text-gray-700 dark:text-gray-300 mb-3">Portfolio Images:</p>
                                                <div className="flex gap-3 overflow-x-auto pb-2">
                                                    {portfolioImages.map((image, idx) => (
                                                        <button
                                                            key={idx}
                                                            onClick={() => handleSelectImage(image)}
                                                            className={`flex-shrink-0 w-20 h-20 rounded-lg border-2 overflow-hidden transition-all ${
                                                                selectedImage === `data:${image.mimeType};base64,${image.data}`
                                                                    ? "border-red-500 ring-2 ring-red-300 dark:ring-red-700 shadow-lg"
                                                                    : "border-purple-300 dark:border-purple-700 hover:border-purple-400 dark:hover:border-purple-600"
                                                            }`}
                                                        >
                                                            <img
                                                                src={`data:${image.mimeType};base64,${image.data}`}
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
                                    {/* Otherwise this is the viewer's side of things, show who they're viewing it from, and the selected image */}
                                    <p className="text-lg mb-4 text-gray-900 dark:text-white">Viewing portfolio from: <span className="font-bold bg-gradient-to-r from-purple-600 to-red-600 bg-clip-text text-transparent">{otherUsername}</span></p>
                                    <div className="p-6 bg-gradient-to-br from-purple-50 to-purple-100 dark:from-purple-950/40 dark:to-purple-900/40 rounded-lg min-h-[300px] flex items-center justify-center border-2 border-purple-200 dark:border-purple-800">
                                        {selectedImage ? (
                                            <img src={selectedImage} alt="Artist portfolio" className="max-h-[300px] max-w-full object-contain rounded-lg shadow-lg" />
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
                        <div>
                            {/* Otherwise, they're not connected yet, so waiting for that to load */}
                            <p className="text-center text-gray-600 dark:text-gray-300 py-8">Waiting to connect...</p>
                        </div>
                    )}

                    {/* The button to let them leave */}
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