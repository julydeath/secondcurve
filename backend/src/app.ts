import cors from "cors";
import express from "express";
import helmet from "helmet";
import morgan from "morgan";
import cookieParser from "cookie-parser";
import { healthRouter } from "./routes/health";
import { authRouter } from "./routes/auth";
import { mentorRouter } from "./routes/mentors";
import { learnerRouter } from "./routes/learners";
import { bookingRouter } from "./routes/bookings";
import { adminRouter } from "./routes/admin";
import { reviewRouter } from "./routes/reviews";
import { webhookRouter } from "./routes/webhooks";
import { subscriptionRouter } from "./routes/subscriptions";
import { errorHandler } from "./middleware/error";
import { notFoundHandler } from "./middleware/notFound";

export const createApp = () => {
  const app = express();
  const corsOrigins = process.env.CORS_ORIGIN
    ? process.env.CORS_ORIGIN.split(",").map((origin) => origin.trim())
    : undefined;

  app.use(helmet());
  app.use(cors({ origin: corsOrigins ?? true, credentials: true }));
  app.use(cookieParser());

  app.use("/webhooks/razorpay", express.raw({ type: "application/json" }));
  app.use("/webhooks", webhookRouter);

  app.use(express.json({ limit: "1mb" }));
  app.use(morgan("tiny"));

  app.use("/health", healthRouter);
  app.use("/auth", authRouter);
  app.use("/mentors", mentorRouter);
  app.use("/learners", learnerRouter);
  app.use("/bookings", bookingRouter);
  app.use("/subscriptions", subscriptionRouter);
  app.use("/reviews", reviewRouter);
  app.use("/admin", adminRouter);

  app.use(notFoundHandler);
  app.use(errorHandler);

  return app;
};
