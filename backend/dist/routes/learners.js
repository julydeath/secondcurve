"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.learnerRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const http_1 = require("../lib/http");
const auth_1 = require("../lib/auth");
exports.learnerRouter = (0, express_1.Router)();
exports.learnerRouter.get("/me", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.LEARNER), (0, http_1.asyncHandler)(async (req, res) => {
    const learner = await prisma_1.prisma.user.findUnique({
        where: { id: req.user.id },
        include: { learnerProfile: true },
    });
    if (!learner) {
        throw new http_1.HttpError(404, "learner_not_found");
    }
    return res.json({ learner });
}));
const learnerProfileSchema = zod_1.z.object({
    name: zod_1.z.string().min(1).max(120).optional(),
    goals: zod_1.z.string().max(2000).optional(),
    timezone: zod_1.z.string().min(3).optional(),
});
exports.learnerRouter.patch("/me", auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.LEARNER), (0, http_1.asyncHandler)(async (req, res) => {
    const input = learnerProfileSchema.parse(req.body);
    const user = await prisma_1.prisma.user.update({
        where: { id: req.user.id },
        data: input.name ? { name: input.name } : {},
    });
    const profile = await prisma_1.prisma.learnerProfile.upsert({
        where: { userId: req.user.id },
        create: {
            userId: req.user.id,
            goals: input.goals,
            timezone: input.timezone ?? "Asia/Kolkata",
        },
        update: {
            goals: input.goals,
            timezone: input.timezone,
        },
    });
    return res.json({ user, profile });
}));
