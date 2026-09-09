import { readFileSync } from "fs";
import { join } from "path";
import { GarminConnect } from "garmin-connect";
import prisma from "@/app/_lib/prisma";
import { dateFromYmd } from "@/app/_lib/utils/training-date";

/**
 * Pulls recent Garmin activities and auto-creates a linked RUN LoggedSession
 * for every run, so runs land in /train without any manual logging. Also
 * silently collects nightly wellness (HRV, resting HR, sleep) into
 * DailyWellness — readiness baselines need ~3 weeks of history, so collection
 * runs long before any UI exists. Invoked by the daily cron
 * (/api/cron/sync-garmin) and the manual sync button.
 *
 * Auth: long-lived OAuth tokens minted once by `npx tsx scripts/garmin-login.ts`
 * (run locally by the owner — the password is never stored). Tokens come from
 * the GARMIN_TOKENS env var (prod) or .garmin-tokens.json (local, gitignored).
 */

const TOKEN_FILE = ".garmin-tokens.json";

function loadTokens(): { oauth1: object; oauth2: object } | null {
  const fromEnv = process.env.GARMIN_TOKENS;
  if (fromEnv) {
    try {
      return JSON.parse(fromEnv);
    } catch {
      console.error("GARMIN_TOKENS env var is not valid JSON");
      return null;
    }
  }
  try {
    return JSON.parse(readFileSync(join(process.cwd(), TOKEN_FILE), "utf8"));
  } catch {
    return null;
  }
}

/** "YYYY-MM-DD HH:mm:ss" GMT → the ET calendar day (evening runs stay today). */
function etYmdFromGmt(gmt: string): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date(`${gmt.replace(" ", "T")}Z`));
}

export type GarminSyncResult = {
  ok: boolean;
  reason?: string;
  imported: number;
  runsCreated: number;
  wellnessDays: number;
};

export async function syncGarminActivities(): Promise<GarminSyncResult> {
  const tokens = loadTokens();
  if (!tokens?.oauth1 || !tokens?.oauth2) {
    return {
      ok: false,
      reason:
        "No Garmin tokens. Run `npx tsx scripts/garmin-login.ts` once, then set GARMIN_TOKENS.",
      imported: 0,
      runsCreated: 0,
      wellnessDays: 0,
    };
  }

  const client = new GarminConnect({
    username: process.env.GARMIN_EMAIL ?? "",
    password: "",
  });
  client.loadToken(tokens.oauth1 as never, tokens.oauth2 as never);

  const activities = await client.getActivities(0, 30);
  if (!Array.isArray(activities)) {
    return {
      ok: false,
      reason: "Unexpected Garmin response",
      imported: 0,
      runsCreated: 0,
      wellnessDays: 0,
    };
  }

  let imported = 0;
  let runsCreated = 0;

  for (const activity of activities) {
    const garminId = String(activity.activityId);
    const typeKey: string = activity.activityType?.typeKey ?? "unknown";
    // startTimeLocal is already the device's local (ET) clock; the GMT
    // fallback must be converted or evening runs date to tomorrow.
    const ymd: string | undefined = activity.startTimeLocal
      ? activity.startTimeLocal.slice(0, 10)
      : activity.startTimeGMT
        ? etYmdFromGmt(activity.startTimeGMT)
        : undefined;
    if (!ymd) continue;

    const data = {
      date: dateFromYmd(ymd),
      type: typeKey,
      name: activity.activityName ?? null,
      avgHr: activity.averageHR ? Math.round(activity.averageHR) : null,
      maxHr: activity.maxHR ? Math.round(activity.maxHR) : null,
      distanceM: activity.distance ?? null,
      durationSec: activity.duration ? Math.round(activity.duration) : null,
      avgPaceSecPerKm:
        activity.averageSpeed && activity.averageSpeed > 0
          ? Math.round((1000 / activity.averageSpeed) * 10) / 10
          : null,
    };

    const existing = await prisma.garminActivity.findUnique({
      where: { garminId },
      select: { id: true, loggedSessionId: true, dismissed: true },
    });
    const row = await prisma.garminActivity.upsert({
      where: { garminId },
      update: data,
      create: { garminId, ...data },
    });
    if (!existing) imported++;

    if (existing?.loggedSessionId) {
      // Garmin-side edits (date, duration) must reach the linked session or
      // the session card and its stats block drift apart.
      await prisma.loggedSession.update({
        where: { id: existing.loggedSessionId },
        data: {
          date: data.date,
          durationMin: data.durationSec
            ? Math.round(data.durationSec / 60)
            : null,
        },
      });
    } else if (typeKey.includes("running") && !row.dismissed) {
      // Nested create keeps activity-link + session atomic: no orphan
      // duplicates if the function dies mid-way. Dismissed rows (session
      // deleted in-app) are never resurrected.
      await prisma.garminActivity.update({
        where: { garminId },
        data: {
          loggedSession: {
            create: {
              activityType: "RUN",
              date: data.date,
              durationMin: data.durationSec
                ? Math.round(data.durationSec / 60)
                : null,
            },
          },
        },
      });
      runsCreated++;
    }
  }

  const wellnessDays = await pullWellness(client);

  return { ok: true, imported, runsCreated, wellnessDays };
}

/**
 * Best-effort nightly wellness for the last 7 days. Fully isolated: these are
 * undocumented endpoints that drift, and a broken sleep pull must never stop
 * runs from importing.
 */
async function pullWellness(client: GarminConnect): Promise<number> {
  let saved = 0;
  for (let daysAgo = 0; daysAgo < 7; daysAgo++) {
    try {
      const ymd = new Intl.DateTimeFormat("en-CA", {
        timeZone: "America/New_York",
      }).format(new Date(Date.now() - daysAgo * 86_400_000));
      const date = new Date(`${ymd}T00:00:00`);

      const sleep = (await client.getSleepData(date)) as Record<string, any>;
      let rhr7dAvg: number | null = null;
      try {
        const hr = (await client.getHeartRate(date)) as Record<string, any>;
        rhr7dAvg = hr?.lastSevenDaysAvgRestingHeartRate ?? null;
      } catch {
        // resting-HR endpoint failing is fine; sleep payload still has RHR
      }

      const fields = {
        hrvMs: sleep?.avgOvernightHrv ?? null,
        hrvStatus: sleep?.hrvStatus ?? null,
        restingHr: sleep?.restingHeartRate ?? null,
        rhr7dAvg,
        sleepSec:
          typeof sleep?.sleepTimeSeconds === "number"
            ? sleep.sleepTimeSeconds
            : null,
        sleepScore: sleep?.sleepScores?.overall?.value ?? null,
        bodyBatteryChange: sleep?.bodyBatteryChange ?? null,
        avgSleepStress: sleep?.avgSleepStress ?? null,
        respirationAvg: sleep?.averageRespirationValue ?? null,
      };
      // Skip empty nights (watch not worn) so they don't overwrite real data.
      if (Object.values(fields).every((v) => v === null)) continue;

      await prisma.dailyWellness.upsert({
        where: { date: dateFromYmd(ymd) },
        update: fields,
        create: { date: dateFromYmd(ymd), ...fields },
      });
      saved++;
    } catch (error) {
      console.error("Garmin wellness pull failed (non-fatal):", error);
    }
  }
  return saved;
}
