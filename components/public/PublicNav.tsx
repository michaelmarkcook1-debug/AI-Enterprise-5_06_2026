"use client";

// Lean PUBLIC nav — the front-door chrome.
// ─────────────────────────────────────────
// Deliberately NOT the dashboard TopNav: it makes ZERO network calls (no
// /api/system/last-refreshed fetch, no live providers), so every public page
// reaches document-idle. Static links + a theme toggle only. The heavy,
// live-polling dashboard nav lives in the (internal) route group.

import { useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortalTheme } from "@/lib/use-theme";
import BrandLogo from "@/components/BrandLogo";

const NAV: { href: string; label: string }[] = [
  { href: "/vendors", label: "Rankings" },
  { href: "/models", label: "Models" },
  { href: "/dependencies", label: "Dependencies" },
  { href: "/insights", label: "Insights" },
];

function isActive(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export default function PublicNav() {
  const pathname = usePathname();
  const [theme, setTheme] = usePortalTheme();
  const [open, setOpen] = useState(false);

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
                key={n.href}
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
          <Link
            href="/subscribe"
            className="hidden rounded-full bg-[#d4af37] px-3.5 py-1.5 text-xs font-semibold text-[#0a1f38] transition-colors hover:bg-[#e8c95c] md:inline-block"
          >
            Get the market read
          </Link>
          <Link
            href="/signin"
            className="hidden text-xs font-medium text-[#c8d7e9] transition-colors hover:text-white md:inline-block"
          >
            Sign in
          </Link>
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
            aria-controls="public-mobile-nav"
          >
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              {open ? <><line x1="18" y1="6" x2="6" y2="18" /><line x1="6" y1="6" x2="18" y2="18" /></> : <><line x1="3" y1="6" x2="21" y2="6" /><line x1="3" y1="12" x2="21" y2="12" /><line x1="3" y1="18" x2="21" y2="18" /></>}
            </svg>
          </button>
        </div>
      </div>

      {open && (
        <nav id="public-mobile-nav" className="border-t border-white/10 bg-[#0a1f38] px-4 py-3 md:hidden" aria-label="Mobile navigation">
          <ul className="flex flex-col gap-1 text-sm">
            {NAV.map((n) => (
              <li key={n.href}>
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
            <li className="mt-1 flex items-center justify-between gap-2 border-t border-white/10 pt-2">
              <Link
                href="/subscribe"
                onClick={() => setOpen(false)}
                className="rounded-full bg-[#d4af37] px-3 py-1.5 text-xs font-semibold text-[#0a1f38]"
              >
                Get the market read
              </Link>
              <Link
                href="/signin"
                onClick={() => setOpen(false)}
                className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-[#d8e2ec]"
              >
                Sign in
              </Link>
            </li>
            <li className="flex items-center justify-end pt-1">
              <button
                type="button"
                onClick={() => setTheme(theme === "dark" ? "light" : "dark")}
                className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-[#d8e2ec]"
                aria-label="Toggle light and dark mode"
                aria-pressed={theme === "dark"}
              >
                {theme === "dark" ? "Light mode" : "Dark mode"}
              </button>
            </li>
          </ul>
        </nav>
      )}
    </header>
  );
}
