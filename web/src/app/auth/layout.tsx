import Link from "next/link";

export default function AuthLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div className="theme-newsprint">
      <div className="mx-auto max-w-6xl px-6 py-12">
        <div className="ink-border paper-texture px-6 py-10">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
            <div>
              <p className="newsprint-title text-xs">Account Desk</p>
              <h1 className="newsprint-title mt-2 text-3xl">
                Sign in or create your account
              </h1>
              <p className="mt-2 text-sm text-[var(--ink-700)]">
                Only Google and LinkedIn are supported for now.
              </p>
            </div>
            <Link className="chip" href="/">
              Back to Home
            </Link>
          </div>
          <div className="ink-divider my-8" />
          {children}
        </div>
      </div>
    </div>
  );
}
