-- AlterTable
ALTER TABLE "GarminActivity" ADD COLUMN     "loggedSessionId" TEXT,
ADD COLUMN     "name" TEXT;

-- AlterTable
ALTER TABLE "LoggedSession" ADD COLUMN     "blockResults" JSONB;

-- CreateIndex
CREATE UNIQUE INDEX "GarminActivity_loggedSessionId_key" ON "GarminActivity"("loggedSessionId");

-- AddForeignKey
ALTER TABLE "GarminActivity" ADD CONSTRAINT "GarminActivity_loggedSessionId_fkey" FOREIGN KEY ("loggedSessionId") REFERENCES "LoggedSession"("id") ON DELETE SET NULL ON UPDATE CASCADE;

