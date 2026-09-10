"use client";

import { ReactNode, useMemo, useState } from "react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import {
  ChevronRight,
  Flame,
  Flower2,
  Footprints,
  Mountain,
  RefreshCw,
  TrendingUp,
  Zap,
} from "lucide-react";
import { ActivityType } from "@prisma/client";
import {
  createLoggedSession,
  syncGarminNow,
} from "@/app/_lib/actions/training.actions";
import { HYROX_RACE_YMD } from "@/app/_lib/constants/training";
import {
  ACTIVITY_LABELS,
  ANTON,
  etTodayYmd,
  fmtDay,
  fmtTime,
  ymd,
} from "./logger-utils";
import type { PlannedSessionDto, SessionWithMovementsDto } from "./types";

const ACTIVITIES: { type: ActivityType; icon: ReactNode }[] = [
  { type: "HYROX", icon: <Flame className="h-6 w-6" /> },
  { type: "CROSSFIT", icon: <Zap className="h-6 w-6" /> },
  { type: "RUN", icon: <Footprints className="h-6 w-6" /> },
  { type: "YOGA", icon: <Flower2 className="h-6 w-6" /> },
  { type: "CLIMBING", icon: <Mountain className="h-6 w-6" /> },
];

function sessionSummary(s: SessionWithMovementsDto): string {
  const bits: string[] = [];
  const g = s.garminActivity;
  if (g?.distanceM) {
    bits.push(
      `${(g.distanceM / 1000).toFixed(1)} km` +
        (g.avgPaceSecPerKm
          ? ` · ${fmtTime(Math.round(g.avgPaceSecPerKm))}/km`
          : "") +
        (g.avgHr ? ` · ${g.avgHr} bpm` : ""),
    );
  }
  if (s.movements.length > 0) {
    const names = s.movements.map((m) => m.movement.name);
    bits.push(names.slice(0, 3).join(", ") + (names.length > 3 ? "…" : ""));
  }
  if (s.score) bits.push(s.score);
  if (s.durationMin) bits.push(`${s.durationMin} min`);
  if (s.rpe) bits.push(`RPE ${s.rpe}`);
  return bits.join(" · ") || "Logged";
}

function SessionCard({ session }: { session: SessionWithMovementsDto }) {
  return (
    <Link
      href={`/train/log/${session.id}`}
      className="mb-1.5 flex min-h-16 items-center justify-between gap-3 rounded-xl bg-[#131826] px-4 py-3 active:bg-[#1a2136]"
    >
      <div className="min-w-0">
        <p
          className={`${ANTON} text-base uppercase tracking-wide text-neutral-50`}
        >
          {ACTIVITY_LABELS[session.activityType]}
        </p>
        <p className="truncate text-sm text-neutral-500">
          {sessionSummary(session)}
        </p>
      </div>
      <ChevronRight className="h-5 w-5 shrink-0 text-neutral-600" />
    </Link>
  );
}

