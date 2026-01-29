"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.webhookRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const http_1 = require("../lib/http");
const razorpay_1 = require("../lib/razorpay");
const payments_1 = require("../services/payments");
const calendar_1 = require("../lib/calendar");
const subscriptions_1 = require("../services/subscriptions");
exports.webhookRouter = (0, express_1.Router)();
exports.webhookRouter.post("/razorpay", (0, http_1.asyncHandler)(async (req, res) => {
    const signature = req.header("x-razorpay-signature");
    if (!signature) {
        throw new http_1.HttpError(400, "signature_missing");
    }
    const payload = req.body;
    const isValid = (0, razorpay_1.verifyWebhookSignature)(payload, signature);
    if (!isValid) {
        throw new http_1.HttpError(400, "invalid_signature");
    }
    const event = JSON.parse(payload.toString("utf8"));
    if (event.event.startsWith("payment.")) {
        const entity = event.payload?.payment?.entity;
        if (entity) {
            const payment = await prisma_1.prisma.payment.findFirst({
                where: {
                    OR: [
                        { providerPaymentId: entity.id },
                        { providerOrderId: entity.order_id },
                    ],
                },
            });
            if (payment) {
                const bookingStart = payment.bookingId
                    ? (await prisma_1.prisma.booking.findUnique({
                        where: { id: payment.bookingId },
                        select: { scheduledStartAt: true },
                    }))?.scheduledStartAt
                    : null;
                const scheduledFor = payment.scheduledFor ??
                    (bookingStart
                        ? new Date(bookingStart.getTime() - 24 * 60 * 60 * 1000)
                        : null);
                if (event.event === "payment.authorized") {
                    await prisma_1.prisma.payment.update({
                        where: { id: payment.id },
                        data: {
                            status: client_1.PaymentStatus.AUTHORIZED,
                            providerPaymentId: entity.id,
                            method: entity.method,
                            raw: entity,
                            scheduledFor: scheduledFor ?? payment.scheduledFor,
                        },
                    });
                    const shouldCapture = scheduledFor && scheduledFor.getTime() <= Date.now();
                    if (shouldCapture) {
                        await (0, payments_1.captureAuthorizedPayment)(payment.id);
                    }
                }
                if (event.event === "payment.captured") {
                    const updated = await prisma_1.prisma.$transaction(async (tx) => {
                        const updatedPayment = await tx.payment.update({
                            where: { id: payment.id },
                            data: {
                                status: client_1.PaymentStatus.CAPTURED,
                                providerPaymentId: entity.id,
                                method: entity.method,
                                capturedAt: new Date(),
                                raw: entity,
                            },
                        });
                        const updatedBooking = await tx.booking.update({
                            where: { id: payment.bookingId },
                            data: { status: client_1.BookingStatus.CONFIRMED },
                        });
                        await tx.availabilitySlot.update({
                            where: { id: updatedBooking.availabilitySlotId },
                            data: { status: client_1.AvailabilityStatus.BOOKED },
                        });
                        return updatedPayment;
                    });
                    void updated;
                }
                if (event.event === "payment.failed") {
                    await prisma_1.prisma.$transaction(async (tx) => {
                        await tx.payment.update({
                            where: { id: payment.id },
                            data: {
                                status: client_1.PaymentStatus.FAILED,
                                providerPaymentId: entity.id,
                                method: entity.method,
                                raw: entity,
                            },
                        });
                        const booking = await tx.booking.update({
                            where: { id: payment.bookingId },
                            data: { status: client_1.BookingStatus.CANCELED },
                        });
                        await tx.availabilitySlot.update({
                            where: { id: booking.availabilitySlotId },
                            data: { status: client_1.AvailabilityStatus.AVAILABLE },
                        });
                    });
                }
            }
        }
    }
    if (event.event.startsWith("subscription.")) {
        const entity = event.payload?.subscription?.entity;
        if (entity?.id) {
            const subscription = await prisma_1.prisma.subscription.findFirst({
                where: { providerSubscriptionId: entity.id },
                include: { booking: true, availabilityRule: true },
            });
            if (subscription) {
                const statusMap = {
                    "subscription.activated": client_1.SubscriptionStatus.ACTIVE,
                    "subscription.paused": client_1.SubscriptionStatus.PAUSED,
                    "subscription.resumed": client_1.SubscriptionStatus.ACTIVE,
                    "subscription.cancelled": client_1.SubscriptionStatus.CANCELED,
                    "subscription.completed": client_1.SubscriptionStatus.CANCELED,
                };
                const nextStatus = statusMap[event.event];
                if (nextStatus) {
                    await prisma_1.prisma.subscription.update({
                        where: { id: subscription.id },
                        data: {
                            status: nextStatus,
                            startAt: entity.start_at
                                ? new Date(entity.start_at * 1000)
                                : subscription.startAt,
                            endAt: entity.end_at
                                ? new Date(entity.end_at * 1000)
                                : subscription.endAt,
                            nextChargeAt: entity.charge_at
                                ? new Date(entity.charge_at * 1000)
                                : subscription.nextChargeAt,
                        },
                    });
                }
                if (event.event === "subscription.charged" && subscription.booking) {
                    const booking = subscription.booking;
                    const chargedPayment = event.payload?.payment?.entity;
                    if (chargedPayment?.id) {
                        const existingPayment = await prisma_1.prisma.payment.findFirst({
                            where: { providerPaymentId: chargedPayment.id },
                        });
                        if (!existingPayment) {
                            await prisma_1.prisma.payment.create({
                                data: {
                                    bookingId: subscription.booking.id,
                                    provider: "razorpay",
                                    providerPaymentId: chargedPayment.id,
                                    amountInr: Math.round((chargedPayment.amount ?? 0) / 100),
                                    currency: chargedPayment.currency ?? "INR",
                                    status: client_1.PaymentStatus.CAPTURED,
                                    capturedAt: new Date(),
                                    raw: chargedPayment,
                                },
                            });
                        }
                    }
                    await prisma_1.prisma.$transaction(async (tx) => {
                        await tx.booking.update({
                            where: { id: booking.id },
                            data: { status: client_1.BookingStatus.CONFIRMED },
                        });
                        await tx.availabilitySlot.update({
                            where: { id: booking.availabilitySlotId },
                            data: { status: client_1.AvailabilityStatus.BOOKED },
                        });
                    });
                    if (subscription.availabilityRule) {
                        const nextSlot = await (0, subscriptions_1.findOrCreateNextSlot)(subscription.availabilityRule, booking.scheduledStartAt);
                        const nextBooking = await prisma_1.prisma.booking.create({
                            data: {
                                mentorId: subscription.mentorId,
                                learnerId: subscription.learnerId,
                                availabilitySlotId: nextSlot.id,
                                scheduledStartAt: nextSlot.startAt,
                                scheduledEndAt: nextSlot.endAt,
                                status: client_1.BookingStatus.PENDING,
                                priceInr: nextSlot.priceInr,
                                platformFeeInr: 0,
                                commissionRate: 0.15,
                            },
                        });
                        await prisma_1.prisma.availabilitySlot.update({
                            where: { id: nextSlot.id },
                            data: { status: client_1.AvailabilityStatus.RESERVED },
                        });
                        await prisma_1.prisma.subscription.update({
                            where: { id: subscription.id },
                            data: { bookingId: nextBooking.id },
                        });
                        await (0, calendar_1.syncCalendarForBooking)(nextBooking.id);
                    }
                }
            }
        }
    }
    return res.json({ received: true });
}));
