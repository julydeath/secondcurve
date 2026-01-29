import { Router } from "express";
import {
  AvailabilityStatus,
  BookingStatus,
  PaymentStatus,
  Prisma,
  SubscriptionStatus,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError, asyncHandler } from "../lib/http";
import { verifyWebhookSignature } from "../lib/razorpay";
import { captureAuthorizedPayment } from "../services/payments";
import { syncCalendarForBooking } from "../lib/calendar";
import { findOrCreateNextSlot } from "../services/subscriptions";

export const webhookRouter = Router();

webhookRouter.post(
  "/razorpay",
  asyncHandler(async (req, res) => {
    const signature = req.header("x-razorpay-signature");
    if (!signature) {
      throw new HttpError(400, "signature_missing");
    }

    const payload = req.body as Buffer;
    const isValid = verifyWebhookSignature(payload, signature);
    if (!isValid) {
      throw new HttpError(400, "invalid_signature");
    }

    const event = JSON.parse(payload.toString("utf8")) as {
      event: string;
      payload?: Record<string, { entity?: Record<string, any> }>;
    };

    if (event.event.startsWith("payment.")) {
      const entity = event.payload?.payment?.entity;
      if (entity) {
        const payment = await prisma.payment.findFirst({
          where: {
            OR: [
              { providerPaymentId: entity.id },
              { providerOrderId: entity.order_id },
            ],
          },
        });

        if (payment) {
          const bookingStart = payment.bookingId
            ? (
                await prisma.booking.findUnique({
                  where: { id: payment.bookingId },
                  select: { scheduledStartAt: true },
                })
              )?.scheduledStartAt
            : null;
          const scheduledFor =
            payment.scheduledFor ??
            (bookingStart
              ? new Date(bookingStart.getTime() - 24 * 60 * 60 * 1000)
              : null);

          if (event.event === "payment.authorized") {
            await prisma.payment.update({
              where: { id: payment.id },
              data: {
                status: PaymentStatus.AUTHORIZED,
                providerPaymentId: entity.id,
                method: entity.method,
                raw: entity as Prisma.JsonObject,
                scheduledFor: scheduledFor ?? payment.scheduledFor,
              },
            });

            const shouldCapture =
              scheduledFor && scheduledFor.getTime() <= Date.now();
            if (shouldCapture) {
              await captureAuthorizedPayment(payment.id);
            }
          }

          if (event.event === "payment.captured") {
            const updated = await prisma.$transaction(
              async (tx: Prisma.TransactionClient) => {
                const updatedPayment = await tx.payment.update({
                  where: { id: payment.id },
                  data: {
                    status: PaymentStatus.CAPTURED,
                    providerPaymentId: entity.id,
                    method: entity.method,
                    capturedAt: new Date(),
                    raw: entity as Prisma.JsonObject,
                  },
                });
                const updatedBooking = await tx.booking.update({
                  where: { id: payment.bookingId },
                  data: { status: BookingStatus.CONFIRMED },
                });
                await tx.availabilitySlot.update({
                  where: { id: updatedBooking.availabilitySlotId },
                  data: { status: AvailabilityStatus.BOOKED },
                });
                return updatedPayment;
              },
            );
            void updated;
          }

          if (event.event === "payment.failed") {
            await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
              await tx.payment.update({
                where: { id: payment.id },
                data: {
                  status: PaymentStatus.FAILED,
                  providerPaymentId: entity.id,
                  method: entity.method,
                  raw: entity as Prisma.JsonObject,
                },
              });
              const booking = await tx.booking.update({
                where: { id: payment.bookingId },
                data: { status: BookingStatus.CANCELED },
              });
              await tx.availabilitySlot.update({
                where: { id: booking.availabilitySlotId },
                data: { status: AvailabilityStatus.AVAILABLE },
              });
            });
          }
        }
      }
    }

    if (event.event.startsWith("subscription.")) {
      const entity = event.payload?.subscription?.entity;
      if (entity?.id) {
        const subscription = await prisma.subscription.findFirst({
          where: { providerSubscriptionId: entity.id },
          include: { booking: true, availabilityRule: true },
        });
        if (subscription) {
          const statusMap: Record<string, SubscriptionStatus> = {
            "subscription.activated": SubscriptionStatus.ACTIVE,
            "subscription.paused": SubscriptionStatus.PAUSED,
            "subscription.resumed": SubscriptionStatus.ACTIVE,
            "subscription.cancelled": SubscriptionStatus.CANCELED,
            "subscription.completed": SubscriptionStatus.CANCELED,
          };
          const nextStatus = statusMap[event.event];
          if (nextStatus) {
            await prisma.subscription.update({
              where: { id: subscription.id },
              data: {
                status: nextStatus,
                startAt: entity.start_at
                  ? new Date(entity.start_at * 1000)
                  : subscription.startAt,
                endAt: entity.end_at
                  ? new Date(entity.end_at * 1000)
                  : subscription.endAt,
                nextChargeAt: entity.charge_at
                  ? new Date(entity.charge_at * 1000)
                  : subscription.nextChargeAt,
              },
            });
          }

          if (event.event === "subscription.charged" && subscription.booking) {
            const booking = subscription.booking;
            const chargedPayment = event.payload?.payment?.entity;
            if (chargedPayment?.id) {
              const existingPayment = await prisma.payment.findFirst({
                where: { providerPaymentId: chargedPayment.id },
              });
              if (!existingPayment) {
                await prisma.payment.create({
                  data: {
                    bookingId: subscription.booking.id,
                    provider: "razorpay",
                    providerPaymentId: chargedPayment.id,
                    amountInr: Math.round((chargedPayment.amount ?? 0) / 100),
                    currency: chargedPayment.currency ?? "INR",
                    status: PaymentStatus.CAPTURED,
                    capturedAt: new Date(),
                    raw: chargedPayment as Prisma.JsonObject,
                  },
                });
              }
            }
            await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
              await tx.booking.update({
                where: { id: booking.id },
                data: { status: BookingStatus.CONFIRMED },
              });
              await tx.availabilitySlot.update({
                where: { id: booking.availabilitySlotId },
                data: { status: AvailabilityStatus.BOOKED },
              });
            });

            if (subscription.availabilityRule) {
              const nextSlot = await findOrCreateNextSlot(
                subscription.availabilityRule,
                booking.scheduledStartAt,
              );
              const nextBooking = await prisma.booking.create({
                data: {
                  mentorId: subscription.mentorId,
                  learnerId: subscription.learnerId,
                  availabilitySlotId: nextSlot.id,
                  scheduledStartAt: nextSlot.startAt,
                  scheduledEndAt: nextSlot.endAt,
                  status: BookingStatus.PENDING,
                  priceInr: nextSlot.priceInr,
                  platformFeeInr: 0,
                  commissionRate: 0.15,
                },
              });
              await prisma.availabilitySlot.update({
                where: { id: nextSlot.id },
                data: { status: AvailabilityStatus.RESERVED },
              });
              await prisma.subscription.update({
                where: { id: subscription.id },
                data: { bookingId: nextBooking.id },
              });
              await syncCalendarForBooking(nextBooking.id);
            }
          }
        }
      }
    }

    return res.json({ received: true });
  }),
);
