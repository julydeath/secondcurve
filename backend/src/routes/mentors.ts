import { Router } from "express";
import { AvailabilityStatus, OAuthProvider, Prisma, Role, UserStatus } from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError, asyncHandler } from "../lib/http";
import { requireAuth, requireRole } from "../lib/auth";

export const mentorRouter = Router();

const ensureLinkedIn = async (mentorId: string) => {
  const linkedIn = await prisma.oAuthAccount.findFirst({
    where: {
      userId: mentorId,
      provider: OAuthProvider.LINKEDIN,
    },
  });
  if (!linkedIn) {
    throw new HttpError(403, "linkedin_required");
  }
};

const parseListParam = (value: unknown) => {
  if (!value) return undefined;
  if (Array.isArray(value)) {
    return value
      .flatMap((entry) => String(entry).split(","))
      .map((entry) => entry.trim())
      .filter(Boolean);
  }
  return String(value)
    .split(",")
    .map((entry) => entry.trim())
    .filter(Boolean);
};

mentorRouter.get(
  "/",
  asyncHandler(async (req, res) => {
    const expertise = parseListParam(req.query.expertise);
    const subjects = parseListParam(req.query.subject);
    const collections = parseListParam(req.query.collection);
    const languages = parseListParam(req.query.language);
    const minPrice = req.query.minPrice ? Number(req.query.minPrice) : undefined;
    const maxPrice = req.query.maxPrice ? Number(req.query.maxPrice) : undefined;
    const minRating = req.query.minRating
      ? Number(req.query.minRating)
      : undefined;
    const minExperience = req.query.minExperience
      ? Number(req.query.minExperience)
      : undefined;
    const availabilityFrom = req.query.availableFrom
      ? new Date(String(req.query.availableFrom))
      : undefined;
    const availabilityTo = req.query.availableTo
      ? new Date(String(req.query.availableTo))
      : undefined;
    const search = req.query.q ? String(req.query.q) : undefined;

    const mentorProfileWhere: Prisma.MentorProfileWhereInput = {};
    if (expertise?.length) {
      mentorProfileWhere.expertiseTags = { hasSome: expertise };
    }
    if (subjects?.length) {
      mentorProfileWhere.subjectTags = { hasSome: subjects };
    }
    if (collections?.length) {
      mentorProfileWhere.collectionTags = { hasSome: collections };
    }
    if (languages?.length) {
      mentorProfileWhere.languages = { hasSome: languages };
    }
    if (minRating) {
      mentorProfileWhere.ratingAvg = { gte: minRating };
    }
    if (minExperience) {
      mentorProfileWhere.yearsExperience = { gte: minExperience };
    }
    if (search) {
      mentorProfileWhere.OR = [
        { bio: { contains: search, mode: "insensitive" } },
        { achievements: { contains: search, mode: "insensitive" } },
        { headline: { contains: search, mode: "insensitive" } },
      ];
    }

    const availabilityFilter =
      minPrice || maxPrice || availabilityFrom || availabilityTo
        ? {
            some: {
              status: AvailabilityStatus.AVAILABLE,
              priceInr: {
                gte: minPrice,
                lte: maxPrice,
              },
              startAt: {
                gte: availabilityFrom,
                lte: availabilityTo,
              },
            },
          }
        : undefined;

    const mentors = await prisma.user.findMany({
      where: {
        role: Role.MENTOR,
        status: UserStatus.ACTIVE,
        mentorProfile: Object.keys(mentorProfileWhere).length
          ? { is: { ...mentorProfileWhere, approvedAt: { not: null } } }
          : { is: { approvedAt: { not: null } } },
        availabilitySlots: availabilityFilter,
      },
      include: {
        mentorProfile: true,
        availabilitySlots: {
          where: {
            status: AvailabilityStatus.AVAILABLE,
            startAt: { gte: new Date() },
          },
          orderBy: { startAt: "asc" },
          take: 5,
        },
      },
    });

    return res.json({ mentors });
  })
);

mentorRouter.get(
  "/me",
  requireAuth,
  requireRole(Role.MENTOR),
  asyncHandler(async (req, res) => {
    const mentor = await prisma.user.findUnique({
      where: { id: req.user!.id },
      include: { mentorProfile: true },
    });
    if (!mentor) {
      throw new HttpError(404, "mentor_not_found");
    }
    return res.json({ mentor });
  })
);

