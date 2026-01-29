/*
  Warnings:

  - You are about to drop the column `bufferAfterMinutes` on the `AvailabilityRule` table. All the data in the column will be lost.
  - You are about to drop the column `bufferBeforeMinutes` on the `AvailabilityRule` table. All the data in the column will be lost.
  - You are about to drop the column `endTime` on the `AvailabilityRule` table. All the data in the column will be lost.
  - You are about to drop the column `bufferAfterMinutes` on the `AvailabilitySlot` table. All the data in the column will be lost.
  - You are about to drop the column `bufferBeforeMinutes` on the `AvailabilitySlot` table. All the data in the column will be lost.
  - Added the required column `title` to the `AvailabilityRule` table without a default value. This is not possible if the table is not empty.

*/
-- CreateEnum
CREATE TYPE "AvailabilityMode" AS ENUM ('ONE_TIME', 'RECURRING');

-- AlterTable
ALTER TABLE "AvailabilityRule" DROP COLUMN "bufferAfterMinutes",
DROP COLUMN "bufferBeforeMinutes",
DROP COLUMN "endTime",
ADD COLUMN     "meetingLink" TEXT,
ADD COLUMN     "mode" "AvailabilityMode" NOT NULL DEFAULT 'ONE_TIME',
ADD COLUMN     "title" TEXT NOT NULL;

-- AlterTable
ALTER TABLE "AvailabilitySlot" DROP COLUMN "bufferAfterMinutes",
DROP COLUMN "bufferBeforeMinutes",
ADD COLUMN     "meetingLink" TEXT,
ADD COLUMN     "mode" "AvailabilityMode" NOT NULL DEFAULT 'ONE_TIME',
ADD COLUMN     "title" TEXT;
