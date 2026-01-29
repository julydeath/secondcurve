"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

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

  useEffect(() => {
    const check = async () => {
      const response = await fetch(`${apiUrl}/auth/me`, {
        credentials: "include",
      });
      if (!response.ok) {
        router.replace("/auth/sign-in");
        return;
      }
      const data = (await response.json()) as { user: { role: Role } };
      if (!allowed.includes(data.user.role)) {
        router.replace("/");
        return;
      }
      setReady(true);
    };
    check();
  }, [allowed, router]);

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
