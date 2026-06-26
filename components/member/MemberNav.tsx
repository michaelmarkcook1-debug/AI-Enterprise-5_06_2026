"use client";

import { useState } from "react";
import Link from "next/link";
import BrandLogo from "@/components/BrandLogo";

// Slim member chrome — static links + a sign-out action. Deliberately lean: NO
// freshness poller / live providers (those belong to the internal dashboard).
export default function MemberNav({ email }: { email: string }) {
  const [signingOut, setSigningOut] = useState(false);

  async function signOut() {
    if (signingOut) return;
    setSigningOut(true);
    try {
      await fetch("/api/auth/signout", { method: "POST" });
    } catch {
      // ignore — clear client state regardless
    }
    window.location.href = "/";
  }

  return (
    <header className="sticky top-0 z-30 border-b border-[#d4af37]/30 bg-[#0a1f38]/[0.97] backdrop-blur dark:border-[#d4af37]/20 dark:bg-[#071827]/[0.97]">
      <div className="mx-auto flex h-14 max-w-5xl items-center gap-5 px-5">
        <Link href="/" className="flex items-center" aria-label="AI Enterprise — home">
          <BrandLogo size={30} onDark />
        </Link>
        <nav className="hidden flex-1 items-center gap-1 text-sm md:flex">
          <Link href="/monitor" className="rounded-md px-3 py-1.5 font-medium text-white">
            Monitor
          </Link>
          <Link href="/watchlist" className="rounded-md px-3 py-1.5 font-medium text-[#c8d7e9] hover:text-white">
            My watchlist
          </Link>
          <Link href="/vendors" className="rounded-md px-3 py-1.5 font-medium text-[#c8d7e9] hover:text-white">
            Rankings
          </Link>
          <Link href="/dependencies" className="rounded-md px-3 py-1.5 font-medium text-[#c8d7e9] hover:text-white">
            Graph
          </Link>
        </nav>
        <div className="ml-auto flex items-center gap-3">
          <span className="hidden text-[11px] text-[#9fb3c8] sm:inline">{email}</span>
          <button
            type="button"
            onClick={signOut}
            disabled={signingOut}
            className="rounded-full border border-white/20 px-3 py-1.5 text-xs font-semibold text-[#d8e2ec] transition-colors hover:border-[#d4af37]/50 hover:text-white disabled:opacity-60"
          >
            {signingOut ? "…" : "Sign out"}
          </button>
        </div>
      </div>
    </header>
  );
}
