export default function AboutPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 space-y-8">
      <header className="ink-border paper-texture p-6">
        <p className="newsprint-title text-xs">About Us</p>
        <h1 className="newsprint-title mt-2 text-3xl">
          WisdomBridge connects India’s experienced retirees with ambitious
          learners.
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-700)]">
          We’re building the most trusted 1:1 mentoring marketplace for
          professionals and students across India.
        </p>
      </header>

      <section className="ink-border p-6 space-y-4">
        <p className="text-sm text-[var(--ink-700)]">
          Mentors set their own pricing, availability, and meeting tools.
          Learners get personalized guidance from experts who have lived the
          journey.
        </p>
        <p className="text-sm text-[var(--ink-700)]">
          Our mission is to create a respectful, senior-friendly platform that
          gives every learner access to wisdom and clarity.
        </p>
      </section>
    </div>
  );
}
