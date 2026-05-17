"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { usePortalTheme } from "@/lib/use-theme";
import BrandLogo from "@/components/BrandLogo";
import { INVESTOR_TOOLS_NAV } from "@/lib/investor-tools/nav";

// ──────────────────────────────────────────────────────────────────
// 4-tab information architecture (May-2026 restructure).
// Grouped by the job the user is doing, not by data type:
//   Dashboard  — state of the market at a glance
//   Vendors    — deep per-vendor intelligence (directory / capabilities / reputation)
//   Market     — what's moving (tracker / news / briefings)
//   Assessment — the user's own platform-fit evaluation
// Watchlists moved into Settings (personal config, not an intel surface).
// Investor Tools + Admin kept as separate utility entries.
// ──────────────────────────────────────────────────────────────────

interface SubLink { href: string; label: string }
interface Section {
  id: string;
  href: string;
  label: string;
  /** Path prefixes that light this section up as active. */
  match: string[];
  /** Optional second-row sub-navigation. */
  sub?: SubLink[];
}

const SECTIONS: Section[] = [
  { id: "dashboard", href: "/dashboard", label: "Dashboard", match: ["/dashboard"] },
  {
    id: "vendors", href: "/vendors", label: "Vendors",
    match: ["/vendors", "/capabilities", "/reputation"],
    sub: [
      { href: "/vendors", label: "Directory" },
      { href: "/capabilities", label: "Capabilities" },
      { href: "/reputation", label: "Reputation" },
    ],
  },
  {
    id: "market", href: "/market", label: "Market",
    match: ["/market", "/news", "/briefings"],
    sub: [
      { href: "/market", label: "Tracker" },
      { href: "/news", label: "News" },
      { href: "/briefings", label: "Briefings" },
    ],
  },
  { id: "assessment", href: "/assessment", label: "Assessment", match: ["/assessment", "/assess", "/results", "/methodology"] },
];

function isActiveSection(section: Section, pathname: string): boolean {
  return section.match.some((m) => pathname === m || pathname.startsWith(m + "/"));
}

export default function TopNav() {
  const pathname = usePathname();
  const [theme, setTheme] = usePortalTheme();

  // Home page renders the AIEnterpriseShell which has its own chrome.
  if (pathname === "/") return null;

  function toggleTheme() {
    setTheme(theme === "dark" ? "light" : "dark");
  }

  const activeSection = SECTIONS.find((s) => isActiveSection(s, pathname));

  const primaryClass = (active: boolean) =>
    `rounded-md px-3 py-1.5 text-sm transition-colors ${
      active
        ? "bg-[#192319] !text-white font-semibold shadow-sm dark:bg-white dark:!text-[#0c1220]"
        : "font-medium text-[#4d574b] hover:bg-[#e9ede4] hover:text-[#18201b] dark:text-zinc-400 dark:hover:bg-zinc-900 dark:hover:text-zinc-100"
    }`;

  return (
    <header className="sticky top-0 z-30 border-b border-[#dfe4da] bg-[#f7f8f5]/95 backdrop-blur dark:border-zinc-800 dark:bg-[#071827]/95">
      <div className="border-b border-[#dfe4da] bg-white/70 px-5 py-1.5 text-center text-[11px] font-medium text-[#5f685a] dark:border-zinc-800 dark:bg-[#071827]/70 dark:text-zinc-400">
        Seed intelligence preview | estimated market signals remain confidence-labelled until live ingestion is connected.
      </div>

      {/* Row 1 — primary 4-tab nav */}
      <div className="mx-auto flex h-14 max-w-7xl items-center gap-6 px-5">
        <Link href="/" className="flex items-center" aria-label="AI Enterprise home">
          <BrandLogo size={32} />
        </Link>
        <nav className="hidden flex-1 items-center gap-1 md:flex">
          {SECTIONS.map((s) => (
            <Link
              key={s.id}
              href={s.href}
              aria-current={activeSection?.id === s.id ? "page" : undefined}
              className={primaryClass(activeSection?.id === s.id)}
            >
              {s.label}
            </Link>
          ))}

          {/* Investor Tools — Level-3 specialist module, non-hero styling. */}
          <div className="group relative">
            <Link
              href={INVESTOR_TOOLS_NAV.route}
              className={primaryClass(pathname.startsWith("/investor-tools") || pathname.startsWith("/investing"))}
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

          <Link href="/admin" className={primaryClass(pathname.startsWith("/admin"))}>
            Admin
          </Link>
        </nav>

        {/* Utility cluster — Settings (holds Watchlists) + theme toggle. */}
        <div className="ml-auto flex items-center gap-2">
          <Link
            href="/settings"
            aria-current={pathname.startsWith("/settings") ? "page" : undefined}
            className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition-colors ${
              pathname.startsWith("/settings")
                ? "border-[#192319] bg-[#192319] text-white dark:border-white dark:bg-white dark:text-[#0c1220]"
                : "border-[#cfd7c8] bg-white/70 text-[#273227] hover:bg-[#eef2e8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            }`}
            aria-label="Settings"
          >
            ⚙ Settings
          </Link>
          <button
            type="button"
            onClick={toggleTheme}
            className="rounded-full border border-[#cfd7c8] bg-white/70 px-3 py-1.5 text-xs font-semibold text-[#273227] transition-colors hover:bg-[#eef2e8] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100 dark:hover:bg-zinc-800"
            aria-label="Toggle light and dark mode"
            aria-pressed={theme === "dark"}
          >
            {theme === "dark" ? "Light" : "Dark"}
          </button>
        </div>
      </div>

      {/* Row 2 — sub-navigation for the active section (Vendors / Market). */}
      {activeSection?.sub && (
        <div className="border-t border-[#e7ebe2] bg-white/60 dark:border-zinc-800 dark:bg-[#071827]/60">
          <div className="mx-auto flex max-w-7xl items-center gap-1 px-5 py-1.5">
            {activeSection.sub.map((link) => {
              const active = pathname === link.href || pathname.startsWith(link.href + "/");
              return (
                <Link
                  key={link.href}
                  href={link.href}
                  aria-current={active ? "page" : undefined}
                  className={`rounded-md px-2.5 py-1 text-xs transition-colors ${
                    active
                      ? "bg-[#e9ede4] font-semibold text-[#18201b] dark:bg-zinc-800 dark:text-zinc-100"
                      : "font-medium text-[#697362] hover:bg-[#eef2e8] hover:text-[#18201b] dark:text-zinc-500 dark:hover:bg-zinc-900 dark:hover:text-zinc-200"
                  }`}
                >
                  {link.label}
                </Link>
              );
            })}
          </div>
        </div>
      )}
    </header>
  );
}
