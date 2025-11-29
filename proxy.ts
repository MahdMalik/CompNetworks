import { clerkMiddleware } from "@clerk/nextjs/server";

// Note: clerkMiddleware no longer accepts `publicRoutes` in the options object.
// To make specific routes public, either handle protection per-route using
// the `authHandler.protect` helper exposed to the middleware handler, or
// implement route-matching outside of Clerk before calling the middleware.
export default clerkMiddleware({
  // If your project provides a server secret via `CLERK_API_KEY` or `CLERK_SECRET_KEY`,
  // Clerk will propagate it. For that propagation to be secure the middleware
  // requires a `CLERK_ENCRYPTION_KEY` environment variable (see README).
});

export const config = {
  matcher: ["/((?!.+\\.[\\w]+$|_next).*)", "/", "\/(api|trpc)(.*)"],
};