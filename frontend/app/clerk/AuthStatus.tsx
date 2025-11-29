"use client";

import Link from "next/link";
import { SignedIn, SignedOut, UserButton } from "@clerk/nextjs";

export default function AuthStatus() {
  return (
    <div className="flex items-center gap-3">
      <SignedIn>
        <UserButton />
      </SignedIn>
      <SignedOut>
        <Link href="/sign-in" className="rounded-full bg-black px-4 py-2 text-white hover:opacity-95">Sign in</Link>
      </SignedOut>
    </div>
  );
}
