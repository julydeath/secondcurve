import Link from "next/link";
import RoleGate from "@/components/RoleGate";

export default function MentorLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theme-newsprint">
      <RoleGate allowed={["MENTOR"]}>
        <header className="paper-texture ink-border mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="newsprint-title text-xs">Mentor Desk</p>
              <h1 className="newsprint-title mt-2 text-3xl">
                WisdomBridge Mentor
              </h1>
              <p className="mt-2 text-sm text-[var(--ink-700)]">
                Large text. Clear actions. Zero clutter.
              </p>
            </div>
            <div className="flex flex-wrap gap-3 text-xs uppercase tracking-widest">
              <Link className="chip chip-button" href="/mentor">
                Overview
              </Link>
              <Link className="chip chip-button" href="/mentor/sessions">
                Sessions
              </Link>
              <Link className="chip chip-button" href="/mentor/availability">
                Availability
              </Link>
              <Link className="chip chip-button" href="/mentor/earnings">
                Earnings
              </Link>
              <Link className="chip chip-button" href="/mentor/profile">
                Profile
              </Link>
            </div>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 py-10">{children}</main>
      </RoleGate>
    </div>
  );
}
