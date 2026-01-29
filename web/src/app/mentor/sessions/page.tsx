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

export default function MentorSessions() {
  const { pushToast } = useToast();
  const [sessions, setSessions] = useState<Booking[]>([]);
  const [loading, setLoading] = useState(true);
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});
  const [savingLinkId, setSavingLinkId] = useState<string | null>(null);
  const [openRule, setOpenRule] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`${apiUrl}/bookings/me?as=MENTOR`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = (await response.json()) as { bookings: Booking[] };
        setSessions(
          data.bookings.sort(
            (a, b) =>
              new Date(b.scheduledStartAt).getTime() -
              new Date(a.scheduledStartAt).getTime(),
          ),
        );
      }
      setLoading(false);
    };
    load();
  }, []);

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
          new Date(b.scheduledStartAt).getTime() -
          new Date(a.scheduledStartAt).getTime(),
      );
      return { rule, sessions: sorted, next: sorted[0] };
    });
    return groups.sort(
      (a, b) =>
        new Date(b.next.scheduledStartAt).getTime() -
        new Date(a.next.scheduledStartAt).getTime(),
    );
  };

  useEffect(() => {
    setOpenRule(null);
  }, [sessions.length]);

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
    <div className="space-y-6">
      <h2 className="newsprint-title text-xl">Upcoming Sessions</h2>
      <div className="ink-border divide-y-2 divide-black">
        {loading && (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`session-skel-${index}`} className="space-y-2">
                <div className="skeleton skeleton-line w-1/3" />
                <div className="skeleton skeleton-line w-1/2" />
              </div>
            ))}
          </div>
        )}
        {!loading && sessions.length === 0 && (
          <div className="px-5 py-4 text-sm text-[var(--ink-700)]">
            No upcoming sessions.
          </div>
        )}
        {!loading &&
          groupSessions(sessions).map((group) => (
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
                  {group.sessions.map((session) => (
                    <div
                      key={session.id}
                      className="grid gap-3 px-5 py-4 sm:grid-cols-[180px_1fr_auto]"
                    >
                      <div>
                        <p className="text-base font-semibold">
                          {new Date(session.scheduledStartAt).toLocaleDateString()}
                        </p>
                        <p className="text-sm text-[var(--ink-700)]">
                          {new Date(session.scheduledStartAt).toLocaleTimeString([], {
                            hour: "2-digit",
                            minute: "2-digit",
                          })}
                        </p>
                      </div>
                      <div>
                        <p className="text-base font-semibold">{session.learner.name}</p>
                        <p className="text-sm text-[var(--ink-700)]">
                          ₹{session.priceInr} • {session.status}
                        </p>
                      </div>
                      <div className="flex flex-col items-start gap-2 sm:items-end">
                        <span className={`chip ${statusTone(session)}`}>
                          {statusLabel(session)}
                        </span>
                        <input
                          className="ink-border px-3 py-2 text-xs"
                          placeholder="Paste meeting link"
                          value={linkDrafts[session.id] ?? session.meetingLink ?? ""}
                          onChange={(event) =>
                            setLinkDrafts((prev) => ({
                              ...prev,
                              [session.id]: event.target.value,
                            }))
                          }
                        />
                        <InkButton
                          loading={savingLinkId === session.id}
                          onClick={() => saveMeetingLink(session.id)}
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
    </div>
  );
}
