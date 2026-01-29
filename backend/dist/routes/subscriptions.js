"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.subscriptionRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const http_1 = require("../lib/http");
const auth_1 = require("../lib/auth");
const razorpay_1 = require("../lib/razorpay");
const subscriptions_1 = require("../services/subscriptions");
const calendar_1 = require("../lib/calendar");
exports.subscriptionRouter = (0, express_1.Router)();
const subscriptionCreateSchema = zod_1.z.object({
    availabilityRuleId: zod_1.z.string().min(1),
});
exports.subscriptionRouter.post("/", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.LEARNER), (0, http_1.asyncHandler)(async (req, res) => {
    const input = subscriptionCreateSchema.parse(req.body);
    const rule = await prisma_1.prisma.availabilityRule.findUnique({
        where: { id: input.availabilityRuleId },
    });
    if (!rule || rule.mode !== client_1.AvailabilityMode.RECURRING || !rule.active) {
        throw new http_1.HttpError(404, "rule_not_found");
    }
    const slot = await (0, subscriptions_1.findOrCreateNextSlot)(rule, new Date());
    if (slot.status !== client_1.AvailabilityStatus.AVAILABLE) {
        throw new http_1.HttpError(409, "slot_unavailable");
    }
    const booking = await prisma_1.prisma.booking.create({
        data: {
            mentorId: rule.mentorId,
            learnerId: req.user.id,
            availabilitySlotId: slot.id,
            status: client_1.BookingStatus.PENDING,
            scheduledStartAt: slot.startAt,
            scheduledEndAt: slot.endAt,
            priceInr: slot.priceInr,
            platformFeeInr: 0,
            commissionRate: 0.15,
        },
    });
    await prisma_1.prisma.availabilitySlot.update({
        where: { id: slot.id },
        data: { status: client_1.AvailabilityStatus.RESERVED },
    });
    await prisma_1.prisma.chatThread.create({
        data: {
            mentorId: rule.mentorId,
            learnerId: req.user.id,
            bookingId: booking.id,
        },
    });
    const startAtMs = booking.scheduledStartAt.getTime() - 24 * 60 * 60 * 1000;
    const startAtSeconds = Math.max(Math.floor(startAtMs / 1000), Math.floor(Date.now() / 1000) + 300);
    const razorpay = (0, razorpay_1.razorpayClient)();
    const plan = await razorpay.plans.create({
        period: "weekly",
        interval: 1,
        item: {
            name: `WisdomBridge • ${rule.title}`,
            amount: rule.priceInr * 100,
            currency: "INR",
        },
    });
    const subscription = await razorpay.subscriptions.create({
        plan_id: plan.id,
        total_count: 999,
        customer_notify: 1,
        start_at: startAtSeconds,
        notes: {
            bookingId: booking.id,
            mentorId: rule.mentorId,
            learnerId: req.user.id,
        },
    });
    const record = await prisma_1.prisma.subscription.create({
        data: {
            mentorId: rule.mentorId,
            learnerId: req.user.id,
            availabilityRuleId: rule.id,
            bookingId: booking.id,
            provider: "razorpay",
            providerPlanId: plan.id,
            providerSubscriptionId: subscription.id,
            status: client_1.SubscriptionStatus.CREATED,
            priceInr: rule.priceInr,
            startAt: new Date(startAtSeconds * 1000),
            nextChargeAt: new Date(startAtSeconds * 1000),
        },
    });
    await (0, calendar_1.syncCalendarForBooking)(booking.id);
    return res.status(201).json({
        subscription: record,
        booking,
        razorpay: {
            keyId: (0, razorpay_1.getRazorpayKeyId)(),
            subscriptionId: subscription.id,
        },
    });
}));
exports.subscriptionRouter.get("/me", auth_1.requireAuth, (0, http_1.asyncHandler)(async (req, res) => {
    const subs = await prisma_1.prisma.subscription.findMany({
        where: req.user.role === client_1.Role.ADMIN
            ? undefined
            : { learnerId: req.user.id },
        orderBy: { createdAt: "desc" },
        include: { availabilityRule: true, booking: true },
    });
    return res.json({ subscriptions: subs });
}));
const pauseSchema = zod_1.z.object({
    weeks: zod_1.z.number().int().min(1).max(4),
});
exports.subscriptionRouter.post("/:id/pause", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.LEARNER, client_1.Role.MENTOR), (0, http_1.asyncHandler)(async (req, res) => {
    const input = pauseSchema.parse(req.body);
    const subscription = await prisma_1.prisma.subscription.findUnique({
        where: { id: String(req.params.id) },
    });
    if (!subscription ||
        (subscription.learnerId !== req.user.id &&
            subscription.mentorId !== req.user.id)) {
        throw new http_1.HttpError(404, "subscription_not_found");
    }
    if (!subscription.providerSubscriptionId) {
        throw new http_1.HttpError(409, "subscription_not_ready");
    }
    const razorpay = (0, razorpay_1.razorpayClient)();
    await razorpay.subscriptions.pause(subscription.providerSubscriptionId, {
        pause_at: "now",
    });
    const pauseUntil = new Date(Date.now() + input.weeks * 7 * 24 * 60 * 60 * 1000);
    const updated = await prisma_1.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
            status: client_1.SubscriptionStatus.PAUSED,
            pauseUntil,
        },
    });
    return res.json({ subscription: updated });
}));
exports.subscriptionRouter.post("/:id/resume", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.LEARNER, client_1.Role.MENTOR), (0, http_1.asyncHandler)(async (req, res) => {
    const subscription = await prisma_1.prisma.subscription.findUnique({
        where: { id: String(req.params.id) },
    });
    if (!subscription ||
        (subscription.learnerId !== req.user.id &&
            subscription.mentorId !== req.user.id)) {
        throw new http_1.HttpError(404, "subscription_not_found");
    }
    if (!subscription.providerSubscriptionId) {
        throw new http_1.HttpError(409, "subscription_not_ready");
    }
    const razorpay = (0, razorpay_1.razorpayClient)();
    await razorpay.subscriptions.resume(subscription.providerSubscriptionId, {
        resume_at: "now",
    });
    const updated = await prisma_1.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
            status: client_1.SubscriptionStatus.ACTIVE,
            pauseUntil: null,
        },
    });
    return res.json({ subscription: updated });
}));
exports.subscriptionRouter.post("/:id/cancel", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.LEARNER), (0, http_1.asyncHandler)(async (req, res) => {
    const subscription = await prisma_1.prisma.subscription.findUnique({
        where: { id: String(req.params.id) },
    });
    if (!subscription || subscription.learnerId !== req.user.id) {
        throw new http_1.HttpError(404, "subscription_not_found");
    }
    if (!subscription.providerSubscriptionId) {
        throw new http_1.HttpError(409, "subscription_not_ready");
    }
    const razorpay = (0, razorpay_1.razorpayClient)();
    await razorpay.subscriptions.cancel(subscription.providerSubscriptionId);
    const updated = await prisma_1.prisma.subscription.update({
        where: { id: subscription.id },
        data: {
            status: client_1.SubscriptionStatus.CANCELED,
            canceledAt: new Date(),
        },
    });
    if (subscription.bookingId) {
        const booking = await prisma_1.prisma.booking.findUnique({
            where: { id: subscription.bookingId },
        });
        if (booking && booking.status === client_1.BookingStatus.PENDING) {
            await prisma_1.prisma.$transaction(async (tx) => {
                await tx.booking.update({
                    where: { id: booking.id },
                    data: { status: client_1.BookingStatus.CANCELED, canceledAt: new Date() },
                });
                await tx.availabilitySlot.update({
                    where: { id: booking.availabilitySlotId },
                    data: { status: client_1.AvailabilityStatus.AVAILABLE },
                });
            });
        }
    }
    return res.json({ subscription: updated });
}));
