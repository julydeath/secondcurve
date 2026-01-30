"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import InkButton from "@/components/InkButton";
import DataTable from "@/components/DataTable";
import { useToast } from "@/components/ToastProvider";
import { apiUrl, fetchJson } from "@/lib/api";

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
    mode?: "ONE_TIME" | "RECURRING";
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

type Links = { googleLinked: boolean; linkedinLinked: boolean; googleCalendarLinked?: boolean };

export default function LearnerBookings() {
  const { pushToast } = useToast();
  const queryClient = useQueryClient();
  const [pauseWeeks, setPauseWeeks] = useState<Record<string, number>>({});

  const bookingsQuery = useQuery({
    queryKey: ["bookings", "me"],
    queryFn: () => fetchJson<{ bookings: Booking[] }>("/bookings/me"),
  });

  const subscriptionsQuery = useQuery({
    queryKey: ["subscriptions", "me"],
    queryFn: () => fetchJson<{ subscriptions: Subscription[] }>("/subscriptions/me"),
  });

  const linksQuery = useQuery({
    queryKey: ["auth", "links"],
    queryFn: () => fetchJson<Links>("/auth/links"),
  });

  const cancelSubscription = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/subscriptions/${id}/cancel`, { method: "POST" }),
    onSuccess: async () => {
      pushToast("Subscription canceled", "info");
      await queryClient.invalidateQueries({ queryKey: ["subscriptions", "me"] });
    },
    onError: () => pushToast("Unable to cancel subscription", "error"),
  });

  const pauseSubscription = useMutation({
    mutationFn: ({ id, weeks }: { id: string; weeks: number }) =>
      fetchJson(`/subscriptions/${id}/pause`, {
        method: "POST",
        json: { weeks },
      }),
    onSuccess: async () => {
      pushToast("Subscription paused", "success");
      await queryClient.invalidateQueries({ queryKey: ["subscriptions", "me"] });
    },
    onError: () => pushToast("Unable to pause subscription", "error"),
  });

  const resumeSubscription = useMutation({
    mutationFn: (id: string) =>
      fetchJson(`/subscriptions/${id}/resume`, { method: "POST" }),
    onSuccess: async () => {
      pushToast("Subscription resumed", "success");
      await queryClient.invalidateQueries({ queryKey: ["subscriptions", "me"] });
    },
    onError: () => pushToast("Unable to resume subscription", "error"),
  });

  const addToCalendar = useMutation({
    mutationFn: (bookingId: string) =>
      fetchJson<{ synced: boolean; mentorAdded?: boolean; learnerAdded?: boolean }>(
        `/bookings/${bookingId}/sync-calendar`,
        { method: "POST" },
      ),
    onSuccess: () => pushToast("Added to Google Calendar", "success"),
    onError: () => {
      pushToast("Calendar not linked. Please connect Google Calendar.", "error");
      setTimeout(() => {
        window.location.href = `${apiUrl}/auth/google/start?calendar=1&link=1`;
      }, 600);
    },
  });

  const bookings = bookingsQuery.data?.bookings ?? [];
  const subscriptions = subscriptionsQuery.data?.subscriptions ?? [];
  const links = linksQuery.data;

  const bookingColumns = useMemo<ColumnDef<Booking>[]>(
    () => [
      {
        header: "Session",
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-semibold">{row.original.mentor.name}</p>
            <p className="text-xs text-[var(--ink-700)]">
              {row.original.availabilitySlot?.rule?.title ?? "One-time"}
            </p>
          </div>
        ),
      },
      {
        header: "Date",
        cell: ({ row }) => (
          <div>
            <p>{new Date(row.original.scheduledStartAt).toLocaleDateString()}</p>
            <p className="text-xs text-[var(--ink-700)]">
              {new Date(row.original.scheduledStartAt).toLocaleTimeString([], {
                hour: "2-digit",
                minute: "2-digit",
              })}
            </p>
          </div>
        ),
      },
      {
        header: "Price",
        accessorFn: (row) => `₹${row.priceInr}`,
      },
      {
        header: "Status",
        cell: ({ row }) => {
          const booking = row.original;
          const label =
            booking.status === "CANCELED"
              ? "Cancelled"
              : booking.payment?.status === "CAPTURED"
              ? "Paid"
              : "Reserved";
          const tone =
            booking.status === "CANCELED"
              ? "bg-red-100 text-red-900 border-red-900"
              : booking.payment?.status === "CAPTURED"
              ? "bg-green-100 text-green-900 border-green-900"
              : "bg-yellow-100 text-yellow-900 border-yellow-900";
          return <span className={`chip ${tone}`}>{label}</span>;
        },
      },
      {
        header: "Meeting",
        cell: ({ row }) => (
          <div className="flex flex-col gap-2">
            <InkButton
              disabled={
                row.original.payment?.status !== "CAPTURED" ||
                !row.original.meetingLink
              }
              onClick={() => {
                if (!row.original.meetingLink) return;
                window.open(row.original.meetingLink, "_blank", "noopener,noreferrer");
              }}
            >
              Join
            </InkButton>
            <InkButton
              onClick={() => addToCalendar.mutate(row.original.id)}
              disabled={row.original.payment?.status !== "CAPTURED"}
            >
              Add to Calendar
            </InkButton>
          </div>
        ),
      },
      {
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex flex-col gap-2">
            <InkButton
              disabled={row.original.payment?.status !== "CAPTURED"}
              onClick={async () => {
                const response = await fetch(
                  `${apiUrl}/bookings/${row.original.id}/receipt`,
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
                link.download = `wisdombridge-receipt-${row.original.id}.txt`;
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
                window.location.href = `/mentors/${row.original.mentor.id}`;
              }}
            >
              View Mentor
            </InkButton>
          </div>
        ),
      },
    ],
    [addToCalendar, pushToast],
  );

  const subscriptionColumns = useMemo<ColumnDef<Subscription>[]>(
    () => [
      {
        header: "Plan",
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-semibold">
              {row.original.availabilityRule?.title ?? "Recurring Mentoring"}
            </p>
            <p className="text-xs text-[var(--ink-700)]">
              ₹{row.original.priceInr} / week
            </p>
          </div>
        ),
      },
      {
        header: "Status",
        accessorKey: "status",
      },
      {
        header: "Next Charge",
        cell: ({ row }) =>
          row.original.nextChargeAt
            ? new Date(row.original.nextChargeAt).toLocaleDateString()
            : "—",
      },
      {
        header: "Paused Until",
        cell: ({ row }) =>
          row.original.pauseUntil
            ? new Date(row.original.pauseUntil).toLocaleDateString()
            : "—",
      },
      {
        header: "Actions",
        cell: ({ row }) => (
          <div className="flex flex-wrap gap-2">
            <label className="flex items-center gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
              Pause weeks
              <select
                className="ink-border px-2 py-1 text-xs"
                value={pauseWeeks[row.original.id] ?? 1}
                onChange={(event) =>
                  setPauseWeeks((prev) => ({
                    ...prev,
                    [row.original.id]: Number(event.target.value),
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
              loading={pauseSubscription.isPending}
              onClick={() =>
                pauseSubscription.mutate({
                  id: row.original.id,
                  weeks: pauseWeeks[row.original.id] ?? 1,
                })
              }
            >
              Pause
            </InkButton>
            <InkButton
              loading={resumeSubscription.isPending}
              onClick={() => resumeSubscription.mutate(row.original.id)}
            >
              Resume
            </InkButton>
            <InkButton
              loading={cancelSubscription.isPending}
              onClick={() => cancelSubscription.mutate(row.original.id)}
            >
              Cancel
            </InkButton>
          </div>
        ),
      },
    ],
    [pauseWeeks, pauseSubscription, resumeSubscription, cancelSubscription],
  );

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
          {links?.googleCalendarLinked
            ? "Calendar Connected"
            : "Connect Calendar"}
        </InkButton>
      </div>

      <section className="space-y-3">
        <h3 className="newsprint-title text-sm">All Bookings</h3>
        <DataTable
          data={bookings}
          columns={bookingColumns}
          emptyState={
            bookingsQuery.isLoading ? "Loading bookings..." : "No bookings yet."
          }
        />
      </section>

      <section className="space-y-3">
        <h3 className="newsprint-title text-sm">Subscriptions</h3>
        <DataTable
          data={subscriptions}
          columns={subscriptionColumns}
          emptyState={
            subscriptionsQuery.isLoading
              ? "Loading subscriptions..."
              : "No subscriptions yet."
          }
        />
      </section>
    </div>
  );
}
