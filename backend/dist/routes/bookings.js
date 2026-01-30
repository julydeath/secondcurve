"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const http_1 = require("../lib/http");
const auth_1 = require("../lib/auth");
const razorpay_1 = require("../lib/razorpay");
const calendar_1 = require("../lib/calendar");
exports.bookingRouter = (0, express_1.Router)();
const bookingCreateSchema = zod_1.z.object({
    availabilitySlotId: zod_1.z.string().min(1),
});
exports.bookingRouter.post("/", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.LEARNER), (0, http_1.asyncHandler)(async (req, res) => {
    const input = bookingCreateSchema.parse(req.body);
    console.log("Creating booking for slot:", input);
    const result = await prisma_1.prisma.$transaction(async (tx) => {
        const slot = await tx.availabilitySlot.findUnique({
            where: { id: input.availabilitySlotId },
        });
        if (!slot || slot.status !== client_1.AvailabilityStatus.AVAILABLE) {
            throw new http_1.HttpError(409, "slot_unavailable");
        }
        if (slot.mode === "RECURRING") {
            throw new http_1.HttpError(409, "use_subscription_for_recurring");
        }
        const existing = await tx.booking.findUnique({
            where: { availabilitySlotId: slot.id },
            include: { payment: true },
        });
        if (existing) {
            if (existing.status !== client_1.BookingStatus.CANCELED) {
                throw new http_1.HttpError(409, "slot_unavailable");
            }
            if (existing.payment) {
                await tx.payment.delete({ where: { id: existing.payment.id } });
            }
            await tx.booking.delete({ where: { id: existing.id } });
        }
        const booking = await tx.booking.create({
            data: {
                mentorId: slot.mentorId,
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
        await tx.availabilitySlot.update({
            where: { id: slot.id },
            data: { status: client_1.AvailabilityStatus.RESERVED },
        });
        const razorpay = (0, razorpay_1.razorpayClient)();
        const order = await razorpay.orders.create({
            amount: slot.priceInr * 100,
            currency: "INR",
            receipt: `booking_${booking.id}`,
            payment_capture: true,
            notes: {
                bookingId: booking.id,
                mentorId: slot.mentorId,
                learnerId: req.user.id,
            },
        });
        const payment = await tx.payment.create({
            data: {
                bookingId: booking.id,
                provider: "razorpay",
                amountInr: slot.priceInr,
                status: client_1.PaymentStatus.CREATED,
                providerOrderId: order.id,
                scheduledFor: new Date(Date.now() + 30 * 60 * 1000),
                raw: order,
            },
        });
        await tx.chatThread.create({
            data: {
                mentorId: slot.mentorId,
                learnerId: req.user.id,
                bookingId: booking.id,
            },
        });
        return { booking, payment, order };
    });
    return res.status(201).json({
        booking: result.booking,
        payment: result.payment,
        razorpay: {
            keyId: (0, razorpay_1.getRazorpayKeyId)(),
            orderId: result.order.id,
            amount: result.order.amount,
            currency: result.order.currency,
        },
    });
}));
exports.bookingRouter.get("/me", auth_1.requireAuth, (0, http_1.asyncHandler)(async (req, res) => {
    const asRole = req.query.as
        ? String(req.query.as).toUpperCase()
        : undefined;
    const role = asRole ?? req.user.role;
    if (role !== client_1.Role.MENTOR && role !== client_1.Role.LEARNER) {
        throw new http_1.HttpError(400, "invalid_role");
    }
    if (role !== req.user.role && req.user.role !== client_1.Role.ADMIN) {
        throw new http_1.HttpError(403, "forbidden");
    }
    const where = role === client_1.Role.MENTOR
        ? { mentorId: req.user.id }
        : { learnerId: req.user.id };
    const bookings = await prisma_1.prisma.booking.findMany({
        where,
        orderBy: { scheduledStartAt: "desc" },
        include: {
            mentor: { select: { id: true, name: true, email: true } },
            learner: { select: { id: true, name: true, email: true } },
            payment: true,
            availabilitySlot: {
                include: {
                    rule: true,
                },
            },
        },
    });
    return res.json({ bookings });
}));
exports.bookingRouter.get("/:id/receipt", auth_1.requireAuth, (0, http_1.asyncHandler)(async (req, res) => {
    const bookingId = String(req.params.id);
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            mentor: { select: { name: true, email: true } },
            learner: { select: { name: true, email: true } },
            payment: true,
        },
    });
    if (!booking) {
        throw new http_1.HttpError(404, "booking_not_found");
    }
    if (![booking.mentorId, booking.learnerId].includes(req.user.id)) {
        throw new http_1.HttpError(403, "forbidden");
    }
    if (!booking.payment || booking.payment.status !== client_1.PaymentStatus.CAPTURED) {
        throw new http_1.HttpError(409, "receipt_not_ready");
    }
    const lines = [
        "WisdomBridge Payment Receipt",
        `Booking ID: ${booking.id}`,
        `Mentor: ${booking.mentor.name} (${booking.mentor.email})`,
        `Learner: ${booking.learner.name} (${booking.learner.email})`,
        `Session Time: ${booking.scheduledStartAt.toISOString()}`,
        `Amount: INR ${booking.priceInr}`,
        `Payment Status: ${booking.payment.status}`,
        `Razorpay Order ID: ${booking.payment.providerOrderId ?? "N/A"}`,
        `Razorpay Payment ID: ${booking.payment.providerPaymentId ?? "N/A"}`,
        `Captured At: ${booking.payment.capturedAt?.toISOString() ?? "N/A"}`,
    ];
    res.setHeader("Content-Type", "text/plain");
    res.setHeader("Content-Disposition", `attachment; filename="wisdombridge-receipt-${booking.id}.txt"`);
    return res.send(lines.join("\n"));
}));
const paymentConfirmSchema = zod_1.z.object({
    razorpayOrderId: zod_1.z.string().min(1),
    razorpayPaymentId: zod_1.z.string().min(1),
    razorpaySignature: zod_1.z.string().min(1),
    method: zod_1.z.string().optional(),
});
exports.bookingRouter.post("/:id/confirm-payment", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.LEARNER), (0, http_1.asyncHandler)(async (req, res) => {
    const input = paymentConfirmSchema.parse(req.body);
    const bookingId = String(req.params.id);
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { payment: true, availabilitySlot: true },
    });
    if (!booking) {
        throw new http_1.HttpError(404, "booking_not_found");
    }
    if (booking.learnerId !== req.user.id) {
        throw new http_1.HttpError(403, "forbidden");
    }
    if (!booking.payment) {
        throw new http_1.HttpError(409, "payment_missing");
    }
    if (booking.payment.providerOrderId !== input.razorpayOrderId) {
        throw new http_1.HttpError(409, "order_mismatch");
    }
    const valid = (0, razorpay_1.verifyCheckoutSignature)(input.razorpayOrderId, input.razorpayPaymentId, input.razorpaySignature);
    if (!valid) {
        throw new http_1.HttpError(400, "invalid_signature");
    }
    const payment = await prisma_1.prisma.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.update({
            where: { id: booking.payment.id },
            data: {
                status: client_1.PaymentStatus.CAPTURED,
                providerPaymentId: input.razorpayPaymentId,
                method: input.method,
                capturedAt: new Date(),
            },
        });
        await tx.booking.update({
            where: { id: booking.id },
            data: { status: client_1.BookingStatus.CONFIRMED },
        });
        await tx.availabilitySlot.update({
            where: { id: booking.availabilitySlotId },
            data: { status: client_1.AvailabilityStatus.BOOKED },
        });
        return updatedPayment;
    });
    await (0, calendar_1.syncCalendarForBooking)(booking.id);
    return res.json({ payment });
}));
const cancelSchema = zod_1.z.object({
    reason: zod_1.z.string().min(3).max(500).optional(),
});
exports.bookingRouter.post("/:id/cancel", auth_1.requireAuth, (0, http_1.asyncHandler)(async (req, res) => {
    const input = cancelSchema.parse(req.body ?? {});
    const bookingId = String(req.params.id);
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { payment: true, availabilitySlot: true },
    });
    if (!booking) {
        throw new http_1.HttpError(404, "booking_not_found");
    }
    if (![booking.mentorId, booking.learnerId].includes(req.user.id)) {
        throw new http_1.HttpError(403, "forbidden");
    }
    if (booking.status === client_1.BookingStatus.CANCELED) {
        throw new http_1.HttpError(409, "already_canceled");
    }
    if (booking.availabilitySlot?.mode === "ONE_TIME" &&
        booking.payment?.status === client_1.PaymentStatus.CAPTURED) {
        throw new http_1.HttpError(409, "cancel_not_allowed");
    }
    const cutoff = new Date(booking.scheduledStartAt.getTime() - 24 * 60 * 60 * 1000);
    if (Date.now() >= cutoff.getTime()) {
        throw new http_1.HttpError(409, "cancel_window_passed");
    }
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        const updatedBooking = await tx.booking.update({
            where: { id: booking.id },
            data: {
                status: client_1.BookingStatus.CANCELED,
                canceledAt: new Date(),
                cancelReason: input.reason,
            },
        });
        await tx.availabilitySlot.update({
            where: { id: booking.availabilitySlotId },
            data: { status: client_1.AvailabilityStatus.AVAILABLE },
        });
        if (booking.payment) {
            await tx.payment.update({
                where: { id: booking.payment.id },
                data: { status: client_1.PaymentStatus.FAILED },
            });
        }
        return updatedBooking;
    });
    return res.json({ booking: updated });
}));
const meetingLinkSchema = zod_1.z.object({
    meetingLink: zod_1.z.string().url(),
});
exports.bookingRouter.patch("/:id/meeting-link", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.MENTOR), (0, http_1.asyncHandler)(async (req, res) => {
    const input = meetingLinkSchema.parse(req.body);
    const bookingId = String(req.params.id);
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: bookingId },
    });
    if (!booking) {
        throw new http_1.HttpError(404, "booking_not_found");
    }
    if (booking.mentorId !== req.user.id) {
        throw new http_1.HttpError(403, "forbidden");
    }
    const updated = await prisma_1.prisma.booking.update({
        where: { id: booking.id },
        data: {
            meetingLink: input.meetingLink,
            meetingLinkAddedAt: new Date(),
        },
    });
    return res.json({ booking: updated });
}));
const disputeSchema = zod_1.z.object({
    reason: zod_1.z.string().min(10).max(2000),
});
exports.bookingRouter.post("/:id/dispute", auth_1.requireAuth, (0, http_1.asyncHandler)(async (req, res) => {
    const input = disputeSchema.parse(req.body);
    const bookingId = String(req.params.id);
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: bookingId },
    });
    if (!booking) {
        throw new http_1.HttpError(404, "booking_not_found");
    }
    if (![booking.mentorId, booking.learnerId].includes(req.user.id)) {
        throw new http_1.HttpError(403, "forbidden");
    }
    const dispute = await prisma_1.prisma.dispute.create({
        data: {
            bookingId: booking.id,
            raisedById: req.user.id,
            reason: input.reason,
        },
    });
    await prisma_1.prisma.booking.update({
        where: { id: booking.id },
        data: { status: client_1.BookingStatus.DISPUTED },
    });
    return res.status(201).json({ dispute });
}));
exports.bookingRouter.post("/:id/complete", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.MENTOR), (0, http_1.asyncHandler)(async (req, res) => {
    const bookingId = String(req.params.id);
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: bookingId },
    });
    if (!booking) {
        throw new http_1.HttpError(404, "booking_not_found");
    }
    if (booking.mentorId !== req.user.id) {
        throw new http_1.HttpError(403, "forbidden");
    }
    if (booking.status !== client_1.BookingStatus.CONFIRMED) {
        throw new http_1.HttpError(409, "invalid_status");
    }
    const commission = Math.round(booking.priceInr * booking.commissionRate);
    const payoutAmount = booking.priceInr - commission - booking.platformFeeInr;
    const result = await prisma_1.prisma.$transaction(async (tx) => {
        const updatedBooking = await tx.booking.update({
            where: { id: booking.id },
            data: { status: client_1.BookingStatus.COMPLETED },
        });
        const payout = await tx.payout.create({
            data: {
                bookingId: booking.id,
                mentorId: booking.mentorId,
                provider: "razorpay",
                amountInr: payoutAmount,
                status: client_1.PayoutStatus.SCHEDULED,
                scheduledFor: new Date(),
            },
        });
        return { booking: updatedBooking, payout };
    });
    return res.json(result);
}));
exports.bookingRouter.post("/:id/sync-calendar", auth_1.requireAuth, (0, http_1.asyncHandler)(async (req, res) => {
    const bookingId = String(req.params.id);
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: bookingId },
    });
    if (!booking) {
        throw new http_1.HttpError(404, "booking_not_found");
    }
    if (![booking.mentorId, booking.learnerId].includes(req.user.id)) {
        throw new http_1.HttpError(403, "forbidden");
    }
    const result = await (0, calendar_1.syncCalendarForBooking)(bookingId);
    if (!result.mentorAdded && !result.learnerAdded) {
        throw new http_1.HttpError(409, "calendar_not_linked");
    }
    return res.json({ synced: true, ...result });
}));
