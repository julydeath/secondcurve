import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError, asyncHandler } from "../lib/http";
import { requireAuth } from "../lib/auth";

export const reviewRouter = Router();

const reviewCreateSchema = z.object({
  bookingId: z.string().min(1),
  rating: z.number().int().min(1).max(5),
  comment: z.string().max(2000).optional(),
});

reviewRouter.post(
  "/",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = reviewCreateSchema.parse(req.body);
    const booking = await prisma.booking.findUnique({
      where: { id: input.bookingId },
    });

    if (!booking) {
      throw new HttpError(404, "booking_not_found");
    }
    if (booking.status !== "COMPLETED") {
      throw new HttpError(409, "booking_not_completed");
    }
    if (![booking.mentorId, booking.learnerId].includes(req.user!.id)) {
      throw new HttpError(403, "forbidden");
    }

    const reviewerId = req.user!.id;
    const revieweeId =
      reviewerId === booking.mentorId ? booking.learnerId : booking.mentorId;

    const review = await prisma.review.create({
      data: {
        bookingId: booking.id,
        reviewerId,
        revieweeId,
        rating: input.rating,
        comment: input.comment,
      },
    });

    if (revieweeId === booking.mentorId) {
      const aggregate = await prisma.review.aggregate({
        where: { revieweeId },
        _avg: { rating: true },
        _count: { rating: true },
      });

      await prisma.mentorProfile.update({
        where: { userId: revieweeId },
        data: {
          ratingAvg: aggregate._avg.rating ?? 0,
          ratingCount: aggregate._count.rating ?? 0,
        },
      });
    }

    return res.status(201).json({ review });
  })
);

reviewRouter.get(
  "/mentor/:mentorId",
  asyncHandler(async (req, res) => {
    const mentorId = String(req.params.mentorId);
    const reviews = await prisma.review.findMany({
      where: { revieweeId: mentorId },
      orderBy: { createdAt: "desc" },
      include: {
        reviewer: { select: { id: true, name: true, role: true } },
      },
    });
    return res.json({ reviews });
  })
);

reviewRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const as = req.query.as ? String(req.query.as).toUpperCase() : undefined;
    const role = as ?? req.user!.role;
    if (role !== Role.MENTOR && role !== Role.LEARNER) {
      throw new HttpError(400, "invalid_role");
    }
    if (role !== req.user!.role && req.user!.role !== Role.ADMIN) {
      throw new HttpError(403, "forbidden");
    }

    const where =
      role === Role.MENTOR
        ? { revieweeId: req.user!.id }
        : { reviewerId: req.user!.id };

    const reviews = await prisma.review.findMany({
      where,
      orderBy: { createdAt: "desc" },
    });

    return res.json({ reviews });
  })
);
