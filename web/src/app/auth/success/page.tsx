"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";
import { useQuery } from "@tanstack/react-query";
import { fetchJson } from "@/lib/api";

export default function AuthSuccess() {
  const router = useRouter();

  const meQuery = useQuery({
    queryKey: ["auth", "me"],
    queryFn: () =>
      fetchJson<{ user: { role: "MENTOR" | "LEARNER" | "ADMIN" } }>("/auth/me"),
    retry: false,
  });

  useEffect(() => {
    if (meQuery.isLoading) return;
    if (meQuery.isError) {
      router.replace("/auth/sign-in");
      return;
    }
    if (meQuery.data) {
      if (meQuery.data.user.role === "MENTOR") {
        router.replace("/mentor");
      } else if (meQuery.data.user.role === "ADMIN") {
        router.replace("/admin");
      } else {
        router.replace("/learner");
      }
    }
  }, [meQuery.data, meQuery.isError, meQuery.isLoading, router]);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12">
      <div className="ink-border paper-texture p-6">
        <p className="newsprint-title text-xs">Signing you in</p>
        <h1 className="newsprint-title mt-2 text-2xl">
          Please wait while we finish setup.
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-700)]">
          We are redirecting you to your dashboard.
        </p>
      </div>
    </div>
  );
}
