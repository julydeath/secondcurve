/*
  Warnings:

  - A unique constraint covering the columns `[mentorId,startAt]` on the table `AvailabilitySlot` will be added. If there are existing duplicate values, this will fail.

*/
-- CreateIndex
CREATE UNIQUE INDEX "AvailabilitySlot_mentorId_startAt_key" ON "AvailabilitySlot"("mentorId", "startAt");
