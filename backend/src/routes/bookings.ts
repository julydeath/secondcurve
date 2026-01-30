import { Router } from "express";
import {
  AvailabilityStatus,
  BookingStatus,
  PaymentStatus,
  PayoutStatus,
  Role,
  Prisma,
} from "@prisma/client";
import { z } from "zod";
import { prisma } from "../lib/prisma";
import { HttpError, asyncHandler } from "../lib/http";
import { requireAuth, requireRole } from "../lib/auth";
import {
  getRazorpayKeyId,
  razorpayClient,
  verifyCheckoutSignature,
} from "../lib/razorpay";
import { syncCalendarForBooking } from "../lib/calendar";

export const bookingRouter = Router();

const bookingCreateSchema = z.object({
  availabilitySlotId: z.string().min(1),
});

bookingRouter.post(
  "/",
  requireAuth,
  requireRole(Role.LEARNER),
  asyncHandler(async (req, res) => {
    const input = bookingCreateSchema.parse(req.body);

    console.log("Creating booking for slot:", input);

    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const slot = await tx.availabilitySlot.findUnique({
          where: { id: input.availabilitySlotId },
        });
        if (!slot || slot.status !== AvailabilityStatus.AVAILABLE) {
          throw new HttpError(409, "slot_unavailable");
        }
        if (slot.mode === "RECURRING") {
          throw new HttpError(409, "use_subscription_for_recurring");
        }

        const existing = await tx.booking.findUnique({
          where: { availabilitySlotId: slot.id },
          include: { payment: true },
        });
        if (existing) {
          if (existing.status !== BookingStatus.CANCELED) {
            throw new HttpError(409, "slot_unavailable");
          }
          if (existing.payment) {
            await tx.payment.delete({ where: { id: existing.payment.id } });
          }
          await tx.booking.delete({ where: { id: existing.id } });
        }

        const booking = await tx.booking.create({
          data: {
            mentorId: slot.mentorId,
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

        await tx.availabilitySlot.update({
          where: { id: slot.id },
          data: { status: AvailabilityStatus.RESERVED },
        });

        const razorpay = razorpayClient();

        const order = await razorpay.orders.create({
          amount: slot.priceInr * 100,
          currency: "INR",
          receipt: `booking_${booking.id}`,
          payment_capture: true,
          notes: {
            bookingId: booking.id,
            mentorId: slot.mentorId,
            learnerId: req.user!.id,
          },
        });

        const payment = await tx.payment.create({
          data: {
            bookingId: booking.id,
            provider: "razorpay",
            amountInr: slot.priceInr,
            status: PaymentStatus.CREATED,
            providerOrderId: order.id,
            scheduledFor: new Date(Date.now() + 30 * 60 * 1000),
          raw: order as unknown as Prisma.JsonObject,
          },
        });

        await tx.chatThread.create({
          data: {
            mentorId: slot.mentorId,
            learnerId: req.user!.id,
            bookingId: booking.id,
          },
        });

        return { booking, payment, order };
      },
    );

    return res.status(201).json({
      booking: result.booking,
      payment: result.payment,
      razorpay: {
        keyId: getRazorpayKeyId(),
        orderId: result.order.id,
        amount: result.order.amount,
        currency: result.order.currency,
      },
    });
  }),
);

bookingRouter.get(
  "/me",
  requireAuth,
  asyncHandler(async (req, res) => {
    const asRole = req.query.as
      ? String(req.query.as).toUpperCase()
      : undefined;
    const role = asRole ?? req.user!.role;

    if (role !== Role.MENTOR && role !== Role.LEARNER) {
      throw new HttpError(400, "invalid_role");
    }
    if (role !== req.user!.role && req.user!.role !== Role.ADMIN) {
      throw new HttpError(403, "forbidden");
    }

    const where =
      role === Role.MENTOR
        ? { mentorId: req.user!.id }
        : { learnerId: req.user!.id };

    const bookings = await prisma.booking.findMany({
      where,
      orderBy: { scheduledStartAt: "desc" },
      include: {
        mentor: { select: { id: true, name: true, email: true } },
        learner: { select: { id: true, name: true, email: true } },
        payment: true,
        availabilitySlot: {
          include: {
            rule: true,
          },
        },
      },
    });

    return res.json({ bookings });
  }),
);

bookingRouter.get(
  "/:id/receipt",
  requireAuth,
  asyncHandler(async (req, res) => {
    const bookingId = String(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: {
        mentor: { select: { name: true, email: true } },
        learner: { select: { name: true, email: true } },
        payment: true,
      },
    });
    if (!booking) {
      throw new HttpError(404, "booking_not_found");
    }
    if (![booking.mentorId, booking.learnerId].includes(req.user!.id)) {
      throw new HttpError(403, "forbidden");
    }
    if (!booking.payment || booking.payment.status !== PaymentStatus.CAPTURED) {
      throw new HttpError(409, "receipt_not_ready");
    }

    const lines = [
      "WisdomBridge Payment Receipt",
      `Booking ID: ${booking.id}`,
      `Mentor: ${booking.mentor.name} (${booking.mentor.email})`,
      `Learner: ${booking.learner.name} (${booking.learner.email})`,
      `Session Time: ${booking.scheduledStartAt.toISOString()}`,
      `Amount: INR ${booking.priceInr}`,
      `Payment Status: ${booking.payment.status}`,
      `Razorpay Order ID: ${booking.payment.providerOrderId ?? "N/A"}`,
      `Razorpay Payment ID: ${booking.payment.providerPaymentId ?? "N/A"}`,
      `Captured At: ${booking.payment.capturedAt?.toISOString() ?? "N/A"}`,
    ];

    res.setHeader("Content-Type", "text/plain");
    res.setHeader(
      "Content-Disposition",
      `attachment; filename="wisdombridge-receipt-${booking.id}.txt"`
    );
    return res.send(lines.join("\n"));
  }),
);

