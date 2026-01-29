-- CreateEnum
CREATE TYPE "SubscriptionStatus" AS ENUM ('CREATED', 'ACTIVE', 'PAUSED', 'CANCELED', 'PAST_DUE');

-- AlterTable
ALTER TABLE "Payment" ADD COLUMN     "providerOrderId" TEXT,
ADD COLUMN     "scheduledFor" TIMESTAMP(3);

-- CreateTable
CREATE TABLE "Subscription" (
    "id" TEXT NOT NULL,
    "mentorId" TEXT NOT NULL,
    "learnerId" TEXT NOT NULL,
    "availabilityRuleId" TEXT NOT NULL,
    "bookingId" TEXT,
    "provider" TEXT NOT NULL,
    "providerPlanId" TEXT,
    "providerSubscriptionId" TEXT,
    "status" "SubscriptionStatus" NOT NULL DEFAULT 'CREATED',
    "priceInr" INTEGER NOT NULL,
    "currency" TEXT NOT NULL DEFAULT 'INR',
    "startAt" TIMESTAMP(3),
    "endAt" TIMESTAMP(3),
    "nextChargeAt" TIMESTAMP(3),
    "canceledAt" TIMESTAMP(3),
    "pauseUntil" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,

    CONSTRAINT "Subscription_pkey" PRIMARY KEY ("id")
);

-- CreateIndex
CREATE UNIQUE INDEX "Subscription_bookingId_key" ON "Subscription"("bookingId");

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_mentorId_fkey" FOREIGN KEY ("mentorId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_learnerId_fkey" FOREIGN KEY ("learnerId") REFERENCES "User"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_availabilityRuleId_fkey" FOREIGN KEY ("availabilityRuleId") REFERENCES "AvailabilityRule"("id") ON DELETE RESTRICT ON UPDATE CASCADE;

-- AddForeignKey
ALTER TABLE "Subscription" ADD CONSTRAINT "Subscription_bookingId_fkey" FOREIGN KEY ("bookingId") REFERENCES "Booking"("id") ON DELETE SET NULL ON UPDATE CASCADE;