mentorRouter.get(
  "/:id",
  asyncHandler(async (req, res) => {
    const mentorId = String(req.params.id);
    const now = new Date();
    const cutoff = new Date(now.getTime() + 24 * 60 * 60 * 1000);
    const mentor = await prisma.user.findUnique({
      where: { id: mentorId },
      include: {
        mentorProfile: true,
        availabilitySlots: {
          where: {
            status: { in: [AvailabilityStatus.AVAILABLE, AvailabilityStatus.RESERVED, AvailabilityStatus.BOOKED] },
            startAt: { gte: cutoff },
          },
          orderBy: { startAt: "asc" },
          take: 60,
        },
      },
    });

    if (
      !mentor ||
      mentor.role !== Role.MENTOR ||
      mentor.status !== UserStatus.ACTIVE
    ) {
      throw new HttpError(404, "mentor_not_found");
    }

    return res.json({ mentor });
  })
);

const mentorProfileSchema = z.object({
  headline: z.string().min(2).max(120).optional(),
  bio: z.string().min(200).max(2000).optional(),
  yearsExperience: z.number().int().min(1).max(70).optional(),
  expertiseTags: z.array(z.string().min(1)).min(1).optional(),
  subjectTags: z.array(z.string().min(1)).min(1).optional(),
  collectionTags: z.array(z.string().min(1)).min(1).optional(),
  languages: z.array(z.string().min(1)).min(1).optional(),
  achievements: z.string().max(2000).optional(),
  introVideoUrl: z.string().url().optional(),
  profilePhotoUrl: z.string().url().optional(),
  maxSessionsPerDay: z.number().int().min(1).max(20).optional(),
  maxSessionsPerWeek: z.number().int().min(1).max(100).optional(),
  timezone: z.string().min(3).optional(),
});

mentorRouter.patch(
  "/me",
  requireAuth,
  requireRole(Role.MENTOR),
  asyncHandler(async (req, res) => {
    const input = mentorProfileSchema.parse(req.body);
    const existing = await prisma.mentorProfile.findUnique({
      where: { userId: req.user!.id },
    });

    if (!existing) {
      const requiredFields: (keyof typeof input)[] = [
        "bio",
        "yearsExperience",
        "expertiseTags",
        "subjectTags",
        "collectionTags",
        "languages",
      ];

      for (const field of requiredFields) {
        if (!input[field]) {
          throw new HttpError(400, "missing_required_fields", {
            fields: requiredFields,
          });
        }
      }
    }

    const profile = await prisma.mentorProfile.upsert({
      where: { userId: req.user!.id },
      create: {
        userId: req.user!.id,
        bio: input.bio ?? "",
        yearsExperience: input.yearsExperience ?? 0,
        expertiseTags: input.expertiseTags ?? [],
        subjectTags: input.subjectTags ?? [],
        collectionTags: input.collectionTags ?? [],
        languages: input.languages ?? [],
        headline: input.headline,
        achievements: input.achievements,
        introVideoUrl: input.introVideoUrl,
        profilePhotoUrl: input.profilePhotoUrl,
        maxSessionsPerDay: input.maxSessionsPerDay,
        maxSessionsPerWeek: input.maxSessionsPerWeek,
        timezone: input.timezone ?? "Asia/Kolkata",
      },
      update: input,
    });

    return res.json({ profile });
  })
);

const availabilityRuleSchema = z.object({
  title: z.string().min(2).max(120),
  weekday: z.number().int().min(0).max(6),
  startTime: z.string().regex(/^\d{2}:\d{2}$/),
  durationMinutes: z.number().int().refine((value) =>
    [30, 45, 60, 90].includes(value)
  ),
  priceInr: z.number().int().min(100),
  meetingLink: z.string().url().optional(),
  mode: z.enum(["ONE_TIME", "RECURRING"]),
  active: z.boolean().optional(),
  timezone: z.string().min(3).optional(),
});

mentorRouter.post(
  "/me/availability/rules",
  requireAuth,
  requireRole(Role.MENTOR),
  asyncHandler(async (req, res) => {
    await ensureLinkedIn(req.user!.id);
    const input = availabilityRuleSchema.parse(req.body);
    const startMinutes = toMinutes(input.startTime);
    const endMinutes = startMinutes + input.durationMinutes;

    const existingRules = await prisma.availabilityRule.findMany({
      where: {
        mentorId: req.user!.id,
        weekday: input.weekday,
      },
    });
    const conflict = existingRules.some((rule) => {
      const ruleStart = toMinutes(rule.startTime);
      const ruleEnd = ruleStart + rule.durationMinutes;
      return rangesOverlap(startMinutes, endMinutes, ruleStart, ruleEnd);
    });
    if (conflict) {
      throw new HttpError(409, "availability_conflict");
    }
    const rule = await prisma.availabilityRule.create({
      data: {
        mentorId: req.user!.id,
        title: input.title,
        weekday: input.weekday,
        startTime: input.startTime,
        durationMinutes: input.durationMinutes,
        priceInr: input.priceInr,
        meetingLink: input.meetingLink,
        mode: input.mode,
        active: input.active ?? true,
        timezone: input.timezone ?? "Asia/Kolkata",
      },
    });

    return res.status(201).json({ rule });
  })
);

