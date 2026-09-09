import { MovementCategory, UnitType, WeightUnit } from "@prisma/client";

/** Race day (America/New_York calendar date) — drives the home countdown. */
export const HYROX_RACE_YMD = "2026-09-07";

type MovementSeed = {
  name: string;
  category: MovementCategory;
  unitType: UnitType;
  defaultUnit?: WeightUnit;
};

/**
 * Starter movement library, seeded lazily on first /train visit (see
 * ensureMovementLibrary). Names match the Hyrox plan doc's wording so the
 * planned-vs-actual matching stays string-simple. defaultUnit follows how each
 * load is actually prescribed: barbell work in lb, Hyrox station loads in kg.
 */
export const DEFAULT_MOVEMENTS: MovementSeed[] = [
  // Barbell
  {
    name: "Back Squat",
    category: MovementCategory.BARBELL,
    unitType: UnitType.WEIGHT_REPS,
  },
  {
    name: "Front Squat",
    category: MovementCategory.BARBELL,
    unitType: UnitType.WEIGHT_REPS,
  },
  {
    name: "Romanian Deadlift",
    category: MovementCategory.BARBELL,
    unitType: UnitType.WEIGHT_REPS,
  },
  {
    name: "Deadlift",
    category: MovementCategory.BARBELL,
    unitType: UnitType.WEIGHT_REPS,
  },
  {
    name: "Bench Press",
    category: MovementCategory.BARBELL,
    unitType: UnitType.WEIGHT_REPS,
  },
  {
    name: "Push Press",
    category: MovementCategory.BARBELL,
    unitType: UnitType.WEIGHT_REPS,
  },
  {
    name: "Bent-over Row",
    category: MovementCategory.BARBELL,
    unitType: UnitType.WEIGHT_REPS,
  },

  // Dumbbell
  {
    name: "DB Bench Press",
    category: MovementCategory.DUMBBELL,
    unitType: UnitType.WEIGHT_REPS,
  },
  {
    name: "Bulgarian Split Squat",
    category: MovementCategory.DUMBBELL,
    unitType: UnitType.WEIGHT_REPS,
  },
  {
    name: "Chest-supported Row",
    category: MovementCategory.DUMBBELL,
    unitType: UnitType.WEIGHT_REPS,
  },

  // Gymnastic / bodyweight
  {
    name: "Pull-up",
    category: MovementCategory.GYMNASTIC,
    unitType: UnitType.REPS,
  },
  {
    name: "Push-up",
    category: MovementCategory.GYMNASTIC,
    unitType: UnitType.REPS,
  },
  {
    name: "Burpee",
    category: MovementCategory.GYMNASTIC,
    unitType: UnitType.REPS,
  },
  {
    name: "Walking Lunge",
    category: MovementCategory.GYMNASTIC,
    unitType: UnitType.REPS,
  },

  // Hyrox stations
  {
    name: "Sled Push",
    category: MovementCategory.STATION,
    unitType: UnitType.DISTANCE_TIME,
    defaultUnit: WeightUnit.KG,
  },
  {
    name: "Sled Pull",
    category: MovementCategory.STATION,
    unitType: UnitType.DISTANCE_TIME,
    defaultUnit: WeightUnit.KG,
  },
  {
    name: "Wall Ball",
    category: MovementCategory.STATION,
    unitType: UnitType.WEIGHT_REPS,
    defaultUnit: WeightUnit.KG,
  },
  {
    name: "Burpee Broad Jump",
    category: MovementCategory.STATION,
    unitType: UnitType.DISTANCE_TIME,
  },

  // Machines
  {
    name: "SkiErg",
    category: MovementCategory.MACHINE,
    unitType: UnitType.DISTANCE_TIME,
  },
  {
    name: "Row Erg",
    category: MovementCategory.MACHINE,
    unitType: UnitType.DISTANCE_TIME,
  },

  // Carries
  {
    name: "Farmers Carry",
    category: MovementCategory.CARRY,
    unitType: UnitType.DISTANCE_TIME,
    defaultUnit: WeightUnit.KG,
  },
  {
    name: "Sandbag Lunge",
    category: MovementCategory.CARRY,
    unitType: UnitType.DISTANCE_TIME,
    defaultUnit: WeightUnit.KG,
  },

  // Core
  {
    name: "Plank",
    category: MovementCategory.CORE,
    unitType: UnitType.DURATION,
  },
  {
    name: "Hollow Rocks",
    category: MovementCategory.CORE,
    unitType: UnitType.REPS,
  },

  // Intervals inside a session (e.g. 6x400m run bridges); full runs are their
  // own LoggedSession, this movement is for run pieces within Hyrox/CrossFit.
  {
    name: "Run",
    category: MovementCategory.OTHER,
    unitType: UnitType.DISTANCE_TIME,
  },
];
