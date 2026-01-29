import crypto from "crypto";
import Razorpay from "razorpay";
import { HttpError } from "./http";

const getRazorpayClient = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  const keySecret = process.env.RAZORPAY_KEY_SECRET;
  if (!keyId || !keySecret) {
    throw new HttpError(500, "razorpay_not_configured");
  }
  return new Razorpay({ key_id: keyId, key_secret: keySecret });
};

export const getRazorpayKeyId = () => {
  const keyId = process.env.RAZORPAY_KEY_ID;
  if (!keyId) {
    throw new HttpError(500, "razorpay_not_configured");
  }
  return keyId;
};

export const verifyCheckoutSignature = (
  orderId: string,
  paymentId: string,
  signature: string,
) => {
  const secret = process.env.RAZORPAY_KEY_SECRET;
  if (!secret) {
    throw new HttpError(500, "razorpay_not_configured");
  }
  const payload = `${orderId}|${paymentId}`;
  const digest = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return digest === signature;
};

export const verifyWebhookSignature = (payload: Buffer, signature: string) => {
  const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
  if (!secret) {
    throw new HttpError(500, "razorpay_not_configured");
  }
  const digest = crypto
    .createHmac("sha256", secret)
    .update(payload)
    .digest("hex");
  return digest === signature;
};

export const razorpayClient = () => getRazorpayClient();
