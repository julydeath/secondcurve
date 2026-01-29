"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.bookingRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const http_1 = require("../lib/http");
const auth_1 = require("../lib/auth");
exports.bookingRouter = (0, express_1.Router)();
const createCalendarEvent = async (params) => {
    await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${params.accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            summary: params.summary,
            description: params.description,
            start: { dateTime: params.start, timeZone: params.timezone },
            end: { dateTime: params.end, timeZone: params.timezone },
        }),
    });
};
const refreshGoogleToken = async (refreshToken) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new http_1.HttpError(500, "google_oauth_not_configured");
    }
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }),
    });
    if (!response.ok) {
        throw new http_1.HttpError(502, "google_token_refresh_failed");
    }
    return (await response.json());
};
const getGoogleAccessTokenForUser = async (userId) => {
    const account = await prisma_1.prisma.oAuthAccount.findFirst({
        where: {
            userId,
            provider: client_1.OAuthProvider.GOOGLE,
        },
    });
    if (!account || !account.accessToken) {
        return null;
    }
    const needsRefresh = account.expiresAt &&
        account.refreshToken &&
        account.expiresAt.getTime() < Date.now() + 60_000;
    if (!needsRefresh) {
        return account.accessToken;
    }
    const refreshed = await refreshGoogleToken(account.refreshToken);
    await prisma_1.prisma.oAuthAccount.update({
        where: { id: account.id },
        data: {
            accessToken: refreshed.access_token,
            scopes: refreshed.scope ?? account.scopes,
            expiresAt: refreshed.expires_in
                ? new Date(Date.now() + refreshed.expires_in * 1000)
                : account.expiresAt,
        },
    });
    return refreshed.access_token;
};
const syncCalendarForBooking = async (bookingId) => {
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            mentor: { select: { id: true, name: true, email: true } },
            learner: { select: { id: true, name: true, email: true } },
        },
    });
    if (!booking) {
        return;
    }
    const [mentorToken, learnerToken] = await Promise.all([
        getGoogleAccessTokenForUser(booking.mentorId),
        getGoogleAccessTokenForUser(booking.learnerId),
    ]);
    const timezone = "Asia/Kolkata";
    const summary = `WisdomBridge • ${booking.mentor.name} ↔ ${booking.learner.name}`;
    const description = `Session booked on WisdomBridge. Meeting link: ${booking.meetingLink ?? "Pending"}`;
    const start = booking.scheduledStartAt.toISOString();
    const end = booking.scheduledEndAt.toISOString();
    const tasks = [];
    if (mentorToken) {
        tasks.push(createCalendarEvent({
            accessToken: mentorToken,
            summary,
            description,
            start,
            end,
            timezone,
        }));
    }
    if (learnerToken) {
        tasks.push(createCalendarEvent({
            accessToken: learnerToken,
            summary,
            description,
            start,
            end,
            timezone,
        }));
    }
    await Promise.allSettled(tasks);
};
const bookingCreateSchema = zod_1.z.object({
    availabilitySlotId: zod_1.z.string().min(1),
});
exports.bookingRouter.post("/", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.LEARNER), (0, http_1.asyncHandler)(async (req, res) => {
    const input = bookingCreateSchema.parse(req.body);
    const result = await prisma_1.prisma.$transaction(async (tx) => {
        const slot = await tx.availabilitySlot.findUnique({
            where: { id: input.availabilitySlotId },
        });
        if (!slot || slot.status !== client_1.AvailabilityStatus.AVAILABLE) {
            throw new http_1.HttpError(409, "slot_unavailable");
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
        const payment = await tx.payment.create({
            data: {
                bookingId: booking.id,
                provider: "razorpay",
                amountInr: slot.priceInr,
                status: client_1.PaymentStatus.CREATED,
            },
        });
        await tx.chatThread.create({
            data: {
                mentorId: slot.mentorId,
                learnerId: req.user.id,
                bookingId: booking.id,
            },
        });
        return { booking, payment };
    });
    return res.status(201).json({
        booking: result.booking,
        payment: result.payment,
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
        },
    });
    return res.json({ bookings });
}));
const paymentConfirmSchema = zod_1.z.object({
    providerPaymentId: zod_1.z.string().min(1),
    method: zod_1.z.string().optional(),
});
exports.bookingRouter.post("/:id/confirm-payment", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.LEARNER), (0, http_1.asyncHandler)(async (req, res) => {
    const input = paymentConfirmSchema.parse(req.body);
    const bookingId = String(req.params.id);
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: bookingId },
        include: { payment: true },
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
    const updated = await prisma_1.prisma.$transaction(async (tx) => {
        const payment = await tx.payment.update({
            where: { id: booking.payment.id },
            data: {
                status: client_1.PaymentStatus.CAPTURED,
                providerPaymentId: input.providerPaymentId,
                method: input.method,
                capturedAt: new Date(),
            },
        });
        const updatedBooking = await tx.booking.update({
            where: { id: booking.id },
            data: { status: client_1.BookingStatus.CONFIRMED },
        });
        await tx.availabilitySlot.update({
            where: { id: booking.availabilitySlotId },
            data: { status: client_1.AvailabilityStatus.BOOKED },
        });
        return { booking: updatedBooking, payment };
    });
    await syncCalendarForBooking(booking.id);
    return res.json(updated);
}));
const cancelSchema = zod_1.z.object({
    reason: zod_1.z.string().min(3).max(500).optional(),
});
exports.bookingRouter.post("/:id/cancel", auth_1.requireAuth, (0, http_1.asyncHandler)(async (req, res) => {
    const input = cancelSchema.parse(req.body ?? {});
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
    if (booking.status === client_1.BookingStatus.CANCELED) {
        throw new http_1.HttpError(409, "already_canceled");
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
    await syncCalendarForBooking(bookingId);
    return res.json({ synced: true });
}));
