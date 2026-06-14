"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortalTheme } from "@/lib/use-theme";
import BrandLogo from "@/components/BrandLogo";

/**
 * Relative-time formatter used by the "Data refreshed" badge.
 * Returns "just now" / "12 min ago" / "5 hr ago" / "2 days ago".
 */
function formatRelative(iso: string): string {
  const then = new Date(iso).getTime();
  if (Number.isNaN(then)) return "—";
  const secs = Math.max(0, Math.round((Date.now() - then) / 1000));
  if (secs < 60) return "just now";
  const mins = Math.round(secs / 60);
  if (mins < 60) return `${mins} min ago`;
  const hrs = Math.round(mins / 60);
  if (hrs < 36) return `${hrs} hr ago`;
  const days = Math.round(hrs / 24);
  return `${days} day${days === 1 ? "" : "s"} ago`;
}

interface IngestionHealth {
  runType: string;
  stepsTotal: number;
  stepsOk: number;
  percentComplete: number;
  failedSteps: string[];
  crashed: boolean;
  expectedSteps: number;
  runId: string | null;
  startedAt: string | null;
  finishedAt: string | null;
  durationMs: number;
}

interface RefreshData {
  lastRefreshedAt: string | null;
  ingestionHealth: IngestionHealth | null;
}

/**
 * Lazily fetch the most-recent daily-refresh timestamp + ingestion
 * health once on mount. Treats fetch errors as silent.
 */
