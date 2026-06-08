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

/** Dot colour based on ingestion completeness. */
function healthDotClass(health: IngestionHealth | null): string {
  if (!health) return "bg-emerald-500 dark:bg-emerald-300";
  if (health.crashed) return "bg-rose-500 dark:bg-rose-300";
  if (health.percentComplete === 100) return "bg-emerald-500 dark:bg-emerald-300";
  if (health.percentComplete >= 70) return "bg-amber-500 dark:bg-amber-300";
  return "bg-rose-500 dark:bg-rose-300";
}

function healthBorderClass(health: IngestionHealth | null): string {
  if (!health) return "border-emerald-300 dark:border-emerald-800";
  if (health.crashed) return "border-rose-300 dark:border-rose-800";
  if (health.percentComplete === 100) return "border-emerald-300 dark:border-emerald-800";
  if (health.percentComplete >= 70) return "border-amber-300 dark:border-amber-800";
  return "border-rose-300 dark:border-rose-800";
}

function healthBgClass(health: IngestionHealth | null): string {
  if (!health) return "bg-emerald-50 dark:bg-emerald-950/40";
  if (health.crashed) return "bg-rose-50 dark:bg-rose-950/40";
  if (health.percentComplete === 100) return "bg-emerald-50 dark:bg-emerald-950/40";
  if (health.percentComplete >= 70) return "bg-amber-50 dark:bg-amber-950/40";
  return "bg-rose-50 dark:bg-rose-950/40";
}

function healthTextClass(health: IngestionHealth | null): string {
  if (!health) return "text-emerald-900 dark:text-emerald-200";
  if (health.crashed) return "text-rose-900 dark:text-rose-200";
  if (health.percentComplete === 100) return "text-emerald-900 dark:text-emerald-200";
  if (health.percentComplete >= 70) return "text-amber-900 dark:text-amber-200";
  return "text-rose-900 dark:text-rose-200";
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
const NAV: { href: string; label: string }[] = [
  { href: "/query", label: "Query" },
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
    <header className="sticky top-0 z-30 border-b border-[#dfe4da] bg-[#f7f8f5]/95 backdrop-blur dark:border-zinc-800 dark:bg-[#071827]/95">
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-5">
        <Link href="/" className="flex items-center" aria-label="AI Enterprise home">
          <BrandLogo size={32} />
        </Link>
        <nav className="hidden flex-1 items-center gap-1 text-sm md:flex">
          {NAV.map((n) => {
            const active = isActiveNavItem(pathname, n.href);
            return (
              <Link
                key={n.href}
                href={n.href}
                aria-current={active ? "page" : undefined}
                className={`rounded-md px-3 py-1.5 transition-colors ${
                  active
                    ? "bg-[#192319] !text-white font-semibold shadow-sm dark:bg-white dark:!text-[#0c1220]"
                    : "font-medium text-[#4d574b] hover:bg-[#e9ede4] hover:text-[#18201b] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                }`}
              >
                {n.label}
              </Link>
            );
          })}
          {/* Investor Tools — visually separated secondary workflow */}
          <span className="mx-1 h-5 w-px bg-[#dfe4da] dark:bg-zinc-700" aria-hidden />
          <Link
            href="/investor-tools"
            aria-current={pathname.startsWith("/investor-tools") || pathname.startsWith("/investing") ? "page" : undefined}
            className={`rounded-md px-3 py-1.5 transition-colors ${
              pathname.startsWith("/investor-tools") || pathname.startsWith("/investing")
                ? "bg-[#192319] !text-white font-semibold shadow-sm dark:bg-white dark:!text-[#0c1220]"
                : "font-medium text-[#8a7a5a] hover:bg-[#f0ebe0] hover:text-[#5a4e36] dark:text-amber-400/80 dark:hover:bg-amber-950/40 dark:hover:text-amber-200"
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
          {/* Admin — gear icon, utility not primary nav */}
          <Link
            href="/admin"
            aria-label="Admin console"
            title="Admin console"
            className={`hidden h-8 w-8 items-center justify-center rounded-md transition-colors md:flex ${
              pathname.startsWith("/admin")
                ? "bg-[#192319] text-white dark:bg-white dark:text-[#0c1220]"
                : "text-[#4d574b] hover:bg-[#e9ede4] hover:text-[#18201b] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
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
            className="hidden rounded-full border border-[#cfd7c8] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#273227] transition-colors hover:bg-[#eef2e8] md:inline-block dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
          className="ml-auto inline-flex h-10 w-10 items-center justify-center rounded-md border border-[#cfd7c8] bg-white/70 text-[#273227] transition-colors hover:bg-[#eef2e8] md:hidden dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
          className="border-t border-[#dfe4da] bg-white/95 px-4 py-3 md:hidden dark:border-zinc-800 dark:bg-[#071827]/95"
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
                        ? "bg-[#192319] !text-white font-semibold shadow-sm dark:bg-white dark:!text-[#0c1220]"
                        : "font-medium text-[#4d574b] hover:bg-[#e9ede4] hover:text-[#18201b] dark:text-zinc-300 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                    }`}
                  >
                    {n.label}
                  </Link>
                </li>
              );
            })}

            {/* Investor Tools — separated secondary workflow */}
            <li className="mt-1 border-t border-[#dfe4da] pt-2 dark:border-zinc-800">
              <Link
                href="/investor-tools"
                onClick={() => setMobileOpen(false)}
                aria-current={pathname.startsWith("/investor-tools") || pathname.startsWith("/investing") ? "page" : undefined}
                className={`block rounded-md px-3 py-2.5 transition-colors ${
                  pathname.startsWith("/investor-tools") || pathname.startsWith("/investing")
                    ? "bg-[#192319] !text-white font-semibold shadow-sm dark:bg-white dark:!text-[#0c1220]"
                    : "font-medium text-[#8a7a5a] hover:bg-[#f0ebe0] hover:text-[#5a4e36] dark:text-amber-400/80 dark:hover:bg-amber-950/40 dark:hover:text-amber-200"
                }`}
              >
                Investor Tools
              </Link>
            </li>
          </ul>

          {/* Admin utility link — visually separated. */}
          <div className="mt-1 border-t border-[#dfe4da] pt-2 dark:border-zinc-800">
            <Link
              href="/admin"
              onClick={() => setMobileOpen(false)}
              className={`flex items-center gap-2 rounded-md px-3 py-2 text-xs font-medium transition-colors ${
                pathname.startsWith("/admin")
                  ? "bg-[#192319] text-white dark:bg-white dark:text-[#0c1220]"
                  : "text-[#697362] hover:bg-[#e9ede4] hover:text-[#18201b] dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
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
          <div className="mt-3 flex items-center justify-between gap-2 border-t border-[#dfe4da] pt-3 dark:border-zinc-800">
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
              className="rounded-full border border-[#cfd7c8] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#273227] transition-colors hover:bg-[#eef2e8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
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
