import Link from "next/link";

export default function Home() {
  return (
    <div className="min-h-screen bg-[var(--paper-100)]">
      <main className="mx-auto flex max-w-6xl flex-col gap-10 px-6 py-12">
        <header className="paper-texture ink-border rounded-none px-6 py-8">
          <p className="newsprint-title text-xs">WisdomBridge Gazette</p>
          <h1 className="newsprint-title mt-3 text-3xl sm:text-5xl">
            1:1 Mentoring From India’s Most Experienced Professionals
          </h1>
          <p className="mt-4 max-w-2xl text-base leading-7 text-[var(--ink-700)] sm:text-lg">
            A simple, senior‑friendly platform where retired experts guide the
            next generation. Mentors host on their preferred video tool. We
            handle discovery, booking, and payouts.
          </p>
        </header>

        <section className="grid gap-6 md:grid-cols-3">
          <div className="stat-card paper-texture p-6">
            <p className="newsprint-title text-xs">Mentor Desk</p>
            <h2 className="mt-3 text-2xl font-semibold">
              Old‑school, calm, and easy
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-700)]">
              Large typography, high contrast, minimal clicks. Built for senior
              mentors who want clarity.
            </p>
            <Link
              href="/mentor"
              className="mt-6 inline-flex w-full items-center justify-center border-2 border-black bg-black px-4 py-3 text-sm font-semibold uppercase tracking-widest text-white"
            >
              Enter Mentor Dashboard
            </Link>
          </div>

          <div className="stat-card paper-texture p-6">
            <p className="newsprint-title text-xs">Learner Desk</p>
            <h2 className="mt-3 text-2xl font-semibold">
              Premium guidance, fast booking
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-700)]">
              Search, compare, book instantly. Track progress and keep your
              favorite mentors close.
            </p>
            <Link
              href="/learner"
              className="mt-6 inline-flex w-full items-center justify-center border-2 border-black bg-black px-4 py-3 text-sm font-semibold uppercase tracking-widest text-white"
            >
              Enter Learner Dashboard
            </Link>
          </div>

          <div className="ink-border p-6">
            <p className="newsprint-title text-xs">Admin Desk</p>
            <h2 className="mt-3 text-2xl font-semibold">
              Approvals, disputes, payouts
            </h2>
            <p className="mt-3 text-sm leading-6 text-[var(--ink-700)]">
              Review mentor profiles, monitor transactions, and close disputes
              with full audit trails.
            </p>
            <Link
              href="/admin"
              className="mt-6 inline-flex w-full items-center justify-center border-2 border-black px-4 py-3 text-sm font-semibold uppercase tracking-widest"
            >
              Enter Admin Panel
            </Link>
          </div>
        </section>
      </main>
    </div>
  );
}
