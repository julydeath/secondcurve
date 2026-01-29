export default function SiteFooter() {
  return (
    <footer className="site-footer ink-border">
      <div className="mx-auto flex h-full max-w-6xl flex-col items-center justify-between gap-3 px-6 text-xs uppercase tracking-widest text-[var(--ink-700)] sm:flex-row">
        <span>WisdomBridge</span>
        <div className="flex flex-wrap items-center gap-4">
          <span>Mentor Marketplace • India</span>
          <span className="hidden sm:inline">|</span>
          <span>Help</span>
          <span>Contact</span>
          <span>Privacy</span>
          <span>Terms</span>
        </div>
      </div>
    </footer>
  );
}
