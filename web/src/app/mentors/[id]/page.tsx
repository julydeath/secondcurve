"use client";

import { useEffect, useState } from "react";
import { useParams } from "next/navigation";
import InkButton from "@/components/InkButton";
import { useToast } from "@/components/ToastProvider";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Mentor = {
  id: string;
  name: string;
  mentorProfile?: {
    headline?: string | null;
    bio?: string | null;
    yearsExperience?: number;
    expertiseTags?: string[];
    subjectTags?: string[];
    collectionTags?: string[];
    languages?: string[];
    ratingAvg?: number;
    ratingCount?: number;
    profilePhotoUrl?: string | null;
  } | null;
  availabilitySlots?: {
    id: string;
    startAt: string;
    durationMinutes: number;
    priceInr: number;
    status: "AVAILABLE" | "RESERVED" | "BOOKED" | "BLOCKED";
    ruleId?: string | null;
    mode?: "ONE_TIME" | "RECURRING";
  }[];
};

type RecurringRule = {
  id: string;
  title: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  priceInr: number;
  timezone: string;
};

const loadRazorpay = () =>
  new Promise<boolean>((resolve) => {
    if (typeof window === "undefined") {
      resolve(false);
      return;
    }
    if ((window as any).Razorpay) {
      resolve(true);
      return;
    }
    const script = document.createElement("script");
    script.src = "https://checkout.razorpay.com/v1/checkout.js";
    script.onload = () => resolve(true);
    script.onerror = () => resolve(false);
    document.body.appendChild(script);
  });

