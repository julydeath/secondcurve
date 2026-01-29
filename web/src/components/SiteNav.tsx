"use client";

import Link from "next/link";
import Image from "next/image";
import { useEffect, useRef, useState } from "react";

const apiUrl = process.env.NEXT_PUBLIC_API_URL ?? "http://localhost:4000";

type SessionState = {
  status: "loading" | "authenticated" | "anonymous";
  name?: string;
  role?: "MENTOR" | "LEARNER" | "ADMIN";
  email?: string;
  profilePhotoUrl?: string | null;
};

export default function SiteNav() {
  const [session, setSession] = useState<SessionState>({
    status: "loading",
  });

  const [open, setOpen] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const menuRef = useRef<HTMLDivElement | null>(null);

  useEffect(() => {
    const checkSession = async () => {
      try {
        const response = await fetch(`${apiUrl}/auth/me`, {
          credentials: "include",
        });
        if (response.ok) {
          const data = (await response.json()) as {
            user: {
              name: string;
              role: "MENTOR" | "LEARNER" | "ADMIN";
              email?: string;
              mentorProfile?: { profilePhotoUrl?: string | null } | null;
            };
          };
          setSession({
            status: "authenticated",
            name: data.user.name,
            role: data.user.role,
            email: data.user.email,
            profilePhotoUrl: data.user.mentorProfile?.profilePhotoUrl ?? null,
          });
          return;
        }
      } catch {
        // ignore
      }
      setSession({ status: "anonymous" });
    };

    checkSession();
  }, []);

  useEffect(() => {
    const handleClick = (event: MouseEvent) => {
      if (menuRef.current && !menuRef.current.contains(event.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener("click", handleClick);
    return () => document.removeEventListener("click", handleClick);
  }, []);

  const initials = (() => {
    if (session.name) {
      const parts = session.name.trim().split(" ");
      return ((parts[0]?.[0] ?? "") + (parts[1]?.[0] ?? parts[0]?.[1] ?? ""))
        .toUpperCase()
        .slice(0, 2);
    }
    if (session.email) {
      return session.email.slice(0, 2).toUpperCase();
    }
    return "WB";
  })();

  return (
    <header className="site-nav ink-border paper-texture bg-white sticky top-0 z-50">
      <div className="mx-auto flex h-full max-w-6xl items-center justify-between px-6">
        <Link href="/" className="newsprint-title text-sm">
          WisdomBridge
        </Link>
        <nav className="hidden flex-wrap items-center gap-3 text-xs uppercase tracking-widest md:flex">
          <Link className="chip chip-button" href="/">
            Home
          </Link>
          <Link className="chip chip-button" href="/mentors">
            Mentors
          </Link>
          <Link className="chip chip-button" href="/join-mentor">
            Join as Mentor
          </Link>
          <Link className="chip chip-button" href="/about">
            About Us
          </Link>
          <Link className="chip chip-button" href="/contact">
            Contact
          </Link>
          {session.status === "authenticated" ? (
            <div className="relative" ref={menuRef}>
              <button
                className="avatar-button"
                onClick={() => setOpen((prev) => !prev)}
              >
                {session.profilePhotoUrl ? (
                  <Image
                    alt="Profile"
                    src={session.profilePhotoUrl}
                    width={36}
                    height={36}
                    className="h-9 w-9 rounded-full object-cover"
                  />
                ) : (
                  <span className="avatar-initials">{initials}</span>
                )}
              </button>
              {open && (
                <div className="dropdown-panel">
                  <div className="dropdown-header">
                    <p className="text-sm font-semibold">
                      {session.name ?? "Account"}
                    </p>
                    <p className="text-xs text-[var(--ink-700)]">
                      {session.role ?? "USER"}
                    </p>
                  </div>
                  <div className="dropdown-actions">
                    {session.role === "MENTOR" && (
                      <Link className="dropdown-item" href="/mentor">
                        Dashboard
                      </Link>
                    )}
                    {session.role === "LEARNER" && (
                      <Link className="dropdown-item" href="/learner">
                        Dashboard
                      </Link>
                    )}
                    {session.role === "ADMIN" && (
                      <Link className="dropdown-item" href="/admin">
                        Admin
                      </Link>
                    )}
                    <Link className="dropdown-item" href="/profile">
                      Profile
                    </Link>
                    <button
                      className="dropdown-item"
                      onClick={async () => {
                        await fetch(`${apiUrl}/auth/logout`, {
                          method: "POST",
                          credentials: "include",
                        });
                        setSession({ status: "anonymous" });
                        window.location.href = "/";
                      }}
                    >
                      Logout
                    </button>
                  </div>
                </div>
              )}
            </div>
          ) : (
            <Link className="chip chip-button" href="/auth/sign-in">
              Sign In
            </Link>
          )}
        </nav>
        <div className="md:hidden">
          <button
            className="ink-border px-3 py-2 text-xs uppercase tracking-widest"
            onClick={() => setMobileOpen((prev) => !prev)}
          >
            Menu
          </button>
        </div>
      </div>
      {mobileOpen && (
        <div className="md:hidden border-t-2 border-black bg-[var(--paper-100)]">
          <div className="mx-auto max-w-6xl px-6 py-4 space-y-3 text-xs uppercase tracking-widest">
            <Link className="chip chip-button block" href="/" onClick={() => setMobileOpen(false)}>
              Home
            </Link>
            <Link className="chip chip-button block" href="/mentors" onClick={() => setMobileOpen(false)}>
              Mentors
            </Link>
            <Link className="chip chip-button block" href="/join-mentor" onClick={() => setMobileOpen(false)}>
              Join as Mentor
            </Link>
            <Link className="chip chip-button block" href="/about" onClick={() => setMobileOpen(false)}>
              About Us
            </Link>
            <Link className="chip chip-button block" href="/contact" onClick={() => setMobileOpen(false)}>
              Contact
            </Link>
            {session.status === "authenticated" ? (
              <>
                {session.role === "MENTOR" && (
                  <Link className="chip chip-button block" href="/mentor" onClick={() => setMobileOpen(false)}>
                    Dashboard
                  </Link>
                )}
                {session.role === "LEARNER" && (
                  <Link className="chip chip-button block" href="/learner" onClick={() => setMobileOpen(false)}>
                    Dashboard
                  </Link>
                )}
                {session.role === "ADMIN" && (
                  <Link className="chip chip-button block" href="/admin" onClick={() => setMobileOpen(false)}>
                    Admin
                  </Link>
                )}
                <Link className="chip chip-button block" href="/profile" onClick={() => setMobileOpen(false)}>
                  Profile
                </Link>
                <button
                  className="ink-border w-full px-3 py-2 text-xs uppercase tracking-widest"
                  onClick={async () => {
                    await fetch(`${apiUrl}/auth/logout`, {
                      method: "POST",
                      credentials: "include",
                    });
                    setSession({ status: "anonymous" });
                    setMobileOpen(false);
                    window.location.href = "/";
                  }}
                >
                  Logout
                </button>
              </>
            ) : (
              <Link className="chip chip-button block" href="/auth/sign-in" onClick={() => setMobileOpen(false)}>
                Sign In
              </Link>
            )}
          </div>
        </div>
      )}
    </header>
  );
}
