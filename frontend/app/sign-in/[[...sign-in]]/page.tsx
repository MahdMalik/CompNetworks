"use client";

import { SignIn } from "@clerk/nextjs";
import { useRef, useEffect } from "react";

export default function SignInPage() {
  const svgRef = useRef<SVGSVGElement>(null);

  // this is the stuff to display the particles to the screen
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;

    // setusp the particles
    const particles: Array<{ x: number; y: number; vx: number; vy: number }> = [];
    const particleCount = 120;
    
    // sets their position and speeds
    for (let i = 0; i < particleCount; i++) {
      particles.push({
        x: Math.random() * el.clientWidth,
        y: Math.random() * el.clientHeight,
        vx: (Math.random() - 0.5) * 2,
        vy: (Math.random() - 0.5) * 2,
      });
    }

    // animates them moving and conected when close enough. I'm kinda tired of typing this every single time but only 2 more pages to go to tepe it for
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

        // sets the dots that actulaly make up this element
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
    <div className="flex min-h-screen items-center justify-center font-sans relative overflow-hidden bg-gradient-to-br from-purple-950 via-slate-950 to-purple-900">
      {/* Particle network background */}
      <svg className="absolute inset-0 w-full h-full z-0 pointer-events-none" ref={svgRef} />

      <div className="relative z-10">
        <div className="w-full max-w-lg rounded-lg bg-white p-8 shadow-2xl dark:bg-slate-900 border-2 border-red-400 dark:border-red-600 transition-all duration-300 hover:scale-105 hover:[box-shadow:0_0_50px_rgba(239,68,68,0.5)]">
          <h1 className="mb-2 text-3xl font-bold bg-gradient-to-r from-purple-600 to-red-600 bg-clip-text text-transparent">Sign in</h1>
          <p className="mb-6 text-sm text-gray-600 dark:text-gray-400">Welcome back to CompNetworks</p>
          {/* Clerk makes it easy to just plug in the sign in element here and have it done. */}
          <SignIn 
            path="/sign-in"
            fallbackRedirectUrl="/main"
          />
        </div>
      </div>
    </div>
  );
}