mentorRouter.get(
  "/me/availability/rules",
  requireAuth,
  requireRole(Role.MENTOR),
  asyncHandler(async (req, res) => {
    const rules = await prisma.availabilityRule.findMany({
      where: { mentorId: req.user!.id },
      orderBy: { createdAt: "desc" },
    });
    return res.json({ rules });
  })
);

mentorRouter.patch(
  "/me/availability/rules/:id",
  requireAuth,
  requireRole(Role.MENTOR),
  asyncHandler(async (req, res) => {
    const input = availabilityRuleSchema.partial().parse(req.body);
    const ruleId = String(req.params.id);
    const existing = await prisma.availabilityRule.findFirst({
      where: { id: ruleId, mentorId: req.user!.id },
    });
    if (!existing) {
      throw new HttpError(404, "rule_not_found");
    }

    const nextWeekday = input.weekday ?? existing.weekday;
    const nextStart = input.startTime ?? existing.startTime;
    const nextDuration = input.durationMinutes ?? existing.durationMinutes;
    const nextStartMinutes = toMinutes(nextStart);
    const nextEndMinutes = nextStartMinutes + nextDuration;

    const otherRules = await prisma.availabilityRule.findMany({
      where: {
        mentorId: req.user!.id,
        weekday: nextWeekday,
        id: { not: ruleId },
      },
    });
    const conflict = otherRules.some((rule) => {
      const ruleStart = toMinutes(rule.startTime);
      const ruleEnd = ruleStart + rule.durationMinutes;
      return rangesOverlap(nextStartMinutes, nextEndMinutes, ruleStart, ruleEnd);
    });
    if (conflict) {
      throw new HttpError(409, "availability_conflict");
    }

    const rule = await prisma.availabilityRule.update({
      where: { id: ruleId },
      data: input,
    });
    return res.json({ rule });
  })
);

mentorRouter.delete(
  "/me/availability/rules/:id",
  requireAuth,
  requireRole(Role.MENTOR),
  asyncHandler(async (req, res) => {
    const ruleId = String(req.params.id);
    const deleted = await prisma.availabilityRule.deleteMany({
      where: { id: ruleId, mentorId: req.user!.id },
    });
    if (!deleted.count) {
      throw new HttpError(404, "rule_not_found");
    }
    return res.status(204).send();
  })
);

const ruleGenerateSchema = z.object({
  weeks: z.number().int().min(1).max(52).default(4),
  startDate: z.string().datetime().optional(),
});

const toMinutes = (time: string) => {
  const [hours, minutes] = time.split(":").map(Number);
  return hours * 60 + minutes;
};

const rangesOverlap = (aStart: number, aEnd: number, bStart: number, bEnd: number) =>
  aStart < bEnd && bStart < aEnd;

mentorRouter.post(
  "/me/availability/rules/:id/generate",
  requireAuth,
  requireRole(Role.MENTOR),
  asyncHandler(async (req, res) => {
    const input = ruleGenerateSchema.parse(req.body ?? {});
    const ruleId = String(req.params.id);
    const rule = await prisma.availabilityRule.findFirst({
      where: { id: ruleId, mentorId: req.user!.id },
    });
    if (!rule) {
      throw new HttpError(404, "rule_not_found");
    }

    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    const totalDays = input.weeks * 7;
    const startMinutes = toMinutes(rule.startTime);

    const slots: Prisma.AvailabilitySlotCreateManyInput[] = [];

    for (let day = 0; day <= totalDays; day += 1) {
      const date = new Date(startDate);
      date.setDate(startDate.getDate() + day);
      if (date.getDay() !== rule.weekday) {
        continue;
      }

      const slotStart = new Date(date);
      slotStart.setHours(0, 0, 0, 0);
      slotStart.setMinutes(startMinutes);
      const slotEnd = new Date(slotStart);
      slotEnd.setMinutes(slotStart.getMinutes() + rule.durationMinutes);

      slots.push({
        mentorId: rule.mentorId,
        ruleId: rule.id,
        startAt: slotStart,
        endAt: slotEnd,
        durationMinutes: rule.durationMinutes,
        priceInr: rule.priceInr,
        title: rule.title,
        meetingLink: rule.meetingLink,
        mode: rule.mode,
      });
    }

    await prisma.availabilitySlot.createMany({
      data: slots,
      skipDuplicates: true,
    });

    return res.status(201).json({ created: slots.length });
  })
);

const slotSchema = z.object({
  title: z.string().min(2).max(120),
  startAt: z.string().datetime(),
  endAt: z.string().datetime(),
  durationMinutes: z.number().int().refine((value) =>
    [30, 45, 60, 90].includes(value)
  ),
  priceInr: z.number().int().min(100),
  meetingLink: z.string().url().optional(),
  mode: z.enum(["ONE_TIME", "RECURRING"]).default("ONE_TIME"),
});