export default function TrainHome({
  todaySessions,
  recentSessions,
  todayPlans,
}: {
  todaySessions: SessionWithMovementsDto[];
  recentSessions: SessionWithMovementsDto[];
  todayPlans: PlannedSessionDto[];
}) {
  const router = useRouter();
  const [starting, setStarting] = useState<ActivityType | null>(null);
  const [syncing, setSyncing] = useState(false);
  const [syncMsg, setSyncMsg] = useState<string | null>(null);

  async function syncGarmin() {
    if (syncing) return;
    setSyncing(true);
    setSyncMsg(null);
    try {
      const result = await syncGarminNow();
      if (result.ok) {
        setSyncMsg(
          result.runsCreated > 0
            ? `${result.runsCreated} run${result.runsCreated === 1 ? "" : "s"} imported from Garmin`
            : "Garmin is up to date",
        );
        router.refresh();
      } else {
        setSyncMsg(result.reason ?? "Garmin sync failed");
      }
    } catch (error) {
      console.error(error);
      setSyncMsg("Garmin sync failed");
    } finally {
      setSyncing(false);
    }
  }

  const historyByDay = useMemo(() => {
    const groups: { day: string; sessions: SessionWithMovementsDto[] }[] = [];
    for (const s of recentSessions) {
      const day = ymd(s.date);
      const last = groups[groups.length - 1];
      if (last && last.day === day) last.sessions.push(s);
      else groups.push({ day, sessions: [s] });
    }
    return groups;
  }, [recentSessions]);

  async function start(type: ActivityType) {
    if (starting) return;
    setStarting(type);
    try {
      const session = await createLoggedSession({ activityType: type });
      router.push(`/train/log/${session.id}`);
    } catch (error) {
      console.error(error);
      setStarting(null);
    }
  }

  return (
    <div className="mx-auto min-h-dvh max-w-md px-3 pb-10">
      <header className="flex items-end justify-between pb-4 pt-[max(1.25rem,env(safe-area-inset-top))]">
        <h1
          className={`${ANTON} text-3xl uppercase tracking-wide text-neutral-50`}
        >
          Train
        </h1>
        <div className="flex items-center gap-3">
          <p
            className={`${ANTON} text-sm uppercase tracking-wider text-[#6ba3f5]`}
          >
            {fmtDay(new Date().toISOString(), { timeZone: "America/New_York" })}
          </p>
          <button
            type="button"
            onClick={syncGarmin}
            aria-label="Pull runs from Garmin"
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#131826] text-[#6ba3f5] active:bg-[#1a2136]"
          >
            <RefreshCw className={`h-5 w-5 ${syncing ? "animate-spin" : ""}`} />
          </button>
          <Link
            href="/train/trends"
            aria-label="Trends"
            className="flex h-11 w-11 items-center justify-center rounded-lg bg-[#131826] text-[#6ba3f5] active:bg-[#1a2136]"
          >
            <TrendingUp className="h-5 w-5" />
          </Link>
        </div>
      </header>
      {syncMsg && (
        <p className="-mt-2 pb-3 text-sm text-neutral-500">{syncMsg}</p>
      )}

      {(() => {
        const daysToRace = Math.round(
          (Date.parse(`${HYROX_RACE_YMD}T00:00:00Z`) -
            Date.parse(`${etTodayYmd()}T00:00:00Z`)) /
            86_400_000,
        );
        if (daysToRace < 0) return null;
        const hyroxPlan = todayPlans.find((p) => p.world === "HYROX");
        const week = hyroxPlan?.blocks?.week;
        const phase = hyroxPlan?.blocks?.phase;
        return (
          <p
            className={`${ANTON} -mt-1 pb-4 text-sm uppercase tracking-wider text-neutral-500`}
          >
            {daysToRace === 0 ? (
              <span className="text-cta">Race day</span>
            ) : (
              <>
                <span className="text-neutral-50">{daysToRace}</span> days to
                race
              </>
            )}
            {week ? ` · Wk ${week}/11` : ""}
            {phase && phase !== "RACE" ? ` ${phase}` : ""}
          </p>
        );
      })()}

      {(() => {
        // Rest days show the plan's note instead of an invitation to train.
        const hyroxPlan = todayPlans.find((p) => p.world === "HYROX");
        const isRest =
          hyroxPlan &&
          (hyroxPlan.blocks?.items?.length ?? 0) === 0 &&
          hyroxPlan.blocks?.note;
        if (!isRest) return null;
        return (
          <section className="mb-5 rounded-2xl border border-[#6ba3f5]/25 bg-[#10182b] p-4">
            <p className="text-[11px] font-semibold uppercase tracking-widest text-[#6ba3f5]">
              {hyroxPlan.title}
            </p>
            <p className="mt-1 text-sm leading-relaxed text-neutral-300">
              {hyroxPlan.blocks!.note}
            </p>
          </section>
        );
      })()}

      {todaySessions.length > 0 && (
        <section className="mb-5">
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
            Today
          </h2>
          {todaySessions.map((s) => (
            <SessionCard key={s.id} session={s} />
          ))}
        </section>
      )}

      {/* Tap an activity to create a session and start logging. */}
      <section className="mb-6">
        <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
          Start
        </h2>
        <div className="flex flex-col gap-2">
          {ACTIVITIES.map(({ type, icon }) => {
            const plan =
              type === "HYROX" || type === "CROSSFIT"
                ? todayPlans.find((p) => p.world === type)
                : undefined;
            const subtitle =
              type === "HYROX" && plan
                ? `${plan.title}${plan.blocks?.durationMin ? ` · ~${plan.blocks.durationMin} min` : ""}`
                : type === "CROSSFIT"
                  ? (plan?.title ?? "Fetches today’s WOD")
                  : null;
            return (
              <button
                key={type}
                type="button"
                disabled={starting !== null}
                onClick={() => start(type)}
                className="flex min-h-16 w-full items-center gap-4 rounded-xl bg-[#131826] px-5 py-3 text-left active:bg-[#1a2136] disabled:opacity-60"
              >
                <span className="text-[#6ba3f5]">{icon}</span>
                <span className="min-w-0 flex-1">
                  <span
                    className={`${ANTON} block text-xl uppercase tracking-wide text-neutral-50`}
                  >
                    {ACTIVITY_LABELS[type]}
                  </span>
                  {subtitle && (
                    <span className="block truncate text-sm text-neutral-500">
                      {subtitle}
                    </span>
                  )}
                </span>
                <span className="text-sm text-neutral-600">
                  {starting === type ? (
                    "Starting…"
                  ) : (
                    <ChevronRight className="h-5 w-5" />
                  )}
                </span>
              </button>
            );
          })}
        </div>
      </section>

      {historyByDay.length > 0 && (
        <section>
          <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
            History
          </h2>
          {historyByDay.map((group) => (
            <div key={group.day} className="mb-3">
              <p className="mb-1 px-1 text-xs text-neutral-600">
                {fmtDay(`${group.day}T00:00:00.000Z`)}
              </p>
              {group.sessions.map((s) => (
                <SessionCard key={s.id} session={s} />
              ))}
            </div>
          ))}
        </section>
      )}
    </div>
  );
}
