import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isAuthenticatedRoute = createRouteMatcher([
  "/account",
  "/admin/(.*)",
  "/profile",
  "/settings",
  "/train",
  "/train/(.*)",
]);

// /train is the owner's personal training tracker — admin-gated like /admin.
const isAdminRoute = createRouteMatcher([
  "/admin",
  "/admin/(.*)",
  "/train",
  "/train/(.*)",
]);

const isPublicRoute = createRouteMatcher(["/"]);

export default clerkMiddleware(async (auth, req) => {
  const authObject = await auth();

  const needsAuth =
    (isAuthenticatedRoute(req) || isAdminRoute(req)) && !isPublicRoute(req);

  // Not signed in on any protected route → send to sign-in and come back after.
  // This must run before the admin-role check, otherwise a signed-out visitor
  // to /admin gets bounced to "/" instead of being prompted to log in.
  if (needsAuth && !authObject.userId) {
    const url = req.nextUrl.clone();
    url.pathname = "/sign-in";
    url.searchParams.set("redirect_url", req.nextUrl.pathname);
    return NextResponse.redirect(url);
  }

  // Signed in but not an admin → keep them out of the admin area.
  if (
    isAdminRoute(req) &&
    authObject.sessionClaims?.metadata?.role !== "admin"
  ) {
    const url = req.nextUrl.clone();
    url.pathname = "/";
    return NextResponse.redirect(url);
  }

  return NextResponse.next();
});

export const config = {
  matcher: [
    "/((?!.*\\..*|_next|api/cron/|api/webhooks/).*)",
    "/",
    "/api/((?!cron/|webhooks/).*)",
    "/trpc(.*)",
  ],
};
