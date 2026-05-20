"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortalTheme } from "@/lib/use-theme";
import BrandLogo from "@/components/BrandLogo";
import { INVESTOR_TOOLS_NAV } from "@/lib/investor-tools/nav";

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

/**
 * Lazily fetch the most-recent daily-refresh timestamp once on mount.
 * Treats fetch errors as silent — the badge simply doesn't render.
 */
function useLastRefreshedAt(): string | null {
  const [iso, setIso] = useState<string | null>(null);
  useEffect(() => {
    let cancelled = false;
    fetch("/api/system/last-refreshed", { cache: "no-store" })
      .then((r) => r.json())
      .then((data: { lastRefreshedAt: string | null }) => {
        if (!cancelled) setIso(data.lastRefreshedAt);
      })
      .catch(() => {});
    return () => { cancelled = true; };
  }, []);
  return iso;
}

// Hero / Level-1 core functions first (Assessment, Vendors, Capabilities,
// Briefings), then Level-2 supporting modules (Market Tracker, News,
// Watchlists). Investor Tools is a Level-3 specialist module and is
// rendered AFTER this nav with non-hero styling — see the JSX below.
const NAV: { href: string; label: string }[] = [
  { href: "/dashboard", label: "Dashboard" },
  { href: "/assessment", label: "Assessment" },
  { href: "/vendors", label: "Vendors" },
  { href: "/capabilities", label: "Capabilities" },
  { href: "/briefings", label: "Briefings" },
  { href: "/market", label: "Market Tracker" },
  { href: "/exposure-map", label: "Exposure" },
  { href: "/news", label: "News" },
  { href: "/reputation", label: "Reputation" },
  { href: "/watchlists", label: "Watchlists" },
  { href: "/admin", label: "Admin" },
];

export default function TopNav() {
  const pathname = usePathname();
  const [theme, setTheme] = usePortalTheme();
  const lastRefreshedAt = useLastRefreshedAt();

  // The home page renders the AIEnterpriseShell which has its own chrome —
  // suppress the global TopNav so we don't double-stack headers.
  if (pathname === "/") return null;

  function toggleTheme() {
    const nextTheme = theme === "dark" ? "light" : "dark";
    setTheme(nextTheme);
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[#dfe4da] bg-[#f7f8f5]/95 backdrop-blur dark:border-zinc-800 dark:bg-[#071827]/95">
      <div className="border-b border-[#dfe4da] bg-white/70 px-5 py-1.5 text-center text-[11px] font-medium text-[#5f685a] dark:border-zinc-800 dark:bg-[#071827]/70 dark:text-zinc-400">
        Seed intelligence preview | estimated market signals remain confidence-labelled until live ingestion is connected.
      </div>
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-5">
        <Link href="/" className="flex items-center" aria-label="AI Enterprise home">
          <BrandLogo size={32} />
        </Link>
        <nav className="hidden flex-1 items-center gap-1 text-sm md:flex">
          {NAV.map((n) => {
            const active = n.href === "/" ? pathname === "/" : pathname.startsWith(n.href);
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
          {/* Investor Tools is a Level-3 specialist module per Stage-2 Rev2
              hero hierarchy. Kept in the nav (accessible) but rendered
              AFTER the hero pillars with non-bold styling so it doesn't
              read as a hero function. */}
          <div className="group relative">
            <Link
              href={INVESTOR_TOOLS_NAV.route}
              className={`rounded-md px-3 py-1.5 transition-colors ${
                pathname.startsWith("/investor-tools") || pathname.startsWith("/investing")
                  ? "bg-[#192319] !text-white font-semibold shadow-sm dark:bg-white dark:!text-[#0c1220]"
                  : "font-medium text-[#4d574b] hover:bg-[#e9ede4] hover:text-[#18201b] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
              }`}
            >
              {INVESTOR_TOOLS_NAV.label}
              <span
                className="ml-1.5 rounded-full bg-amber-100 px-1.5 py-0.5 align-middle text-[10px] font-semibold uppercase tracking-wider text-amber-900 dark:bg-amber-950/50 dark:text-amber-200"
                aria-label="beta"
              >
                beta
              </span>
            </Link>
            <div className="invisible absolute left-0 top-8 z-40 w-64 rounded-lg border border-[#dfe4da] bg-white p-2 opacity-0 shadow-lg transition group-hover:visible group-hover:opacity-100 group-focus-within:visible group-focus-within:opacity-100 dark:border-zinc-800 dark:bg-[#071827]">
              {INVESTOR_TOOLS_NAV.children?.map((child) => (
                <Link
                  key={child.id}
                  href={child.route}
                  className="block rounded-md px-3 py-2 text-sm text-[#4d574b] hover:bg-[#e9ede4] hover:text-[#18201b] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
                >
                  {child.label}
                </Link>
              ))}
            </div>
          </div>
        </nav>
        {/* Data-freshness badge — proxies "when did the daily refresh last
            succeed" via the most-recent VendorRankingSnapshot.capturedAt
            (every successful run writes one snapshot per vendor). */}
        {lastRefreshedAt && (
          <span
            className="ml-auto hidden items-center gap-1.5 rounded-full border border-emerald-300 bg-emerald-50 px-2.5 py-1 text-[11px] font-medium text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200 md:inline-flex"
            title={`Last daily refresh completed at ${new Date(lastRefreshedAt).toLocaleString()}`}
          >
            <span className="h-1.5 w-1.5 rounded-full bg-emerald-500 dark:bg-emerald-300" aria-hidden />
            Data refreshed {formatRelative(lastRefreshedAt)}
          </span>
        )}
        <button
          type="button"
          onClick={toggleTheme}
          className={`${lastRefreshedAt ? "ml-2" : "ml-auto"} rounded-full border border-[#cfd7c8] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#273227] transition-colors hover:bg-[#eef2e8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800`}
          aria-label="Toggle light and dark mode"
          aria-pressed={theme === "dark"}
        >
          {theme === "dark" ? "Light" : "Dark"}
        </button>
      </div>
    </header>
  );
}
