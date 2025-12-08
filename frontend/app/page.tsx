"use client";

import Link from "next/link";
import { useUser, SignOutButton } from "@clerk/nextjs";
import { useRef, useEffect } from "react";

export default function Home() {
  const { isSignedIn } = useUser();
  const svgRef = useRef<SVGSVGElement>(null);

  // sets up the particles used on every page. Now that i tthink about it i should've really made this component
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    const particles: Array<{ x: number; y: number; vx: number; vy: number }> = [];
    const particleCount = 120;
    
    // initializes the particles
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * el.clientWidth,
        y: Math.random() * el.clientHeight,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      });
    }

    // animates them moving across and connecting
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

  return (
    <div className="flex min-h-screen items-start justify-center font-sans py-12 relative overflow-hidden bg-gradient-to-br from-purple-950 via-slate-950 to-purple-900">
      {/* Particle network background */}
      <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none" ref={svgRef} />

      <div className="relative z-10">
        <main className="w-full max-w-4xl space-y-12 rounded-2xl bg-white p-10 shadow-2xl dark:bg-slate-900 border-2 border-purple-300 dark:border-purple-700 transition-all duration-300 hover:scale-105 hover:border-red-500 dark:hover:border-red-500 hover:[box-shadow:0_0_50px_rgba(239,68,68,0.5)]">
          <header className="flex items-center justify-between gap-6">
            <div className="flex items-center gap-4">
              <div className="w-14 h-7 bg-gradient-to-r from-purple-600 to-red-600 rounded-lg flex items-center justify-center">
                <span className="text-white font-bold text-xs">CN</span>
              </div>
              <div>
                <h1 className="text-2xl font-semibold bg-gradient-to-r from-purple-700 to-red-600 bg-clip-text text-transparent">CompNetworks</h1>
                <p className="text-sm text-purple-600 dark:text-purple-300">Connect, share and showcase portfolios securely.</p>
              </div>
            </div>

            {/* Sets up the navigation  bar that allows them to either sing out or sign in, depending on their sign in status */}
            <nav className="flex items-center gap-3">
              {isSignedIn ? (
                <SignOutButton>
                  <button className="rounded-full bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-2 text-white hover:shadow-lg hover:shadow-purple-500/50 transition-all cursor-pointer">
                    Log out
                  </button>
                </SignOutButton>
              ) : (
                <Link href="/sign-in" className="rounded-full bg-gradient-to-r from-purple-600 to-purple-700 px-4 py-2 text-white hover:shadow-lg hover:shadow-purple-500/50 transition-all">
                  Sign in
                </Link>
              )}

              {/* Link to our github */}
              <Link href="https://github.com/MahdMalik/CompNetworks" className="rounded-full border-2 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-300 px-4 py-2 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition">Docs</Link>
            </nav>
          </header>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="space-y-4">
              <h2 className="text-4xl font-bold bg-gradient-to-r from-purple-700 via-purple-600 to-red-600 bg-clip-text text-transparent">Share your portfolio, securely</h2>
              <p className="text-lg text-gray-700 dark:text-gray-300">
                Users sign in (we recommend Clerk.js for auth), connect with other clients, and publish
                image-based portfolios hosted on remote servers. Portfolios are populated by securely
                fetching images from a remote Linux server via user-provided (encrypted) SSH credentials
                and a path to the image folder.
              </p>

              <div className="mt-4 space-y-3">
                <h3 className="font-medium text-gray-900 dark:text-white">How it works</h3>
                <ul className="ml-5 list-disc text-gray-700 dark:text-gray-300 space-y-1">
                  <li>Sign in with your account (Clerk.js integration placeholder).</li>
                  <li>Connect with other users to share and collaborate.</li>
                  <li>Provide encrypted SSH username/password + remote path to images.</li>
                  <li>Server-side process fetches images and stores them for portfolio use.</li>
                  <li>Create and tweak portfolio layouts, then share with connections.</li>
                </ul>
              </div>

              <div className="mt-6 flex gap-3">
                {/* Addition logout and sign in button */}
                {isSignedIn ? (
                  <SignOutButton>
                    <button className="inline-block rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 px-5 py-3 text-white hover:shadow-lg hover:shadow-purple-500/50 transition-all font-medium cursor-pointer">
                      Log out
                    </button>
                  </SignOutButton>
                ) : (
                  <Link href="/sign-in" className="inline-block rounded-lg bg-gradient-to-r from-purple-600 to-purple-700 px-5 py-3 text-white hover:shadow-lg hover:shadow-purple-500/50 transition-all font-medium">
                    Sign in with Clerk
                  </Link>
                )}

                {/* Links them to the portoflio */}
                <Link href="/main" className="inline-block rounded-lg border-2 border-purple-300 dark:border-purple-700 text-purple-600 dark:text-purple-300 px-5 py-3 hover:bg-purple-50 dark:hover:bg-purple-950/50 transition font-medium">
                  Create portfolio
                </Link>
              </div>
            </div>

            <div className="rounded-xl border-2 border-red-400 dark:border-red-700 bg-gradient-to-br from-red-50 to-red-100 dark:from-red-950/40 dark:to-red-900/30 p-6">
              <h4 className="mb-3 font-semibold text-red-900 dark:text-red-100 text-lg">Security & UX notes</h4>
              <p className="text-sm text-red-800 dark:text-red-200">
                Credentials entered by users must be encrypted client-side or over TLS and stored encrypted
                at rest. The server will use the provided credentials to SSH to the user's remote host and
                retrieve images from the specified path. Consider using SSH keys or temporary tokens for
                better security.
              </p>

              <div className="mt-4 space-y-4">
                <div className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-lg border-l-4 border-red-600">
                  <strong className="text-red-900 dark:text-red-100">Supported image sources:</strong>
                  <div className="text-sm text-red-700 dark:text-red-300">
                    Any Linux host reachable over SSH with read access to the image directory.
                  </div>
                </div>
                <div className="p-3 bg-white/80 dark:bg-slate-800/80 rounded-lg border-l-4 border-red-600">
                  <strong className="text-red-900 dark:text-red-100">Portfolio editor:</strong>
                  <div className="text-sm text-red-700 dark:text-red-300">
                    Drag-and-drop positioning, visibility toggles, and sharing controls for connected
                    users.
                  </div>
                </div>
              </div>
            </div>
          </section>

          <footer className="flex items-center justify-between text-sm text-gray-500 border-t border-purple-200 dark:border-purple-800 pt-6">
            <div>Built with Next.js — prototype landing copy</div>
          </footer>
        </main>
      </div>
    </div>
  );
}