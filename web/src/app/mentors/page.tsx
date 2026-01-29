/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
"use client";

import { useEffect, useState } from "react";
import InkButton from "@/components/InkButton";
import { useToast } from "@/components/ToastProvider";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Mentor = {
  id: string;
  name: string;
  mentorProfile?: {
    headline?: string | null;
    ratingAvg: number;
    ratingCount: number;
    expertiseTags: string[];
    languages: string[];
    yearsExperience: number;
    profilePhotoUrl?: string | null;
  } | null;
};

export default function MentorsPage() {
  const { pushToast } = useToast();
  const [mentors, setMentors] = useState<Mentor[]>([]);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState({
    expertise: "",
    subject: "",
    collection: "",
    minPrice: "",
    maxPrice: "",
    language: "",
    minExperience: "",
    minRating: "",
  });

  const load = async () => {
    setLoading(true);
    const params = new URLSearchParams();
    if (filters.expertise) params.set("expertise", filters.expertise);
    if (filters.subject) params.set("subject", filters.subject);
    if (filters.collection) params.set("collection", filters.collection);
    if (filters.minPrice) params.set("minPrice", filters.minPrice);
    if (filters.maxPrice) params.set("maxPrice", filters.maxPrice);
    if (filters.language) params.set("language", filters.language);
    if (filters.minExperience)
      params.set("minExperience", filters.minExperience);
    if (filters.minRating) params.set("minRating", filters.minRating);

    const response = await fetch(`${apiUrl}/mentors?${params.toString()}`);
    if (response.ok) {
      const data = (await response.json()) as { mentors: Mentor[] };
      setMentors(data.mentors);
    } else {
      pushToast("Unable to load mentors", "error");
    }
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <div className="mx-auto max-w-6xl px-6 py-12 space-y-8">
      <header className="ink-border paper-texture p-6">
        <p className="newsprint-title text-xs">Mentor Directory</p>
        <h1 className="newsprint-title mt-2 text-3xl">
          Find experienced mentors across India
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-700)]">
          Filter by expertise, language, price, or rating.
        </p>
      </header>

      <section className="ink-border p-6">
        <div className="grid gap-4 md:grid-cols-3">
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
            Expertise
            <input
              className="ink-border px-3 py-2 text-sm"
              value={filters.expertise}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, expertise: event.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
            Subject
            <input
              className="ink-border px-3 py-2 text-sm"
              value={filters.subject}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, subject: event.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
            Collection
            <input
              className="ink-border px-3 py-2 text-sm"
              value={filters.collection}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  collection: event.target.value,
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
            Price Min
            <input
              className="ink-border px-3 py-2 text-sm"
              value={filters.minPrice}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, minPrice: event.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
            Price Max
            <input
              className="ink-border px-3 py-2 text-sm"
              value={filters.maxPrice}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, maxPrice: event.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
            Language
            <input
              className="ink-border px-3 py-2 text-sm"
              value={filters.language}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, language: event.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
            Experience (years)
            <input
              className="ink-border px-3 py-2 text-sm"
              value={filters.minExperience}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  minExperience: event.target.value,
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
            Rating
            <input
              className="ink-border px-3 py-2 text-sm"
              value={filters.minRating}
              onChange={(event) =>
                setFilters((prev) => ({
                  ...prev,
                  minRating: event.target.value,
                }))
              }
            />
          </label>
        </div>
        <InkButton
          className="mt-6"
          onClick={async () => {
            await load();
            pushToast("Filters applied", "success");
          }}
        >
          Apply Filters
        </InkButton>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {loading &&
          Array.from({ length: 4 }).map((_, index) => (
            <div key={`skeleton-${index}`} className="ink-border p-6 space-y-4">
              <div className="skeleton skeleton-line w-2/3" />
              <div className="skeleton skeleton-line w-1/2" />
              <div className="flex gap-2">
                <div className="skeleton skeleton-line w-16" />
                <div className="skeleton skeleton-line w-20" />
                <div className="skeleton skeleton-line w-14" />
              </div>
              <div className="skeleton skeleton-line w-24" />
            </div>
          ))}
        {!loading &&
          mentors.map((mentor) => (
            <div key={mentor.id} className="ink-border p-6">
              <div className="flex items-start justify-between gap-4">
                <div>
                  <p className="text-lg font-semibold">{mentor.name}</p>
                  <p className="text-sm text-[var(--ink-700)]">
                    {mentor.mentorProfile?.headline ?? "Experienced mentor"}
                  </p>
                </div>
                <span className="chip">
                  {mentor.mentorProfile?.ratingAvg?.toFixed(1) ?? "0.0"} ★
                </span>
              </div>
              <div className="mt-4 flex flex-wrap gap-2">
                {(mentor.mentorProfile?.expertiseTags ?? []).slice(0, 4).map((tag) => (
                  <span key={tag} className="chip">
                    {tag}
                  </span>
                ))}
              </div>
              <div className="mt-4 flex items-center justify-between">
                <p className="text-xs uppercase tracking-widest text-[var(--ink-700)]">
                  {mentor.mentorProfile?.yearsExperience ?? 0}+ years
                </p>
                <InkButton
                  onClick={() => {
                    window.location.href = `/mentors/${mentor.id}`;
                  }}
                >
                  View Profile
                </InkButton>
              </div>
            </div>
          ))}
      </section>
    </div>
  );
}
