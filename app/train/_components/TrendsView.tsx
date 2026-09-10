"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { ArrowLeft } from "lucide-react";
import {
  Bar,
  BarChart,
  CartesianGrid,
  Line,
  LineChart,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { ActivityType, WeightUnit } from "@prisma/client";
import type {
  BlockResults,
  SetEntry,
  SplitEntry,
} from "@/app/_lib/types/training";
import { cn } from "@/app/_lib/utils/index";
import { ACTIVITY_LABELS, ANTON, fmtDay, setSummary } from "./logger-utils";
import { SplitsSummary } from "./PlanCard";
import type { MovementDto } from "./types";

export type TrendRow = {
  movementId: string;
  sets: SetEntry[];
  movement: MovementDto;
  loggedSession: { date: string; activityType: ActivityType };
};

export type TrendSession = {
  id: string;
  date: string;
  activityType: ActivityType;
  score: string | null;
  scoreType: string | null;
  durationMin: number | null;
  rpe: number | null;
  blockResults: BlockResults | null;
  plannedSession: { title: string } | null;
};

// Chart hues from the site's blue system, one series per chart on the dark
// surface: sky for lines, cta blue for bars.
const LINE = "#6ba3f5";
const BAR = "#1a73e8";
const GRID = "rgba(255,255,255,0.06)";
const TICK = { fill: "#7c8698", fontSize: 11 };

const LB_PER_KG = 2.20462;

function toUnit(w: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return w;
  return to === "LB" ? w * LB_PER_KG : w / LB_PER_KG;
}

/** Epley estimated 1RM. Reps of 1 (or missing) returns the weight itself. */
function epley(weight: number, reps?: number): number {
  if (!reps || reps <= 1) return weight;
  return weight * (1 + reps / 30);
}

type Point = {
  day: string; // YYYY-MM-DD
  label: string; // M/D
  est1: number;
  top: number;
  volume: number;
  distance: number;
  sets: SetEntry[];
};

function ChartTooltip({
  active,
  payload,
  suffix,
}: {
  active?: boolean;
  payload?: { payload: Point; value: number }[];
  suffix: string;
}) {
  if (!active || !payload?.length) return null;
  const p = payload[0];
  return (
    <div className="rounded-lg border border-white/10 bg-[#0f1420] px-3 py-2 text-sm shadow-xl">
      <p className="text-neutral-400">
        {fmtDay(`${p.payload.day}T00:00:00.000Z`)}
      </p>
      <p className="font-semibold text-neutral-50">
        {Math.round(p.value * 10) / 10} {suffix}
      </p>
    </div>
  );
}

function Stat({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex-1 rounded-xl bg-[#131826] p-3">
      <p className={`${ANTON} text-2xl text-neutral-50`}>{value}</p>
      <p className="mt-0.5 text-[11px] font-semibold uppercase tracking-wider text-neutral-500">
        {label}
      </p>
    </div>
  );
}

export default function TrendsView({
  rows,
  sessions,
}: {
  rows: TrendRow[];
  sessions: TrendSession[];
}) {
  // Movements ordered by how often they've been logged with real data.
  const movements = useMemo(() => {
    const byId = new Map<string, { movement: MovementDto; count: number }>();
    for (const row of rows) {
      if (!Array.isArray(row.sets) || row.sets.length === 0) continue;
      const entry = byId.get(row.movementId) ?? {
        movement: row.movement,
        count: 0,
      };
      entry.count += 1;
      byId.set(row.movementId, entry);
    }
    return [...byId.values()]
      .sort((a, b) => b.count - a.count)
      .map((e) => e.movement);
  }, [rows]);

  const [selectedId, setSelectedId] = useState<string | null>(null);
  const selected = movements.find((m) => m.id === selectedId) ?? movements[0];

  const [worldFilter, setWorldFilter] = useState<ActivityType | "ALL">("ALL");

  const points = useMemo(() => {
    if (!selected) return [];
    const unit = selected.defaultUnit as WeightUnit;
    const byDay = new Map<string, Point>();
    for (const row of rows) {
      if (row.movementId !== selected.id) continue;
      const day = row.loggedSession.date.slice(0, 10);
      const point =
        byDay.get(day) ??
        ({
          day,
          label: `${Number(day.slice(5, 7))}/${Number(day.slice(8, 10))}`,
          est1: 0,
          top: 0,
          volume: 0,
          distance: 0,
          sets: [],
        } as Point);
      for (const set of row.sets ?? []) {
        point.sets.push(set);
        if (set.weight !== undefined && set.weight !== null) {
          const w = toUnit(set.weight, (set.unit ?? "LB") as WeightUnit, unit);
          point.top = Math.max(point.top, w);
          point.est1 = Math.max(point.est1, epley(w, set.reps ?? undefined));
          if (set.reps) point.volume += w * set.reps;
        }
        if (set.distanceM) point.distance += set.distanceM;
      }
      byDay.set(day, point);
    }
    return [...byDay.values()].sort((a, b) => a.day.localeCompare(b.day));
  }, [rows, selected]);

  const isWeight = points.some((p) => p.top > 0);
  const unitLabel = selected ? selected.defaultUnit.toLowerCase() : "lb";
  const latest = points[points.length - 1];
  const best = points.reduce((acc, p) => Math.max(acc, p.est1), 0);
  const totalDistance = points.reduce((acc, p) => acc + p.distance, 0);

  const filteredSessions =
    worldFilter === "ALL"
      ? sessions
      : sessions.filter((s) => s.activityType === worldFilter);

  // Test days, simulations, and anything with recorded splits, the plan's
  // "Benchmarks tab". Sessions come back newest first, so this list is too.
  const benchmarks = useMemo(
    () =>
      sessions
        .map((s) => {
          const splits: SplitEntry[] | null = s.blockResults
            ? (Object.values(s.blockResults).find((r) => r?.splits?.length)
                ?.splits ?? null)
            : null;
          const isBenchmark =
            (s.plannedSession &&
              /BENCH|SIM|TEST|RACE/i.test(s.plannedSession.title)) ||
            splits !== null;
          return isBenchmark ? { session: s, splits } : null;
        })
        .filter(
          (b): b is { session: TrendSession; splits: SplitEntry[] | null } =>
            b !== null,
        ),
    [sessions],
  );

  return (
    <div className="mx-auto min-h-dvh max-w-md px-3 pb-10">
      <header className="sticky top-0 z-20 -mx-3 mb-3 flex items-center gap-2 bg-[#0a0e16]/95 px-3 pb-2 pt-[max(0.75rem,env(safe-area-inset-top))] backdrop-blur">
        <Link
          href="/train"
          aria-label="Back to today"
          className="flex h-11 w-11 shrink-0 items-center justify-center rounded-lg text-neutral-300 active:bg-white/10"
        >
          <ArrowLeft className="h-5 w-5" />
        </Link>
        <h1
          className={`${ANTON} text-xl uppercase tracking-wide text-neutral-50`}
        >
          Trends
        </h1>
      </header>

      {movements.length === 0 ? (
        <p className="rounded-2xl bg-[#131826] p-6 text-center text-neutral-400">
          Nothing to chart yet. Log a few sessions and the lifts will show up
          here.
        </p>
      ) : (
        <>
          {/* Movement selector */}
          <div className="-mx-3 mb-3 flex gap-1.5 overflow-x-auto px-3 pb-1">
            {movements.map((m) => (
              <button
                key={m.id}
                type="button"
                onClick={() => setSelectedId(m.id)}
                className={cn(
                  "min-h-11 shrink-0 whitespace-nowrap rounded-lg border px-3 text-sm font-semibold",
                  selected?.id === m.id
                    ? "border-cta bg-cta/15 text-[#6ba3f5]"
                    : "border-white/10 text-neutral-400 active:bg-white/10",
                )}
              >
                {m.name}
              </button>
            ))}
          </div>

          {/* Stat tiles */}
          <div className="mb-3 flex gap-2">
            {isWeight ? (
              <>
                <Stat
                  label={`Latest est 1RM (${unitLabel})`}
                  value={latest ? String(Math.round(latest.est1)) : "—"}
                />
                <Stat
                  label={`Best est 1RM (${unitLabel})`}
                  value={best ? String(Math.round(best)) : "—"}
                />
              </>
            ) : (
              <Stat
                label="Total meters"
                value={String(Math.round(totalDistance))}
              />
            )}
            <Stat label="Sessions" value={String(points.length)} />
          </div>

          {/* Charts */}
          {isWeight ? (
            <>
              <section className="mb-3 rounded-2xl bg-[#131826] p-3">
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                  Estimated 1RM ({unitLabel})
                </h2>
                <ResponsiveContainer width="100%" height={200}>
                  <LineChart
                    data={points}
                    margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
                  >
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={TICK}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis
                      tick={TICK}
                      axisLine={false}
                      tickLine={false}
                      domain={["auto", "auto"]}
                    />
                    <Tooltip
                      content={<ChartTooltip suffix={unitLabel} />}
                      cursor={{ stroke: GRID }}
                    />
                    <Line
                      type="monotone"
                      dataKey="est1"
                      stroke={LINE}
                      strokeWidth={2}
                      dot={{ r: 4, fill: LINE, strokeWidth: 0 }}
                      activeDot={{ r: 5.5 }}
                      isAnimationActive={false}
                    />
                  </LineChart>
                </ResponsiveContainer>
              </section>

              <section className="mb-3 rounded-2xl bg-[#131826] p-3">
                <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                  Volume per session ({unitLabel})
                </h2>
                <ResponsiveContainer width="100%" height={160}>
                  <BarChart
                    data={points}
                    margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
                    barCategoryGap={2}
                  >
                    <CartesianGrid stroke={GRID} vertical={false} />
                    <XAxis
                      dataKey="label"
                      tick={TICK}
                      axisLine={false}
                      tickLine={false}
                      interval="preserveStartEnd"
                    />
                    <YAxis tick={TICK} axisLine={false} tickLine={false} />
                    <Tooltip
                      content={<ChartTooltip suffix={unitLabel} />}
                      cursor={{ fill: "rgba(255,255,255,0.04)" }}
                    />
                    <Bar
                      dataKey="volume"
                      fill={BAR}
                      radius={[4, 4, 0, 0]}
                      maxBarSize={28}
                      isAnimationActive={false}
                    />
                  </BarChart>
                </ResponsiveContainer>
              </section>
            </>
          ) : (
            <section className="mb-3 rounded-2xl bg-[#131826] p-3">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                Meters per session
              </h2>
              <ResponsiveContainer width="100%" height={200}>
                <BarChart
                  data={points}
                  margin={{ top: 8, right: 8, bottom: 0, left: -18 }}
                  barCategoryGap={2}
                >
                  <CartesianGrid stroke={GRID} vertical={false} />
                  <XAxis
                    dataKey="label"
                    tick={TICK}
                    axisLine={false}
                    tickLine={false}
                    interval="preserveStartEnd"
                  />
                  <YAxis tick={TICK} axisLine={false} tickLine={false} />
                  <Tooltip
                    content={<ChartTooltip suffix="m" />}
                    cursor={{ fill: "rgba(255,255,255,0.04)" }}
                  />
                  <Bar
                    dataKey="distance"
                    fill={BAR}
                    radius={[4, 4, 0, 0]}
                    maxBarSize={28}
                    isAnimationActive={false}
                  />
                </BarChart>
              </ResponsiveContainer>
            </section>
          )}

          {/* Table view of the same data */}
          <section className="mb-6 rounded-2xl bg-[#131826] p-3">
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
              {selected?.name} history
            </h2>
            {[...points].reverse().map((p) => (
              <div
                key={p.day}
                className="flex items-baseline justify-between gap-3 border-b border-white/5 py-2 last:border-0"
              >
                <span className="shrink-0 text-sm text-neutral-500">
                  {fmtDay(`${p.day}T00:00:00.000Z`)}
                </span>
                <span className="text-right text-sm text-neutral-200">
                  {p.sets.map((s) => setSummary(s)).join(", ")}
                </span>
              </div>
            ))}
          </section>

          {/* Benchmarks & simulations */}
          {benchmarks.length > 0 && (
            <section className="mb-6">
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
                Benchmarks &amp; sims
              </h2>
              {benchmarks.map(({ session: s, splits }) => (
                <Link
                  key={s.id}
                  href={`/train/log/${s.id}`}
                  className="mb-1.5 block rounded-xl bg-[#131826] px-4 py-3 active:bg-[#1a2136]"
                >
                  <div className="flex items-baseline justify-between gap-3">
                    <span
                      className={`${ANTON} text-base uppercase tracking-wide text-neutral-50`}
                    >
                      {s.plannedSession?.title ??
                        ACTIVITY_LABELS[s.activityType]}
                    </span>
                    <span className="shrink-0 text-xs text-neutral-500">
                      {fmtDay(s.date)}
                    </span>
                  </div>
                  {s.score && (
                    <p className={`${ANTON} mt-0.5 text-xl text-[#6ba3f5]`}>
                      {s.score}
                    </p>
                  )}
                  {splits && <SplitsSummary splits={splits} />}
                </Link>
              ))}
            </section>
          )}

          {/* Session history, filterable by world */}
          <section>
            <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-widest text-neutral-500">
              All sessions
            </h2>
            <div className="mb-2 flex flex-wrap gap-1.5">
              {(
                ["ALL", "HYROX", "CROSSFIT", "RUN", "YOGA", "CLIMBING"] as const
              ).map((w) => (
                <button
                  key={w}
                  type="button"
                  onClick={() => setWorldFilter(w as ActivityType | "ALL")}
                  className={cn(
                    "min-h-10 rounded-lg border px-2.5 text-xs font-semibold",
                    worldFilter === w
                      ? "border-cta bg-cta/15 text-[#6ba3f5]"
                      : "border-white/10 text-neutral-500 active:bg-white/10",
                  )}
                >
                  {w === "ALL" ? "All" : ACTIVITY_LABELS[w as ActivityType]}
                </button>
              ))}
            </div>
            {filteredSessions.map((s) => (
              <Link
                key={s.id}
                href={`/train/log/${s.id}`}
                className="mb-1 flex min-h-12 items-center justify-between gap-3 rounded-xl bg-[#131826] px-4 py-2.5 active:bg-[#1a2136]"
              >
                <span className="text-sm text-neutral-200">
                  {ACTIVITY_LABELS[s.activityType]}
                  {s.score ? ` · ${s.score}` : ""}
                  {s.durationMin ? ` · ${s.durationMin} min` : ""}
                  {s.rpe ? ` · RPE ${s.rpe}` : ""}
                </span>
                <span className="shrink-0 text-xs text-neutral-500">
                  {fmtDay(s.date)}
                </span>
              </Link>
            ))}
            {filteredSessions.length === 0 && (
              <p className="rounded-xl bg-[#131826] p-4 text-center text-sm text-neutral-500">
                No sessions logged for this filter yet.
              </p>
            )}
          </section>
        </>
      )}
    </div>
  );
}
