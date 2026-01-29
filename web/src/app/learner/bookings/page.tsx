"use client";

import { useEffect, useState } from "react";
import InkButton from "@/components/InkButton";
import { useToast } from "@/components/ToastProvider";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Booking = {
  id: string;
  status: string;
  scheduledStartAt: string;
  scheduledEndAt: string;
  priceInr: number;
  meetingLink?: string | null;
  mentor: { id: string; name: string };
  payment?: { status: string } | null;
  availabilitySlot?: {
    rule?: { title?: string | null } | null;
  } | null;
};

type Subscription = {
  id: string;
  status: string;
  priceInr: number;
  startAt?: string | null;
  nextChargeAt?: string | null;
  pauseUntil?: string | null;
  availabilityRule?: { title: string } | null;
};

export default function LearnerBookings() {
  const { pushToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [links, setLinks] = useState({ googleLinked: false });
  const [error, setError] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pauseWeeks, setPauseWeeks] = useState<Record<string, number>>({});
  const [openRule, setOpenRule] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [bookingRes, subRes, linksRes] = await Promise.all([
      fetch(`${apiUrl}/bookings/me`, { credentials: "include" }),
      fetch(`${apiUrl}/subscriptions/me`, { credentials: "include" }),
      fetch(`${apiUrl}/auth/links`, { credentials: "include" }),
    ]);

    if (bookingRes.ok) {
      const data = (await bookingRes.json()) as { bookings: Booking[] };
      setBookings(data.bookings);
    }
    if (subRes.ok) {
      const data = (await subRes.json()) as { subscriptions: Subscription[] };
      setSubscriptions(data.subscriptions);
    }
    if (linksRes.ok) {
      const data = (await linksRes.json()) as { googleLinked: boolean };
      setLinks({ googleLinked: data.googleLinked });
    }
    setLoading(false);
  };

  const statusTone = (booking: Booking) => {
    if (booking.status === "CANCELED") return "bg-red-100 text-red-900 border-red-900";
    if (booking.payment?.status === "CAPTURED")
      return "bg-green-100 text-green-900 border-green-900";
    return "bg-yellow-100 text-yellow-900 border-yellow-900";
  };

  const statusLabel = (booking: Booking) => {
    if (booking.status === "CANCELED") return "Cancelled";
    if (booking.payment?.status === "CAPTURED") return "Paid";
    return "Reserved";
  };

  const groupBookings = (items: Booking[]) => {
    const map = new Map<string, Booking[]>();
    items.forEach((booking) => {
      const ruleTitle =
        booking.availabilitySlot?.rule?.title ?? "One-time Sessions";
      if (!map.has(ruleTitle)) map.set(ruleTitle, []);
      map.get(ruleTitle)!.push(booking);
    });
    const groups = Array.from(map.entries()).map(([rule, list]) => {
      const sorted = [...list].sort(
        (a, b) =>
          new Date(b.scheduledStartAt).getTime() -
          new Date(a.scheduledStartAt).getTime(),
      );
      return { rule, bookings: sorted, next: sorted[0] };
    });
    return groups.sort(
      (a, b) =>
        new Date(b.next.scheduledStartAt).getTime() -
        new Date(a.next.scheduledStartAt).getTime(),
    );
  };

  useEffect(() => {
    load().catch(() => {
      setError("Failed to load bookings.");
      setLoading(false);
      pushToast("Failed to load bookings", "error");
    });
  }, []);

  const pauseSubscription = async (id: string) => {
    setActionLoading(id);
    const weeks = pauseWeeks[id] ?? 1;
    const response = await fetch(`${apiUrl}/subscriptions/${id}/pause`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ weeks }),
    });
    if (!response.ok) {
      setError("Unable to pause subscription.");
      pushToast("Unable to pause subscription", "error");
    } else {
      await load();
      pushToast("Subscription paused", "success");
    }
    setActionLoading(null);
  };

  const resumeSubscription = async (id: string) => {
    setActionLoading(id);
    const response = await fetch(`${apiUrl}/subscriptions/${id}/resume`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      setError("Unable to resume subscription.");
      pushToast("Unable to resume subscription", "error");
    } else {
      await load();
      pushToast("Subscription resumed", "success");
    }
    setActionLoading(null);
  };

  const cancelSubscription = async (id: string) => {
    setActionLoading(id);
    const response = await fetch(`${apiUrl}/subscriptions/${id}/cancel`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      setError("Unable to cancel subscription.");
      pushToast("Unable to cancel subscription", "error");
    } else {
      await load();
      pushToast("Subscription canceled", "info");
    }
    setActionLoading(null);
  };

  const cancelBooking = async (booking: Booking) => {
    setActionLoading(booking.id);
    const response = await fetch(`${apiUrl}/bookings/${booking.id}/cancel`, {
      method: "POST",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ reason: "learner_cancel" }),
    });
    if (!response.ok) {
      pushToast("Unable to cancel booking", "error");
    } else {
      await load();
      pushToast("Booking canceled", "info");
    }
    setActionLoading(null);
  };

  const addToCalendar = async (bookingId: string) => {
    const response = await fetch(`${apiUrl}/bookings/${bookingId}/sync-calendar`, {
      method: "POST",
      credentials: "include",
    });
    if (!response.ok) {
      pushToast("Calendar sync failed", "error");
      return;
    }
    pushToast("Added to Google Calendar", "success");
  };

  return (
    <div className="space-y-6">
      <h2 className="newsprint-title text-xl">Your Bookings</h2>
      <div className="ink-border p-6">
        <h3 className="newsprint-title text-sm">Google Calendar</h3>
        <p className="mt-2 text-sm text-[var(--ink-700)]">
          Connect Google Calendar to add booked sessions automatically.
        </p>
        <InkButton
          className="mt-4"
          onClick={() => {
            window.location.href = `${apiUrl}/auth/google/start?calendar=1&link=1`;
          }}
        >
          {links.googleLinked ? "Calendar Connected" : "Connect Calendar"}
        </InkButton>
      </div>
      {error && (
        <div className="ink-border p-4 text-sm text-[var(--ink-700)]">
          {error}
        </div>
      )}

      <div className="grid gap-4">
        {loading && (
          <div className="grid gap-4">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`booking-skel-${index}`} className="ink-border p-6 space-y-3">
                <div className="skeleton skeleton-line w-1/2" />
                <div className="skeleton skeleton-line w-2/3" />
                <div className="skeleton skeleton-line w-24" />
              </div>
            ))}
          </div>
        )}
        {!loading && bookings.length === 0 && (
          <div className="ink-border p-6 text-sm text-[var(--ink-700)]">
            No bookings yet.
          </div>
        )}
        {!loading &&
          groupBookings(bookings).map((group) => (
            <div key={group.rule} className="ink-border">
              <button
                className="flex w-full items-center justify-between px-4 py-3"
                onClick={() =>
                  setOpenRule(openRule === group.rule ? null : group.rule)
                }
              >
                <div>
                  <p className="text-xs uppercase tracking-widest">
                    {group.rule}
                  </p>
                  <p className="mt-1 text-xs text-[var(--ink-700)]">
                    Latest:{" "}
                    {new Date(group.next.scheduledStartAt).toLocaleString()}
                  </p>
                </div>
                <span className="text-xs uppercase tracking-widest">
                  {openRule === group.rule ? "Hide" : "View"}
                </span>
              </button>
              {openRule === group.rule && (
                <div className="border-t-2 border-black divide-y-2 divide-black">
                  {group.bookings.map((booking) => (
                    <div key={booking.id} className="p-6">
                      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
                        <div>
                          <p className="text-base font-semibold">
                            {booking.mentor.name}
                          </p>
                          <p className="text-sm text-[var(--ink-700)]">
                            {new Date(booking.scheduledStartAt).toLocaleString()}
                          </p>
                          <p className="text-xs text-[var(--ink-700)]">
                            ₹{booking.priceInr} • Payment:{" "}
                            {booking.payment?.status ?? "N/A"}
                          </p>
                          {booking.meetingLink && (
                            <p className="text-xs text-[var(--ink-700)]">
                              Meeting link: {booking.meetingLink}
                            </p>
                          )}
                        </div>
                        <div className="flex flex-wrap items-center gap-3">
                          <span className={`chip ${statusTone(booking)}`}>
                            {statusLabel(booking)}
                          </span>
                          <InkButton
                            disabled={
                              booking.payment?.status !== "CAPTURED" ||
                              !booking.meetingLink
                            }
                            onClick={() => {
                              if (!booking.meetingLink) return;
                              window.open(
                                booking.meetingLink,
                                "_blank",
                                "noopener,noreferrer",
                              );
                            }}
                          >
                            Join
                          </InkButton>
                          <InkButton
                            onClick={() => addToCalendar(booking.id)}
                            disabled={booking.payment?.status !== "CAPTURED"}
                          >
                            Add to Calendar
                          </InkButton>
                          <InkButton
                            loading={actionLoading === booking.id}
                            disabled={
                              booking.status === "CANCELED" ||
                              new Date(booking.scheduledStartAt).getTime() -
                                Date.now() <
                                24 * 60 * 60 * 1000
                            }
                            title={
                              booking.status === "CANCELED"
                                ? "Already canceled"
                                : new Date(booking.scheduledStartAt).getTime() -
                                    Date.now() <
                                  24 * 60 * 60 * 1000
                                ? "Cannot cancel within 24 hours"
                                : "Cancel this booking"
                            }
                            onClick={() => cancelBooking(booking)}
                          >
                            Cancel
                          </InkButton>
                          <InkButton
                            disabled={booking.payment?.status !== "CAPTURED"}
                            onClick={async () => {
                              const response = await fetch(
                                `${apiUrl}/bookings/${booking.id}/receipt`,
                                { credentials: "include" },
                              );
                              if (!response.ok) {
                                pushToast("Receipt not ready", "error");
                                return;
                              }
                              const blob = await response.blob();
                              const url = window.URL.createObjectURL(blob);
                              const link = document.createElement("a");
                              link.href = url;
                              link.download = `wisdombridge-receipt-${booking.id}.txt`;
                              document.body.appendChild(link);
                              link.click();
                              link.remove();
                              window.URL.revokeObjectURL(url);
                              pushToast("Receipt downloaded", "success");
                            }}
                          >
                            Receipt
                          </InkButton>
                          <InkButton
                            onClick={() => {
                              window.location.href = `/mentors/${booking.mentor.id}`;
                            }}
                          >
                            View Mentor
                          </InkButton>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ))}
      </div>

      <div className="space-y-4">
        <h3 className="newsprint-title text-sm">Subscriptions</h3>
        {subscriptions.length === 0 && (
          <div className="ink-border p-6 text-sm text-[var(--ink-700)]">
            No active subscriptions yet.
          </div>
        )}
        {subscriptions.map((sub) => (
          <div key={sub.id} className="ink-border p-6">
            <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-semibold">
                  {sub.availabilityRule?.title ?? "Weekly Subscription"}
                </p>
                <p className="text-xs text-[var(--ink-700)]">
                  ₹{sub.priceInr} / week • Status: {sub.status}
                </p>
                {sub.nextChargeAt && (
                  <p className="text-xs text-[var(--ink-700)]">
                    Next charge: {new Date(sub.nextChargeAt).toLocaleString()}
                  </p>
                )}
                {sub.pauseUntil && (
                  <p className="text-xs text-[var(--ink-700)]">
                    Paused until: {new Date(sub.pauseUntil).toLocaleDateString()}
                  </p>
                )}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
                  Pause weeks
                  <select
                    className="ink-border px-2 py-1 text-xs"
                    value={pauseWeeks[sub.id] ?? 1}
                    onChange={(event) =>
                      setPauseWeeks((prev) => ({
                        ...prev,
                        [sub.id]: Number(event.target.value),
                      }))
                    }
                  >
                    {[1, 2, 3, 4].map((week) => (
                      <option key={week} value={week}>
                        {week}
                      </option>
                    ))}
                  </select>
                </label>
                <InkButton
                  loading={actionLoading === sub.id}
                  onClick={() => pauseSubscription(sub.id)}
                >
                  Pause
                </InkButton>
                <InkButton
                  loading={actionLoading === sub.id}
                  onClick={() => resumeSubscription(sub.id)}
                >
                  Resume
                </InkButton>
                <InkButton
                  loading={actionLoading === sub.id}
                  onClick={() => cancelSubscription(sub.id)}
                >
                  Cancel
                </InkButton>
              </div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