const paymentConfirmSchema = z.object({
  razorpayOrderId: z.string().min(1),
  razorpayPaymentId: z.string().min(1),
  razorpaySignature: z.string().min(1),
  method: z.string().optional(),
});

bookingRouter.post(
  "/:id/confirm-payment",
  requireAuth,
  requireRole(Role.LEARNER),
  asyncHandler(async (req, res) => {
    const input = paymentConfirmSchema.parse(req.body);
    const bookingId = String(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true, availabilitySlot: true },
    });

    if (!booking) {
      throw new HttpError(404, "booking_not_found");
    }
    if (booking.learnerId !== req.user!.id) {
      throw new HttpError(403, "forbidden");
    }
    if (!booking.payment) {
      throw new HttpError(409, "payment_missing");
    }

    if (booking.payment.providerOrderId !== input.razorpayOrderId) {
      throw new HttpError(409, "order_mismatch");
    }
    const valid = verifyCheckoutSignature(
      input.razorpayOrderId,
      input.razorpayPaymentId,
      input.razorpaySignature,
    );
    if (!valid) {
      throw new HttpError(400, "invalid_signature");
    }

    const payment = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const updatedPayment = await tx.payment.update({
          where: { id: booking.payment!.id },
          data: {
            status: PaymentStatus.CAPTURED,
            providerPaymentId: input.razorpayPaymentId,
            method: input.method,
            capturedAt: new Date(),
          },
        });

        await tx.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.CONFIRMED },
        });

        await tx.availabilitySlot.update({
          where: { id: booking.availabilitySlotId },
          data: { status: AvailabilityStatus.BOOKED },
        });

        return updatedPayment;
      },
    );

    await syncCalendarForBooking(booking.id);

    return res.json({ payment });
  }),
);

const cancelSchema = z.object({
  reason: z.string().min(3).max(500).optional(),
});

