"use client";

import { usePathname } from "next/navigation";

export default function GlobalFooter() {
  const pathname = usePathname();
  // The AIEnterpriseShell renders its own footer; skip the global one on /.
  if (pathname === "/") return null;
  return (
    <footer className="border-t border-[#e3d9c0] px-6 py-4 text-xs text-[#4c5d75] dark:border-[#1d3a57] dark:bg-[#071827] dark:text-[#8fa5bb]">
      AI Enterprise | Enterprise AI Market Intelligence | Confidence-labelled seed intelligence | v0.2
    </footer>
  );
}
