"use client";

import { useEffect, useState } from "react";
import { useMutation, useQuery } from "@tanstack/react-query";
import InkButton from "@/components/InkButton";
import { useToast } from "@/components/ToastProvider";
import { fetchJson } from "@/lib/api";

export default function LearnerProfilePage() {
  const { pushToast } = useToast();
  const [name, setName] = useState("");
  const [goals, setGoals] = useState("");

  const profileQuery = useQuery({
    queryKey: ["learners", "me"],
    queryFn: () =>
      fetchJson<{
        learner: { name: string; learnerProfile?: { goals?: string | null } };
      }>("/learners/me"),
  });

  useEffect(() => {
    if (!profileQuery.data) return;
    setName(profileQuery.data.learner.name);
    setGoals(profileQuery.data.learner.learnerProfile?.goals ?? "");
  }, [profileQuery.data]);

  const save = useMutation({
    mutationFn: () =>
      fetchJson("/learners/me", {
        method: "PATCH",
        json: { name, goals },
      }),
    onSuccess: () => pushToast("Profile updated", "success"),
    onError: () => pushToast("Failed to save profile", "error"),
  });

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
        <InkButton loading={save.isPending} onClick={() => save.mutate()}>
          Save Profile
        </InkButton>
      </section>
    </div>
  );
}
