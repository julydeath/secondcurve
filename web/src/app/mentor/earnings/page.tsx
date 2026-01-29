"use client";

import { useEffect, useState } from "react";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Payout = {
  id: string;
  amountInr: number;
  status: string;
  scheduledFor?: string | null;
  processedAt?: string | null;
  createdAt: string;
};

export default function MentorEarnings() {
  const [payouts, setPayouts] = useState<Payout[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`${apiUrl}/mentors/me/payouts`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = (await response.json()) as { payouts: Payout[] };
        setPayouts(data.payouts);
      }
      setLoading(false);
    };
    load();
  }, []);

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

      <div className="ink-border divide-y-2 divide-black">
        {loading && (
          <div className="p-6 space-y-3">
            {Array.from({ length: 3 }).map((_, index) => (
              <div key={`payout-skel-${index}`} className="space-y-2">
                <div className="skeleton skeleton-line w-1/3" />
                <div className="skeleton skeleton-line w-1/2" />
              </div>
            ))}
          </div>
        )}
        {!loading && payouts.length === 0 && (
          <div className="px-5 py-4 text-sm text-[var(--ink-700)]">
            No payouts yet.
          </div>
        )}
        {payouts.map((payout) => (
          <div
            key={payout.id}
            className="flex flex-col gap-2 px-5 py-4 sm:flex-row sm:items-center sm:justify-between"
          >
            <div>
              <p className="text-base font-semibold">
                {new Date(payout.createdAt).toLocaleDateString()}
              </p>
              <p className="text-sm text-[var(--ink-700)]">
                Scheduled:{" "}
                {payout.scheduledFor
                  ? new Date(payout.scheduledFor).toLocaleDateString()
                  : "—"}
              </p>
            </div>
            <div className="flex items-center gap-3">
              <span className="text-lg font-semibold">₹{payout.amountInr}</span>
              <span className="chip">{payout.status}</span>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
}
