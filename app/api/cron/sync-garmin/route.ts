import { NextResponse } from "next/server";
import { assertCronRequest } from "@/app/_lib/api-auth";
import { syncGarminActivities } from "@/app/_lib/services/garmin-sync";

export async function GET(request: Request) {
  try {
    const denied = assertCronRequest(request);
    if (denied) return denied;

    const result = await syncGarminActivities();
    return NextResponse.json(
      { ...result, timestamp: new Date().toISOString() },
      { status: result.ok ? 200 : 503 },
    );
  } catch (error) {
    console.error("Garmin cron sync failed:", error);
    return NextResponse.json(
      { ok: false, reason: "Garmin sync failed" },
      { status: 500 },
    );
  }
}
