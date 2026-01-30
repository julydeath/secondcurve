"use client";

import { useMemo } from "react";
import { ColumnDef } from "@tanstack/react-table";
import { useQuery } from "@tanstack/react-query";
import DataTable from "@/components/DataTable";
import { fetchJson } from "@/lib/api";

type Payout = {
  id: string;
  amountInr: number;
  status: string;
  scheduledFor?: string | null;
  processedAt?: string | null;
  createdAt: string;
};

export default function MentorEarnings() {
  const payoutsQuery = useQuery({
    queryKey: ["mentors", "payouts"],
    queryFn: () => fetchJson<{ payouts: Payout[] }>("/mentors/me/payouts"),
  });

  const payouts = payoutsQuery.data?.payouts ?? [];
  const now = new Date();
  const monthStart = new Date(now.getFullYear(), now.getMonth(), 1);
  const monthTotal = payouts
    .filter((p) => p.processedAt)
    .filter((p) => new Date(p.processedAt!).getTime() >= monthStart.getTime())
    .reduce((sum, p) => sum + p.amountInr, 0);

  const avgSession =
    payouts.length > 0
      ? Math.round(
          payouts.reduce((sum, p) => sum + p.amountInr, 0) / payouts.length,
        )
      : 0;

  const nextPayout = payouts
    .filter((p) => p.status === "SCHEDULED" || p.status === "PROCESSING")
    .sort((a, b) => {
      const aTime = a.scheduledFor
        ? new Date(a.scheduledFor).getTime()
        : new Date(a.createdAt).getTime();
      const bTime = b.scheduledFor
        ? new Date(b.scheduledFor).getTime()
        : new Date(b.createdAt).getTime();
      return aTime - bTime;
    })[0];

  const columns = useMemo<ColumnDef<Payout>[]>(
    () => [
      {
        header: "Created",
        cell: ({ row }) => new Date(row.original.createdAt).toLocaleDateString(),
      },
      {
        header: "Scheduled",
        cell: ({ row }) =>
          row.original.scheduledFor
            ? new Date(row.original.scheduledFor).toLocaleDateString()
            : "—",
      },
      {
        header: "Amount",
        cell: ({ row }) => `₹${row.original.amountInr}`,
      },
      {
        header: "Status",
        accessorKey: "status",
      },
    ],
    [],
  );

  return (
    <div className="space-y-6">
      <h2 className="newsprint-title text-xl">Earnings & Payouts</h2>
      <div className="grid gap-6 md:grid-cols-3">
        <div className="stat-card p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--ink-700)]">
            This Month
          </p>
          <p className="mt-3 text-3xl font-semibold">₹{monthTotal}</p>
        </div>
        <div className="stat-card p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--ink-700)]">
            Avg Session
          </p>
          <p className="mt-3 text-3xl font-semibold">₹{avgSession}</p>
        </div>
        <div className="stat-card p-6">
          <p className="text-xs uppercase tracking-[0.2em] text-[var(--ink-700)]">
            Next Payout
          </p>
          <p className="mt-3 text-3xl font-semibold">
            {nextPayout?.scheduledFor
              ? new Date(nextPayout.scheduledFor).toLocaleDateString()
              : "—"}
          </p>
        </div>
      </div>

      <DataTable
        data={payouts}
        columns={columns}
        emptyState={
          payoutsQuery.isLoading ? "Loading payouts..." : "No payouts yet."
        }
      />
    </div>
  );
}
