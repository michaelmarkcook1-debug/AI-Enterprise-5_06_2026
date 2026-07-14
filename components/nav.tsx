"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const NAV_ITEMS = [
  { href: "/", label: "Dashboard" },
  { href: "/vendors", label: "Vendors" },
  { href: "/market", label: "Market Tracker" },
  { href: "/news", label: "News" },
  { href: "/capabilities", label: "Capabilities" },
  { href: "/assessment", label: "Assessment" },
  { href: "/briefings", label: "Briefings" },
  { href: "/watchlists", label: "Watchlists" },
];

export function Nav() {
  const pathname = usePathname();
  return (
    <nav className="hidden items-center gap-1 lg:flex">
      {NAV_ITEMS.map((item) => {
        const active = item.href === "/" ? pathname === "/" : pathname.startsWith(item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            className={`rounded-md px-3 py-2 text-sm transition-colors ${
              active ? "bg-[#123d2c] text-white" : "text-[#475a72] hover:bg-[#f1ead6] hover:text-[#123d2c]"
            }`}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}
