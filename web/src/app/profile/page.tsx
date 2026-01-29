"use client";

import { useEffect, useState } from "react";
import Link from "next/link";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type UserRole = "MENTOR" | "LEARNER" | "ADMIN";

export default function ProfilePage() {
  const [user, setUser] = useState<{ name: string; role: UserRole } | null>(
    null
  );

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`${apiUrl}/auth/me`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = (await response.json()) as {
          user: { name: string; role: UserRole };
        };
        setUser(data.user);
      }
    };
    load();
  }, []);

  if (!user) {
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
