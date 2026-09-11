import { NextResponse } from "next/server";
import { clerkMiddleware, createRouteMatcher } from "@clerk/nextjs/server";

const isAuthenticatedRoute = createRouteMatcher([
  "/account",
  "/admin/(.*)",
  "/profile",
  "/settings",
]);

const isAdminRoute = createRouteMatcher(["/admin", "/admin/(.*)"]);

const previewOrigins = [process.env.VERCEL_URL, process.env.VERCEL_BRANCH_URL]
  .filter(Boolean)
  .map((host) => `https://${host}`);

/**
 * Exact-match allowlist for the `azp` claim on Clerk session tokens, so a token
 * minted for some other origin under aaroncurtisyoga.com is rejected here. The
 * sibling subdomains are real: train. is the training tracker, and mindflow. is
 * served from a different Vercel account, where a dangling CNAME would be a
 * subdomain takeover waiting to replay tokens against this site.
 *
 * train. is deliberately absent. It mints its own host-local session, so no
 * legitimate request here ever carries a train. token. There is no wildcard
 * support, so a host missing from this list 401s on every authenticated request.
 *
 * Gated on VERCEL_ENV, not NODE_ENV: `next start` and every preview build also
 * set NODE_ENV=production, and a preview origin missing from this list sends the
 * sign-in page and the proxy into a redirect loop.
 */
const authorizedParties = [
  "https://www.aaroncurtisyoga.com",
  "https://aaroncurtisyoga.com",
  ...(process.env.VERCEL_ENV === "production"
    ? []
    : ["http://localhost:3000", ...previewOrigins]),
];

export default clerkMiddleware(
  async (auth, req) => {
    const authObject = await auth();

    const needsAuth = isAuthenticatedRoute(req) || isAdminRoute(req);

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
  },
  { authorizedParties },
);

export const config = {
  matcher: [
    "/((?!.*\\..*|_next|api/cron/|api/webhooks/).*)",
    "/",
    "/api/((?!cron/|webhooks/).*)",
    "/trpc(.*)",
  ],
};
