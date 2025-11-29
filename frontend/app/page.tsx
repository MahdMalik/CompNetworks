"use client";

import Image from "next/image";
import Link from "next/link";
import { useUser, SignOutButton } from "@clerk/nextjs";

export default function Home() {
  const { isSignedIn } = useUser();

  return (
    <div className="flex min-h-screen items-start justify-center bg-zinc-50 font-sans dark:bg-black py-12">
      <main className="w-full max-w-4xl space-y-12 rounded-2xl bg-white p-10 shadow-sm dark:bg-[#0b0b0b]">
        <header className="flex items-center justify-between gap-6">
          <div className="flex items-center gap-4">
            <Image src="/next.svg" alt="logo" width={56} height={28} className="dark:invert" />
            <div>
              <h1 className="text-2xl font-semibold text-black dark:text-zinc-50">CompNetworks</h1>
              <p className="text-sm text-zinc-600 dark:text-zinc-400">Connect, share and showcase portfolios securely.</p>
            </div>
          </div>

          <nav className="flex items-center gap-3">
            {isSignedIn ? (
              <SignOutButton>
                <button className="rounded-full bg-black px-4 py-2 text-white hover:opacity-95">
                  Log out
                </button>
              </SignOutButton>
            ) : (
              <Link href="/sign-in" className="rounded-full bg-black px-4 py-2 text-white hover:opacity-95">
                Sign in
              </Link>
            )}

            <Link href="/docs" className="rounded-full border px-4 py-2">Docs</Link>
          </nav>
        </header>

        <section className="grid gap-6 md:grid-cols-2">
          <div className="space-y-4">
            <h2 className="text-3xl font-bold text-black dark:text-zinc-50">Share your portfolio, securely</h2>
            <p className="text-lg text-zinc-600 dark:text-zinc-400">
              Users sign in (we recommend Clerk.js for auth), connect with other clients, and publish
              image-based portfolios hosted on remote servers. Portfolios are populated by securely
              fetching images from a remote Linux server via user-provided (encrypted) SSH credentials
              and a path to the image folder.
            </p>

            <div className="mt-4 space-y-3">
              <h3 className="font-medium">How it works</h3>
              <ul className="ml-5 list-disc text-zinc-600 dark:text-zinc-400">
                <li>Sign in with your account (Clerk.js integration placeholder).</li>
                <li>Connect with other users to share and collaborate.</li>
                <li>Provide encrypted SSH username/password + remote path to images.</li>
                <li>Server-side process fetches images and stores them for portfolio use.</li>
                <li>Create and tweak portfolio layouts, then share with connections.</li>
              </ul>
            </div>

            <div className="mt-6 flex gap-3">
              {isSignedIn ? (
                <SignOutButton>
                  <button className="inline-block rounded-lg bg-black px-5 py-3 text-white">
                    Log out
                  </button>
                </SignOutButton>
              ) : (
                <Link href="/sign-in" className="inline-block rounded-lg bg-black px-5 py-3 text-white">
                  Sign in with Clerk
                </Link>
              )}

              <Link href="/main" className="inline-block rounded-lg border px-5 py-3">
                Create portfolio
              </Link>
            </div>
          </div>

          <div className="rounded-xl border p-4">
            <h4 className="mb-3 font-medium">Security & UX notes</h4>
            <p className="text-sm text-zinc-600 dark:text-zinc-400">
              Credentials entered by users must be encrypted client-side or over TLS and stored encrypted
              at rest. The server will use the provided credentials to SSH to the user's remote host and
              retrieve images from the specified path. Consider using SSH keys or temporary tokens for
              better security.
            </p>

            <div className="mt-4 space-y-3">
              <div>
                <strong>Supported image sources:</strong>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  Any Linux host reachable over SSH with read access to the image directory.
                </div>
              </div>
              <div>
                <strong>Portfolio editor:</strong>
                <div className="text-sm text-zinc-600 dark:text-zinc-400">
                  Drag-and-drop positioning, visibility toggles, and sharing controls for connected
                  users.
                </div>
              </div>
            </div>
          </div>
        </section>

        <footer className="flex items-center justify-between text-sm text-zinc-500">
          <div>Built with Next.js — prototype landing copy</div>
          <div>
            <Link href="/about" className="underline">Learn more</Link>
          </div>
        </footer>
      </main>
    </div>
  );
}
