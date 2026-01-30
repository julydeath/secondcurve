"use client";

import Link from "next/link";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api";

type UserRole = "MENTOR" | "LEARNER" | "ADMIN";

export default function ProfilePage() {
  const userQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => fetchJson<{ user: { name: string; role: UserRole } }>("/auth/me"),
  });

  if (userQuery.isLoading || !userQuery.data) {
    return (
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="ink-border paper-texture p-6">
          <p className="newsprint-title text-xs">Loading</p>
          <p className="mt-2 text-sm text-[var(--ink-700)]">
            Checking your account.
          </p>
        </div>
      </div>
    );
  }

  const user = userQuery.data.user;

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 space-y-6">
      <header className="ink-border paper-texture p-6">
        <p className="newsprint-title text-xs">Profile</p>
        <h1 className="newsprint-title mt-2 text-3xl">{user.name}</h1>
        <p className="mt-2 text-sm text-[var(--ink-700)]">{user.role}</p>
      </header>
      <div className="ink-border p-6">
        {user.role === "MENTOR" && (
          <Link className="chip chip-button" href="/mentor/profile">
            Edit Mentor Profile
          </Link>
        )}
        {user.role === "LEARNER" && (
          <Link className="chip chip-button" href="/learner/profile">
            Edit Learner Profile
          </Link>
        )}
      </div>
    </div>
  );
}
