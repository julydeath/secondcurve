"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.reviewRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const http_1 = require("../lib/http");
const auth_1 = require("../lib/auth");
exports.reviewRouter = (0, express_1.Router)();
const reviewCreateSchema = zod_1.z.object({
    bookingId: zod_1.z.string().min(1),
    rating: zod_1.z.number().int().min(1).max(5),
    comment: zod_1.z.string().max(2000).optional(),
});
exports.reviewRouter.post("/", auth_1.requireAuth, (0, http_1.asyncHandler)(async (req, res) => {
    const input = reviewCreateSchema.parse(req.body);
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: input.bookingId },
    });
    if (!booking) {
        throw new http_1.HttpError(404, "booking_not_found");
    }
    if (booking.status !== "COMPLETED") {
        throw new http_1.HttpError(409, "booking_not_completed");
    }
    if (![booking.mentorId, booking.learnerId].includes(req.user.id)) {
        throw new http_1.HttpError(403, "forbidden");
    }
    const reviewerId = req.user.id;
    const revieweeId = reviewerId === booking.mentorId ? booking.learnerId : booking.mentorId;
    const review = await prisma_1.prisma.review.create({
        data: {
            bookingId: booking.id,
            reviewerId,
            revieweeId,
            rating: input.rating,
            comment: input.comment,
        },
    });
    if (revieweeId === booking.mentorId) {
        const aggregate = await prisma_1.prisma.review.aggregate({
            where: { revieweeId },
            _avg: { rating: true },
            _count: { rating: true },
        });
        await prisma_1.prisma.mentorProfile.update({
            where: { userId: revieweeId },
            data: {
                ratingAvg: aggregate._avg.rating ?? 0,
                ratingCount: aggregate._count.rating ?? 0,
            },
        });
    }
    return res.status(201).json({ review });
}));
exports.reviewRouter.get("/mentor/:mentorId", (0, http_1.asyncHandler)(async (req, res) => {
    const mentorId = String(req.params.mentorId);
    const reviews = await prisma_1.prisma.review.findMany({
        where: { revieweeId: mentorId },
        orderBy: { createdAt: "desc" },
        include: {
            reviewer: { select: { id: true, name: true, role: true } },
        },
    });
    return res.json({ reviews });
}));
exports.reviewRouter.get("/me", auth_1.requireAuth, (0, http_1.asyncHandler)(async (req, res) => {
    const as = req.query.as ? String(req.query.as).toUpperCase() : undefined;
    const role = as ?? req.user.role;
    if (role !== client_1.Role.MENTOR && role !== client_1.Role.LEARNER) {
        throw new http_1.HttpError(400, "invalid_role");
    }
    if (role !== req.user.role && req.user.role !== client_1.Role.ADMIN) {
        throw new http_1.HttpError(403, "forbidden");
    }
    const where = role === client_1.Role.MENTOR
        ? { revieweeId: req.user.id }
        : { reviewerId: req.user.id };
    const reviews = await prisma_1.prisma.review.findMany({
        where,
        orderBy: { createdAt: "desc" },
    });
    return res.json({ reviews });
}));
