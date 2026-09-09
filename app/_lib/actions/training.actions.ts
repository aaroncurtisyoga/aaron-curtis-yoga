"use server";

import { ActivityType, Prisma } from "@prisma/client";
import prisma from "@/app/_lib/prisma";
import { requireAdmin } from "@/app/_lib/auth";
import { DEFAULT_MOVEMENTS } from "@/app/_lib/constants/training";
import hyroxPlan from "@/app/_lib/data/hyrox-plan.json";
import { syncGarminActivities } from "@/app/_lib/services/garmin-sync";
import { fetchCrossfitWod } from "@/app/_lib/services/pushpress-wod";
import { SetEntry, UpdateLoggedSessionParams } from "@/app/_lib/types/training";
import { handleError } from "@/app/_lib/utils";
import { serialize } from "@/app/_lib/utils/serialize";
import { dateFromYmd, etToday } from "@/app/_lib/utils/training-date";

type PlanDay = {
  date: string;
  week: number;
  phase: string;
  title: string;
  durationMin: number | null;
  rest: boolean;
  note: string | null;
  blocks: { label: string; minutes: number | null; text: string }[];
};

// No caching anywhere in this file on purpose: /train is single-user private
// traffic, and stale reads would fight the last-used-weight pre-fill.

/** Seed the movement library on first use so every environment self-heals. */
async function ensureMovementLibrary() {
  const count = await prisma.movement.count();
  if (count === 0) {
    await prisma.movement.createMany({
      data: DEFAULT_MOVEMENTS,
      skipDuplicates: true,
    });
  }
}

/**
 * Seed the authored 11-week Hyrox plan from the committed JSON export on first
 * use (same self-healing idea as the movement library). The doc is fixed data;
 * to re-seed after editing the export, delete the AUTHORED rows and reload.
 */
async function ensureHyroxPlan() {
  const days = hyroxPlan as PlanDay[];
  const count = await prisma.plannedSession.count({
    where: { world: "HYROX", source: "AUTHORED" },
  });
  if (count > 0 || days.length === 0) return;
  // skipDuplicates + the partial unique index guard the first-load race:
  // two concurrent renders can both see count 0 without double-seeding.
  await prisma.plannedSession.createMany({
    skipDuplicates: true,
    data: days.map((day) => ({
      date: dateFromYmd(day.date),
      world: "HYROX" as const,
      source: "AUTHORED" as const,
      title: day.title,
      rawText: null,
      blocks: {
        week: day.week,
        phase: day.phase,
        durationMin: day.durationMin,
        note: day.note,
        items: day.blocks,
      } as Prisma.InputJsonValue,
    })),
  });
}

/** Home screen payload: today's sessions, today's plan offers, recent history. */
export const getTrainingHome = async () => {
  await requireAdmin();
  await ensureMovementLibrary();
  await ensureHyroxPlan();
  const today = etToday();
  const [todaySessions, recentSessions, todayPlans] = await Promise.all([
    prisma.loggedSession.findMany({
      where: { date: today },
      orderBy: { createdAt: "asc" },
      include: {
        movements: { include: { movement: true }, orderBy: { order: "asc" } },
        garminActivity: true,
      },
    }),
    prisma.loggedSession.findMany({
      where: { date: { lt: today } },
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      take: 30,
      include: {
        movements: { include: { movement: true }, orderBy: { order: "asc" } },
        garminActivity: true,
      },
    }),
    prisma.plannedSession.findMany({ where: { date: today } }),
  ]);
  return serialize({ todaySessions, recentSessions, todayPlans });
};

/** Manual "pull from Garmin now" — same sync the nightly cron runs. */
export const syncGarminNow = async () => {
  try {
    await requireAdmin();
    return await syncGarminActivities();
  } catch (error) {
    return handleError(error);
  }
};

/**
 * Everything for the trends screen in one round-trip: every logged movement
 * with its session's date, plus the plain session list for the history filter.
 */
export const getTrendsData = async () => {
  await requireAdmin();
  const [rows, sessions] = await Promise.all([
    prisma.loggedMovement.findMany({
      orderBy: { createdAt: "asc" },
      select: {
        movementId: true,
        sets: true,
        movement: true,
        loggedSession: { select: { date: true, activityType: true } },
      },
    }),
    prisma.loggedSession.findMany({
      orderBy: [{ date: "desc" }, { createdAt: "desc" }],
      select: {
        id: true,
        date: true,
        activityType: true,
        score: true,
        scoreType: true,
        durationMin: true,
        rpe: true,
        blockResults: true,
        plannedSession: { select: { title: true } },
      },
    }),
  ]);
  return serialize({ rows, sessions });
};

/**
 * Everything the logger screen needs in one round-trip: the session with its
 * movements, the movement library, and each movement's most recent sets from
 * OTHER sessions (ghost values + pre-fill).
 */
