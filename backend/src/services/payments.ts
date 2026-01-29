import {
  AvailabilityStatus,
  BookingStatus,
  PaymentStatus,
  Prisma,
} from "@prisma/client";
import { prisma } from "../lib/prisma";
import { HttpError } from "../lib/http";
import { razorpayClient } from "../lib/razorpay";

export const captureAuthorizedPayment = async (paymentId: string) => {
  const payment = await prisma.payment.findUnique({
    where: { id: paymentId },
    include: { booking: true },
  });
  if (!payment) {
    throw new HttpError(404, "payment_not_found");
  }
  if (!payment.providerPaymentId) {
    throw new HttpError(409, "payment_not_authorized");
  }
  if (payment.status === PaymentStatus.CAPTURED) {
    return payment;
  }

  const razorpay = razorpayClient();
  const capture = await razorpay.payments.capture(
    payment.providerPaymentId,
    payment.amountInr * 100,
    payment.currency
  );

  const result = await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
    const updatedPayment = await tx.payment.update({
      where: { id: payment.id },
      data: {
        status: PaymentStatus.CAPTURED,
        capturedAt: new Date(),
        raw: capture as Prisma.JsonObject,
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
  });

  return result;
};

export const captureDuePayments = async () => {
  const now = new Date();
  const duePayments = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.AUTHORIZED,
      scheduledFor: { lte: now },
    },
    select: { id: true },
  });

  for (const due of duePayments) {
    try {
      await captureAuthorizedPayment(due.id);
    } catch {
      // Best-effort; failures will be retried on next run.
    }
  }
};

export const cancelOverdueUnpaidBookings = async () => {
  const now = new Date();
  const overdue = await prisma.payment.findMany({
    where: {
      status: PaymentStatus.CREATED,
      scheduledFor: { lte: now },
    },
    select: { id: true, bookingId: true },
  });

  for (const payment of overdue) {
    try {
      await prisma.$transaction(async (tx: Prisma.TransactionClient) => {
        const booking = await tx.booking.update({
          where: { id: payment.bookingId },
          data: { status: BookingStatus.CANCELED, canceledAt: now },
        });
        await tx.payment.update({
          where: { id: payment.id },
          data: { status: PaymentStatus.FAILED },
        });
        await tx.availabilitySlot.update({
          where: { id: booking.availabilitySlotId },
          data: { status: AvailabilityStatus.AVAILABLE },
        });
      });
    } catch {
      // Best-effort retry.
    }
  }
};
