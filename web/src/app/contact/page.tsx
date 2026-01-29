import InkButton from "@/components/InkButton";

export default function ContactPage() {
  return (
    <div className="mx-auto max-w-6xl px-6 py-12 space-y-8">
      <header className="ink-border paper-texture p-6">
        <p className="newsprint-title text-xs">Contact Us</p>
        <h1 className="newsprint-title mt-2 text-3xl">
          We’re here to help.
        </h1>
        <p className="mt-2 text-sm text-[var(--ink-700)]">
          Reach out for support, partnerships, or mentor onboarding.
        </p>
      </header>

      <section className="ink-border p-6 space-y-4">
        <label className="flex flex-col gap-2 text-sm">
          Name
          <input className="ink-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Email
          <input className="ink-border px-3 py-2" />
        </label>
        <label className="flex flex-col gap-2 text-sm">
          Message
          <textarea className="ink-border min-h-[140px] px-3 py-2" />
        </label>
        <InkButton>Send Message</InkButton>
      </section>
    </div>
  );
}
