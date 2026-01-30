/* eslint-disable react-hooks/set-state-in-effect, react-hooks/exhaustive-deps */
"use client";

import { useMemo, useState } from "react";
import { useQuery } from "@tanstack/react-query";
import InkButton from "@/components/InkButton";
import { useToast } from "@/components/ToastProvider";
import { apiUrl, fetchJson } from "@/lib/api";

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
  const [appliedFilters, setAppliedFilters] = useState(filters);

  const queryKey = useMemo(() => ["mentors", appliedFilters], [appliedFilters]);

  const mentorsQuery = useQuery({
    queryKey,
    queryFn: async () => {
      const params = new URLSearchParams();
      if (appliedFilters.expertise) params.set("expertise", appliedFilters.expertise);
      if (appliedFilters.subject) params.set("subject", appliedFilters.subject);
      if (appliedFilters.collection) params.set("collection", appliedFilters.collection);
      if (appliedFilters.minPrice) params.set("minPrice", appliedFilters.minPrice);
      if (appliedFilters.maxPrice) params.set("maxPrice", appliedFilters.maxPrice);
      if (appliedFilters.language) params.set("language", appliedFilters.language);
      if (appliedFilters.minExperience)
        params.set("minExperience", appliedFilters.minExperience);
      if (appliedFilters.minRating) params.set("minRating", appliedFilters.minRating);

      return fetchJson<{ mentors: Mentor[] }>(`/mentors?${params.toString()}`);
    },
  });

  const mentors = mentorsQuery.data?.mentors ?? [];

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
                setFilters((prev) => ({ ...prev, collection: event.target.value }))
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
                setFilters((prev) => ({ ...prev, minExperience: event.target.value }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-xs uppercase tracking-widest text-[var(--ink-700)]">
            Rating
            <input
              className="ink-border px-3 py-2 text-sm"
              value={filters.minRating}
              onChange={(event) =>
                setFilters((prev) => ({ ...prev, minRating: event.target.value }))
              }
            />
          </label>
        </div>
        <InkButton
          className="mt-6"
          onClick={() => {
            setAppliedFilters(filters);
            pushToast("Filters applied", "success");
          }}
        >
          Apply Filters
        </InkButton>
      </section>

      <section className="grid gap-5 md:grid-cols-2">
        {mentorsQuery.isLoading &&
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
        {!mentorsQuery.isLoading && mentors.length === 0 && (
          <div className="ink-border p-6 text-sm text-[var(--ink-700)]">
            No mentors found.
          </div>
        )}
        {!mentorsQuery.isLoading &&
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
