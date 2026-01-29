"use client";

import { useEffect, useState } from "react";
import InkButton from "@/components/InkButton";
import Image from "next/image";
import TagInput from "@/components/TagInput";
import { useToast } from "@/components/ToastProvider";

const apiUrl =
  process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type Profile = {
  name: string;
  headline?: string | null;
  linkedinHeadline?: string | null;
  linkedinUrl?: string | null;
  linkedinLocation?: string | null;
  linkedinIndustry?: string | null;
  currentCompany?: string | null;
  currentTitle?: string | null;
  bio?: string | null;
  yearsExperience?: number | null;
  expertiseTags?: string[];
  subjectTags?: string[];
  collectionTags?: string[];
  languages?: string[];
  profilePhotoUrl?: string | null;
};

export default function MentorProfile() {
  const { pushToast } = useToast();
  const [profile, setProfile] = useState<Profile>({
    name: "",
    headline: "",
    bio: "",
    yearsExperience: 0,
    expertiseTags: [],
    subjectTags: [],
    collectionTags: [],
    languages: [],
    profilePhotoUrl: "",
  });
  const [links, setLinks] = useState({
    linkedinLinked: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const load = async () => {
      const [meRes, linksRes] = await Promise.all([
        fetch(`${apiUrl}/auth/me`, { credentials: "include" }),
        fetch(`${apiUrl}/auth/links`, { credentials: "include" }),
      ]);
      if (meRes.ok) {
        const data = (await meRes.json()) as {
          user: {
            name: string;
            mentorProfile?: {
              headline?: string | null;
              linkedinHeadline?: string | null;
              linkedinUrl?: string | null;
              linkedinLocation?: string | null;
              linkedinIndustry?: string | null;
              currentCompany?: string | null;
              currentTitle?: string | null;
              bio?: string | null;
              yearsExperience?: number | null;
              expertiseTags?: string[];
              subjectTags?: string[];
              collectionTags?: string[];
              languages?: string[];
              profilePhotoUrl?: string | null;
            } | null;
          };
        };
        setProfile({
          name: data.user.name,
          headline: data.user.mentorProfile?.headline ?? "",
          linkedinHeadline: data.user.mentorProfile?.linkedinHeadline ?? "",
          linkedinUrl: data.user.mentorProfile?.linkedinUrl ?? "",
          linkedinLocation: data.user.mentorProfile?.linkedinLocation ?? "",
          linkedinIndustry: data.user.mentorProfile?.linkedinIndustry ?? "",
          currentCompany: data.user.mentorProfile?.currentCompany ?? "",
          currentTitle: data.user.mentorProfile?.currentTitle ?? "",
          bio: data.user.mentorProfile?.bio ?? "",
          yearsExperience: data.user.mentorProfile?.yearsExperience ?? 0,
          expertiseTags: data.user.mentorProfile?.expertiseTags ?? [],
          subjectTags: data.user.mentorProfile?.subjectTags ?? [],
          collectionTags: data.user.mentorProfile?.collectionTags ?? [],
          languages: data.user.mentorProfile?.languages ?? [],
          profilePhotoUrl: data.user.mentorProfile?.profilePhotoUrl ?? "",
        });
      }
      if (linksRes.ok) {
        const data = (await linksRes.json()) as {
          linkedinLinked: boolean;
        };
        setLinks({ linkedinLinked: data.linkedinLinked });
      }
    };
    load();
  }, []);

  const save = async () => {
    setSaving(true);
    setError(null);
    const payload: Record<string, unknown> = {};
    if (profile.bio && profile.bio.trim().length > 0) {
      payload.bio = profile.bio;
    }
    if (profile.yearsExperience && profile.yearsExperience > 0) {
      payload.yearsExperience = profile.yearsExperience;
    }
    if (profile.expertiseTags && profile.expertiseTags.length > 0) {
      payload.expertiseTags = profile.expertiseTags;
    }
    if (profile.subjectTags && profile.subjectTags.length > 0) {
      payload.subjectTags = profile.subjectTags;
    }
    if (profile.collectionTags && profile.collectionTags.length > 0) {
      payload.collectionTags = profile.collectionTags;
    }
    if (profile.languages && profile.languages.length > 0) {
      payload.languages = profile.languages;
    }
    if (profile.headline && profile.headline.trim().length > 0) {
      payload.headline = profile.headline;
    }
    const response = await fetch(`${apiUrl}/mentors/me`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      credentials: "include",
      body: JSON.stringify(payload),
    });
    if (!response.ok) {
      const data = (await response.json().catch(() => ({}))) as {
        error?: string;
      };
      setError(data.error ?? "Failed to save profile.");
      pushToast(data.error ?? "Failed to save profile", "error");
    } else {
      pushToast("Profile updated", "success");
    }
    setSaving(false);
  };

  return (
    <div className="space-y-6">
      <h2 className="newsprint-title text-xl">Mentor Profile</h2>
      <div className="ink-border p-6">
        <h3 className="newsprint-title text-sm">LinkedIn Profile</h3>
        <p className="mt-2 text-sm text-[var(--ink-700)]">
          Mentors must link LinkedIn so we can import experience and
          achievements.
        </p>
        <InkButton
          className="mt-4"
          onClick={() => {
            window.location.href = `${apiUrl}/auth/linkedin/start?role=MENTOR&link=1`;
          }}
        >
          {links.linkedinLinked ? "LinkedIn Connected" : "Connect LinkedIn"}
        </InkButton>
        <div className="mt-6 grid gap-4 md:grid-cols-2">
          <div className="border-2 border-black p-3">
            <p className="newsprint-title text-xs">Headline</p>
            <p className="mt-2 text-sm text-[var(--ink-700)]">
              {profile.linkedinHeadline || "Not available with current LinkedIn permissions."}
            </p>
          </div>
          <div className="border-2 border-black p-3">
            <p className="newsprint-title text-xs">Current Role</p>
            <p className="mt-2 text-sm text-[var(--ink-700)]">
              {profile.currentTitle || "Not available with current LinkedIn permissions."}
            </p>
          </div>
          <div className="border-2 border-black p-3">
            <p className="newsprint-title text-xs">Company</p>
            <p className="mt-2 text-sm text-[var(--ink-700)]">
              {profile.currentCompany || "Not available with current LinkedIn permissions."}
            </p>
          </div>
          <div className="border-2 border-black p-3">
            <p className="newsprint-title text-xs">Location / Industry</p>
            <p className="mt-2 text-sm text-[var(--ink-700)]">
              {[profile.linkedinLocation, profile.linkedinIndustry]
                .filter(Boolean)
                .join(" • ") || "Not available with current LinkedIn permissions."}
            </p>
          </div>
        </div>
      </div>
      <div className="ink-border p-6">
        <div className="grid gap-6 md:grid-cols-2">
          <label className="flex flex-col gap-2 text-sm">
            Full Name
            <input
              className="ink-border px-3 py-2"
              placeholder="R.K. Sharma"
              value={profile.name}
              onChange={(event) =>
                setProfile((prev) => ({
                  ...prev,
                  name: event.target.value,
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Headline
            <input
              className="ink-border px-3 py-2"
              placeholder="Retired Banker • Leadership Mentor"
              value={profile.headline ?? ""}
              onChange={(event) =>
                setProfile((prev) => ({
                  ...prev,
                  headline: event.target.value,
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-sm">
            Years of Experience
            <input
              className="ink-border px-3 py-2"
              placeholder="25"
              value={profile.yearsExperience ?? 0}
              onChange={(event) =>
                setProfile((prev) => ({
                  ...prev,
                  yearsExperience: Number(event.target.value),
                }))
              }
            />
          </label>
          <label className="flex flex-col gap-2 text-sm md:col-span-2">
            Bio (200–300 words)
            <textarea
              className="ink-border min-h-[140px] px-3 py-2"
              placeholder="Share your journey and the kind of guidance you offer."
              value={profile.bio ?? ""}
              onChange={(event) =>
                setProfile((prev) => ({
                  ...prev,
                  bio: event.target.value,
                }))
              }
            />
          </label>
          <TagInput
            label="Expertise Tags"
            value={profile.expertiseTags ?? []}
            onChange={(next) =>
              setProfile((prev) => ({
                ...prev,
                expertiseTags: next,
              }))
            }
            placeholder="Banking, Finance, Leadership"
          />
          <TagInput
            label="Subject Tags"
            value={profile.subjectTags ?? []}
            onChange={(next) =>
              setProfile((prev) => ({
                ...prev,
                subjectTags: next,
              }))
            }
            placeholder="Interview Prep, Business, Agriculture"
          />
          <TagInput
            label="Collections"
            value={profile.collectionTags ?? []}
            onChange={(next) =>
              setProfile((prev) => ({
                ...prev,
                collectionTags: next,
              }))
            }
            placeholder="Career Growth, Finance Basics"
          />
          <TagInput
            label="Languages"
            value={profile.languages ?? []}
            onChange={(next) =>
              setProfile((prev) => ({
                ...prev,
                languages: next,
              }))
            }
            placeholder="English, Hindi"
          />
        </div>
        {profile.profilePhotoUrl && (
          <div className="mt-6 border-2 border-black p-3">
            <p className="newsprint-title text-xs">Linked Profile Photo</p>
            <Image
              alt="LinkedIn profile"
              src={profile.profilePhotoUrl}
              width={80}
              height={80}
              className="mt-3 h-20 w-20 object-cover"
            />
          </div>
        )}
        <InkButton className="mt-6" onClick={save} loading={saving}>
          Save Profile
        </InkButton>
        {error && (
          <p className="mt-3 text-xs uppercase tracking-widest text-red-700">
            {error}
          </p>
        )}
      </div>
    </div>
  );
}
