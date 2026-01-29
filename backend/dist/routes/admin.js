"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.adminRouter = void 0;
const express_1 = require("express");
const client_1 = require("@prisma/client");
const zod_1 = require("zod");
const prisma_1 = require("../lib/prisma");
const http_1 = require("../lib/http");
const auth_1 = require("../lib/auth");
exports.adminRouter = (0, express_1.Router)();
exports.adminRouter.use(auth_1.requireAuth, (0, auth_1.requireRole)(client_1.Role.ADMIN));
exports.adminRouter.get("/mentors", (0, http_1.asyncHandler)(async (req, res) => {
    const status = req.query.status ? String(req.query.status) : "pending";
    const mentors = await prisma_1.prisma.user.findMany({
        where: {
            role: client_1.Role.MENTOR,
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
}));
exports.adminRouter.get("/mentors/pending", (0, http_1.asyncHandler)(async (_req, res) => {
    const mentors = await prisma_1.prisma.user.findMany({
        where: {
            role: client_1.Role.MENTOR,
            mentorProfile: { is: { approvedAt: null } },
        },
        include: { mentorProfile: true },
        orderBy: { createdAt: "desc" },
    });
    return res.json({ mentors });
}));
exports.adminRouter.post("/mentors/:id/approve", (0, http_1.asyncHandler)(async (req, res) => {
    const mentorId = String(req.params.id);
    const mentorProfile = await prisma_1.prisma.mentorProfile.findUnique({
        where: { userId: mentorId },
    });
    if (!mentorProfile) {
        throw new http_1.HttpError(404, "mentor_profile_not_found");
    }
    const profile = await prisma_1.prisma.mentorProfile.update({
        where: { userId: mentorId },
        data: { approvedAt: new Date() },
    });
    const user = await prisma_1.prisma.user.update({
        where: { id: mentorId },
        data: { status: client_1.UserStatus.ACTIVE },
    });
    return res.json({ user, profile });
}));
exports.adminRouter.get("/disputes", (0, http_1.asyncHandler)(async (_req, res) => {
    const disputes = await prisma_1.prisma.dispute.findMany({
        include: {
            booking: true,
            raisedBy: { select: { id: true, name: true, email: true } },
        },
        orderBy: { createdAt: "desc" },
    });
    return res.json({ disputes });
}));
const disputeResolveSchema = zod_1.z.object({
    status: zod_1.z.nativeEnum(client_1.DisputeStatus).refine((value) => value !== client_1.DisputeStatus.OPEN && value !== client_1.DisputeStatus.IN_REVIEW, { message: "invalid_status" }),
    resolutionNote: zod_1.z.string().min(5).max(2000).optional(),
});
exports.adminRouter.post("/disputes/:id/resolve", (0, http_1.asyncHandler)(async (req, res) => {
    const input = disputeResolveSchema.parse(req.body);
    const disputeId = String(req.params.id);
    const dispute = await prisma_1.prisma.dispute.update({
        where: { id: disputeId },
        data: {
            status: input.status,
            resolutionNote: input.resolutionNote,
            resolvedAt: new Date(),
        },
    });
    return res.json({ dispute });
}));
const payoutSchema = zod_1.z.object({
    providerPayoutId: zod_1.z.string().optional(),
});
exports.adminRouter.post("/payouts/:id/mark-paid", (0, http_1.asyncHandler)(async (req, res) => {
    const input = payoutSchema.parse(req.body ?? {});
    const payoutId = String(req.params.id);
    const payout = await prisma_1.prisma.payout.update({
        where: { id: payoutId },
        data: {
            status: client_1.PayoutStatus.PAID,
            providerPayoutId: input.providerPayoutId,
            processedAt: new Date(),
        },
    });
    return res.json({ payout });
}));
