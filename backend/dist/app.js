"use strict";
var __importDefault = (this && this.__importDefault) || function (mod) {
    return (mod && mod.__esModule) ? mod : { "default": mod };
};
Object.defineProperty(exports, "__esModule", { value: true });
exports.createApp = void 0;
const cors_1 = __importDefault(require("cors"));
const express_1 = __importDefault(require("express"));
const helmet_1 = __importDefault(require("helmet"));
const morgan_1 = __importDefault(require("morgan"));
const cookie_parser_1 = __importDefault(require("cookie-parser"));
const health_1 = require("./routes/health");
const auth_1 = require("./routes/auth");
const mentors_1 = require("./routes/mentors");
const learners_1 = require("./routes/learners");
const bookings_1 = require("./routes/bookings");
const admin_1 = require("./routes/admin");
const reviews_1 = require("./routes/reviews");
const webhooks_1 = require("./routes/webhooks");
const subscriptions_1 = require("./routes/subscriptions");
const error_1 = require("./middleware/error");
const notFound_1 = require("./middleware/notFound");
const createApp = () => {
    const app = (0, express_1.default)();
    const corsOrigins = process.env.CORS_ORIGIN
        ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
        : undefined;
    app.use((0, helmet_1.default)());
    app.set("trust proxy", 1);
    app.use((0, cors_1.default)({ origin: corsOrigins ?? true, credentials: true }));
    app.use((0, cookie_parser_1.default)());
    app.use("/webhooks/razorpay", express_1.default.raw({ type: "application/json" }));
    app.use("/webhooks", webhooks_1.webhookRouter);
    app.use(express_1.default.json({ limit: "1mb" }));
    app.use((0, morgan_1.default)("tiny"));
    app.use("/health", health_1.healthRouter);
    app.use("/auth", auth_1.authRouter);
    app.use("/mentors", mentors_1.mentorRouter);
    app.use("/learners", learners_1.learnerRouter);
    app.use("/bookings", bookings_1.bookingRouter);
    app.use("/subscriptions", subscriptions_1.subscriptionRouter);
    app.use("/reviews", reviews_1.reviewRouter);
    app.use("/admin", admin_1.adminRouter);
    app.use(notFound_1.notFoundHandler);
    app.use(error_1.errorHandler);
    return app;
};
exports.createApp = createApp;
