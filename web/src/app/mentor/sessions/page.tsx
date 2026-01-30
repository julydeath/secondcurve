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

export default function MentorSessions() {
  const { pushToast } = useToast();
  const [linkDrafts, setLinkDrafts] = useState<Record<string, string>>({});

  const sessionsQuery = useQuery({
    queryKey: ["bookings", "me", "mentor"],
    queryFn: () => fetchJson<{ bookings: Booking[] }>("/bookings/me?as=MENTOR"),
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

  const sessions = useMemo(() => {
    const data = sessionsQuery.data?.bookings ?? [];
    return [...data].sort(
      (a, b) =>
        new Date(b.scheduledStartAt).getTime() -
        new Date(a.scheduledStartAt).getTime(),
    );
  }, [sessionsQuery.data]);

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
    <div className="space-y-6">
      <h2 className="newsprint-title text-xl">All Sessions</h2>
      <DataTable
        data={sessions}
        columns={columns}
        emptyState={
          sessionsQuery.isLoading
            ? "Loading sessions..."
            : "No sessions yet."
        }
      />
    </div>
  );
}