export const getLoggerData = async (sessionId: string) => {
  await requireAdmin();
  const [session, movements, recentLogged] = await Promise.all([
    prisma.loggedSession.findUnique({
      where: { id: sessionId },
      include: {
        movements: { include: { movement: true }, orderBy: { order: "asc" } },
        plannedSession: true,
        garminActivity: true,
      },
    }),
    prisma.movement.findMany({ orderBy: { name: "asc" } }),
    // Latest non-empty sets per movement by SESSION DATE (not createdAt, so
    // backfilled entries don't masquerade as most recent), with no row-count
    // window that would forget older lifts.
    prisma.$queryRaw<{ movementId: string; sets: unknown }[]>`
      SELECT DISTINCT ON (lm."movementId") lm."movementId", lm."sets"
      FROM "LoggedMovement" lm
      JOIN "LoggedSession" ls ON ls."id" = lm."loggedSessionId"
      WHERE lm."loggedSessionId" <> ${sessionId}
        AND jsonb_array_length(lm."sets") > 0
      ORDER BY lm."movementId", ls."date" DESC, lm."createdAt" DESC
    `,
  ]);
  if (!session) return null;

  const lastSets: Record<string, SetEntry[]> = {};
  for (const row of recentLogged) {
    lastSets[row.movementId] = row.sets as SetEntry[];
  }
  return serialize({ session, movements, lastSets });
};

const MOVEMENT_ALIASES: Record<string, string> = {
  rdl: "romanian deadlift",
  skierg: "skierg",
  ski: "skierg",
  row: "row erg",
};

const normalizeName = (s: string) =>
  s
    .toLowerCase()
    .replace(/\(.*?\)/g, "")
    .replace(/[^a-z0-9 ]/g, "")
    .replace(/\s+/g, " ")
    .trim();

/**
 * Pre-populate the session's movement cards from the plan's STRENGTH and
 * CONDITIONING blocks so logging a planned day starts at "tap ✓", not at
 * "search for Back Squat". Unmatched lines (accessory work not in the
 * library) are skipped silently — the inline picker covers those.
 */
async function materializePlanMovements(
  sessionId: string,
  blocks: Prisma.JsonValue | null,
) {
  const items =
    (blocks as { items?: { label?: string; text?: string }[] } | null)?.items ??
    [];
  if (items.length === 0) return;
  const movements = await prisma.movement.findMany();

  const resolve = (raw: string) => {
    const name = MOVEMENT_ALIASES[normalizeName(raw)] ?? normalizeName(raw);
    if (!name) return undefined;
    // Exact (or plural-stripped) match first, containment only as a fallback,
    // so "DB Bench Press" never resolves to "Bench Press".
    return (
      movements.find((m) => {
        const n = normalizeName(m.name);
        return n === name || n === name.replace(/s$/, "");
      }) ?? movements.find((m) => name.includes(normalizeName(m.name)))
    );
  };

  const toAdd: string[] = [];
  for (const item of items) {
    const label = (item.label ?? "").toUpperCase();
    if (label.startsWith("STRENGTH")) {
      for (const line of (item.text ?? "").split("\n")) {
        const match = line.match(/^•\s*(.+?)\s+[—–-]/);
        if (!match) continue;
        const found = resolve(match[1]);
        if (found && !toAdd.includes(found.id)) toAdd.push(found.id);
      }
    } else if (label.startsWith("CONDITIONING")) {
      const target = label.split(/[—–-]/)[1]?.trim();
      if (target) {
        const found = resolve(target);
        if (found && !toAdd.includes(found.id)) toAdd.push(found.id);
      }
    }
  }
  if (toAdd.length === 0) return;
  await prisma.loggedMovement.createMany({
    data: toAdd.map((movementId, order) => ({
      loggedSessionId: sessionId,
      movementId,
      order,
      sets: [] as unknown as Prisma.InputJsonValue,
    })),
  });
}

export const createLoggedSession = async ({
  activityType,
  date,
}: {
  activityType: ActivityType;
  date?: string; // YYYY-MM-DD, defaults to today in ET
}) => {
  try {
    await requireAdmin();
    const sessionDate = date ? dateFromYmd(date) : etToday();

    // Link the day's prescription when one exists. Hyrox comes from the seeded
    // plan; CrossFit is fetched on demand from PushPress (failure is fine —
    // the logger offers manual paste instead).
    let plannedSessionId: string | null = null;
    let planBlocks: Prisma.JsonValue | null = null;
    if (activityType === "HYROX") {
      const plan = await prisma.plannedSession.findFirst({
        where: { world: "HYROX", date: sessionDate },
        orderBy: { createdAt: "desc" },
      });
      plannedSessionId = plan?.id ?? null;
      planBlocks = plan?.blocks ?? null;
    } else if (activityType === "CROSSFIT") {
      const existing = await prisma.plannedSession.findFirst({
        where: { world: "CROSSFIT", date: sessionDate },
        orderBy: { createdAt: "desc" },
      });
      if (existing) {
        plannedSessionId = existing.id;
      } else {
        const wod = await fetchCrossfitWod(
          sessionDate.toISOString().slice(0, 10),
        );
        if (wod) {
          const plan = await prisma.plannedSession.upsert({
            where: { sourceId: wod.sourceId },
            update: {
              date: sessionDate, // a republished uid must not keep a stale day
              world: "CROSSFIT",
              title: wod.title,
              rawText: wod.rawText,
              blocks: wod.blocks as Prisma.InputJsonValue,
            },
            create: {
              date: sessionDate,
              world: "CROSSFIT",
              source: "PUSHPRESS",
              sourceId: wod.sourceId,
              title: wod.title,
              rawText: wod.rawText,
              blocks: wod.blocks as Prisma.InputJsonValue,
            },
          });
          plannedSessionId = plan.id;
        }
      }
    }

    const session = await prisma.loggedSession.create({
      data: { activityType, date: sessionDate, plannedSessionId },
    });
    if (planBlocks) await materializePlanMovements(session.id, planBlocks);
    return serialize(session);
  } catch (error) {
    return handleError(error);
  }
};

