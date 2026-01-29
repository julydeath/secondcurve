"use client";

import { useEffect } from "react";
import { useRouter } from "next/navigation";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function AuthSuccess() {
  const router = useRouter();

  useEffect(() => {
    const fetchMe = async () => {
      const response = await fetch(`${apiUrl}/auth/me`, {
        credentials: "include",
      });
      if (!response.ok) {
        router.replace("/auth/sign-in");
        return;
      }
      const data = (await response.json()) as {
        user: { role: "MENTOR" | "LEARNER" | "ADMIN" };
      };
      if (data.user.role === "MENTOR") {
        router.replace("/mentor");
      } else if (data.user.role === "ADMIN") {
        router.replace("/admin");
      } else {
        router.replace("/learner");
      }
    };

    fetchMe();
  }, [router]);

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
