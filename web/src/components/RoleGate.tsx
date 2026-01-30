"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api";

type Role = "MENTOR" | "LEARNER" | "ADMIN";

export default function RoleGate({
  allowed,
  children,
}: {
  allowed: Role[];
  children: React.ReactNode;
}) {
  const [ready, setReady] = useState(false);
  const router = useRouter();

  const authQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () => fetchJson<{ user: { role: Role } }>("/auth/me"),
    retry: false,
  });

  useEffect(() => {
    if (authQuery.isLoading) return;
    if (authQuery.isError) {
      router.replace("/auth/sign-in");
      return;
    }
    if (authQuery.data && !allowed.includes(authQuery.data.user.role)) {
      router.replace("/");
      return;
    }
    if (authQuery.data) {
      setReady(true);
    }
  }, [authQuery.data, authQuery.isError, authQuery.isLoading, allowed, router]);

  if (!ready) {
    return (
      <div className="ink-border paper-texture p-6">
        <p className="newsprint-title text-xs">Checking access</p>
        <p className="mt-2 text-sm text-[var(--ink-700)]">
          Please wait while we verify your role.
        </p>
      </div>
    );
  }

  return <>{children}</>;
}
