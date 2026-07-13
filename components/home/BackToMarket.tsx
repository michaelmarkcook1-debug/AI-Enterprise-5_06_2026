"use client";

// An unmistakable "get me back to the market view" control for the buyer/demo
// home — the nav's "Viewing as: buyer — exit" pill is too subtle, so a visitor
// who toggles into the demo loses rankings + news with no obvious way back.
// Writes the SAME ae_view_mode cookie the nav toggle uses (visitor), then
// refreshes so the server re-renders the market home.

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { VIEW_MODE_COOKIE } from "@/lib/member/view-mode-client";

export default function BackToMarket() {
  const router = useRouter();
  const [pending, startTransition] = useTransition();

  function toMarket() {
    document.cookie = `${VIEW_MODE_COOKIE}=visitor; path=/; max-age=${30 * 24 * 60 * 60}; samesite=lax`;
    startTransition(() => router.refresh());
  }

  return (
    <button
      type="button"
      onClick={toMarket}
      disabled={pending}
      className="inline-flex items-center gap-1.5 rounded-full border border-[#d4af37]/50 bg-[#fbf6e4]/70 px-3 py-1.5 text-xs font-semibold text-[#8a6d1f] transition-colors hover:bg-[#fbf6e4] disabled:opacity-60 dark:border-[#d4af37]/40 dark:bg-[#1a1605]/40 dark:text-[#d4af37]"
      aria-label="Return to the market view with rankings and news"
    >
      <span aria-hidden>←</span> Market view · rankings &amp; news
    </button>
  );
}