function useRefreshData(enabled = true): RefreshData {
  const [data, setData] = useState<RefreshData>({ lastRefreshedAt: null, ingestionHealth: null });
  useEffect(() => {
    if (!enabled) return;
    let cancelled = false;
    fetch("/api/system/last-refreshed", { cache: "no-store" })
      .then((r) => r.json())
      .then((d: RefreshData) => {
        if (!cancelled) setData(d);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, [enabled]);
  return data;
}

/** Dot colour based on ingestion completeness. The badge always sits on the
 * navy masthead, so all tints are dark-surface tints regardless of theme. */
function healthDotClass(health: IngestionHealth | null): string {
  if (!health) return "bg-emerald-300";
  if (health.crashed) return "bg-rose-300";
  if (health.percentComplete === 100) return "bg-emerald-300";
  if (health.percentComplete >= 70) return "bg-amber-300";
  return "bg-rose-300";
}

function healthBorderClass(health: IngestionHealth | null): string {
  if (!health) return "border-emerald-300/30";
  if (health.crashed) return "border-rose-300/40";
  if (health.percentComplete === 100) return "border-emerald-300/30";
  if (health.percentComplete >= 70) return "border-amber-300/40";
  return "border-rose-300/40";
}

function healthBgClass(health: IngestionHealth | null): string {
  if (!health) return "bg-emerald-400/10";
  if (health.crashed) return "bg-rose-400/10";
  if (health.percentComplete === 100) return "bg-emerald-400/10";
  if (health.percentComplete >= 70) return "bg-amber-400/10";
  return "bg-rose-400/10";
}

function healthTextClass(health: IngestionHealth | null): string {
  if (!health) return "text-emerald-200";
  if (health.crashed) return "text-rose-200";
  if (health.percentComplete === 100) return "text-emerald-200";
  if (health.percentComplete >= 70) return "text-amber-200";
  return "text-rose-200";
}

function healthTitle(health: IngestionHealth | null, iso: string): string {
  const base = `Last refresh: ${new Date(iso).toLocaleString()}`;
  if (!health) return base;
  if (health.crashed) {
    return `${base}\n⚠ CRASHED — completed ${health.stepsTotal}/${health.expectedSteps} steps before timeout\nCompleted: ${health.stepsOk} OK, ${health.failedSteps.length} failed`;
  }
  const pct = `${health.percentComplete}% complete (${health.stepsOk}/${health.stepsTotal} steps)`;
  if (health.failedSteps.length > 0) {
    return `${base}\n${pct}\nFailed: ${health.failedSteps.join(", ")}`;
  }
  return `${base}\n${pct}`;
}

function badgeLabel(health: IngestionHealth | null, iso: string): string {
  const relative = formatRelative(iso);
  if (!health) return `Refreshed ${relative}`;
  if (health.crashed) return `⚠ Crashed · ${relative}`;
  if (health.percentComplete < 100) return `${health.percentComplete}% · ${relative}`;
  return `Refreshed ${relative}`;
}

// CIO Decision Lifecycle — five primary tabs.
// Atlas and Leadership are accessible from Understand, not top nav.
// Investor Tools is visually separated as a secondary workflow.
const LIBRARY: { href: string; label: string }[] = [
  { href: "/market", label: "Market" },
  { href: "/news", label: "News" },
  { href: "/reputation", label: "Reputation" },
  { href: "/capabilities", label: "Capabilities" },
  { href: "/vendors", label: "Vendors" },
  { href: "/watchlists", label: "Watchlists" },
  { href: "/briefings", label: "Briefings" },
  { href: "/evolution", label: "Evolution" },
  { href: "/exposure-map", label: "Exposure Map" },
  { href: "/dashboard", label: "Dashboard" },
  { href: "/methodology", label: "Methodology" },
];

const NAV: { href: string; label: string }[] = [
  { href: "/query-v2", label: "Query" },
  { href: "/understand", label: "Understand" },
  { href: "/assess", label: "Assess" },
  { href: "/demonstrate", label: "Demonstrate" },
  { href: "/monitor", label: "Monitor" },
];

function isActiveNavItem(pathname: string, href: string) {
  return href === "/" ? pathname === "/" : pathname.startsWith(href);
}

export default function TopNav() {
  const pathname = usePathname();
  const [theme, setTheme] = usePortalTheme();
  const { lastRefreshedAt, ingestionHealth } = useRefreshData(!pathname.startsWith("/atlas"));
  const [mobileOpen, setMobileOpen] = useState(false);

  // Home redirects into Query; avoid a flash of duplicate chrome while the
  // redirect resolves.
  if (pathname === "/") return null;

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[#d4af37]/30 bg-[#0a1f38]/[0.97] backdrop-blur dark:border-[#d4af37]/20 dark:bg-[#071827]/[0.97]">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-5">
        <Link href="/" className="flex items-center" aria-label="AI Enterprise home">
          <BrandLogo size={32} onDark />
        </Link>
        <nav className="hidden h-full flex-1 items-stretch gap-0.5 text-sm md:flex">
          {NAV.map((n) => {
            const active = isActiveNavItem(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`flex items-center border-b-2 px-3.5 transition-colors ${
                  active
                    ? "border-[#d4af37] font-semibold text-white"
                    : "border-transparent font-medium text-[#9db1c7] hover:border-[#d4af37]/40 hover:text-[#e8effa]"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
          {/* Library — reference surfaces pruned from primary nav */}
          <div className="group relative flex items-stretch">
            <button
              type="button"
              aria-haspopup="menu"
              className={`flex items-center gap-1 border-b-2 px-3.5 transition-colors ${
                LIBRARY.some((l) => pathname.startsWith(l.href))
                  ? "border-[#d4af37] font-semibold text-white"
                  : "border-transparent font-medium text-[#9db1c7] hover:border-[#d4af37]/40 hover:text-[#e8effa]"
              }`}
            >
              Library
              <svg width="9" height="9" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2.5} strokeLinecap="round" strokeLinejoin="round" aria-hidden><path d="m6 9 6 6 6-6" /></svg>
            </button>
            <div className="invisible absolute left-0 top-full z-40 w-52 pt-1 opacity-0 transition-all duration-150 group-focus-within:visible group-focus-within:opacity-100 group-hover:visible group-hover:opacity-100">
              <div role="menu" className="grid grid-cols-1 gap-0.5 rounded-md border border-[#2a4a6b] bg-[#0c2238] p-1.5 shadow-[0_12px_32px_rgba(2,10,20,0.55)]">
                {LIBRARY.map((l) => (
                  <Link
                    key={l.href}
                    href={l.href}
                    role="menuitem"
                    className={`rounded px-2.5 py-1.5 text-xs transition-colors ${
                      pathname.startsWith(l.href)
                        ? "bg-[#d4af37] font-semibold !text-[#0a1f38]"
                        : "text-[#c2d1e0] hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    {l.label}
                  </Link>
                ))}
              </div>
            </div>
          </div>
          {/* Investor Tools — visually separated secondary workflow */}
          <span className="mx-2 my-auto h-5 w-px bg-white/15" aria-hidden />
          <Link
            href="/investor-tools"
            aria-current={pathname.startsWith("/investor-tools") || pathname.startsWith("/investing") ? "page" : undefined}
            className={`flex items-center border-b-2 px-3.5 transition-colors ${
              pathname.startsWith("/investor-tools") || pathname.startsWith("/investing")
                ? "border-[#d4af37] font-semibold text-[#e8c95c]"
                : "border-transparent font-medium text-[#c3a558] hover:border-[#d4af37]/40 hover:text-[#e8c95c]"
            }`}
          >
            Investor Tools
          </Link>
        </nav>
        {/* Utility area — right side of the header bar */}
        <div className="ml-auto flex items-center gap-2">
          {lastRefreshedAt && (
            <Link
              href="/admin/pipeline-health"
              className={`hidden items-center gap-1.5 rounded-full border ${healthBorderClass(ingestionHealth)} ${healthBgClass(ingestionHealth)} px-2.5 py-1 text-[11px] font-medium ${healthTextClass(ingestionHealth)} no-underline md:inline-flex`}
              title={healthTitle(ingestionHealth, lastRefreshedAt)}
            >
              <span className={`h-1.5 w-1.5 rounded-full ${healthDotClass(ingestionHealth)}`} aria-hidden />
              {badgeLabel(ingestionHealth, lastRefreshedAt)}
            </Link>
          )}
          {/* Settings — gear icon, utility not primary nav */}
          <Link
            href="/settings"
            aria-label="Settings — ingestion & spend"
            title="Settings — ingestion & spend"
            className={`hidden h-8 w-8 items-center justify-center rounded-md transition-colors md:flex ${
              pathname.startsWith("/settings") || pathname.startsWith("/admin")
                ? "bg-[#d4af37] text-[#0a1f38]"
                : "text-[#9db1c7] hover:bg-white/[0.07] hover:text-white"
            }`}
          >
            <svg width="15" height="15" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <circle cx="12" cy="12" r="3" />
              <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
            </svg>
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="hidden rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-[#d8e2ec] transition-colors hover:border-[#d4af37]/50 hover:text-white md:inline-block"
            aria-label="Toggle light and dark mode"
            aria-pressed={theme === "dark"}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>

        {/* Mobile menu button — only visible below `md`. Toggles the
            full-width drawer below the header that mirrors the desktop
            nav so users on phones can switch QUAD tabs. */}
        <button
          type="button"
          onClick={() => setMobileOpen((v) => !v)}
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-md border border-white/20 text-[#d8e2ec] transition-colors hover:bg-white/[0.07] md:hidden"
          aria-label={mobileOpen ? "Close menu" : "Open menu"}
          aria-expanded={mobileOpen}
          aria-controls="mobile-nav-drawer"
        >
          {mobileOpen ? (
            // Close (X) icon
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="18" y1="6" x2="6" y2="18" />
              <line x1="6" y1="6" x2="18" y2="18" />
            </svg>
          ) : (
            // Hamburger icon
            <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
              <line x1="3" y1="6" x2="21" y2="6" />
              <line x1="3" y1="12" x2="21" y2="12" />
              <line x1="3" y1="18" x2="21" y2="18" />
            </svg>
          )}
        </button>
      </div>

      {/* Mobile drawer — CIO lifecycle + separated Investor Tools + utility controls. */}
      {mobileOpen && (
        <nav
          id="mobile-nav-drawer"
          className="border-t border-white/10 bg-[#0a1f38] px-4 py-3 md:hidden"
          aria-label="Mobile navigation"
        >
          <ul className="flex flex-col gap-1 text-sm">
            {NAV.map((n) => {
              const active = isActiveNavItem(pathname, n.href);
              return (
                <li key={n.href}>
                  <Link
                    href={n.href}
                    onClick={() => setMobileOpen(false)}
                    aria-current={active ? "page" : undefined}
                    className={`block rounded-md px-3 py-2.5 transition-colors ${
                      active
                        ? "bg-[#d4af37] font-semibold !text-[#0a1f38]"
                        : "font-medium text-[#c2d1e0] hover:bg-white/[0.06] hover:text-white"
                    }`}
                  >
                    {n.label}
                  </Link>
                </li>
              );
            })}

            {/* Investor Tools — separated secondary workflow */}
            <li className="mt-1 border-t border-white/10 pt-2">
              <Link
                href="/investor-tools"
                onClick={() => setMobileOpen(false)}
                aria-current={pathname.startsWith("/investor-tools") || pathname.startsWith("/investing") ? "page" : undefined}
                className={`block rounded-md px-3 py-2.5 transition-colors ${
                  pathname.startsWith("/investor-tools") || pathname.startsWith("/investing")
                    ? "bg-[#d4af37] font-semibold !text-[#0a1f38]"
                    : "font-medium text-[#c3a558] hover:bg-white/[0.06] hover:text-[#e8c95c]"
                }`}
              >
                Investor Tools
              </Link>
            </li>
          </ul>

          {/* Admin utility link — visually separated. */}
          <div className="mt-1 border-t border-white/10 pt-2">
            <div className="px-3 pb-1 text-[9px] font-semibold uppercase tracking-wider text-[#7d93aa]">Library</div>
            <div className="grid grid-cols-2 gap-0.5 pb-2">
              {LIBRARY.map((l) => (
                <Link
                  key={l.href}
                  href={l.href}
                  onClick={() => setMobileOpen(false)}
                  className="rounded-md px-3 py-1.5 text-xs text-[#a7bacd] hover:bg-white/[0.06] hover:text-white"
                >
                  {l.label}
                </Link>
              ))}
            </div>
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-[#d4af37] text-[#0a1f38]"
                  : "text-[#8fa5bb] hover:bg-white/[0.06] hover:text-white"
              }`}
            >
              <svg width="13" height="13" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth={1.8} strokeLinecap="round" strokeLinejoin="round" aria-hidden>
                <circle cx="12" cy="12" r="3" />
                <path d="M19.4 15a1.65 1.65 0 0 0 .33 1.82l.06.06a2 2 0 0 1-2.83 2.83l-.06-.06a1.65 1.65 0 0 0-1.82-.33 1.65 1.65 0 0 0-1 1.51V21a2 2 0 0 1-4 0v-.09A1.65 1.65 0 0 0 9 19.4a1.65 1.65 0 0 0-1.82.33l-.06.06a2 2 0 0 1-2.83-2.83l.06-.06A1.65 1.65 0 0 0 4.68 15a1.65 1.65 0 0 0-1.51-1H3a2 2 0 0 1 0-4h.09A1.65 1.65 0 0 0 4.6 9a1.65 1.65 0 0 0-.33-1.82l-.06-.06a2 2 0 0 1 2.83-2.83l.06.06A1.65 1.65 0 0 0 9 4.68a1.65 1.65 0 0 0 1-1.51V3a2 2 0 0 1 4 0v.09a1.65 1.65 0 0 0 1 1.51 1.65 1.65 0 0 0 1.82-.33l.06-.06a2 2 0 0 1 2.83 2.83l-.06.06A1.65 1.65 0 0 0 19.4 9a1.65 1.65 0 0 0 1.51 1H21a2 2 0 0 1 0 4h-.09a1.65 1.65 0 0 0-1.51 1z" />
              </svg>
              Admin
            </Link>
          </div>

          {/* Mobile theme toggle + freshness badge. Stacked under the
              nav links because the header bar is too cramped on phones. */}
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-white/10 pt-3">
            {lastRefreshedAt ? (
              <Link
                href="/admin/pipeline-health"
                onClick={() => setMobileOpen(false)}
                className={`inline-flex items-center gap-1.5 rounded-full border ${healthBorderClass(ingestionHealth)} ${healthBgClass(ingestionHealth)} px-2.5 py-1 text-[11px] font-medium ${healthTextClass(ingestionHealth)} no-underline`}
                title={healthTitle(ingestionHealth, lastRefreshedAt)}
              >
                <span className={`h-1.5 w-1.5 rounded-full ${healthDotClass(ingestionHealth)}`} aria-hidden />
                {ingestionHealth && ingestionHealth.percentComplete < 100
                  ? `${ingestionHealth.percentComplete}% · ${formatRelative(lastRefreshedAt)}`
                  : `Refreshed ${formatRelative(lastRefreshedAt)}`}
              </Link>
            ) : <span />}
            <button
              type="button"
              onClick={toggleTheme}
              className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-[#d8e2ec] transition-colors hover:border-[#d4af37]/50 hover:text-white"
              aria-label="Toggle light and dark mode"
              aria-pressed={theme === "dark"}
            >
              {theme === "dark" ? "Light mode" : "Dark mode"}
            </button>
          </div>
        </nav>
      )}
    </header>
  );
}
