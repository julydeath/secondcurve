"use client";

import { useEffect, useState } from "react";
import InkButton from "@/components/InkButton";
import { useToast } from "@/components/ToastProvider";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

export default function LearnerProfilePage() {
  const { pushToast } = useToast();
  const [name, setName] = useState("");
  const [goals, setGoals] = useState("");
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    const load = async () => {
      const response = await fetch(`${apiUrl}/learners/me`, {
        credentials: "include",
      });
      if (response.ok) {
        const data = (await response.json()) as {
          learner: { name: string; learnerProfile?: { goals?: string | null } };
        };
        setName(data.learner.name);
        setGoals(data.learner.learnerProfile?.goals ?? "");
      }
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    const response = await fetch(`${apiUrl}/learners/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify({ name, goals }),
    });
    if (!response.ok) {
      pushToast("Failed to save profile", "error");
    } else {
      pushToast("Profile updated", "success");
    }
    setSaving(false);
  };

  return (
    <div className="mx-auto max-w-6xl px-6 py-10 space-y-6">
      <header className="ink-border paper-texture p-6">
        <p className="newsprint-title text-xs">Learner Profile</p>
        <h1 className="newsprint-title mt-2 text-3xl">
          Update your preferences
        </h1>
      </header>

      <section className="ink-border p-6 space-y-4">
        <label className="flex flex-col gap-2 text-sm">
          Full Name
          <input
            className="ink-border px-3 py-2"
            value={name}
            onChange={(event) => setName(event.target.value)}
          />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Goals / Topics
          <textarea
            className="ink-border min-h-[140px] px-3 py-2"
            value={goals}
            onChange={(event) => setGoals(event.target.value)}
          />
        </label>
        <InkButton loading={saving} onClick={save}>
          Save Profile
        </InkButton>
      </section>
    </div>
  );
}
