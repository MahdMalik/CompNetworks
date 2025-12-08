"use client";

import { ReactNode } from "react";
import { ClerkProvider } from "@clerk/nextjs";

//This basically sets the key for Clerk to allow it to be used in the app.
export default function ClerkProviderClient({ children }: { children: ReactNode }) {
  // Provide the publishable key via NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
  // If the publishable key is not configured, render children without Clerk
  const publishableKey = process.env.NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY;
  if (!publishableKey) {
    // eslint-disable-next-line no-console
    console.warn("NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY is not set — Clerk is disabled locally.");
    return <>{children}</>;
  }

  return <ClerkProvider publishableKey={publishableKey}>{children}</ClerkProvider>;
}
