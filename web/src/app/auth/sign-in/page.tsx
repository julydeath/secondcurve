"use client";

import Link from "next/link";
import { useToast } from "@/components/ToastProvider";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function SignIn() {
  const { pushToast } = useToast();
  return (
    <div className="grid gap-8 md:grid-cols-[1.2fr_0.8fr]">
      <div className="space-y-6">
        <h2 className="newsprint-title text-xl">Welcome Back</h2>
        <p className="text-sm text-[var(--ink-700)]">
          Use your Google or LinkedIn account to continue. We do not store any
          passwords.
        </p>
        <div className="space-y-4">
          <button
            className="ink-border w-full px-4 py-3 text-xs uppercase tracking-widest"
            onClick={() => {
              pushToast("Redirecting to Google", "info");
              window.location.href = `${apiUrl}/auth/google/start`;
            }}
          >
            Continue with Google
          </button>
          <button
            className="ink-border w-full px-4 py-3 text-xs uppercase tracking-widest"
            onClick={() => {
              pushToast("Redirecting to LinkedIn", "info");
              window.location.href = `${apiUrl}/auth/linkedin/start`;
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
        <p className="newsprint-title text-xs">Why Sign In</p>
        <ul className="mt-4 space-y-3 text-sm text-[var(--ink-700)]">
          <li>• Book and manage 1:1 sessions.</li>
          <li>• Track payouts, ratings, and history.</li>
          <li>• Access reminders and meeting links.</li>
        </ul>
        <Link
          href="/auth/sign-up"
          className="mt-6 inline-flex w-full items-center justify-center border-2 border-black bg-black px-4 py-3 text-xs uppercase tracking-widest text-white"
        >
          Create an Account
        </Link>
      </aside>
    </div>
  );
}
