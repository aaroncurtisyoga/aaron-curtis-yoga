import { WeightUnit } from "@prisma/client";

/**
 * One performed set. Any combination of fields is valid — Hyrox stations mix
 * weight + distance + time in a single set (e.g. sled push 25m @ 102kg), while
 * a barbell set is just weight + reps. This is the shape stored in
 * LoggedMovement.sets (Json).
 */
export type SetEntry = {
  weight?: number;
  unit?: WeightUnit;
  reps?: number;
  distanceM?: number;
  timeSec?: number;
};

/** One timed segment of a race-order block (sim split mode). */
export type SplitEntry = {
  label: string;
  sec: number;
};

/** Inline result for one plan block, keyed by block index in blockResults. */
export type BlockResult = {
  done?: boolean;
  timeSec?: number;
  rounds?: number;
  reps?: number;
  splits?: SplitEntry[];
};

export type BlockResults = Record<string, BlockResult>;

export type UpdateLoggedSessionParams = {
  date?: string; // YYYY-MM-DD
  rpe?: number | null;
  felt?: number | null;
  durationMin?: number | null;
  score?: string | null;
  scoreType?: string | null;
  notes?: string | null;
  blockResults?: BlockResults;
};
