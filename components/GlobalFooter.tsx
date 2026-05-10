"use client";

import { usePathname } from "next/navigation";

export default function GlobalFooter() {
  const pathname = usePathname();
  // The AIEnterpriseShell renders its own footer; skip the global one on /.
  if (pathname === "/") return null;
  return (
    <footer className="border-t border-zinc-200 px-6 py-4 text-xs text-zinc-500 dark:border-zinc-800 dark:bg-[#071827] dark:text-zinc-500">
      AI Enterpise | Enterprise AI Market Intelligence | Confidence-labelled seed intelligence | v0.2
    </footer>
  );
}
