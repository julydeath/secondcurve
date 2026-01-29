import { Router } from "express";
import { Role } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError, asyncHandler } from "../lib/http";
import { requireAuth, requireRole } from "../lib/auth";

export const learnerRouter = Router();

learnerRouter.get(
  "/me",
  requireAuth,
  requireRole(Role.LEARNER),
  asyncHandler(async (req, res) => {
    const learner = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { learnerProfile: true },
    });
    if (!learner) {
      throw new HttpError(404, "learner_not_found");
    }
    return res.json({ learner });
  })
);

const learnerProfileSchema = z.object({
  name: z.string().min(1).max(120).optional(),
  goals: z.string().max(2000).optional(),
  timezone: z.string().min(3).optional(),
});

learnerRouter.patch(
  "/me",
  requireAuth,
  requireRole(Role.LEARNER),
  asyncHandler(async (req, res) => {
    const input = learnerProfileSchema.parse(req.body);
    const user = await prisma.user.update({
      where: { id: req.user!.id },
      data: input.name ? { name: input.name } : {},
    });
    const profile = await prisma.learnerProfile.upsert({
      where: { userId: req.user!.id },
      create: {
        userId: req.user!.id,
        goals: input.goals,
        timezone: input.timezone ?? "Asia/Kolkata",
      },
      update: {
        goals: input.goals,
        timezone: input.timezone,
      },
    });
    return res.json({ user, profile });
  })
);
