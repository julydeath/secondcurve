/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import InkButton from "@/components/InkButton";
import { useToast } from "@/components/ToastProvider";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Rule = {
  id: string;
  weekday: number;
  startTime: string;
  durationMinutes: number;
  priceInr: number;
  title: string;
  meetingLink?: string | null;
  mode: "ONE_TIME" | "RECURRING";
  active: boolean;
};

type Slot = {
  id: string;
  startAt: string;
  endAt: string;
  status: string;
  priceInr: number;
  title?: string | null;
  mode?: "ONE_TIME" | "RECURRING";
  ruleId?: string | null;
  booking?: {
    id: string;
    learner?: { id: string; name: string } | null;
    subscription?: { id: string; pauseUntil?: string | null } | null;
  } | null;
};

const weekdayLabels = ["Sun", "Mon", "Tue", "Wed", "Thu", "Fri", "Sat"];

export default function MentorAvailability() {
  const { pushToast } = useToast();
  const [rules, setRules] = useState<Rule[]>([]);
  const [slots, setSlots] = useState<Slot[]>([]);
  const [links, setLinks] = useState({
    googleLinked: false,
    linkedinLinked: false,
  });
  const [error, setError] = useState<string | null>(null);
  const [loadingRule, setLoadingRule] = useState(false);
  const [editingRuleId, setEditingRuleId] = useState<string | null>(null);
  const [openRule, setOpenRule] = useState<string | null>(null);
  const [openSlotsRule, setOpenSlotsRule] = useState<string | null>(null);
  const [actionLoading, setActionLoading] = useState<string | null>(null);
  const [pauseWeeks, setPauseWeeks] = useState<Record<string, number>>({});
  const [editForm, setEditForm] = useState({
    weekday: 1,
    startTime: "10:00",
    durationMinutes: 60,
    priceInr: 1200,
    title: "Mentoring Session",
    meetingLink: "",
    mode: "ONE_TIME" as "ONE_TIME" | "RECURRING",
    active: true,
  });
  const [form, setForm] = useState({
    weekday: 1,
    startTime: "10:00",
    durationMinutes: 60,
    priceInr: 1200,
    title: "Mentoring Session",
    meetingLink: "",
    mode: "ONE_TIME" as "ONE_TIME" | "RECURRING",
    active: true,
  });

  const loadRules = async () => {
    const response = await fetch(`${apiUrl}/mentors/me/availability/rules`, {
      credentials: "include",
    });
    if (response.ok) {
      const data = (await response.json()) as { rules: Rule[] };
      setRules(data.rules);
    }
  };

  const loadSlots = async () => {
    const response = await fetch(`${apiUrl}/mentors/me/availability/slots`, {
      credentials: "include",
    });
    if (response.ok) {
      const data = (await response.json()) as { slots: Slot[] };
      setSlots(data.slots);
    }
  };

  useEffect(() => {
    loadRules();
    loadSlots();
    const loadLinks = async () => {
      const response = await fetch(`${apiUrl}/auth/links`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = (await response.json()) as {
          googleLinked: boolean;
          linkedinLinked: boolean;
        };
        setLinks(data);
      }
    };
    loadLinks();
  }, []);

  useEffect(() => {
    setOpenRule(null);
    setOpenSlotsRule(null);
  }, [rules.length]);

  const ruleHasBookings = (ruleId: string) =>
    slots.some(
      (slot) =>
        slot.ruleId === ruleId &&
        (slot.booking || slot.status === "BOOKED" || slot.status === "RESERVED"),
    );

  const createRule = async () => {
    setError(null);
    setLoadingRule(true);
    const response = await fetch(`${apiUrl}/mentors/me/availability/rules`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ...form,
        meetingLink: form.meetingLink ? form.meetingLink : undefined,
      }),
    });
    if (!response.ok) {
      const payload = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(payload.error ?? "Failed to save availability.");
      pushToast(payload.error ?? "Failed to save availability", "error");
    } else {
      await loadRules();
      pushToast("Availability rule created", "success");
    }
    setLoadingRule(false);
  };

  const generateSlots = async (ruleId: string) => {
    setError(null);
    await fetch(`${apiUrl}/mentors/me/availability/rules/${ruleId}/generate`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ weeks: 4 }),
    });
    await loadSlots();
    pushToast("Slots generated for next 4 weeks", "success");
  };

  const deleteRule = async (ruleId: string) => {
    setError(null);
    await fetch(`${apiUrl}/mentors/me/availability/rules/${ruleId}`, {
      method: "DELETE",
      credentials: "include",
    });
    if (editingRuleId === ruleId) {
      setEditingRuleId(null);
    }
    await loadRules();
    pushToast("Availability rule deleted", "info");
  };

  const startEdit = (rule: Rule) => {
    setEditingRuleId(rule.id);
    setEditForm({
      weekday: rule.weekday,
      startTime: rule.startTime,
      durationMinutes: rule.durationMinutes,
      priceInr: rule.priceInr,
      title: rule.title,
      meetingLink: rule.meetingLink ?? "",
      mode: rule.mode,
      active: rule.active,
    });
  };

  const saveEdit = async () => {
    if (!editingRuleId) return;
    setError(null);
    await fetch(`${apiUrl}/mentors/me/availability/rules/${editingRuleId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({
        ...editForm,
        meetingLink: editForm.meetingLink ? editForm.meetingLink : undefined,
      }),
    });
    setEditingRuleId(null);
    await loadRules();
    pushToast("Availability rule updated", "success");
  };

  const toggleSlot = async (slot: Slot) => {
    setError(null);
    const nextStatus = slot.status === "BLOCKED" ? "AVAILABLE" : "BLOCKED";
    await fetch(`${apiUrl}/mentors/me/availability/slots/${slot.id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ status: nextStatus }),
    });
    await loadSlots();
    pushToast(
      nextStatus === "BLOCKED" ? "Slot blocked" : "Slot unblocked",
      "info",
    );
  };

  const pauseSubscription = async (subscriptionId: string) => {
    setActionLoading(subscriptionId);
    const weeks = pauseWeeks[subscriptionId] ?? 1;
    const response = await fetch(
      `${apiUrl}/subscriptions/${subscriptionId}/pause`,
      {
        method: "POST",
        credentials: "include",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ weeks }),
      },
    );
    if (!response.ok) {
      pushToast("Unable to pause subscription", "error");
    } else {
      pushToast("Subscription paused for selected weeks", "info");
    }
    setActionLoading(null);
  };

  const resumeSubscription = async (subscriptionId: string) => {
    setActionLoading(subscriptionId);
    const response = await fetch(
      `${apiUrl}/subscriptions/${subscriptionId}/resume`,
      {
        method: "POST",
        credentials: "include",
      },
    );
    if (!response.ok) {
      pushToast("Unable to resume subscription", "error");
    } else {
      pushToast("Subscription resumed", "success");
    }
    setActionLoading(null);
  };

  return (
    <div className="space-y-8">
      <section className="ink-border p-6">
        <h2 className="newsprint-title text-sm">Connections</h2>
        <p className="mt-2 text-sm text-[var(--ink-700)]">
          Connect Google Calendar to auto‑add bookings. Link LinkedIn to import
          experience.
        </p>
        <div className="mt-4 flex flex-col gap-3 sm:flex-row">
          <InkButton
            onClick={() => {
              window.location.href = `${apiUrl}/auth/google/start?calendar=1&link=1`;
            }}
          >
            {links.googleLinked ? "Google Calendar Connected" : "Connect Google Calendar"}
          </InkButton>
          <InkButton
            onClick={() => {
              window.location.href = `${apiUrl}/auth/linkedin/start?role=MENTOR&link=1`;
            }}
          >
            {links.linkedinLinked ? "LinkedIn Connected" : "Link LinkedIn Profile"}
          </InkButton>
        </div>
        {error && (
          <p className="mt-3 text-xs uppercase tracking-widest text-red-700">
            {error}
          </p>
        )}
      </section>

      <section className="ink-border p-6">
        <h2 className="newsprint-title text-sm">Create Availability</h2>
        {!links.linkedinLinked && (
          <p className="mt-2 text-xs uppercase tracking-widest text-red-700">
            LinkedIn must be connected before creating availability.
          </p>
        )}
        <div className="mt-4 grid gap-4 md:grid-cols-5">
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)] md:col-span-2">
            Title
            <input
              className="ink-border px-3 py-2 text-sm"
              value={form.title}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  title: event.target.value,
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
            Weekday
            <select
              className="ink-border px-3 py-2 text-sm"
              value={form.weekday}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  weekday: Number(event.target.value),
                }))
              }
            >
              {weekdayLabels.map((label, index) => (
                <option key={label} value={index}>
                  {label}
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
            Start
            <input
              type="time"
              className="ink-border px-3 py-2 text-sm"
              value={form.startTime}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  startTime: event.target.value,
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
            Duration
            <select
              className="ink-border px-3 py-2 text-sm"
              value={form.durationMinutes}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  durationMinutes: Number(event.target.value),
                }))
              }
            >
              {[30, 45, 60, 90].map((value) => (
                <option key={value} value={value}>
                  {value} mins
                </option>
              ))}
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
            Price (₹)
            <input
              type="number"
              className="ink-border px-3 py-2 text-sm"
              value={form.priceInr}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  priceInr: Number(event.target.value),
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)] md:col-span-2">
            Meeting URL
            <input
              className="ink-border px-3 py-2 text-sm"
              value={form.meetingLink}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  meetingLink: event.target.value,
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
            Mode
            <select
              className="ink-border px-3 py-2 text-sm"
              value={form.mode}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  mode: event.target.value as "ONE_TIME" | "RECURRING",
                }))
              }
            >
              <option value="ONE_TIME">One‑time</option>
              <option value="RECURRING">Recurring</option>
            </select>
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
            Availability
            <select
              className="ink-border px-3 py-2 text-sm"
              value={form.active ? "ON" : "OFF"}
              onChange={(event) =>
                setForm((prev) => ({
                  ...prev,
                  active: event.target.value === "ON",
                }))
              }
            >
              <option value="ON">On</option>
              <option value="OFF">Off</option>
            </select>
          </label>
        </div>
        <InkButton
          className="mt-6"
          onClick={createRule}
          loading={loadingRule}
          disabled={!links.linkedinLinked}
        >
          Save Availability
        </InkButton>
      </section>

      <section className="ink-border p-6">
        <h2 className="newsprint-title text-sm">Active Rules</h2>
        <div className="mt-4 space-y-4">
          {rules.length === 0 && (
            <p className="text-sm text-[var(--ink-700)]">
              No rules yet. Create one above.
            </p>
          )}
          {rules.map((rule) => (
            <div key={rule.id} className="border-2 border-black">
              <button
                className="flex w-full items-center justify-between px-4 py-3"
                onClick={() =>
                  setOpenRule(openRule === rule.id ? null : rule.id)
                }
              >
                <div>
                  <p className="text-xs uppercase tracking-widest">{rule.title}</p>
                  <p className="mt-1 text-xs text-[var(--ink-700)]">
                    {weekdayLabels[rule.weekday]} • {rule.startTime} •{" "}
                    {rule.durationMinutes} mins • ₹{rule.priceInr}
                  </p>
                  <p className="text-[10px] uppercase tracking-widest text-[var(--ink-700)]">
                    {rule.mode} • {rule.active ? "ON" : "OFF"}
                  </p>
                </div>
                <span className="text-xs uppercase tracking-widest">
                  {openRule === rule.id ? "Hide" : "View"}
                </span>
              </button>
              {openRule === rule.id && (
                <div className="border-t-2 border-black p-4 space-y-4">
                  <div className="flex flex-wrap gap-2">
                    <InkButton
                      className="px-4 py-2"
                      onClick={() => startEdit(rule)}
                      disabled={ruleHasBookings(rule.id)}
                      title={
                        ruleHasBookings(rule.id)
                          ? "Cannot edit a rule with booked sessions"
                          : "Edit rule"
                      }
                    >
                      Edit
                    </InkButton>
                    <InkButton
                      className="px-4 py-2"
                      onClick={() => generateSlots(rule.id)}
                    >
                      Generate 4 Weeks
                    </InkButton>
                    <InkButton
                      className="px-4 py-2"
                      onClick={() => deleteRule(rule.id)}
                      disabled={ruleHasBookings(rule.id)}
                      title={
                        ruleHasBookings(rule.id)
                          ? "Cannot delete a rule with booked sessions"
                          : "Delete rule"
                      }
                    >
                      Delete
                    </InkButton>
                  </div>
                  {ruleHasBookings(rule.id) && (
                    <p className="text-xs uppercase tracking-widest text-red-700">
                      This rule has booked sessions. Editing or deleting is disabled.
                    </p>
                  )}
                  {editingRuleId === rule.id && (
                    <div className="grid gap-3 md:grid-cols-5">
                      <input
                        className="ink-border px-3 py-2 text-sm md:col-span-2"
                        value={editForm.title}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            title: event.target.value,
                          }))
                        }
                      />
                      <select
                        className="ink-border px-3 py-2 text-sm"
                        value={editForm.weekday}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            weekday: Number(event.target.value),
                          }))
                        }
                      >
                        {weekdayLabels.map((label, index) => (
                          <option key={label} value={index}>
                            {label}
                          </option>
                        ))}
                      </select>
                      <input
                        type="time"
                        className="ink-border px-3 py-2 text-sm"
                        value={editForm.startTime}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            startTime: event.target.value,
                          }))
                        }
                      />
                      <select
                        className="ink-border px-3 py-2 text-sm"
                        value={editForm.durationMinutes}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            durationMinutes: Number(event.target.value),
                          }))
                        }
                      >
                        {[30, 45, 60, 90].map((value) => (
                          <option key={value} value={value}>
                            {value} mins
                          </option>
                        ))}
                      </select>
                      <input
                        type="number"
                        className="ink-border px-3 py-2 text-sm"
                        value={editForm.priceInr}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            priceInr: Number(event.target.value),
                          }))
                        }
                      />
                      <input
                        className="ink-border px-3 py-2 text-sm md:col-span-2"
                        value={editForm.meetingLink}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            meetingLink: event.target.value,
                          }))
                        }
                      />
                      <select
                        className="ink-border px-3 py-2 text-sm"
                        value={editForm.mode}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            mode: event.target.value as "ONE_TIME" | "RECURRING",
                          }))
                        }
                      >
                        <option value="ONE_TIME">One‑time</option>
                        <option value="RECURRING">Recurring</option>
                      </select>
                      <select
                        className="ink-border px-3 py-2 text-sm"
                        value={editForm.active ? "ON" : "OFF"}
                        onChange={(event) =>
                          setEditForm((prev) => ({
                            ...prev,
                            active: event.target.value === "ON",
                          }))
                        }
                      >
                        <option value="ON">On</option>
                        <option value="OFF">Off</option>
                      </select>
                    </div>
                  )}
                  {editingRuleId === rule.id && (
                    <div className="flex flex-wrap gap-2">
                      <InkButton className="px-4 py-2" onClick={saveEdit}>
                        Save
                      </InkButton>
                      <InkButton
                        className="px-4 py-2"
                        onClick={() => setEditingRuleId(null)}
                      >
                        Cancel
                      </InkButton>
                    </div>
                  )}
                </div>
              )}
            </div>
          ))}
        </div>
      </section>

      <section className="ink-border p-6">
        <h2 className="newsprint-title text-sm">Upcoming Slots</h2>
        <div className="mt-4 space-y-4">
          {slots.length === 0 && (
            <p className="text-sm text-[var(--ink-700)]">
              Slots will appear here after you generate them.
            </p>
          )}
          {rules.map((rule) => {
            const ruleSlots = slots.filter((slot) => slot.ruleId === rule.id);
            if (!ruleSlots.length) return null;
            const byDate = ruleSlots.reduce<Record<string, Slot[]>>((acc, slot) => {
              const day = new Date(slot.startAt).toDateString();
              if (!acc[day]) acc[day] = [];
              acc[day].push(slot);
              return acc;
            }, {});
            return (
              <div key={rule.id} className="border-2 border-black">
                <button
                  className="flex w-full items-center justify-between px-4 py-3"
                  onClick={() =>
                    setOpenSlotsRule(openSlotsRule === rule.id ? null : rule.id)
                  }
                >
                  <div>
                    <p className="text-xs uppercase tracking-widest">{rule.title}</p>
                    <p className="mt-1 text-xs text-[var(--ink-700)]">
                      {weekdayLabels[rule.weekday]} • {rule.startTime} •{" "}
                      {rule.durationMinutes} mins • ₹{rule.priceInr}
                    </p>
                  </div>
                  <span className="text-xs uppercase tracking-widest">
                    {openSlotsRule === rule.id ? "Hide" : "View"}
                  </span>
                </button>
                {openSlotsRule === rule.id && (
                  <div className="border-t-2 border-black p-4 space-y-3">
                    {Object.entries(byDate).map(([day, daySlots]) => (
                      <div key={day} className="border-2 border-black">
                        <div className="border-b-2 border-black px-3 py-2 text-xs uppercase tracking-widest">
                          {day}
                        </div>
                        <div className="space-y-3 p-3">
                          {daySlots.map((slot) => (
                            <div
                              key={slot.id}
                              className="flex flex-col gap-2 border-2 border-black px-4 py-3 sm:flex-row sm:items-center sm:justify-between"
                            >
                              <div>
                                <p className="text-sm font-semibold">
                                  {new Date(slot.startAt).toLocaleTimeString([], {
                                    hour: "2-digit",
                                    minute: "2-digit",
                                  })}
                                </p>
                                <p className="text-xs text-[var(--ink-700)]">
                                  {slot.status} • ₹{slot.priceInr}
                                </p>
                                {slot.booking && (
                                  <p className="text-xs uppercase tracking-widest text-red-700">
                                    Booked by {slot.booking.learner?.name ?? "Learner"}
                                    {slot.booking.subscription ? " • Subscription" : ""}
                                  </p>
                                )}
                                {slot.booking?.subscription?.pauseUntil && (
                                  <p className="text-xs text-[var(--ink-700)]">
                                    Paused until:{" "}
                                    {new Date(
                                      slot.booking.subscription.pauseUntil,
                                    ).toLocaleDateString()}
                                  </p>
                                )}
                              </div>
                              {slot.booking?.subscription ? (
                                <div className="flex flex-wrap items-center gap-3">
                                  <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
                                    Pause weeks
                                    <select
                                      className="ink-border px-2 py-1 text-xs"
                                      value={pauseWeeks[slot.booking.subscription.id] ?? 1}
                                      onChange={(event) =>
                                        setPauseWeeks((prev) => ({
                                          ...prev,
                                          [slot.booking!.subscription!.id]: Number(
                                            event.target.value,
                                          ),
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
                                    className="px-4 py-2"
                                    loading={actionLoading === slot.booking.subscription.id}
                                    onClick={() =>
                                      pauseSubscription(slot.booking!.subscription!.id)
                                    }
                                  >
                                    Pause
                                  </InkButton>
                                  <InkButton
                                    className="px-4 py-2"
                                    loading={actionLoading === slot.booking.subscription.id}
                                    onClick={() =>
                                      resumeSubscription(slot.booking!.subscription!.id)
                                    }
                                  >
                                    Resume
                                  </InkButton>
                                </div>
                              ) : (
                                <InkButton
                                  className="px-4 py-2"
                                  onClick={() => toggleSlot(slot)}
                                  disabled={
                                    slot.status === "BOOKED" ||
                                    slot.status === "RESERVED" ||
                                    Boolean(slot.booking) ||
                                    slot.mode === "RECURRING"
                                  }
                                  title={
                                    slot.mode === "RECURRING"
                                      ? "Recurring slots cannot be blocked"
                                      : slot.status === "BOOKED" ||
                                        slot.status === "RESERVED" ||
                                        slot.booking
                                      ? "Cannot block a booked/reserved slot"
                                      : "Block/unblock this slot"
                                  }
                                >
                                  {slot.status === "BLOCKED" ? "Unblock" : "Block"}
                                </InkButton>
                              )}
                            </div>
                          ))}
                        </div>
                      </div>
                    ))}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      </section>
    </div>
  );
}
