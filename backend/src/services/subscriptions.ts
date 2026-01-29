import {
  AvailabilityStatus,
  AvailabilityRule,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { razorpayClient } from "../lib/razorpay";

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const nextDateForWeekday = (from: Date, weekday: number) => {
  const date = new Date(from);
  const delta = (weekday - date.getDay() + 7) % 7;
  date.setDate(date.getDate() + (delta === 0 ? 7 : delta));
  return date;
};

export const findOrCreateNextSlot = async (
  rule: AvailabilityRule,
  fromDate: Date
) => {
  const existing = await prisma.availabilitySlot.findFirst({
    where: {
      ruleId: rule.id,
      status: AvailabilityStatus.AVAILABLE,
      startAt: { gt: fromDate },
    },
    orderBy: { startAt: "asc" },
  });

  if (existing) {
    return existing;
  }

  const nextDate = nextDateForWeekday(fromDate, rule.weekday);
  const startMinutes = toMinutes(rule.startTime);
  const slotStart = new Date(nextDate);
  slotStart.setHours(0, 0, 0, 0);
  slotStart.setMinutes(startMinutes);
  const slotEnd = new Date(slotStart);
  slotEnd.setMinutes(slotStart.getMinutes() + rule.durationMinutes);

  return prisma.availabilitySlot.create({
    data: {
      mentorId: rule.mentorId,
      ruleId: rule.id,
      startAt: slotStart,
      endAt: slotEnd,
      durationMinutes: rule.durationMinutes,
      priceInr: rule.priceInr,
      title: rule.title,
      meetingLink: rule.meetingLink,
      mode: rule.mode,
    },
  });
};

export const resumeDueSubscriptions = async () => {
  const now = new Date();
  const due = await prisma.subscription.findMany({
    where: {
      status: SubscriptionStatus.PAUSED,
      pauseUntil: { lte: now },
      providerSubscriptionId: { not: null },
    },
    select: { id: true, providerSubscriptionId: true },
  });

  if (!due.length) {
    return;
  }

  const razorpay = razorpayClient();
  for (const sub of due) {
    if (!sub.providerSubscriptionId) continue;
    try {
      await razorpay.subscriptions.resume(sub.providerSubscriptionId, {
        resume_at: "now",
      });
      await prisma.subscription.update({
        where: { id: sub.id },
        data: { status: SubscriptionStatus.ACTIVE, pauseUntil: null },
      });
    } catch {
      // Best-effort; retries on next run.
    }
  }
};
