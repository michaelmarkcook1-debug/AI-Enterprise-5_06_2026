"use client";

import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { VIEW_MODE_COOKIE } from "@/lib/member/view-mode-client";

// "View as: visitor <-> signed-in buyer" — a no-password preference cookie,
// NOT an auth action. It carries no access of its own: the server only ever
// shows buyer content when memberTestOpenEffective() is true (test/preview
// only), so this control is never rendered on real production at all (see
// shouldShowViewToggle) and flipping the cookie there would do nothing even
// if someone forged it by hand.
export default function ViewModeToggle({
  mode,
  variant = "desktop",
  onToggle,
}: {
  mode: "visitor" | "buyer";
  variant?: "desktop" | "mobile";
  /** Optimistic local update (e.g. AppNav's own label) — the cookie write is
   *  the source of truth; router.refresh() re-syncs actual page content
   *  (buyer dashboard vs visitor feed) from the server right after. */
  onToggle?: (next: "visitor" | "buyer") => void;
}) {
  const router = useRouter();
  const [pending, startTransition] = useTransition();
  const [busy, setBusy] = useState(false);

  function flip() {
    if (busy) return;
    setBusy(true);
    const next = mode === "buyer" ? "visitor" : "buyer";
    document.cookie = `${VIEW_MODE_COOKIE}=${next}; path=/; max-age=${30 * 24 * 60 * 60}; samesite=lax`;
    onToggle?.(next);
    startTransition(() => {
      router.refresh();
      setBusy(false);
    });
  }

  return (
    <button
      type="button"
      onClick={flip}
      disabled={pending}
      className={`items-center gap-1.5 rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-[#d8e2ec] transition-colors hover:border-[#d4af37]/50 hover:text-white disabled:opacity-60 ${
        variant === "desktop" ? "hidden md:inline-flex" : "flex w-full justify-center"
      }`}
      aria-label={mode === "buyer" ? "Exit buyer view, view as visitor" : "View as a signed-in buyer (demo)"}
    >
      <span className="h-1.5 w-1.5 rounded-full bg-[#d4af37]" aria-hidden />
      {mode === "buyer" ? "Viewing as: buyer — exit" : "View as: buyer (demo)"}
    </button>
  );
}
