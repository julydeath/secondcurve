"use client";

import { useState } from "react";
import Link from "next/link";
import { useToast } from "@/components/ToastProvider";

type Role = "MENTOR" | "LEARNER";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function SignUp() {
  const { pushToast } = useToast();
  const [role, setRole] = useState<Role | null>(null);

  return (
    <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        <h2 className="newsprint-title text-xl">Create Your Account</h2>
        <p className="text-sm text-[var(--ink-700)]">
          Choose your role and continue with Google or LinkedIn. Mentors are
          verified before going live.
        </p>
        <div className="ink-border p-5">
          <p className="newsprint-title text-xs">Choose Role</p>
          <div className="mt-4 flex flex-col gap-3 sm:flex-row">
            <button
              className={`ink-border w-full px-4 py-3 text-xs uppercase tracking-widest ${
                role === "MENTOR" ? "bg-black text-white" : ""
              }`}
              onClick={() => setRole("MENTOR")}
            >
              I am a Mentor
            </button>
            <button
              className={`ink-border w-full px-4 py-3 text-xs uppercase tracking-widest ${
                role === "LEARNER" ? "bg-black text-white" : ""
              }`}
              onClick={() => setRole("LEARNER")}
            >
              I am a Learner
            </button>
          </div>
        </div>
        <div className="space-y-4">
          <button
            className="ink-border w-full px-4 py-3 text-xs uppercase tracking-widest disabled:opacity-40"
            disabled={!role}
            onClick={() => {
              if (!role) return;
              pushToast("Redirecting to Google", "info");
              window.location.href = `${apiUrl}/auth/google/start?role=${role}`;
            }}
          >
            Continue with Google
          </button>
          <button
            className="ink-border w-full px-4 py-3 text-xs uppercase tracking-widest disabled:opacity-40"
            disabled={!role}
            onClick={() => {
              if (!role) return;
              pushToast("Redirecting to LinkedIn", "info");
              window.location.href = `${apiUrl}/auth/linkedin/start?role=${role}`;
            }}
          >
            Continue with LinkedIn
          </button>
        </div>
        <p className="text-xs uppercase tracking-widest text-[var(--ink-700)]">
          By continuing, you agree to our Terms & Privacy.
        </p>
      </div>

      <aside className="ink-border p-6">
        <p className="newsprint-title text-xs">Mentor Verification</p>
        <ul className="mt-4 space-y-3 text-sm text-[var(--ink-700)]">
          <li>• Google login is mandatory for mentors.</li>
          <li>• LinkedIn helps auto‑import experience.</li>
          <li>• KYC is required before payouts.</li>
        </ul>
        <Link
          href="/auth/sign-in"
          className="mt-6 inline-flex w-full items-center justify-center border-2 border-black px-4 py-3 text-xs uppercase tracking-widest"
        >
          Already have an account
        </Link>
      </aside>
    </div>
  );
}
