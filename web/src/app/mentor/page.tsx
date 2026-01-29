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
  meetingLink?: string | null;
  learner: { id: string; name: string };
  priceInr: number;
  payment?: { status: string } | null;
  availabilitySlot?: { rule?: { title?: string | null } | null } | null;
};

type Payout = {
  id: string;
  amountInr: number;
  status: string;
  scheduledFor?: string | null;
  processedAt?: string | null;
};

type MentorProfile = {
  ratingAvg?: number | null;
};

export default function MentorDashboard() {
  const { pushToast } = useToast();
  const [bookings, setBookings] = useState<Booking[]>([]);
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [ratingAvg, setRatingAvg] = useState<number>(0);
  const [loading, setLoading] = useState(true);
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const [savingLinkId, setSavingLinkId] = useState<string | null>(null);
  const [openRule, setOpenRule] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [bookingRes, payoutRes, mentorRes] = await Promise.all([
        fetch(`${apiUrl}/bookings/me?as=MENTOR`, { credentials: "include" }),
        fetch(`${apiUrl}/mentors/me/payouts`, { credentials: "include" }),
        fetch(`${apiUrl}/mentors/me`, { credentials: "include" }),
      ]);
      if (bookingRes.ok) {
        const data = (await bookingRes.json()) as { bookings: Booking[] };
        setBookings(data.bookings);
      }
      if (payoutRes.ok) {
        const data = (await payoutRes.json()) as { payouts: Payout[] };
        setPayouts(data.payouts);
      }
      if (mentorRes.ok) {
        const data = (await mentorRes.json()) as {
          mentor: { mentorProfile?: MentorProfile | null };
        };
        setRatingAvg(data.mentor.mentorProfile?.ratingAvg ?? 0);
      }
      setLoading(false);
    };
    load();
  }, []);

  const now = Date.now();
  const upcoming = bookings
    .filter((b) => new Date(b.scheduledStartAt).getTime() > now)
    .sort(
      (a, b) =>
        new Date(a.scheduledStartAt).getTime() -
        new Date(b.scheduledStartAt).getTime(),
    )
    .slice(0, 3);

  const weekStart = (() => {
    const date = new Date();
    const day = date.getDay();
    const diff = date.getDate() - day;
    const start = new Date(date.setDate(diff));
    start.setHours(0, 0, 0, 0);
    return start;
  })();

  const weekEarnings = payouts
    .filter((p) => p.processedAt)
    .filter((p) => new Date(p.processedAt!).getTime() >= weekStart.getTime())
    .reduce((sum, p) => sum + p.amountInr, 0);

  const stats = [
    { label: "Upcoming Sessions", value: String(upcoming.length) },
    { label: "This Week Earnings", value: `₹${weekEarnings}` },
    { label: "Average Rating", value: `${ratingAvg.toFixed(1)} ★` },
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

  const groupSessions = (items: Booking[]) => {
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
      return { rule, sessions: sorted, next: sorted[0] };
    });
    return groups.sort(
      (a, b) =>
        new Date(a.next.scheduledStartAt).getTime() -
        new Date(b.next.scheduledStartAt).getTime(),
    );
  };

  useEffect(() => {
    setOpenRule(null);
  }, [upcoming.length]);

  const saveMeetingLink = async (bookingId: string) => {
    const link = linkDrafts[bookingId];
    if (!link) return;
    setSavingLinkId(bookingId);
    const response = await fetch(`${apiUrl}/bookings/${bookingId}/meeting-link`, {
      method: "PATCH",
      credentials: "include",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ meetingLink: link }),
    });
    if (!response.ok) {
      pushToast("Failed to save meeting link", "error");
    } else {
      pushToast("Meeting link saved", "success");
    }
    setSavingLinkId(null);
  };

  return (
    <div className="space-y-10">
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

      <section className="space-y-4">
        <div className="flex items-center justify-between">
          <h2 className="newsprint-title text-lg">Next Sessions</h2>
          <p className="text-sm text-[var(--ink-700)]">
            Please add your meeting links 2 hours before.
          </p>
        </div>
        <div className="ink-border divide-y-2 divide-black">
          {loading && (
            <div className="px-5 py-4 text-sm text-[var(--ink-700)]">
              Loading sessions...
            </div>
          )}
          {!loading && upcoming.length === 0 && (
            <div className="px-5 py-4 text-sm text-[var(--ink-700)]">
              No upcoming sessions.
            </div>
          )}
          {!loading &&
            groupSessions(upcoming).map((group) => (
              <div key={group.rule} className="ink-border">
                <button
                  className="flex w-full items-center justify-between px-4 py-3"
                  onClick={() =>
                    setOpenRule(openRule === group.rule ? null : group.rule)
                  }
                >
                  <div>
                    <p className="text-xs uppercase tracking-widest">{group.rule}</p>
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
                    {group.sessions.map((item) => (
                      <div
                        key={item.id}
                        className="flex flex-col gap-3 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
                      >
                        <div>
                          <p className="text-base font-semibold">
                            {new Date(item.scheduledStartAt).toLocaleString()}
                          </p>
                          <p className="text-sm text-[var(--ink-700)]">
                            {item.learner.name} • ₹{item.priceInr} • {item.status}
                          </p>
                        </div>
                        <div className="flex flex-col gap-2 sm:items-end">
                          <span className={`chip ${statusTone(item)}`}>
                            {statusLabel(item)}
                          </span>
                          <input
                            className="ink-border px-3 py-2 text-xs"
                            placeholder="Paste meeting link"
                            value={linkDrafts[item.id] ?? item.meetingLink ?? ""}
                            onChange={(event) =>
                              setLinkDrafts((prev) => ({
                                ...prev,
                                [item.id]: event.target.value,
                              }))
                            }
                          />
                          <InkButton
                            loading={savingLinkId === item.id}
                            onClick={() => saveMeetingLink(item.id)}
                          >
                            Save Link
                          </InkButton>
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            ))}
        </div>
      </section>

      <section className="grid gap-6 md:grid-cols-2">
        <div className="ink-border p-6">
          <h3 className="newsprint-title text-sm">Reminders</h3>
          <ul className="mt-4 space-y-3 text-sm text-[var(--ink-700)]">
            <li>• Verify PAN/Aadhaar to enable weekly payouts.</li>
            <li>• Add a short intro video to boost bookings.</li>
            <li>• Keep 15-minute buffer between sessions.</li>
          </ul>
        </div>
        <div className="ink-border p-6">
          <h3 className="newsprint-title text-sm">Quick Actions</h3>
          <div className="mt-4 flex flex-col gap-3">
            <button className="ink-border px-4 py-3 text-xs uppercase tracking-widest">
              Create New Slots
            </button>
            <button className="ink-border px-4 py-3 text-xs uppercase tracking-widest">
              View Payouts
            </button>
            <button className="ink-border px-4 py-3 text-xs uppercase tracking-widest">
              Update Bio
            </button>
          </div>
        </div>
      </section>
    </div>
  );
}