mentorRouter.post(
  "/me/availability/slots",
  requireAuth,
  requireRole(Role.MENTOR),
  asyncHandler(async (req, res) => {
    await ensureLinkedIn(req.user!.id);
    const input = z.array(slotSchema).min(1).parse(req.body);
    const slotRanges = input.map((slot) => ({
      startAt: new Date(slot.startAt),
      endAt: new Date(slot.endAt),
    }));
    const minStart = new Date(
      Math.min(...slotRanges.map((slot) => slot.startAt.getTime()))
    );
    const maxEnd = new Date(
      Math.max(...slotRanges.map((slot) => slot.endAt.getTime()))
    );

    const existingSlots = await prisma.availabilitySlot.findMany({
      where: {
        mentorId: req.user!.id,
        startAt: { lt: maxEnd },
        endAt: { gt: minStart },
      },
      select: { startAt: true, endAt: true },
    });

    const overlap = slotRanges.some((slot) =>
      existingSlots.some(
        (existing) =>
          slot.startAt < existing.endAt && existing.startAt < slot.endAt
      )
    );
    if (overlap) {
      throw new HttpError(409, "availability_conflict");
    }
    const slots = await prisma.availabilitySlot.createMany({
      data: input.map((slot) => ({
        mentorId: req.user!.id,
        title: slot.title,
        startAt: new Date(slot.startAt),
        endAt: new Date(slot.endAt),
        durationMinutes: slot.durationMinutes,
        priceInr: slot.priceInr,
        meetingLink: slot.meetingLink,
        mode: slot.mode,
      })),
      skipDuplicates: true,
    });

    return res.status(201).json({ created: slots.count });
  })
);

mentorRouter.get(
  "/me/availability/slots",
  requireAuth,
  requireRole(Role.MENTOR),
  asyncHandler(async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const slots = await prisma.availabilitySlot.findMany({
      where: {
        mentorId: req.user!.id,
        startAt: { gte: from, lte: to },
      },
      orderBy: { startAt: "asc" },
      include: {
        booking: {
          include: {
            learner: { select: { id: true, name: true } },
            subscription: true,
          },
        },
      },
    });
    return res.json({ slots });
  })
);

mentorRouter.get(
  "/me/payouts",
  requireAuth,
  requireRole(Role.MENTOR),
  asyncHandler(async (req, res) => {
    const payouts = await prisma.payout.findMany({
      where: { mentorId: req.user!.id },
      orderBy: { createdAt: "desc" },
      include: {
        booking: {
          include: {
            learner: { select: { id: true, name: true, email: true } },
          },
        },
      },
    });
    return res.json({ payouts });
  })
);

mentorRouter.get(
  "/:id/availability/slots",
  asyncHandler(async (req, res) => {
    const mentorId = String(req.params.id);
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const slots = await prisma.availabilitySlot.findMany({
      where: {
        mentorId,
        status: AvailabilityStatus.AVAILABLE,
        startAt: { gte: from, lte: to },
      },
      orderBy: { startAt: "asc" },
    });

    return res.json({ slots });
  })
);

mentorRouter.get(
  "/:id/availability/rules",
  asyncHandler(async (req, res) => {
    const mentorId = String(req.params.id);
    const mode = req.query.mode ? String(req.query.mode).toUpperCase() : undefined;

    const mentor = await prisma.user.findUnique({
      where: { id: mentorId },
      include: { mentorProfile: true },
    });
    if (
      !mentor ||
      mentor.role !== Role.MENTOR ||
      mentor.status !== UserStatus.ACTIVE ||
      !mentor.mentorProfile?.approvedAt
    ) {
      throw new HttpError(404, "mentor_not_found");
    }

    const rules = await prisma.availabilityRule.findMany({
      where: {
        mentorId,
        active: true,
        ...(mode ? { mode: mode as "ONE_TIME" | "RECURRING" } : {}),
      },
      orderBy: { createdAt: "desc" },
    });

    return res.json({ rules });
  })
);

mentorRouter.patch(
  "/me/availability/slots/:id",
  requireAuth,
  requireRole(Role.MENTOR),
  asyncHandler(async (req, res) => {
    const input = z
      .object({
        status: z.enum(["AVAILABLE", "BLOCKED"]),
      })
      .parse(req.body);

    const slotId = String(req.params.id);
    const updated = await prisma.availabilitySlot.updateMany({
      where: { id: slotId, mentorId: req.user!.id },
      data: { status: input.status },
    });
    if (!updated.count) {
      throw new HttpError(404, "slot_not_found");
    }
    const slot = await prisma.availabilitySlot.findUnique({
      where: { id: slotId },
    });
    return res.json({ slot });
  })
);
