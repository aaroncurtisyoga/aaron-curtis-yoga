import { NextResponse } from "next/server";
import { auth } from "@clerk/nextjs/server";

/**
 * Route-handler guard for admin-only API routes. Returns a 401/403 JSON
 * Response to short-circuit the handler, or null when the caller is an admin.
 *
 * Mirrors requireAdmin() (server actions) but yields a Response instead of
 * throwing, since route handlers return Responses. Standardized on
 * `sessionClaims.metadata.role` to match proxy.ts.
 *
 *   const denied = await assertAdminRequest();
 *   if (denied) return denied;
 */
export async function assertAdminRequest(): Promise<NextResponse | null> {
  const { userId, sessionClaims } = await auth();
  if (!userId) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  if (sessionClaims?.metadata?.role !== "admin") {
    return NextResponse.json({ error: "Forbidden" }, { status: 403 });
  }
  return null;
}

/**
 * Route-handler guard for Vercel Cron endpoints. Returns a 401 Response when
 * the request lacks the `Bearer ${CRON_SECRET}` authorization header, else null.
 */
export function assertCronRequest(request: Request): NextResponse | null {
  // Without this guard, an env missing CRON_SECRET would accept the literal
  // header "Bearer undefined".
  const secret = process.env.CRON_SECRET;
  if (!secret) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  const authHeader = request.headers.get("authorization");
  if (authHeader !== `Bearer ${secret}`) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }
  return null;
}
