"use client";

import { useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery } from "@tanstack/react-query";
import InkButton from "@/components/InkButton";
import DataTable from "@/components/DataTable";
import { useToast } from "@/components/ToastProvider";
import { apiUrl, fetchJson } from "@/lib/api";

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

  const bookingsQuery = useQuery({
    queryKey: ["bookings", "me"],
    queryFn: () => fetchJson<{ bookings: Booking[] }>("/bookings/me"),
  });

  const subscriptionsQuery = useQuery({
    queryKey: ["subscriptions", "me"],
    queryFn: () => fetchJson<{ subscriptions: Subscription[] }>("/subscriptions/me"),
  });

  const addToCalendar = useMutation({
    mutationFn: (bookingId: string) =>
      fetchJson(`/bookings/${bookingId}/sync-calendar`, { method: "POST" }),
    onSuccess: () => pushToast("Added to Google Calendar", "success"),
    onError: () => {
      pushToast("Calendar not linked. Please connect Google Calendar.", "error");
      setTimeout(() => {
        window.location.href = `/learner/bookings`;
      }, 600);
    },
  });

  const bookings = bookingsQuery.data?.bookings ?? [];
  const subscriptions = subscriptionsQuery.data?.subscriptions ?? [];
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

  const columns = useMemo<ColumnDef<Booking>[]>(
    () => [
      {
        header: "Mentor",
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
        header: "Actions",
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
    ],
    [addToCalendar],
  );

  return (
    <div className="space-y-8">
      <section className="grid gap-6 md:grid-cols-3">
        {(bookingsQuery.isLoading || subscriptionsQuery.isLoading)
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

      <section className="space-y-3">
        <h2 className="newsprint-title text-sm">Upcoming Sessions</h2>
        <DataTable
          data={upcoming}
          columns={columns}
          emptyState={
            bookingsQuery.isLoading
              ? "Loading sessions..."
              : "No upcoming sessions yet."
          }
        />
      </section>
    </div>
  );
}
