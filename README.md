# WisdomBridge

Mobile-first mentoring marketplace connecting experienced mentors with learners in 1:1 live sessions. India-first payments and compliance with Razorpay, Google Calendar sync, and LinkedIn-based mentor verification.

This repo contains:
- `backend/` Express + Prisma API
- `web/` Next.js + Tailwind UI

## Highlights
- Two roles: Mentor, Learner (mutually exclusive accounts)
- One-time sessions and weekly subscriptions (recurring)
- No built-in video calls; mentors provide meeting links
- Razorpay payments (order + subscription flows)
- Automatic Google Calendar events after purchase
- Mentor availability rules + rolling slot generation
- Admin actions for mentor approval, disputes, payouts

---

## Repo Structure

```
backend/   Express API, Prisma schema, auth, payments, webhooks
web/       Next.js app (newsprint UI), mentor/learner/admin dashboards
```

---

## Quick Start

### Backend

1) Go to backend:
```
cd backend
```

2) Create env:
```
cp .env.example .env
```

3) Install deps:
```
npm install
```

4) Prisma generate + migrate:
```
npm run prisma:generate
npm run prisma:migrate
```

5) Run API:
```
npm run dev
```

API default: `http://localhost:4000`

### Web

1) Go to web:
```
cd ../web
```

2) Create env:
```
cp .env.example .env
```

3) Install deps:
```
npm install
```

4) Run:
```
npm run dev
```

Web default: `http://localhost:3000`

---

## Environment Variables

### Backend (`backend/.env`)

Required:
- `DATABASE_URL`
- `JWT_SECRET`
- `OAUTH_STATE_SECRET`
- `GOOGLE_CLIENT_ID`
- `GOOGLE_CLIENT_SECRET`
- `GOOGLE_REDIRECT_URI`
- `LINKEDIN_CLIENT_ID`
- `LINKEDIN_CLIENT_SECRET`
- `LINKEDIN_REDIRECT_URI`
- `RAZORPAY_KEY_ID`
- `RAZORPAY_KEY_SECRET`
- `RAZORPAY_WEBHOOK_SECRET`

Optional:
- `CORS_ORIGIN` (comma separated)
- `APP_BASE_URL`
- `LINKEDIN_SCOPES`

### Web (`web/.env`)

Required:
- `NEXT_PUBLIC_API_URL` (e.g. `http://localhost:4000`)

---

## Core Business Rules

### Roles
- Mentor and Learner are separate accounts
- Mentor must link LinkedIn before creating availability
- Mentor and Learner access are role-protected

### Sessions
- One-time: single booking for a slot
- Recurring: weekly subscription
- Mentors provide meeting links per booking
- No built-in video calling

### Payment
- Razorpay order created at booking
- Payment is authorized immediately, captured 24 hours before session
- If payment not completed before capture time, booking auto-cancels

### Cancellation
- Learner can cancel up to 24 hours before session
- Mentor cannot cancel subscriptions, can pause up to 4 weeks
- No refunds (as per business rule)

### Calendar
- Google Calendar event auto-added on successful purchase
- Learners can manually re-sync per booking

---

## Auto Rolling Slots

For **ONE_TIME** active rules, a background scheduler always ensures the next **8 weeks** of slots exist. This means mentors do not need to manually regenerate after each month.

---

## Backend Overview

### Tech
- Node + Express
- Prisma + Postgres
- Razorpay SDK
- JWT auth

### Key Services
- `services/payments.ts`: capture and cancel logic
- `services/subscriptions.ts`: recurring slot creation
- `services/availability.ts`: auto-rolling slots (8 weeks)
- `routes/webhooks.ts`: Razorpay webhook handling

### Important Endpoints (high level)

Auth:
- `GET /auth/me`
- `GET /auth/links`
- `POST /auth/logout`
- `GET /auth/google/start`
- `GET /auth/linkedin/start`

Mentors:
- `GET /mentors`
- `GET /mentors/:id`
- `GET /mentors/:id/availability/rules`
- `GET /mentors/:id/availability/slots`
- `GET /mentors/me`
- `PATCH /mentors/me`
- `GET /mentors/me/availability/rules`
- `POST /mentors/me/availability/rules`
- `PATCH /mentors/me/availability/rules/:id`
- `DELETE /mentors/me/availability/rules/:id`
- `POST /mentors/me/availability/rules/:id/generate`
- `GET /mentors/me/availability/slots`
- `PATCH /mentors/me/availability/slots/:id`
- `GET /mentors/me/payouts`

Learners:
- `GET /learners/me`
- `PATCH /learners/me`

Bookings:
- `POST /bookings`
- `POST /bookings/:id/confirm-payment`
- `POST /bookings/:id/cancel`
- `PATCH /bookings/:id/meeting-link`
- `POST /bookings/:id/sync-calendar`
- `GET /bookings/me`
- `GET /bookings/:id/receipt`

Subscriptions:
- `POST /subscriptions`
- `GET /subscriptions/me`
- `POST /subscriptions/:id/pause`
- `POST /subscriptions/:id/resume`
- `POST /subscriptions/:id/cancel`

Admin:
- `GET /admin/mentors`
- `POST /admin/mentors/:id/approve`
- `GET /admin/disputes`
- `POST /admin/disputes/:id/resolve`
- `POST /admin/payouts/:id/mark-paid`

Webhooks:
- `POST /webhooks/razorpay`

---

## Frontend Overview

### Tech
- Next.js (App Router)
- Tailwind CSS
- Newsprint UI theme with toasts + skeletons

### Key Pages
- Public: `/`, `/mentors`, `/mentors/[id]`, `/join-mentor`, `/about`, `/contact`
- Auth: `/auth/sign-in`, `/auth/sign-up`
- Mentor: `/mentor`, `/mentor/availability`, `/mentor/sessions`, `/mentor/earnings`, `/mentor/profile`
- Learner: `/learner`, `/learner/bookings`, `/learner/profile`, `/learner/search`
- Admin: `/admin`

### UI Rules
- Mobile-first
- Dropdown groupings by rule
- Color chips:
  - Green = Paid
  - Yellow = Reserved (payment pending)
  - Red = Cancelled

---

## Payment Flow Summary

### One-time
1) Learner selects slot
2) Booking created + slot reserved
3) Razorpay checkout (order)
4) Payment authorized → auto calendar event
5) Capture 24 hours before session

### Recurring
1) Learner starts subscription
2) First booking created + calendar event added
3) Each charge creates next booking
4) Mentor can pause for 1–4 weeks

---

## Testing Tips

1) Create mentor and link LinkedIn
2) Create availability rule
3) Ensure slots appear (auto rolling)
4) Book from learner account
5) Confirm Razorpay payment
6) Check calendar event

---

## Notes

- No refunds (by business rule)
- Sessions start only if payment is captured
- Meeting links required before session
- Subscriptions are ongoing until learner cancels

---

## Next Suggested Enhancements

- PDF invoices
- Admin payout dashboard UI
- WhatsApp reminders
- KYC upload flow
- Auto email reminders
