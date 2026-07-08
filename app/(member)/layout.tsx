import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getMember, getMemberOrTest } from "@/lib/member/auth";
import { MEMBER_AUTH_ENABLED, memberTestOpenEffective, PRICING_ENABLED } from "@/lib/availability";
import AppNav from "@/components/shell/AppNav";
import PublicFooter from "@/components/public/PublicFooter";

// Gated member shell. Server-guarded: an unauthenticated visitor is redirected
// to "/" (sign-in disabled) or /signin. Deliberately LEAN — a slim nav +
// the shared footer, NO TopNav freshness poller / NotLiveBanner. Reading the
// session cookie makes this dynamic (member pages are personalised anyway).
// Prompt 3: same unified AppNav as the public shell (retired the separate
// MemberNav) — one app shell, not two navs to keep in sync.
export const dynamic = "force-dynamic";

export default async function MemberLayout({ children }: { children: ReactNode }) {
  // Test-open resolves a shared test member so /monitor + /watchlist are
  // testable with sign-in off; a real session still wins.
  const [realMember, member] = await Promise.all([getMember(), getMemberOrTest()]);
  // Still nothing (auth off AND test-open off) → send to public home rather
  // than a dead /signin route. Existing valid sessions always pass through.
  if (!member) redirect(MEMBER_AUTH_ENABLED ? "/signin" : "/");

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <AppNav
        pricingEnabled={PRICING_ENABLED}
        showToggle={memberTestOpenEffective() && !realMember}
        initialViewMode="buyer"
        memberEmail={member.email}
        isRealSession={!!realMember}
      />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  );
}
