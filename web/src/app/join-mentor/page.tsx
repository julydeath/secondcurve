import InkButton from "@/components/InkButton";
import Link from "next/link";

export default function JoinMentorPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 space-y-8">
      <header className="ink-border paper-texture p-6">
        <p className="newsprint-title text-xs">Join as Mentor</p>
        <h1 className="newsprint-title mt-2 text-3xl">
          Share your experience. Guide the next generation.
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-700)]">
          WisdomBridge helps retired professionals earn and mentor with
          purpose. You choose your schedule, price, and topics.
        </p>
      </header>

      <section className="grid gap-6 md:grid-cols-3">
        {[
          "Set your own pricing and availability",
          "Work only with serious learners",
          "Weekly payouts and full support",
        ].map((item) => (
          <div key={item} className="stat-card p-6">
            <p className="newsprint-title text-xs">Benefit</p>
            <p className="mt-3 text-base">{item}</p>
          </div>
        ))}
      </section>

      <section className="ink-border p-6 space-y-4">
        <h2 className="newsprint-title text-sm">Ready to apply?</h2>
        <p className="text-sm text-[var(--ink-700)]">
          Sign up with Google and link LinkedIn. Our team verifies your profile
          within 48 hours.
        </p>
        <Link href="/auth/sign-up">
          <InkButton variant="solid">Start Mentor Application</InkButton>
        </Link>
      </section>
    </div>
  );
}