bookingRouter.post(
  "/:id/cancel",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = cancelSchema.parse(req.body ?? {});
    const bookingId = String(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
      include: { payment: true, availabilitySlot: true },
    });
    if (!booking) {
      throw new HttpError(404, "booking_not_found");
    }
    if (![booking.mentorId, booking.learnerId].includes(req.user!.id)) {
      throw new HttpError(403, "forbidden");
    }
    if (booking.status === BookingStatus.CANCELED) {
      throw new HttpError(409, "already_canceled");
    }
    if (
      booking.availabilitySlot?.mode === "ONE_TIME" &&
      booking.payment?.status === PaymentStatus.CAPTURED
    ) {
      throw new HttpError(409, "cancel_not_allowed");
    }

    const cutoff = new Date(
      booking.scheduledStartAt.getTime() - 24 * 60 * 60 * 1000,
    );
    if (Date.now() >= cutoff.getTime()) {
      throw new HttpError(409, "cancel_window_passed");
    }

    const updated = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: {
            status: BookingStatus.CANCELED,
            canceledAt: new Date(),
            cancelReason: input.reason,
          },
        });
        await tx.availabilitySlot.update({
          where: { id: booking.availabilitySlotId },
          data: { status: AvailabilityStatus.AVAILABLE },
        });
        if (booking.payment) {
          await tx.payment.update({
            where: { id: booking.payment.id },
            data: { status: PaymentStatus.FAILED },
          });
        }
        return updatedBooking;
      },
    );

    return res.json({ booking: updated });
  }),
);

const meetingLinkSchema = z.object({
  meetingLink: z.string().url(),
});

bookingRouter.patch(
  "/:id/meeting-link",
  requireAuth,
  requireRole(Role.MENTOR),
  asyncHandler(async (req, res) => {
    const input = meetingLinkSchema.parse(req.body);
    const bookingId = String(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new HttpError(404, "booking_not_found");
    }
    if (booking.mentorId !== req.user!.id) {
      throw new HttpError(403, "forbidden");
    }

    const updated = await prisma.booking.update({
      where: { id: booking.id },
      data: {
        meetingLink: input.meetingLink,
        meetingLinkAddedAt: new Date(),
      },
    });

    return res.json({ booking: updated });
  }),
);

const disputeSchema = z.object({
  reason: z.string().min(10).max(2000),
});

bookingRouter.post(
  "/:id/dispute",
  requireAuth,
  asyncHandler(async (req, res) => {
    const input = disputeSchema.parse(req.body);
    const bookingId = String(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new HttpError(404, "booking_not_found");
    }
    if (![booking.mentorId, booking.learnerId].includes(req.user!.id)) {
      throw new HttpError(403, "forbidden");
    }

    const dispute = await prisma.dispute.create({
      data: {
        bookingId: booking.id,
        raisedById: req.user!.id,
        reason: input.reason,
      },
    });

    await prisma.booking.update({
      where: { id: booking.id },
      data: { status: BookingStatus.DISPUTED },
    });

    return res.status(201).json({ dispute });
  }),
);

bookingRouter.post(
  "/:id/complete",
  requireAuth,
  requireRole(Role.MENTOR),
  asyncHandler(async (req, res) => {
    const bookingId = String(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new HttpError(404, "booking_not_found");
    }
    if (booking.mentorId !== req.user!.id) {
      throw new HttpError(403, "forbidden");
    }
    if (booking.status !== BookingStatus.CONFIRMED) {
      throw new HttpError(409, "invalid_status");
    }

    const commission = Math.round(booking.priceInr * booking.commissionRate);
    const payoutAmount = booking.priceInr - commission - booking.platformFeeInr;

    const result = await prisma.$transaction(
      async (tx: Prisma.TransactionClient) => {
        const updatedBooking = await tx.booking.update({
          where: { id: booking.id },
          data: { status: BookingStatus.COMPLETED },
        });
        const payout = await tx.payout.create({
          data: {
            bookingId: booking.id,
            mentorId: booking.mentorId,
            provider: "razorpay",
            amountInr: payoutAmount,
            status: PayoutStatus.SCHEDULED,
            scheduledFor: new Date(),
          },
        });
        return { booking: updatedBooking, payout };
      },
    );

    return res.json(result);
  }),
);

bookingRouter.post(
  "/:id/sync-calendar",
  requireAuth,
  asyncHandler(async (req, res) => {
    const bookingId = String(req.params.id);
    const booking = await prisma.booking.findUnique({
      where: { id: bookingId },
    });
    if (!booking) {
      throw new HttpError(404, "booking_not_found");
    }
    if (![booking.mentorId, booking.learnerId].includes(req.user!.id)) {
      throw new HttpError(403, "forbidden");
    }

    const result = await syncCalendarForBooking(bookingId);
    if (!result.mentorAdded && !result.learnerAdded) {
      throw new HttpError(409, "calendar_not_linked");
    }

    return res.json({ synced: true, ...result });
  }),
);
