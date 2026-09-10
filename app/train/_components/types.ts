import type { ActivityType, Movement } from "@prisma/client";
import type { BlockResults, SetEntry } from "@/app/_lib/types/training";
import type { Serialized } from "@/app/_lib/utils/serialize";

export type MovementDto = Serialized<Movement>;

export type LoggedMovementDto = {
  id: string;
  movementId: string;
  order: number;
  notes: string | null;
  sets: SetEntry[];
  movement: MovementDto;
};

export type SessionDto = {
  id: string;
  date: string; // ISO from a @db.Date (UTC midnight, format with UTC not ET)
  activityType: ActivityType;
  rpe: number | null;
  felt: number | null;
  durationMin: number | null;
  score: string | null;
  scoreType: string | null;
  notes: string | null;
  blockResults: BlockResults | null;
};

export type GarminActivityDto = {
  id: string;
  name: string | null;
  type: string;
  distanceM: number | null;
  durationSec: number | null;
  avgHr: number | null;
  maxHr: number | null;
  avgPaceSecPerKm: number | null;
};

export type PlanItem = {
  label: string;
  minutes?: number | null;
  text: string;
  scoreType?: string | null;
};

export type PlannedSessionDto = {
  id: string;
  date: string;
  world: "HYROX" | "CROSSFIT";
  title: string;
  source: "AUTHORED" | "PUSHPRESS" | "MANUAL";
  rawText: string | null;
  blocks: {
    items?: PlanItem[];
    durationMin?: number | null;
    phase?: string;
    week?: number;
    note?: string | null;
  } | null;
};

export type SessionWithMovementsDto = SessionDto & {
  movements: LoggedMovementDto[];
  plannedSession?: PlannedSessionDto | null;
  garminActivity?: GarminActivityDto | null;
};

/** Most recent sets per movement id, from sessions other than the open one. */
export type LastSetsMap = Record<string, SetEntry[]>;
