import { Router } from "express";
import {
  AvailabilityMode,
  AvailabilityStatus,
  BookingStatus,
  Role,
  SubscriptionStatus,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError, asyncHandler } from "../lib/http";
import { requireAuth, requireRole } from "../lib/auth";
import { getRazorpayKeyId, razorpayClient } from "../lib/razorpay";
import { findOrCreateNextSlot } from "../services/subscriptions";
import { syncCalendarForBooking } from "../lib/calendar";

export const subscriptionRouter = Router();

const subscriptionCreateSchema = z.object({
  availabilityRuleId: z.string().min(1),
});

subscriptionRouter.post(
  "/",
  requireAuth,
  requireRole(Role.LEARNER),
  asyncHandler(async (req, res) => {
    const input = subscriptionCreateSchema.parse(req.body);

    const rule = await prisma.availabilityRule.findUnique({
      where: { id: input.availabilityRuleId },
    });
    if (!rule || rule.mode !== AvailabilityMode.RECURRING || !rule.active) {
      throw new HttpError(404, "rule_not_found");
    }

    const existingSubscription = await prisma.subscription.findFirst({
      where: {
        availabilityRuleId: rule.id,
        status: {
          in: [
            SubscriptionStatus.CREATED,
            SubscriptionStatus.ACTIVE,
            SubscriptionStatus.PAUSED,
            SubscriptionStatus.PAST_DUE,
          ],
        },
      },
    });
    if (existingSubscription) {
      throw new HttpError(409, "rule_unavailable");
    }

    const slot = await findOrCreateNextSlot(rule, new Date());
    if (slot.status !== AvailabilityStatus.AVAILABLE) {
      throw new HttpError(409, "slot_unavailable");
    }

    const booking = await prisma.booking.create({
      data: {
        mentorId: rule.mentorId,
        learnerId: req.user!.id,
        availabilitySlotId: slot.id,
        status: BookingStatus.PENDING,
        scheduledStartAt: slot.startAt,
        scheduledEndAt: slot.endAt,
        priceInr: slot.priceInr,
        platformFeeInr: 0,
        commissionRate: 0.15,
      },
    });

    await prisma.availabilitySlot.update({
      where: { id: slot.id },
      data: { status: AvailabilityStatus.RESERVED },
    });

    await prisma.chatThread.create({
      data: {
        mentorId: rule.mentorId,
        learnerId: req.user!.id,
        bookingId: booking.id,
      },
    });

    const startAtMs = booking.scheduledStartAt.getTime() - 24 * 60 * 60 * 1000;
    const startAtSeconds = Math.max(
      Math.floor(startAtMs / 1000),
      Math.floor(Date.now() / 1000) + 300
    );

    const razorpay = razorpayClient();
    const plan = await razorpay.plans.create({
      period: "weekly",
      interval: 1,
      item: {
        name: `WisdomBridge • ${rule.title}`,
        amount: rule.priceInr * 100,
        currency: "INR",
      },
    });

    const subscription = await razorpay.subscriptions.create({
      plan_id: plan.id,
      total_count: 999,
      customer_notify: 1,
      start_at: startAtSeconds,
      notes: {
        bookingId: booking.id,
        mentorId: rule.mentorId,
        learnerId: req.user!.id,
      },
    });

    const record = await prisma.subscription.create({
      data: {
        mentorId: rule.mentorId,
        learnerId: req.user!.id,
        availabilityRuleId: rule.id,
        bookingId: booking.id,
        provider: "razorpay",
        providerPlanId: plan.id,
        providerSubscriptionId: subscription.id,
        status: SubscriptionStatus.CREATED,
        priceInr: rule.priceInr,
        startAt: new Date(startAtSeconds * 1000),
        nextChargeAt: new Date(startAtSeconds * 1000),
      },
    });

    await syncCalendarForBooking(booking.id);

    return res.status(201).json({
      subscription: record,
      booking,
      razorpay: {
        keyId: getRazorpayKeyId(),
        subscriptionId: subscription.id,
      },
    });
  })
);

subscriptionRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const subs = await prisma.subscription.findMany({
      where:
        req.user!.role === Role.ADMIN
          ? undefined
          : { learnerId: req.user!.id },
      orderBy: { createdAt: "desc" },
      include: { availabilityRule: true, booking: true },
    });
    return res.json({ subscriptions: subs });
  })
);

const pauseSchema = z.object({
  weeks: z.number().int().min(1).max(4),
});

subscriptionRouter.post(
  "/:id/pause",
  requireAuth,
  requireRole(Role.LEARNER, Role.MENTOR),
  asyncHandler(async (req, res) => {
    const input = pauseSchema.parse(req.body);
    const subscription = await prisma.subscription.findUnique({
      where: { id: String(req.params.id) },
    });
    if (
      !subscription ||
      (subscription.learnerId !== req.user!.id &&
        subscription.mentorId !== req.user!.id)
    ) {
      throw new HttpError(404, "subscription_not_found");
    }
    if (!subscription.providerSubscriptionId) {
      throw new HttpError(409, "subscription_not_ready");
    }

    const razorpay = razorpayClient();
    await razorpay.subscriptions.pause(subscription.providerSubscriptionId, {
      pause_at: "now",
    });

    const pauseUntil = new Date(
      Date.now() + input.weeks * 7 * 24 * 60 * 60 * 1000
    );

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.PAUSED,
        pauseUntil,
      },
    });

    return res.json({ subscription: updated });
  })
);

subscriptionRouter.post(
  "/:id/resume",
  requireAuth,
  requireRole(Role.LEARNER, Role.MENTOR),
  asyncHandler(async (req, res) => {
    const subscription = await prisma.subscription.findUnique({
      where: { id: String(req.params.id) },
    });
    if (
      !subscription ||
      (subscription.learnerId !== req.user!.id &&
        subscription.mentorId !== req.user!.id)
    ) {
      throw new HttpError(404, "subscription_not_found");
    }
    if (!subscription.providerSubscriptionId) {
      throw new HttpError(409, "subscription_not_ready");
    }

    const razorpay = razorpayClient();
    await razorpay.subscriptions.resume(subscription.providerSubscriptionId, {
      resume_at: "now",
    });

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.ACTIVE,
        pauseUntil: null,
      },
    });

    return res.json({ subscription: updated });
  })
);

subscriptionRouter.post(
  "/:id/cancel",
  requireAuth,
  requireRole(Role.LEARNER),
  asyncHandler(async (req, res) => {
    const subscription = await prisma.subscription.findUnique({
      where: { id: String(req.params.id) },
    });
    if (!subscription || subscription.learnerId !== req.user!.id) {
      throw new HttpError(404, "subscription_not_found");
    }
    if (!subscription.providerSubscriptionId) {
      throw new HttpError(409, "subscription_not_ready");
    }

    const razorpay = razorpayClient();
    await razorpay.subscriptions.cancel(subscription.providerSubscriptionId);

    const updated = await prisma.subscription.update({
      where: { id: subscription.id },
      data: {
        status: SubscriptionStatus.CANCELED,
        canceledAt: new Date(),
      },
    });

    if (subscription.bookingId) {
      const booking = await prisma.booking.findUnique({
        where: { id: subscription.bookingId },
      });
      if (booking && booking.status === BookingStatus.PENDING) {
        await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
          await tx.booking.update({
            where: { id: booking.id },
            data: { status: BookingStatus.CANCELED, canceledAt: new Date() },
          });
          await tx.availabilitySlot.update({
            where: { id: booking.availabilitySlotId },
            data: { status: AvailabilityStatus.AVAILABLE },
          });
        });
      }
    }

    return res.json({ subscription: updated });
  })
);
