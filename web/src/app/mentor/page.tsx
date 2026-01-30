"use client";

import { useMemo, useState } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useMutation, useQuery } from "@tanstack/react-query";
import InkButton from "@/components/InkButton";
import DataTable from "@/components/DataTable";
import { useToast } from "@/components/ToastProvider";
import { fetchJson } from "@/lib/api";

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
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});

  const bookingsQuery = useQuery({
    queryKey: ["bookings", "me", "mentor"],
    queryFn: () => fetchJson<{ bookings: Booking[] }>("/bookings/me?as=MENTOR"),
  });

  const payoutsQuery = useQuery({
    queryKey: ["mentors", "payouts"],
    queryFn: () => fetchJson<{ payouts: Payout[] }>("/mentors/me/payouts"),
  });

  const profileQuery = useQuery({
    queryKey: ["mentors", "me"],
    queryFn: () => fetchJson<{ mentor: { mentorProfile?: MentorProfile | null } }>("/mentors/me"),
  });

  const saveMeetingLink = useMutation({
    mutationFn: ({ id, link }: { id: string; link: string }) =>
      fetchJson(`/bookings/${id}/meeting-link`, {
        method: "PATCH",
        json: { meetingLink: link },
      }),
    onSuccess: () => pushToast("Meeting link saved", "success"),
    onError: () => pushToast("Failed to save meeting link", "error"),
  });

  const bookings = bookingsQuery.data?.bookings ?? [];
  const payouts = payoutsQuery.data?.payouts ?? [];
  const ratingAvg = profileQuery.data?.mentor.mentorProfile?.ratingAvg ?? 0;

  const now = Date.now();
  const upcoming = bookings.filter(
    (booking) => new Date(booking.scheduledStartAt).getTime() > now,
  );

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

  const columns = useMemo<ColumnDef<Booking>[]>(
    () => [
      {
        header: "Learner",
        cell: ({ row }) => (
          <div>
            <p className="text-sm font-semibold">{row.original.learner.name}</p>
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
        header: "Payment",
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
        header: "Meeting Link",
        cell: ({ row }) => (
          <div className="flex flex-col gap-2">
            <input
              className="ink-border px-3 py-2 text-xs"
              placeholder="Paste meeting link"
              value={linkDrafts[row.original.id] ?? row.original.meetingLink ?? ""}
              onChange={(event) =>
                setLinkDrafts((prev) => ({
                  ...prev,
                  [row.original.id]: event.target.value,
                }))
              }
            />
            <InkButton
              loading={saveMeetingLink.isPending}
              onClick={() =>
                saveMeetingLink.mutate({
                  id: row.original.id,
                  link: linkDrafts[row.original.id] ?? row.original.meetingLink ?? "",
                })
              }
            >
              Save Link
            </InkButton>
          </div>
        ),
      },
    ],
    [linkDrafts, saveMeetingLink],
  );

  return (
    <div className="space-y-10">
      <section className="grid gap-6 md:grid-cols-3">
        {(bookingsQuery.isLoading || payoutsQuery.isLoading || profileQuery.isLoading)
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
        <div className="flex items-center justify-between">
          <h2 className="newsprint-title text-lg">Upcoming Sessions</h2>
          <p className="text-sm text-[var(--ink-700)]">
            Please add your meeting links 2 hours before.
          </p>
        </div>
        <DataTable
          data={upcoming}
          columns={columns}
          emptyState={
            bookingsQuery.isLoading
              ? "Loading sessions..."
              : "No upcoming sessions."
          }
        />
      </section>
    </div>
  );
}
