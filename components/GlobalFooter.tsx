"use client";

import { usePathname } from "next/navigation";
import SubscribeForm from "@/components/SubscribeForm";

export default function GlobalFooter() {
  const pathname = usePathname();
  // The AIEnterpriseShell renders its own footer; skip the global one on /.
  if (pathname === "/") return null;
  return (
    <footer className="border-t border-[#e3d9c0] px-6 py-8 dark:border-[#1d3a57] dark:bg-[#071827]">
      <div className="mx-auto flex max-w-6xl flex-col gap-6 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <p className="text-sm font-semibold text-[#15263c] dark:text-[#eef3f8]">Get the market read</p>
          <p className="mt-1 text-xs text-[#4c5d75] dark:text-[#8fa5bb]">
            Evidence-based moves in the enterprise-AI market — who&apos;s rising, who&apos;s exposed, who relies on whom.
          </p>
          <SubscribeForm source="footer" className="mt-3 max-w-sm" />
        </div>
        <div className="text-xs text-[#4c5d75] dark:text-[#8fa5bb] sm:text-right">
          AI Enterprise · Enterprise AI Market Intelligence
          <br />
          Confidence-labelled · independent rankings · v0.2
        </div>
      </div>
    </footer>
  );
}
