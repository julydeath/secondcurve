"use client";

import { useEffect, useState } from "react";
import InkButton from "@/components/InkButton";
import { useToast } from "@/components/ToastProvider";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Booking = {
  id: string;
  status: string;
  scheduledStartAt: string;
  mentor: { id: string; name: string };
  meetingLink?: string | null;
  payment?: { status: string } | null;
  priceInr: number;
  availabilitySlot?: { rule?: { title?: string | null } | null } | null;
};

type Subscription = {
  id: string;
  status: string;
};

export default function LearnerDashboard() {
  const { pushToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [subscriptions, setSubscriptions] = useState<Subscription[]>([]);
  const [loading, setLoading] = useState(true);
  const [openRule, setOpenRule] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [bookingRes, subRes] = await Promise.all([
        fetch(`${apiUrl}/bookings/me`, { credentials: "include" }),
        fetch(`${apiUrl}/subscriptions/me`, { credentials: "include" }),
      ]);
      if (bookingRes.ok) {
        const data = (await bookingRes.json()) as { bookings: Booking[] };
        setBookings(data.bookings);
      }
      if (subRes.ok) {
        const data = (await subRes.json()) as { subscriptions: Subscription[] };
        setSubscriptions(data.subscriptions);
      }
      setLoading(false);
    };
    load();
  }, []);

  const now = Date.now();
  const upcoming = bookings.filter(
    (booking) => new Date(booking.scheduledStartAt).getTime() > now,
  );
  const uniqueMentors = new Set(bookings.map((booking) => booking.mentor.id));
  const activeSubs = subscriptions.filter((sub) => sub.status === "ACTIVE");

  const stats = [
    { label: "Upcoming Sessions", value: String(upcoming.length) },
    { label: "Mentors Booked", value: String(uniqueMentors.size) },
    { label: "Active Subscriptions", value: String(activeSubs.length) },
  ];

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
          new Date(a.scheduledStartAt).getTime() -
          new Date(b.scheduledStartAt).getTime(),
      );
      return { rule, bookings: sorted, next: sorted[0] };
    });
    return groups.sort(
      (a, b) =>
        new Date(a.next.scheduledStartAt).getTime() -
        new Date(b.next.scheduledStartAt).getTime(),
    );
  };

  const groupedUpcoming = groupBookings(upcoming);

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

  useEffect(() => {
    setOpenRule(null);
  }, [groupedUpcoming.length]);

  return (
    <div className="space-y-8">
      <section className="grid gap-6 md:grid-cols-3">
        {loading
          ? Array.from({ length: 3 }).map((_, index) => (
              <div key={`stat-skel-${index}`} className="stat-card p-6 space-y-3">
                <div className="skeleton skeleton-line w-2/3" />
                <div className="skeleton skeleton-line w-1/2" />
              </div>
            ))
          : stats.map((stat) => (
              <div key={stat.label} className="stat-card p-6">
                <p className="text-xs uppercase tracking-[0.2em] text-[var(--ink-700)]">
                  {stat.label}
                </p>
                <p className="mt-3 text-3xl font-semibold">{stat.value}</p>
              </div>
            ))}
      </section>

      <section className="grid gap-6 md:grid-cols-[1.2fr_0.8fr]">
        <div className="ink-border p-6">
          <h2 className="newsprint-title text-sm">Upcoming Sessions</h2>
          <div className="mt-4 space-y-4">
            {loading && (
              <p className="text-sm text-[var(--ink-700)]">Loading...</p>
            )}
            {!loading && upcoming.length === 0 && (
              <p className="text-sm text-[var(--ink-700)]">
                No upcoming sessions yet.
              </p>
            )}
            {!loading &&
              groupedUpcoming.map((group) => (
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
                      {group.bookings.slice(0, 3).map((booking) => (
                        <div
                          key={booking.id}
                          className="flex items-center justify-between px-4 py-3"
                        >
                        <div>
                          <p className="text-sm font-semibold">
                            {booking.mentor.name}
                          </p>
                          <p className="text-xs text-[var(--ink-700)]">
                            {new Date(booking.scheduledStartAt).toLocaleString()} • ₹
                            {booking.priceInr}
                          </p>
                        </div>
                        <div className="flex items-center gap-3">
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
                            disabled={booking.payment?.status !== "CAPTURED"}
                            onClick={() => addToCalendar(booking.id)}
                          >
                            Add to Calendar
                          </InkButton>
                        </div>
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              ))}
          </div>
        </div>
        <div className="ink-border p-6">
          <h2 className="newsprint-title text-sm">Next Steps</h2>
          <ul className="mt-4 space-y-3 text-sm text-[var(--ink-700)]">
            <li>• Complete your goals profile for better matches.</li>
            <li>• Add your preferred session times.</li>
            <li>• Try the new mentor discovery filters.</li>
          </ul>
          <InkButton className="mt-6 w-full">Update Preferences</InkButton>
        </div>
      </section>
    </div>
  );
}
