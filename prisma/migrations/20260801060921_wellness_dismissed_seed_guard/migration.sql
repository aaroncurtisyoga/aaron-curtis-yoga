-- AlterTable
ALTER TABLE "GarminActivity" ADD COLUMN     "dismissed" BOOLEAN NOT NULL DEFAULT false;

-- CreateTable
CREATE TABLE "DailyWellness" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" DATE NOT NULL,
    "hrvMs" DOUBLE PRECISION,
    "hrvStatus" TEXT,
    "restingHr" INTEGER,
    "rhr7dAvg" INTEGER,
    "sleepSec" INTEGER,
    "sleepScore" INTEGER,
    "bodyBatteryChange" INTEGER,
    "avgSleepStress" DOUBLE PRECISION,
    "respirationAvg" DOUBLE PRECISION,

    CONSTRAINT "DailyWellness_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "DailyWellness_date_key" ON "DailyWellness"("date");


-- Guard: the seeded plan must never double-insert (first-load races, two
-- devices). Partial unique index because MANUAL pastes may repeat per day.
CREATE UNIQUE INDEX IF NOT EXISTS "PlannedSession_authored_day_key"
  ON "PlannedSession"("date", "world") WHERE "source" = 'AUTHORED';
