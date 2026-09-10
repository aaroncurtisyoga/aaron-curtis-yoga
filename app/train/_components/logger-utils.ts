import { ActivityType, WeightUnit } from "@prisma/client";
import type { SetEntry, SplitEntry } from "@/app/_lib/types/training";
import type { MovementDto, PlanItem } from "./types";

export const LB_PER_KG = 2.20462;

/** Convert a weight between lb and kg, rounded to 1 decimal. */
export function toUnit(w: number, from: WeightUnit, to: WeightUnit): number {
  if (from === to) return w;
  const converted = to === "LB" ? w * LB_PER_KG : w / LB_PER_KG;
  return Math.round(converted * 10) / 10;
}

export const ANTON = "[font-family:var(--font-anton)]";

/** Seconds → "m:ss" (or "h:mm:ss" past the hour). */
export function fmtTime(totalSec: number): string {
  const s = Math.max(0, Math.round(totalSec));
  const h = Math.floor(s / 3600);
  const m = Math.floor((s % 3600) / 60);
  const sec = s % 60;
  const mm = h > 0 ? String(m).padStart(2, "0") : String(m);
  return `${h > 0 ? `${h}:` : ""}${mm}:${String(sec).padStart(2, "0")}`;
}

/** Digit-mask parse: "1432" → 872s (last two digits are seconds). */
export function digitsToSeconds(digits: string): number | undefined {
  const d = digits.replace(/\D/g, "");
  if (!d) return undefined;
  const sec = Number(d.slice(-2));
  const min = Number(d.slice(0, -2) || 0);
  return min * 60 + sec;
}

export function secondsToDigits(sec: number | undefined): string {
  if (sec === undefined || sec === null) return "";
  const m = Math.floor(sec / 60);
  const s = sec % 60;
  return `${m ? m : ""}${String(s).padStart(m ? 2 : 1, "0")}`;
}

/** Live-format a digit string as time, e.g. "1432" → "14:32". */
export function fmtDigits(digits: string): string {
  const d = digits.replace(/\D/g, "");
  if (!d) return "";
  if (d.length <= 2) return d;
  return `${Number(d.slice(0, -2))}:${d.slice(-2)}`;
}

/** Stepper increment: about one plate per unit. */
export function weightStep(unit: WeightUnit): number {
  return unit === WeightUnit.KG ? 2.5 : 5;
}

/** Which inputs a movement's set row shows. Any set may still hold any field. */
export function visibleFields(m: MovementDto): {
  weight: boolean;
  reps: boolean;
  distance: boolean;
  time: boolean;
} {
  switch (m.unitType) {
    case "WEIGHT_REPS":
      return { weight: true, reps: true, distance: false, time: false };
    case "REPS":
      return { weight: false, reps: true, distance: false, time: false };
    case "DURATION":
      return { weight: false, reps: false, distance: false, time: true };
    case "DISTANCE_TIME":
    default: {
      const carriesLoad = m.category === "STATION" || m.category === "CARRY";
      return { weight: carriesLoad, reps: false, distance: true, time: true };
    }
  }
}

/** Compact human summary of one set: "185 lb × 8", "25m · 0:45 @ 102 kg". */
export function setSummary(set: SetEntry): string {
  const parts: string[] = [];
  if (set.distanceM !== undefined && set.distanceM !== null) {
    parts.push(`${set.distanceM}m`);
  }
  if (set.timeSec !== undefined && set.timeSec !== null) {
    parts.push(fmtTime(set.timeSec));
  }
  let core = parts.join(" · ");
  const unit = (set.unit ?? "LB").toLowerCase();
  if (set.weight !== undefined && set.weight !== null) {
    if (core) core += ` @ ${set.weight} ${unit}`;
    else core = `${set.weight} ${unit}`;
  }
  if (set.reps !== undefined && set.reps !== null) {
    core = core ? `${core} × ${set.reps}` : `× ${set.reps}`;
  }
  return core || "Done";
}

/** Format a @db.Date ISO string ("2026-07-31T00:00:00.000Z") as a day label. */
export function fmtDay(iso: string, opts?: Intl.DateTimeFormatOptions): string {
  return new Intl.DateTimeFormat("en-US", {
    timeZone: "UTC", // the ISO string is already the calendar day, don't shift it
    weekday: "short",
    month: "short",
    day: "numeric",
    ...opts,
  }).format(new Date(iso));
}

export function ymd(iso: string): string {
  return iso.slice(0, 10);
}

/** Today's calendar date in ET as YYYY-MM-DD (client-side mirror of etToday). */
export function etTodayYmd(): string {
  return new Intl.DateTimeFormat("en-CA", {
    timeZone: "America/New_York",
  }).format(new Date());
}

export const ACTIVITY_LABELS: Record<ActivityType, string> = {
  HYROX: "Hyrox",
  CROSSFIT: "CrossFit",
  RUN: "Run",
  YOGA: "Yoga",
  CLIMBING: "Climbing",
};

export const SCORE_TYPES = [
  { key: "FOR_TIME", label: "For time" },
  { key: "AMRAP", label: "AMRAP" },
  { key: "LOAD", label: "Load" },
  { key: "REPS", label: "Reps" },
] as const;

/**
 * Which inline result entry a plan block earns. CrossFit parts carry an
 * explicit scoreType; Hyrox main/test/race blocks get a time field by label.
 * Everything else logs with the checkmark alone.
 */
export function scoredKind(item: PlanItem): "time" | "amrap" | null {
  if (item.scoreType === "FOR_TIME") return "time";
  if (item.scoreType === "AMRAP") return "amrap";
  if (item.scoreType) return null;
  if (/^(MAIN|RACE|TEST|FULL RACE|THE RACE)/i.test(item.label)) return "time";
  return null;
}

/**
 * Parse a race-order block ("• 1km run → SkiErg 1000m" lines) into the lap
 * sequence for split mode: Run 1 → Roxzone → Station → Roxzone → Run 2 …
 * Returns null when the block isn't race-shaped (fewer than 2 pairs).
 */
export function raceSegments(item: PlanItem): string[] | null {
  const pairs = item.text
    .split("\n")
    .map((line) => line.match(/^•\s*(.+?)\s*(?:→|->)\s*(.+)$/))
    .filter((m): m is RegExpMatchArray => m !== null);
  if (pairs.length < 2) return null;
  const segments: string[] = [];
  pairs.forEach((m, i) => {
    segments.push(`Run ${i + 1}`);
    segments.push("Roxzone");
    segments.push(m[2].replace(/\(.*?\)/g, "").trim());
    if (i < pairs.length - 1) segments.push("Roxzone");
  });
  return segments;
}

/** Total transition time across a splits array. */
export function roxzoneTotal(splits: SplitEntry[]): number {
  return splits
    .filter((s) => s.label === "Roxzone")
    .reduce((acc, s) => acc + s.sec, 0);
}

/** Run fade: last run vs first run, as a percentage. */
export function runFade(splits: SplitEntry[]): number | null {
  const runs = splits.filter((s) => /^Run \d+$/.test(s.label));
  if (runs.length < 2) return null;
  const first = runs[0].sec;
  const last = runs[runs.length - 1].sec;
  if (first <= 0) return null;
  return Math.round(((last - first) / first) * 1000) / 10;
}
