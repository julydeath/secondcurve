/* eslint-disable react-hooks/set-state-in-effect */
"use client";

import { useEffect, useState } from "react";
import RoleGate from "@/components/RoleGate";
import InkButton from "@/components/InkButton";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Mentor = {
  id: string;
  name: string;
  email: string;
  mentorProfile?: {
    headline?: string | null;
    yearsExperience?: number;
    expertiseTags?: string[];
    subjectTags?: string[];
    collectionTags?: string[];
    approvedAt?: string | null;
  } | null;
};

const disputes = [
  { id: "#D-204", reason: "Late cancellation", status: "Open" },
  { id: "#D-205", reason: "No show", status: "In Review" },
];

export default function AdminPanel() {
  const [pendingMentors, setPendingMentors] = useState<Mentor[]>([]);
  const [approvedMentors, setApprovedMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    setError(null);
    const [pendingRes, approvedRes] = await Promise.all([
      fetch(`${apiUrl}/admin/mentors?status=pending`, {
        credentials: "include",
      }),
      fetch(`${apiUrl}/admin/mentors?status=approved`, {
        credentials: "include",
      }),
    ]);
    if (!pendingRes.ok || !approvedRes.ok) {
      setError("Not authorized or no data available.");
      setLoading(false);
      return;
    }
    if (pendingRes.ok) {
      const data = (await pendingRes.json()) as { mentors: Mentor[] };
      setPendingMentors(data.mentors);
    }
    if (approvedRes.ok) {
      const data = (await approvedRes.json()) as { mentors: Mentor[] };
      setApprovedMentors(data.mentors);
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const approve = async (mentorId: string) => {
    await fetch(`${apiUrl}/admin/mentors/${mentorId}/approve`, {
      method: "POST",
      credentials: "include",
    });
    await load();
  };

  return (
    <RoleGate allowed={["ADMIN"]}>
      <div className="bg-[var(--paper-100)] px-6 py-12">
        <div className="mx-auto flex max-w-6xl flex-col gap-10">
          <header className="ink-border paper-texture p-6">
            <p className="newsprint-title text-xs">Admin Desk</p>
            <h1 className="newsprint-title mt-2 text-3xl">
              Mentor Approval & Disputes
            </h1>
            <p className="mt-2 text-sm text-[var(--ink-700)]">
              Monitor transactions, approve mentors, and resolve disputes.
            </p>
          </header>

          <section className="grid gap-6 md:grid-cols-2">
            <div className="ink-border p-6">
              <h2 className="newsprint-title text-sm">Pending Approvals</h2>
              {error && (
                <p className="mt-3 text-xs uppercase tracking-widest text-red-700">
                  {error}
                </p>
              )}
              <div className="mt-4 space-y-4">
                {pendingMentors.length === 0 && (
                  <p className="text-sm text-[var(--ink-700)]">
                    No pending mentors. Ensure mentors completed their profile.
                  </p>
                )}
                {pendingMentors.map((item) => (
                  <div
                    key={item.id}
                    className="flex flex-col gap-2 border-2 border-black p-3"
                  >
                    <div>
                      <p className="text-base font-semibold">{item.name}</p>
                      <p className="text-xs text-[var(--ink-700)]">
                        {item.mentorProfile?.headline ?? "Mentor applicant"}
                      </p>
                      <p className="text-xs text-[var(--ink-700)]">
                        {item.email}
                      </p>
                    </div>
                    <div className="flex flex-wrap gap-2">
                      {(item.mentorProfile?.expertiseTags ?? [])
                        .slice(0, 3)
                        .map((tag) => (
                          <span key={tag} className="chip">
                            {tag}
                          </span>
                        ))}
                      {(item.mentorProfile?.subjectTags ?? [])
                        .slice(0, 2)
                        .map((tag) => (
                          <span key={tag} className="chip">
                            {tag}
                          </span>
                        ))}
                    </div>
                    <InkButton onClick={() => approve(item.id)}>
                      Approve
                    </InkButton>
                  </div>
                ))}
              </div>
            </div>

            <div className="ink-border p-6">
              <h2 className="newsprint-title text-sm">Open Disputes</h2>
              <div className="mt-4 space-y-4">
                {disputes.map((item) => (
                  <div
                    key={item.id}
                    className="flex items-center justify-between"
                  >
                    <div>
                      <p className="text-base font-semibold">{item.id}</p>
                      <p className="text-xs text-[var(--ink-700)]">
                        {item.reason}
                      </p>
                    </div>
                    <span className="chip">{item.status}</span>
                  </div>
                ))}
              </div>
            </div>
          </section>

          <section className="ink-border p-6">
            <div className="flex items-center justify-between">
              <h2 className="newsprint-title text-sm">Approved Mentors</h2>
              {loading && (
                <span className="text-xs text-[var(--ink-700)]">Loading...</span>
              )}
            </div>
            <div className="mt-4 grid gap-3 md:grid-cols-2">
              {approvedMentors.length === 0 && (
                <p className="text-sm text-[var(--ink-700)]">
                  No approved mentors yet.
                </p>
              )}
              {approvedMentors.map((mentor) => (
                <div
                  key={mentor.id}
                  className="border-2 border-black p-3"
                >
                  <p className="text-base font-semibold">{mentor.name}</p>
                  <p className="text-xs text-[var(--ink-700)]">
                    {mentor.mentorProfile?.headline ?? "Mentor"}
                  </p>
                </div>
              ))}
            </div>
          </section>
        </div>
      </div>
    </RoleGate>
  );
}
