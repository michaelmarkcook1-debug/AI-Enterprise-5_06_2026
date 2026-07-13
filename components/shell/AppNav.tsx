"use client";

// Unified app-shell nav (Prompt 3) — replaces the old PublicNav / MemberNav
// split. Four jobs everywhere; the third slot swaps label+meaning by view
// mode (Market watch <-> My workspace) since both point at "/", which itself
// renders differently per mode (see lib/member/view-mode.ts). Deliberately
// still ZERO network calls (no live pollers) — same reasoning PublicNav had.
//
// `viewMode` is intentionally NOT a server-resolved prop from the public
// layout (that would force its 8 static pages dynamic — see the layout's own
// comment). It defaults to "visitor" for the server render, then reconciles
// to the real ae_view_mode cookie client-side post-hydration — gated on
// `showToggle`, which IS a safe, static, env-only prop, so a real-production
// build (showToggle always false there) never shows buyer styling no matter
// what a client-side cookie claims. The (member) layout, already dynamic, may
// instead pass an explicit `initialViewMode="buyer"` for a real session.

import { useState, useEffect } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortalTheme } from "@/lib/use-theme";
import BrandLogo from "@/components/BrandLogo";
import ViewModeToggle from "@/components/shell/ViewModeToggle";
import { VIEW_MODE_COOKIE } from "@/lib/member/view-mode-client";

interface NavItem {
  href: string;
  label: string;
}

const JOBS_BASE: NavItem[] = [
  { href: "/use-cases", label: "Start here" },
  { href: "/vendors", label: "Assess & decide" },
  { href: "/peers", label: "Peer benchmark" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

function readViewModeCookie(): "visitor" | "buyer" {
  if (typeof document === "undefined") return "visitor";
  const match = document.cookie.match(new RegExp(`(?:^|; )${VIEW_MODE_COOKIE}=(buyer|visitor)`));
  return match?.[1] === "buyer" ? "buyer" : "visitor";
}

export default function AppNav({
  pricingEnabled = false,
  showToggle,
  initialViewMode = "visitor",
  memberEmail,
  isRealSession = false,
}: {
  pricingEnabled?: boolean;
  showToggle: boolean;
  initialViewMode?: "visitor" | "buyer";
  memberEmail?: string | null;
  isRealSession?: boolean;
}) {
  const pathname = usePathname();
  const [theme, setTheme] = usePortalTheme();
  const [open, setOpen] = useState(false);
  const [viewMode, setViewMode] = useState<"visitor" | "buyer">(initialViewMode);

  // Reconcile with the real cookie once mounted — only when the server already
  // told us the toggle is even possible (showToggle), so this never flips a
  // real-production render into buyer styling from a stray/forged cookie.
  useEffect(() => {
    if (!showToggle) return;
    setViewMode(readViewModeCookie());
  }, [showToggle]);

  const thirdJob: NavItem =
    viewMode === "buyer" ? { href: "/", label: "My workspace" } : { href: "/", label: "Market watch" };
  const NAV: NavItem[] = [
    { href: "/how-it-works", label: "How it works" },
    JOBS_BASE[0],
    JOBS_BASE[1],
    thirdJob,
    JOBS_BASE[2],
    ...(pricingEnabled ? [{ href: "/pricing", label: "Pricing" }] : []),
  ];

  async function signOut() {
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // ignore — reload regardless
    }
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[#d4af37]/30 bg-[#0a1f38]/[0.97] backdrop-blur dark:border-[#d4af37]/20 dark:bg-[#071827]/[0.97]">
      <div className="mx-auto flex h-14 max-w-6xl items-center gap-6 px-5">
        <Link href="/" className="flex items-center" aria-label="AI Enterprise — home">
          <BrandLogo size={30} onDark />
        </Link>
        <nav className="hidden h-full flex-1 items-stretch gap-0.5 text-sm md:flex">
          {NAV.map((n) => {
            const active = isActive(pathname, n.href);
            return (
              <Link
                key={n.label}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center border-b-2 px-3.5 transition-colors ${
                  active
                    ? "border-[#d4af37] font-semibold text-white"
                    : "border-transparent font-medium text-[#c8d7e9] hover:border-[#d4af37]/40 hover:text-[#e8effa]"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
        </nav>
        <div className="ml-auto flex items-center gap-2">
          {showToggle && <ViewModeToggle mode={viewMode} onToggle={setViewMode} />}
          {isRealSession && memberEmail ? (
            <>
              <span className="hidden text-[11px] text-[#9fb3c8] sm:inline">{memberEmail}</span>
              <button
                type="button"
                onClick={signOut}
                className="hidden rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-[#d8e2ec] transition-colors hover:border-[#d4af37]/50 hover:text-white md:inline-block"
              >
                Sign out
              </button>
            </>
          ) : (
            <Link
              href="/subscribe"
              className="hidden rounded-full bg-[#d4af37] px-3.5 py-1.5 text-xs font-semibold text-[#0a1f38] transition-colors hover:bg-[#e8c95c] md:inline-block"
            >
              Get the market read
            </Link>
          )}
          <button
            type="button"
            onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
            className="hidden rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-[#d8e2ec] transition-colors hover:border-[#d4af37]/50 hover:text-white md:inline-block"
            aria-label="Toggle light and dark mode"
            aria-pressed={theme === "dark"}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
          <button
            type="button"
            onClick={() => setOpen((v) => !v)}
            className="inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/20 text-[#d8e2ec] transition-colors hover:bg-white/[0.07] md:hidden"
            aria-label={open ? "Close menu" : "Open menu"}
            aria-expanded={open}
            aria-controls="app-mobile-nav"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {open ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav id="app-mobile-nav" className="border-t border-white/10 bg-[#0a1f38] px-4 py-3 md:hidden" aria-label="Mobile navigation">
          <ul className="flex flex-col gap-1 text-sm">
            {NAV.map((n) => (
              <li key={n.label}>
                <Link
                  href={n.href}
                  onClick={() => setOpen(false)}
                  aria-current={isActive(pathname, n.href) ? "page" : undefined}
                  className={`block rounded-md px-3 py-2.5 transition-colors ${
                    isActive(pathname, n.href)
                      ? "bg-[#d4af37] font-semibold !text-[#0a1f38]"
                      : "font-medium text-[#c2d1e0] hover:bg-white/[0.06] hover:text-white"
                  }`}
                >
                  {n.label}
                </Link>
              </li>
            ))}
            {showToggle && (
              <li className="pt-1">
                <ViewModeToggle mode={viewMode} variant="mobile" onToggle={setViewMode} />
              </li>
            )}
            <li className="mt-1 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
              {isRealSession && memberEmail ? (
                <button
                  type="button"
                  onClick={signOut}
                  className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-[#d8e2ec]"
                >
                  Sign out
                </button>
              ) : (
                <Link
                  href="/subscribe"
                  onClick={() => setOpen(false)}
                  className="rounded-full bg-[#d4af37] px-3 py-1.5 text-xs font-semibold text-[#0a1f38]"
                >
                  Get the market read
                </Link>
              )}
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
