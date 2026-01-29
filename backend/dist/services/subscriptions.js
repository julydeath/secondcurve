"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.resumeDueSubscriptions = exports.findOrCreateNextSlot = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const razorpay_1 = require("../lib/razorpay");
const toMinutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
};
const nextDateForWeekday = (from, weekday) => {
    const date = new Date(from);
    const delta = (weekday - date.getDay() + 7) % 7;
    date.setDate(date.getDate() + (delta === 0 ? 7 : delta));
    return date;
};
const findOrCreateNextSlot = async (rule, fromDate) => {
    const existing = await prisma_1.prisma.availabilitySlot.findFirst({
        where: {
            ruleId: rule.id,
            status: client_1.AvailabilityStatus.AVAILABLE,
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
    return prisma_1.prisma.availabilitySlot.create({
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
exports.findOrCreateNextSlot = findOrCreateNextSlot;
const resumeDueSubscriptions = async () => {
    const now = new Date();
    const due = await prisma_1.prisma.subscription.findMany({
        where: {
            status: client_1.SubscriptionStatus.PAUSED,
            pauseUntil: { lte: now },
            providerSubscriptionId: { not: null },
        },
        select: { id: true, providerSubscriptionId: true },
    });
    if (!due.length) {
        return;
    }
    const razorpay = (0, razorpay_1.razorpayClient)();
    for (const sub of due) {
        if (!sub.providerSubscriptionId)
            continue;
        try {
            await razorpay.subscriptions.resume(sub.providerSubscriptionId, {
                resume_at: "now",
            });
            await prisma_1.prisma.subscription.update({
                where: { id: sub.id },
                data: { status: client_1.SubscriptionStatus.ACTIVE, pauseUntil: null },
            });
        }
        catch {
            // Best-effort; retries on next run.
        }
    }
};
exports.resumeDueSubscriptions = resumeDueSubscriptions;
