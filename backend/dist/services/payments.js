"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.cancelOverdueUnpaidBookings = exports.captureDuePayments = exports.captureAuthorizedPayment = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("../lib/prisma");
const http_1 = require("../lib/http");
const razorpay_1 = require("../lib/razorpay");
const captureAuthorizedPayment = async (paymentId) => {
    const payment = await prisma_1.prisma.payment.findUnique({
        where: { id: paymentId },
        include: { booking: true },
    });
    if (!payment) {
        throw new http_1.HttpError(404, "payment_not_found");
    }
    if (!payment.providerPaymentId) {
        throw new http_1.HttpError(409, "payment_not_authorized");
    }
    if (payment.status === client_1.PaymentStatus.CAPTURED) {
        return payment;
    }
    const razorpay = (0, razorpay_1.razorpayClient)();
    const capture = await razorpay.payments.capture(payment.providerPaymentId, payment.amountInr * 100, payment.currency);
    const result = await prisma_1.prisma.$transaction(async (tx) => {
        const updatedPayment = await tx.payment.update({
            where: { id: payment.id },
            data: {
                status: client_1.PaymentStatus.CAPTURED,
                capturedAt: new Date(),
                raw: capture,
            },
        });
        const updatedBooking = await tx.booking.update({
            where: { id: payment.bookingId },
            data: { status: client_1.BookingStatus.CONFIRMED },
        });
        await tx.availabilitySlot.update({
            where: { id: updatedBooking.availabilitySlotId },
            data: { status: client_1.AvailabilityStatus.BOOKED },
        });
        return updatedPayment;
    });
    return result;
};
exports.captureAuthorizedPayment = captureAuthorizedPayment;
const captureDuePayments = async () => {
    const now = new Date();
    const duePayments = await prisma_1.prisma.payment.findMany({
        where: {
            status: client_1.PaymentStatus.AUTHORIZED,
            scheduledFor: { lte: now },
        },
        select: { id: true },
    });
    for (const due of duePayments) {
        try {
            await (0, exports.captureAuthorizedPayment)(due.id);
        }
        catch {
            // Best-effort; failures will be retried on next run.
        }
    }
};
exports.captureDuePayments = captureDuePayments;
const cancelOverdueUnpaidBookings = async () => {
    const now = new Date();
    const overdue = await prisma_1.prisma.payment.findMany({
        where: {
            status: client_1.PaymentStatus.CREATED,
            scheduledFor: { lte: now },
        },
        select: { id: true, bookingId: true },
    });
    for (const payment of overdue) {
        try {
            await prisma_1.prisma.$transaction(async (tx) => {
                const booking = await tx.booking.update({
                    where: { id: payment.bookingId },
                    data: { status: client_1.BookingStatus.CANCELED, canceledAt: now },
                });
                await tx.payment.update({
                    where: { id: payment.id },
                    data: { status: client_1.PaymentStatus.FAILED },
                });
                await tx.availabilitySlot.update({
                    where: { id: booking.availabilitySlotId },
                    data: { status: client_1.AvailabilityStatus.AVAILABLE },
                });
            });
        }
        catch {
            // Best-effort retry.
        }
    }
};
exports.cancelOverdueUnpaidBookings = cancelOverdueUnpaidBookings;