export default function MentorDetailPage() {
  const params = useParams();
  const { pushToast } = useToast();
  const [mentor, setMentor] = useState<Mentor | null>(null);
  const [rules, setRules] = useState<RecurringRule[]>([]);
  const [bookingLoading, setBookingLoading] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  type Slot = NonNullable<Mentor["availabilitySlots"]>[number];
  const [selectedSlot, setSelectedSlot] = useState<Slot | null>(null);
  const [openRuleId, setOpenRuleId] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`${apiUrl}/mentors/${params.id}`);
      if (response.ok) {
        const data = (await response.json()) as { mentor: Mentor };
        setMentor(data.mentor);
        if (data.mentor.availabilitySlots?.length) {
          setSelectedSlot(data.mentor.availabilitySlots[0]);
        }
      }
      const ruleResponse = await fetch(
        `${apiUrl}/mentors/${params.id}/availability/rules`,
      );
      if (ruleResponse.ok) {
        const data = (await ruleResponse.json()) as { rules: RecurringRule[] };
        setRules(data.rules);
      } else {
        pushToast("Unable to load availability rules", "error");
      }
    };
    load().catch(() => pushToast("Failed to load mentor", "error"));
  }, [params.id]);

  const slots = mentor?.availabilitySlots ?? [];
  const slotsByRule = slots.reduce<Record<string, Mentor["availabilitySlots"]>>(
    (acc, slot) => {
      const key = slot.ruleId ?? "one-time";
      if (!acc[key]) acc[key] = [];
      acc[key].push(slot);
      return acc;
    },
    {},
  );

  const ruleNextSlot = (ruleId: string) => {
    const list = slotsByRule[ruleId] ?? [];
    if (!list.length) return null;
    const sorted = [...list].sort(
      (a, b) => new Date(a.startAt).getTime() - new Date(b.startAt).getTime(),
    );
    return sorted[0];
  };

  useEffect(() => {
    if (!rules.length) return;
    const ranked = [...rules]
      .map((rule) => ({ rule, next: ruleNextSlot(rule.id) }))
      .filter((entry) => entry.next)
      .sort(
        (a, b) =>
          new Date(a.next!.startAt).getTime() -
          new Date(b.next!.startAt).getTime(),
      );
    if (ranked.length) {
      setOpenRuleId(ranked[0].rule.id);
      setSelectedSlot(ranked[0].next ?? null);
    }
  }, [rules, slots.length]);

  const handleBookSlot = async (slot: NonNullable<Mentor["availabilitySlots"]>[0]) => {
    try {
      setError(null);
      setBookingLoading(slot.id);

      if (slot.mode === "RECURRING") {
        if (!slot.ruleId) {
          setError("Recurring rule missing for this slot.");
          pushToast("Recurring rule missing for this slot", "error");
          return;
        }
        const response = await fetch(`${apiUrl}/subscriptions`, {
          method: "POST",
          credentials: "include",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ availabilityRuleId: slot.ruleId }),
        });
        if (response.status === 401) {
          window.location.href = "/auth/sign-up";
          return;
        }
        if (!response.ok) {
          setError("Unable to start subscription. Please try again.");
          pushToast("Subscription could not start", "error");
          return;
        }
        const data = (await response.json()) as {
          subscription: { id: string };
          razorpay: { keyId: string; subscriptionId: string };
        };
        const loaded = await loadRazorpay();
        if (!loaded) {
          setError("Payment SDK failed to load.");
          pushToast("Payment SDK failed to load", "error");
          return;
        }
        const rzp = new (window as any).Razorpay({
          key: data.razorpay.keyId,
          subscription_id: data.razorpay.subscriptionId,
          name: "WisdomBridge",
          description: "Weekly mentoring subscription",
          handler: () => {
            // Webhook will confirm and schedule next booking.
          },
          modal: {
            ondismiss: async () => {
              await fetch(`${apiUrl}/subscriptions/${data.subscription.id}/cancel`, {
                method: "POST",
                credentials: "include",
              });
              pushToast("Subscription canceled", "info");
            },
          },
          theme: { color: "#000000" },
        });
        rzp.open();
        pushToast("Subscription started", "success");
        return;
      }

      const response = await fetch(`${apiUrl}/bookings`, {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ availabilitySlotId: slot.id }),
      });
      if (response.status === 401) {
        window.location.href = "/auth/sign-up";
        return;
      }
      if (!response.ok) {
        setError("Unable to create booking. Please try another slot.");
        pushToast("Unable to create booking", "error");
        return;
      }
      const data = (await response.json()) as {
        booking: { id: string };
        razorpay: {
          keyId: string;
          orderId: string;
          amount: number;
          currency: string;
        };
      };

      const loaded = await loadRazorpay();
      if (!loaded) {
        setError("Payment SDK failed to load.");
        pushToast("Payment SDK failed to load", "error");
        return;
      }
      const rzp = new (window as any).Razorpay({
        key: data.razorpay.keyId,
        order_id: data.razorpay.orderId,
        amount: data.razorpay.amount,
        currency: data.razorpay.currency,
        name: "WisdomBridge",
        description: "1:1 mentoring session",
        handler: async (response: {
          razorpay_order_id: string;
          razorpay_payment_id: string;
          razorpay_signature: string;
        }) => {
          await fetch(`${apiUrl}/bookings/${data.booking.id}/confirm-payment`, {
            method: "POST",
            credentials: "include",
            headers: { "Content-Type": "application/json" },
            body: JSON.stringify({
              razorpayOrderId: response.razorpay_order_id,
              razorpayPaymentId: response.razorpay_payment_id,
              razorpaySignature: response.razorpay_signature,
            }),
          });
        },
        modal: {
          ondismiss: async () => {
            await fetch(`${apiUrl}/bookings/${data.booking.id}/cancel`, {
              method: "POST",
              credentials: "include",
              headers: { "Content-Type": "application/json" },
              body: JSON.stringify({ reason: "payment_abandoned" }),
            });
            pushToast("Booking canceled", "info");
          },
        },
        theme: { color: "#000000" },
      });
      rzp.open();
      pushToast("Booking created. Complete payment.", "success");
    } catch (err) {
      setError("Something went wrong. Please try again.");
      pushToast("Something went wrong", "error");
    } finally {
      setBookingLoading(null);
    }
  };


  if (!mentor) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="ink-border paper-texture p-6 space-y-3">
          <div className="skeleton skeleton-line w-32" />
          <div className="skeleton skeleton-line w-2/3" />
          <div className="skeleton skeleton-line w-1/2" />
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 space-y-8">
      <header className="ink-border paper-texture p-6">
        <p className="newsprint-title text-xs">Mentor Profile</p>
        <h1 className="newsprint-title mt-2 text-3xl">{mentor.name}</h1>
        <p className="mt-2 text-sm text-[var(--ink-700)]">
          {mentor.mentorProfile?.headline ?? "Experienced mentor"}
        </p>
      </header>

      {error && (
        <div className="ink-border p-4 text-sm text-[var(--ink-700)]">
          {error}
        </div>
      )}

      <section className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
        <div className="ink-border p-6 space-y-4">
          <h2 className="newsprint-title text-sm">About</h2>
          <p className="text-sm text-[var(--ink-700)]">
            {mentor.mentorProfile?.bio ?? "Bio coming soon."}
          </p>
          <div className="grid gap-3 md:grid-cols-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
            <span>
              Experience: {mentor.mentorProfile?.yearsExperience ?? 0}+ years
            </span>
            <span>
              Rating: {mentor.mentorProfile?.ratingAvg?.toFixed(1) ?? "0.0"} ★
            </span>
          </div>
          <div className="flex flex-wrap gap-2">
            {(mentor.mentorProfile?.expertiseTags ?? []).map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
            {(mentor.mentorProfile?.subjectTags ?? []).map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
            {(mentor.mentorProfile?.collectionTags ?? []).map((tag) => (
              <span key={tag} className="chip">
                {tag}
              </span>
            ))}
          </div>
        </div>

        <div className="ink-border p-6 space-y-4">
          <h2 className="newsprint-title text-sm">Active Availability Rules</h2>
          <p className="text-xs text-[var(--ink-700)]">
            Each rule opens to show available dates and times. Slots within 24
            hours are hidden.
          </p>
          <div className="space-y-4 max-h-[520px] overflow-y-auto pr-1">
            {rules.map((rule) => {
              const ruleSlots = slotsByRule[rule.id] ?? [];
              const grouped = ruleSlots.reduce<
                Record<string, Mentor["availabilitySlots"]>
              >((acc, slot) => {
                const day = new Date(slot.startAt).toDateString();
                if (!acc[day]) acc[day] = [];
                acc[day].push(slot);
                return acc;
              }, {});
              const nextSlot = ruleNextSlot(rule.id);
              const isOpen = openRuleId === rule.id;
              return (
                <div key={rule.id} className="border-2 border-black">
                  <button
                    className="flex w-full items-center justify-between px-4 py-3 text-left"
                    onClick={() => setOpenRuleId(isOpen ? null : rule.id)}
                  >
                    <div>
                      <p className="text-xs uppercase tracking-widest">
                        {rule.title}
                      </p>
                      <p className="mt-1 text-xs text-[var(--ink-700)]">
                        {
                          ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"][
                            rule.weekday
                          ]
                        }{" "}
                        • {rule.startTime} • {rule.durationMinutes} mins • ₹
                        {rule.priceInr}
                      </p>
                      {nextSlot && (
                        <p className="mt-1 text-[10px] uppercase tracking-widest text-[var(--ink-700)]">
                          Next available:{" "}
                          {new Date(nextSlot.startAt).toLocaleString()}
                        </p>
                      )}
                    </div>
                    <span className="text-xs uppercase tracking-widest">
                      {isOpen ? "Hide" : "View"}
                    </span>
                  </button>
                  {isOpen && (
                    <div className="border-t-2 border-black p-4 space-y-3">
                      {Object.entries(grouped).map(([day, daySlots]) => (
                        <div key={day} className="border-2 border-black">
                          <div className="border-b-2 border-black px-3 py-2 text-xs uppercase tracking-widest">
                            {day}
                          </div>
                          <div className="grid gap-2 p-3 sm:grid-cols-2">
                            {(daySlots ?? []).map((slot) => {
                              const isAvailable = slot.status === "AVAILABLE";
                              return (
                                <button
                                  key={slot.id}
                                  className={`ink-border w-full px-3 py-2 text-left text-xs ${
                                    selectedSlot?.id === slot.id
                                      ? "bg-black text-white"
                                      : ""
                                  }`}
                                  onClick={() => setSelectedSlot(slot)}
                                  disabled={
                                    !isAvailable && slot.status !== "RESERVED"
                                  }
                                >
                                  <div className="flex items-center justify-between">
                                    <span>
                                      {new Date(
                                        slot.startAt,
                                      ).toLocaleTimeString([], {
                                        hour: "2-digit",
                                        minute: "2-digit",
                                      })}
                                    </span>
                                    <span>₹{slot.priceInr}</span>
                                  </div>
                                  <div className="mt-1 text-[10px] uppercase tracking-widest text-[var(--ink-700)]">
                                    {slot.status}
                                  </div>
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      ))}
                      {ruleSlots.length === 0 && (
                        <p className="text-sm text-[var(--ink-700)]">
                          No upcoming slots for this rule yet.
                        </p>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
            {rules.length === 0 && (
              <p className="text-sm text-[var(--ink-700)]">
                No active rules yet.
              </p>
            )}
          </div>
          {selectedSlot && (
            <div className="ink-border p-5 space-y-3">
              <p className="text-xs uppercase tracking-widest text-[var(--ink-700)]">
                Selected Slot Details
              </p>
              <p className="text-sm font-semibold">
                {new Date(selectedSlot.startAt).toLocaleString()}
              </p>
              <p className="text-xs text-[var(--ink-700)]">
                {selectedSlot.durationMinutes} mins • ₹{selectedSlot.priceInr}
              </p>
              <p className="text-xs text-[var(--ink-700)]">
                Status: {selectedSlot.status}
              </p>
              {selectedSlot.status === "AVAILABLE" && (
                <InkButton
                  loading={bookingLoading === selectedSlot.id}
                  onClick={() => handleBookSlot(selectedSlot)}
                >
                  Book This Slot
                </InkButton>
              )}
            </div>
          )}
        </div>
      </section>

    </div>
  );
}