/** Fallback when the PushPress fetch fails: paste the WOD by hand. */
export const attachManualWod = async (sessionId: string, text: string) => {
  try {
    await requireAdmin();
    const trimmed = text.trim();
    if (!trimmed) throw new Error("WOD text is required");
    const session = await prisma.loggedSession.findUniqueOrThrow({
      where: { id: sessionId },
      select: { date: true },
    });
    const plan = await prisma.plannedSession.create({
      data: {
        date: session.date,
        world: "CROSSFIT",
        source: "MANUAL",
        title: "CrossFit (pasted)",
        rawText: trimmed,
      },
    });
    await prisma.loggedSession.update({
      where: { id: sessionId },
      data: { plannedSessionId: plan.id },
    });
    return serialize(plan);
  } catch (error) {
    return handleError(error);
  }
};

export const updateLoggedSession = async (
  sessionId: string,
  params: UpdateLoggedSessionParams,
) => {
  try {
    await requireAdmin();
    const { date, blockResults, ...rest } = params;
    const session = await prisma.loggedSession.update({
      where: { id: sessionId },
      data: {
        ...rest,
        ...(date ? { date: dateFromYmd(date) } : {}),
        ...(blockResults !== undefined
          ? { blockResults: blockResults as Prisma.InputJsonValue }
          : {}),
      },
    });
    return serialize(session);
  } catch (error) {
    return handleError(error);
  }
};

export const deleteLoggedSession = async (sessionId: string) => {
  try {
    await requireAdmin();
    // Mark any linked Garmin activity dismissed FIRST, or the nightly sync
    // sees the nulled link and resurrects the session forever.
    await prisma.garminActivity.updateMany({
      where: { loggedSessionId: sessionId },
      data: { dismissed: true },
    });
    await prisma.loggedSession.delete({ where: { id: sessionId } });
    return { status: true };
  } catch (error) {
    return handleError(error);
  }
};

export const addMovementToSession = async ({
  sessionId,
  movementId,
  sets = [],
}: {
  sessionId: string;
  movementId: string;
  sets?: SetEntry[];
}) => {
  try {
    await requireAdmin();
    const order = await prisma.loggedMovement.count({
      where: { loggedSessionId: sessionId },
    });
    const loggedMovement = await prisma.loggedMovement.create({
      data: {
        loggedSessionId: sessionId,
        movementId,
        order,
        sets: sets as Prisma.InputJsonValue,
      },
      include: { movement: true },
    });
    return serialize(loggedMovement);
  } catch (error) {
    return handleError(error);
  }
};

/** The autosave workhorse — called (debounced) on every set edit. */
export const updateLoggedMovement = async (
  loggedMovementId: string,
  { sets, notes }: { sets?: SetEntry[]; notes?: string | null },
) => {
  try {
    await requireAdmin();
    const loggedMovement = await prisma.loggedMovement.update({
      where: { id: loggedMovementId },
      data: {
        ...(sets !== undefined ? { sets: sets as Prisma.InputJsonValue } : {}),
        ...(notes !== undefined ? { notes } : {}),
      },
    });
    return serialize(loggedMovement);
  } catch (error) {
    return handleError(error);
  }
};

export const removeLoggedMovement = async (loggedMovementId: string) => {
  try {
    await requireAdmin();
    await prisma.loggedMovement.delete({ where: { id: loggedMovementId } });
    return { status: true };
  } catch (error) {
    return handleError(error);
  }
};

/** Inline "add a movement I've never logged" from the picker. */
export const createMovement = async ({ name }: { name: string }) => {
  try {
    await requireAdmin();
    const trimmed = name.trim();
    if (!trimmed) throw new Error("Movement name is required");
    const existing = await prisma.movement.findFirst({
      where: { name: { equals: trimmed, mode: "insensitive" } },
    });
    if (existing) return serialize(existing);
    const movement = await prisma.movement.create({ data: { name: trimmed } });
    return serialize(movement);
  } catch (error) {
    return handleError(error);
  }
};
