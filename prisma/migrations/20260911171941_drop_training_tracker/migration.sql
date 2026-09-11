-- DropForeignKey
ALTER TABLE "LoggedSession" DROP CONSTRAINT "LoggedSession_plannedSessionId_fkey";

-- DropForeignKey
ALTER TABLE "LoggedMovement" DROP CONSTRAINT "LoggedMovement_loggedSessionId_fkey";

-- DropForeignKey
ALTER TABLE "LoggedMovement" DROP CONSTRAINT "LoggedMovement_movementId_fkey";

-- DropForeignKey
ALTER TABLE "GarminActivity" DROP CONSTRAINT "GarminActivity_loggedSessionId_fkey";

-- DropTable
DROP TABLE "Movement";

-- DropTable
DROP TABLE "PlannedSession";

-- DropTable
DROP TABLE "LoggedSession";

-- DropTable
DROP TABLE "LoggedMovement";

-- DropTable
DROP TABLE "GarminActivity";

-- DropTable
DROP TABLE "DailyWellness";

-- DropEnum
DROP TYPE "MovementCategory";

-- DropEnum
DROP TYPE "UnitType";

-- DropEnum
DROP TYPE "WeightUnit";

-- DropEnum
DROP TYPE "TrainingWorld";

-- DropEnum
DROP TYPE "PlannedSource";

-- DropEnum
DROP TYPE "ActivityType";

