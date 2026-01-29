import { Router } from "express";
import { DisputeStatus, PayoutStatus, Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError, asyncHandler } from "../lib/http";
import { requireAuth, requireRole } from "../lib/auth";

export const adminRouter = Router();

adminRouter.use(requireAuth, requireRole(Role.ADMIN));

adminRouter.get(
  "/mentors",
  asyncHandler(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : "pending";
    const mentors = await prisma.user.findMany({
      where: {
        role: Role.MENTOR,
        ...(status === "pending"
          ? {
              OR: [
                { mentorProfile: { is: { approvedAt: null } } },
                { mentorProfile: { is: null } },
              ],
            }
          : status === "approved"
          ? { mentorProfile: { is: { approvedAt: { not: null } } } }
          : {}),
      },
      include: { mentorProfile: true },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ mentors });
  })
);

adminRouter.get(
  "/mentors/pending",
  asyncHandler(async (_req, res) => {
    const mentors = await prisma.user.findMany({
      where: {
        role: Role.MENTOR,
        mentorProfile: { is: { approvedAt: null } },
      },
      include: { mentorProfile: true },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ mentors });
  })
);

adminRouter.post(
  "/mentors/:id/approve",
  asyncHandler(async (req, res) => {
    const mentorId = String(req.params.id);
    const mentorProfile = await prisma.mentorProfile.findUnique({
      where: { userId: mentorId },
    });
    if (!mentorProfile) {
      throw new HttpError(404, "mentor_profile_not_found");
    }
    const profile = await prisma.mentorProfile.update({
      where: { userId: mentorId },
      data: { approvedAt: new Date() },
    });
    const user = await prisma.user.update({
      where: { id: mentorId },
      data: { status: UserStatus.ACTIVE },
    });
    return res.json({ user, profile });
  })
);

adminRouter.get(
  "/disputes",
  asyncHandler(async (_req, res) => {
    const disputes = await prisma.dispute.findMany({
      include: {
        booking: true,
        raisedBy: { select: { id: true, name: true, email: true } },
      },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ disputes });
  })
);

const disputeResolveSchema = z.object({
  status: z.nativeEnum(DisputeStatus).refine(
    (value) => value !== DisputeStatus.OPEN && value !== DisputeStatus.IN_REVIEW,
    { message: "invalid_status" }
  ),
  resolutionNote: z.string().min(5).max(2000).optional(),
});

adminRouter.post(
  "/disputes/:id/resolve",
  asyncHandler(async (req, res) => {
    const input = disputeResolveSchema.parse(req.body);
    const disputeId = String(req.params.id);
    const dispute = await prisma.dispute.update({
      where: { id: disputeId },
      data: {
        status: input.status,
        resolutionNote: input.resolutionNote,
        resolvedAt: new Date(),
      },
    });
    return res.json({ dispute });
  })
);

const payoutSchema = z.object({
  providerPayoutId: z.string().optional(),
});

adminRouter.post(
  "/payouts/:id/mark-paid",
  asyncHandler(async (req, res) => {
    const input = payoutSchema.parse(req.body ?? {});
    const payoutId = String(req.params.id);
    const payout = await prisma.payout.update({
      where: { id: payoutId },
      data: {
        status: PayoutStatus.PAID,
        providerPayoutId: input.providerPayoutId,
        processedAt: new Date(),
      },
    });
    return res.json({ payout });
  })
);
