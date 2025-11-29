"use client";

import { SignIn } from "@clerk/nextjs";

export default function SignInPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow dark:bg-[#0b0b0b]">
        <h1 className="mb-4 text-2xl font-semibold">Sign in</h1>
        <SignIn 
          path="/sign-in"
          fallbackRedirectUrl="/main"
        />
      </div>
    </div>
  );
}
