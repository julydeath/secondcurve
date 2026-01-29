import Link from "next/link";
import RoleGate from "@/components/RoleGate";

export default function LearnerLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theme-newsprint">
      <RoleGate allowed={["LEARNER"]}>
        <header className="paper-texture ink-border mx-auto max-w-6xl px-6 py-8">
          <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="newsprint-title text-xs">Learner Desk</p>
              <h1 className="newsprint-title mt-2 text-3xl">
                Find mentors who match your goals
              </h1>
              <p className="mt-2 text-sm text-[var(--ink-700)]">
                Premium 1:1 guidance with instant booking and transparent pricing.
              </p>
            </div>
            <nav className="flex flex-wrap gap-3 text-xs uppercase tracking-widest">
              <Link className="chip chip-button" href="/learner">
                Dashboard
              </Link>
              <Link className="chip chip-button" href="/learner/search">
                Search
              </Link>
              <Link className="chip chip-button" href="/learner/bookings">
                Bookings
              </Link>
              <Link className="chip chip-button" href="/learner/profile">
                Profile
              </Link>
            </nav>
          </div>
        </header>
        <main className="mx-auto max-w-6xl px-6 pb-14">{children}</main>
      </RoleGate>
    </div>
  );
}
