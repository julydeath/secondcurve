"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
exports.syncCalendarForBooking = void 0;
const client_1 = require("@prisma/client");
const prisma_1 = require("./prisma");
const http_1 = require("./http");
const createCalendarEvent = async (params) => {
    await fetch("https://www.googleapis.com/calendar/v3/calendars/primary/events", {
        method: "POST",
        headers: {
            Authorization: `Bearer ${params.accessToken}`,
            "Content-Type": "application/json",
        },
        body: JSON.stringify({
            summary: params.summary,
            description: params.description,
            start: { dateTime: params.start, timeZone: params.timezone },
            end: { dateTime: params.end, timeZone: params.timezone },
        }),
    });
};
const refreshGoogleToken = async (refreshToken) => {
    const clientId = process.env.GOOGLE_CLIENT_ID;
    const clientSecret = process.env.GOOGLE_CLIENT_SECRET;
    if (!clientId || !clientSecret) {
        throw new http_1.HttpError(500, "google_oauth_not_configured");
    }
    const response = await fetch("https://oauth2.googleapis.com/token", {
        method: "POST",
        headers: { "Content-Type": "application/x-www-form-urlencoded" },
        body: new URLSearchParams({
            client_id: clientId,
            client_secret: clientSecret,
            grant_type: "refresh_token",
            refresh_token: refreshToken,
        }),
    });
    if (!response.ok) {
        throw new http_1.HttpError(502, "google_token_refresh_failed");
    }
    return (await response.json());
};
const getGoogleAccessTokenForUser = async (userId) => {
    const account = await prisma_1.prisma.oAuthAccount.findFirst({
        where: {
            userId,
            provider: client_1.OAuthProvider.GOOGLE,
        },
    });
    if (!account || !account.accessToken) {
        return null;
    }
    const needsRefresh = account.expiresAt &&
        account.refreshToken &&
        account.expiresAt.getTime() < Date.now() + 60_000;
    if (!needsRefresh) {
        return account.accessToken;
    }
    const refreshed = await refreshGoogleToken(account.refreshToken);
    await prisma_1.prisma.oAuthAccount.update({
        where: { id: account.id },
        data: {
            accessToken: refreshed.access_token,
            scopes: refreshed.scope ?? account.scopes,
            expiresAt: refreshed.expires_in
                ? new Date(Date.now() + refreshed.expires_in * 1000)
                : account.expiresAt,
        },
    });
    return refreshed.access_token;
};
const syncCalendarForBooking = async (bookingId) => {
    const booking = await prisma_1.prisma.booking.findUnique({
        where: { id: bookingId },
        include: {
            mentor: { select: { id: true, name: true, email: true } },
            learner: { select: { id: true, name: true, email: true } },
        },
    });
    if (!booking) {
        return;
    }
    const [mentorToken, learnerToken] = await Promise.all([
        getGoogleAccessTokenForUser(booking.mentorId),
        getGoogleAccessTokenForUser(booking.learnerId),
    ]);
    const timezone = "Asia/Kolkata";
    const summary = `WisdomBridge • ${booking.mentor.name} ↔ ${booking.learner.name}`;
    const description = `Session booked on WisdomBridge. Meeting link: ${booking.meetingLink ?? "Pending"}`;
    const start = booking.scheduledStartAt.toISOString();
    const end = booking.scheduledEndAt.toISOString();
    const tasks = [];
    if (mentorToken) {
        tasks.push(createCalendarEvent({
            accessToken: mentorToken,
            summary,
            description,
            start,
            end,
            timezone,
        }));
    }
    if (learnerToken) {
        tasks.push(createCalendarEvent({
            accessToken: learnerToken,
            summary,
            description,
            start,
            end,
            timezone,
        }));
    }
    await Promise.allSettled(tasks);
};
exports.syncCalendarForBooking = syncCalendarForBooking;
