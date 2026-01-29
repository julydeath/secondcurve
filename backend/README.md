# WisdomBridge Backend

## Setup

1. `cp .env.example .env` and update `DATABASE_URL`.
2. Add Razorpay credentials (`RAZORPAY_KEY_ID`, `RAZORPAY_KEY_SECRET`, `RAZORPAY_WEBHOOK_SECRET`).
2. `npm install`
3. `npm run prisma:generate`
4. `npm run prisma:migrate`
5. `npm run dev`

## Health Check

`GET /health`

## Dev Auth

- Sign up via `POST /auth/google`
- Use `Authorization: Bearer <userId>` or `X-User-Id: <userId>` for protected routes
