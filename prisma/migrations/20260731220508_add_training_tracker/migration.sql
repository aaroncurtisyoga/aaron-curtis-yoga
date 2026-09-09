-- CreateEnum
CREATE TYPE "MovementCategory" AS ENUM ('BARBELL', 'DUMBBELL', 'MACHINE', 'GYMNASTIC', 'STATION', 'CARRY', 'CORE', 'OTHER');

-- CreateEnum
CREATE TYPE "UnitType" AS ENUM ('WEIGHT_REPS', 'DISTANCE_TIME', 'REPS', 'DURATION');

-- CreateEnum
CREATE TYPE "WeightUnit" AS ENUM ('LB', 'KG');

-- CreateEnum
CREATE TYPE "TrainingWorld" AS ENUM ('HYROX', 'CROSSFIT');

-- CreateEnum
CREATE TYPE "PlannedSource" AS ENUM ('AUTHORED', 'PUSHPRESS', 'MANUAL');

-- CreateEnum
CREATE TYPE "ActivityType" AS ENUM ('HYROX', 'CROSSFIT', 'RUN', 'YOGA', 'CLIMBING');

-- CreateTable
CREATE TABLE "Movement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "name" TEXT NOT NULL,
    "category" "MovementCategory" NOT NULL DEFAULT 'OTHER',
    "unitType" "UnitType" NOT NULL DEFAULT 'WEIGHT_REPS',
    "defaultUnit" "WeightUnit" NOT NULL DEFAULT 'LB',

    CONSTRAINT "Movement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "PlannedSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "date" DATE NOT NULL,
    "world" "TrainingWorld" NOT NULL,
    "title" TEXT NOT NULL,
    "source" "PlannedSource" NOT NULL,
    "rawText" TEXT,
    "blocks" JSONB,
    "sourceId" TEXT,

    CONSTRAINT "PlannedSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoggedSession" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "date" DATE NOT NULL,
    "activityType" "ActivityType" NOT NULL,
    "plannedSessionId" TEXT,
    "rpe" INTEGER,
    "felt" INTEGER,
    "durationMin" INTEGER,
    "score" TEXT,
    "scoreType" TEXT,
    "notes" TEXT,

    CONSTRAINT "LoggedSession_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "LoggedMovement" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    "loggedSessionId" TEXT NOT NULL,
    "movementId" TEXT NOT NULL,
    "order" INTEGER NOT NULL DEFAULT 0,
    "sets" JSONB NOT NULL DEFAULT '[]',
    "notes" TEXT,

    CONSTRAINT "LoggedMovement_pkey" PRIMARY KEY ("id")
);

-- CreateTable
CREATE TABLE "GarminActivity" (
    "id" TEXT NOT NULL,
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "garminId" TEXT NOT NULL,
    "date" DATE NOT NULL,
    "type" TEXT NOT NULL,
    "avgHr" INTEGER,
    "maxHr" INTEGER,
    "distanceM" DOUBLE PRECISION,
    "durationSec" INTEGER,
    "avgPaceSecPerKm" DOUBLE PRECISION,
    "raw" JSONB,

    CONSTRAINT "GarminActivity_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Movement_name_key" ON "Movement"("name");

-- CreateIndex
CREATE UNIQUE INDEX "PlannedSession_sourceId_key" ON "PlannedSession"("sourceId");

-- CreateIndex
CREATE INDEX "PlannedSession_date_idx" ON "PlannedSession"("date");

-- CreateIndex
CREATE INDEX "LoggedSession_date_idx" ON "LoggedSession"("date");

-- CreateIndex
CREATE INDEX "LoggedSession_activityType_date_idx" ON "LoggedSession"("activityType", "date");

-- CreateIndex
CREATE INDEX "LoggedMovement_movementId_createdAt_idx" ON "LoggedMovement"("movementId", "createdAt");

-- CreateIndex
CREATE INDEX "LoggedMovement_loggedSessionId_idx" ON "LoggedMovement"("loggedSessionId");

-- CreateIndex
CREATE UNIQUE INDEX "GarminActivity_garminId_key" ON "GarminActivity"("garminId");

-- CreateIndex
CREATE INDEX "GarminActivity_date_idx" ON "GarminActivity"("date");

-- AddForeignKey
ALTER TABLE "LoggedSession" ADD CONSTRAINT "LoggedSession_plannedSessionId_fkey" FOREIGN KEY ("plannedSessionId") REFERENCES "PlannedSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoggedMovement" ADD CONSTRAINT "LoggedMovement_loggedSessionId_fkey" FOREIGN KEY ("loggedSessionId") REFERENCES "LoggedSession"("id") ON DELETE CASCADE ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "LoggedMovement" ADD CONSTRAINT "LoggedMovement_movementId_fkey" FOREIGN KEY ("movementId") REFERENCES "Movement"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

