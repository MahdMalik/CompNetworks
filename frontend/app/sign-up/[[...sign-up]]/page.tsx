"use client";

import { SignUp } from "@clerk/nextjs";

export default function SignUpPage() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-zinc-50 dark:bg-black">
      <div className="w-full max-w-lg rounded-lg bg-white p-6 shadow dark:bg-[#0b0b0b]">
        <h1 className="mb-4 text-2xl font-semibold">Sign up</h1>
        <SignUp
          path="/sign-up"
          fallbackRedirectUrl="/main"
          routing="path"
        />
      </div>
    </div>
  );
}