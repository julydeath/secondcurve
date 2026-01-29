"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.razorpayClient = exports.verifyWebhookSignature = exports.verifyCheckoutSignature = exports.getRazorpayKeyId = void 0;
const crypto_1 = __importDefault(require("crypto"));
const razorpay_1 = __importDefault(require("razorpay"));
const http_1 = require("./http");
const getRazorpayClient = () => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    const keySecret = process.env.RAZORPAY_KEY_SECRET;
    if (!keyId || !keySecret) {
        throw new http_1.HttpError(500, "razorpay_not_configured");
    }
    return new razorpay_1.default({ key_id: keyId, key_secret: keySecret });
};
const getRazorpayKeyId = () => {
    const keyId = process.env.RAZORPAY_KEY_ID;
    if (!keyId) {
        throw new http_1.HttpError(500, "razorpay_not_configured");
    }
    return keyId;
};
exports.getRazorpayKeyId = getRazorpayKeyId;
const verifyCheckoutSignature = (orderId, paymentId, signature) => {
    const secret = process.env.RAZORPAY_KEY_SECRET;
    if (!secret) {
        throw new http_1.HttpError(500, "razorpay_not_configured");
    }
    const payload = `${orderId}|${paymentId}`;
    const digest = crypto_1.default
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");
    return digest === signature;
};
exports.verifyCheckoutSignature = verifyCheckoutSignature;
const verifyWebhookSignature = (payload, signature) => {
    const secret = process.env.RAZORPAY_WEBHOOK_SECRET;
    if (!secret) {
        throw new http_1.HttpError(500, "razorpay_not_configured");
    }
    const digest = crypto_1.default
        .createHmac("sha256", secret)
        .update(payload)
        .digest("hex");
    return digest === signature;
};
exports.verifyWebhookSignature = verifyWebhookSignature;
const razorpayClient = () => getRazorpayClient();
exports.razorpayClient = razorpayClient;
