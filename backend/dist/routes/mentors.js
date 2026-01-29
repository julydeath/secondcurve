"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.mentorRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const http_1 = require("../lib/http");
const auth_1 = require("../lib/auth");
exports.mentorRouter = (0, express_1.Router)();
const ensureLinkedIn = async (mentorId) => {
    const linkedIn = await prisma_1.prisma.oAuthAccount.findFirst({
        where: {
            userId: mentorId,
            provider: client_1.OAuthProvider.LINKEDIN,
        },
    });
    if (!linkedIn) {
        throw new http_1.HttpError(403, "linkedin_required");
    }
};
const parseListParam = (value) => {
    if (!value)
        return undefined;
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
exports.mentorRouter.get("/", (0, http_1.asyncHandler)(async (req, res) => {
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
    const mentorProfileWhere = {};
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
    const availabilityFilter = minPrice || maxPrice || availabilityFrom || availabilityTo
        ? {
            some: {
                status: client_1.AvailabilityStatus.AVAILABLE,
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
    const mentors = await prisma_1.prisma.user.findMany({
        where: {
            role: client_1.Role.MENTOR,
            status: client_1.UserStatus.ACTIVE,
            mentorProfile: Object.keys(mentorProfileWhere).length
                ? { is: { ...mentorProfileWhere, approvedAt: { not: null } } }
                : { is: { approvedAt: { not: null } } },
            availabilitySlots: availabilityFilter,
        },
        include: {
            mentorProfile: true,
            availabilitySlots: {
                where: {
                    status: client_1.AvailabilityStatus.AVAILABLE,
                    startAt: { gte: new Date() },
                },
                orderBy: { startAt: "asc" },
                take: 5,
            },
        },
    });
    return res.json({ mentors });
}));
exports.mentorRouter.get("/me", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.MENTOR), (0, http_1.asyncHandler)(async (req, res) => {
    const mentor = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.id },
        include: { mentorProfile: true },
    });
    if (!mentor) {
        throw new http_1.HttpError(404, "mentor_not_found");
    }
    return res.json({ mentor });
}));
exports.mentorRouter.get("/:id", (0, http_1.asyncHandler)(async (req, res) => {
    const mentorId = String(req.params.id);
    const mentor = await prisma_1.prisma.user.findUnique({
        where: { id: mentorId },
        include: {
            mentorProfile: true,
            availabilitySlots: {
                where: { status: client_1.AvailabilityStatus.AVAILABLE, startAt: { gte: new Date() } },
                orderBy: { startAt: "asc" },
                take: 20,
            },
        },
    });
    if (!mentor ||
        mentor.role !== client_1.Role.MENTOR ||
        mentor.status !== client_1.UserStatus.ACTIVE) {
        throw new http_1.HttpError(404, "mentor_not_found");
    }
    return res.json({ mentor });
}));
const mentorProfileSchema = zod_1.z.object({
    headline: zod_1.z.string().min(2).max(120).optional(),
    bio: zod_1.z.string().min(200).max(2000).optional(),
    yearsExperience: zod_1.z.number().int().min(1).max(70).optional(),
    expertiseTags: zod_1.z.array(zod_1.z.string().min(1)).min(1).optional(),
    subjectTags: zod_1.z.array(zod_1.z.string().min(1)).min(1).optional(),
    collectionTags: zod_1.z.array(zod_1.z.string().min(1)).min(1).optional(),
    languages: zod_1.z.array(zod_1.z.string().min(1)).min(1).optional(),
    achievements: zod_1.z.string().max(2000).optional(),
    introVideoUrl: zod_1.z.string().url().optional(),
    profilePhotoUrl: zod_1.z.string().url().optional(),
    maxSessionsPerDay: zod_1.z.number().int().min(1).max(20).optional(),
    maxSessionsPerWeek: zod_1.z.number().int().min(1).max(100).optional(),
    timezone: zod_1.z.string().min(3).optional(),
});
exports.mentorRouter.patch("/me", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.MENTOR), (0, http_1.asyncHandler)(async (req, res) => {
    const input = mentorProfileSchema.parse(req.body);
    const existing = await prisma_1.prisma.mentorProfile.findUnique({
        where: { userId: req.user.id },
    });
    if (!existing) {
        const requiredFields = [
            "bio",
            "yearsExperience",
            "expertiseTags",
            "subjectTags",
            "collectionTags",
            "languages",
        ];
        for (const field of requiredFields) {
            if (!input[field]) {
                throw new http_1.HttpError(400, "missing_required_fields", {
                    fields: requiredFields,
                });
            }
        }
    }
    const profile = await prisma_1.prisma.mentorProfile.upsert({
        where: { userId: req.user.id },
        create: {
            userId: req.user.id,
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
}));
const availabilityRuleSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(120),
    weekday: zod_1.z.number().int().min(0).max(6),
    startTime: zod_1.z.string().regex(/^\d{2}:\d{2}$/),
    durationMinutes: zod_1.z.number().int().refine((value) => [30, 45, 60, 90].includes(value)),
    priceInr: zod_1.z.number().int().min(100),
    meetingLink: zod_1.z.string().url().optional(),
    mode: zod_1.z.enum(["ONE_TIME", "RECURRING"]),
    active: zod_1.z.boolean().optional(),
    timezone: zod_1.z.string().min(3).optional(),
});
exports.mentorRouter.post("/me/availability/rules", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.MENTOR), (0, http_1.asyncHandler)(async (req, res) => {
    await ensureLinkedIn(req.user.id);
    const input = availabilityRuleSchema.parse(req.body);
    const rule = await prisma_1.prisma.availabilityRule.create({
        data: {
            mentorId: req.user.id,
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
}));
exports.mentorRouter.get("/me/availability/rules", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.MENTOR), (0, http_1.asyncHandler)(async (req, res) => {
    const rules = await prisma_1.prisma.availabilityRule.findMany({
        where: { mentorId: req.user.id },
        orderBy: { createdAt: "desc" },
    });
    return res.json({ rules });
}));
exports.mentorRouter.patch("/me/availability/rules/:id", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.MENTOR), (0, http_1.asyncHandler)(async (req, res) => {
    const input = availabilityRuleSchema.partial().parse(req.body);
    const ruleId = String(req.params.id);
    const updated = await prisma_1.prisma.availabilityRule.updateMany({
        where: { id: ruleId, mentorId: req.user.id },
        data: input,
    });
    if (!updated.count) {
        throw new http_1.HttpError(404, "rule_not_found");
    }
    const rule = await prisma_1.prisma.availabilityRule.findUnique({
        where: { id: ruleId },
    });
    return res.json({ rule });
}));
exports.mentorRouter.delete("/me/availability/rules/:id", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.MENTOR), (0, http_1.asyncHandler)(async (req, res) => {
    const ruleId = String(req.params.id);
    const deleted = await prisma_1.prisma.availabilityRule.deleteMany({
        where: { id: ruleId, mentorId: req.user.id },
    });
    if (!deleted.count) {
        throw new http_1.HttpError(404, "rule_not_found");
    }
    return res.status(204).send();
}));
const ruleGenerateSchema = zod_1.z.object({
    weeks: zod_1.z.number().int().min(1).max(52).default(4),
    startDate: zod_1.z.string().datetime().optional(),
});
const toMinutes = (time) => {
    const [hours, minutes] = time.split(":").map(Number);
    return hours * 60 + minutes;
};
exports.mentorRouter.post("/me/availability/rules/:id/generate", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.MENTOR), (0, http_1.asyncHandler)(async (req, res) => {
    const input = ruleGenerateSchema.parse(req.body ?? {});
    const ruleId = String(req.params.id);
    const rule = await prisma_1.prisma.availabilityRule.findFirst({
        where: { id: ruleId, mentorId: req.user.id },
    });
    if (!rule) {
        throw new http_1.HttpError(404, "rule_not_found");
    }
    const startDate = input.startDate ? new Date(input.startDate) : new Date();
    const totalDays = input.weeks * 7;
    const startMinutes = toMinutes(rule.startTime);
    const slots = [];
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
    await prisma_1.prisma.availabilitySlot.createMany({
        data: slots,
        skipDuplicates: true,
    });
    return res.status(201).json({ created: slots.length });
}));
const slotSchema = zod_1.z.object({
    title: zod_1.z.string().min(2).max(120),
    startAt: zod_1.z.string().datetime(),
    endAt: zod_1.z.string().datetime(),
    durationMinutes: zod_1.z.number().int().refine((value) => [30, 45, 60, 90].includes(value)),
    priceInr: zod_1.z.number().int().min(100),
    meetingLink: zod_1.z.string().url().optional(),
    mode: zod_1.z.enum(["ONE_TIME", "RECURRING"]).default("ONE_TIME"),
});
exports.mentorRouter.post("/me/availability/slots", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.MENTOR), (0, http_1.asyncHandler)(async (req, res) => {
    await ensureLinkedIn(req.user.id);
    const input = zod_1.z.array(slotSchema).min(1).parse(req.body);
    const slots = await prisma_1.prisma.availabilitySlot.createMany({
        data: input.map((slot) => ({
            mentorId: req.user.id,
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
}));
exports.mentorRouter.get("/me/availability/slots", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.MENTOR), (0, http_1.asyncHandler)(async (req, res) => {
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const slots = await prisma_1.prisma.availabilitySlot.findMany({
        where: {
            mentorId: req.user.id,
            startAt: { gte: from, lte: to },
        },
        orderBy: { startAt: "asc" },
    });
    return res.json({ slots });
}));
exports.mentorRouter.get("/:id/availability/slots", (0, http_1.asyncHandler)(async (req, res) => {
    const mentorId = String(req.params.id);
    const from = req.query.from ? new Date(String(req.query.from)) : undefined;
    const to = req.query.to ? new Date(String(req.query.to)) : undefined;
    const slots = await prisma_1.prisma.availabilitySlot.findMany({
        where: {
            mentorId,
            status: client_1.AvailabilityStatus.AVAILABLE,
            startAt: { gte: from, lte: to },
        },
        orderBy: { startAt: "asc" },
    });
    return res.json({ slots });
}));
exports.mentorRouter.patch("/me/availability/slots/:id", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.MENTOR), (0, http_1.asyncHandler)(async (req, res) => {
    const input = zod_1.z
        .object({
        status: zod_1.z.enum(["AVAILABLE", "BLOCKED"]),
    })
        .parse(req.body);
    const slotId = String(req.params.id);
    const updated = await prisma_1.prisma.availabilitySlot.updateMany({
        where: { id: slotId, mentorId: req.user.id },
        data: { status: input.status },
    });
    if (!updated.count) {
        throw new http_1.HttpError(404, "slot_not_found");
    }
    const slot = await prisma_1.prisma.availabilitySlot.findUnique({
        where: { id: slotId },
    });
    return res.json({ slot });
}));
