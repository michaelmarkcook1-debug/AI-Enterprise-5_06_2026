import type { ReactNode } from "react";
import AppNav from "@/components/shell/AppNav";
import { PRICING_ENABLED, memberTestOpenEffective } from "@/lib/availability";
import PublicFooter from "@/components/public/PublicFooter";
import IntentBeacon from "@/components/IntentBeacon";
import AmbientHeroBackdrop from "@/components/AmbientHeroBackdrop";

// LEAN public shell. The whole reason this route group exists: public pages get
// NONE of the dashboard's live providers or pollers — no /api/system poll, no
// DB-on-render banner — so every public page reaches document-idle, and most
// stay statically generated (insights, use-cases, peers, pricing, ...).
//
// `showToggle` is the ONLY view-mode signal resolved here, and deliberately an
// ENV-only check (memberTestOpenEffective — no request-scoped cookie jar read)
// so this layout stays static — reading the actual ae_view_mode / session
// cookies would force every page under it dynamic (this app has no Partial
// Prerendering to split that).
// AppNav reconciles the real cookie value client-side post-hydration, gated on
// this same showToggle flag, so "never render buyer view on real production"
// still holds unconditionally (it's an env fact, not a cookie a client could
// forge its way around) — only the *default-render* nav label can lag by one
// paint on these 8 static pages. The homepage itself is already force-dynamic
// and resolves the real mode server-side for its actual content switch.
export default function PublicLayout({ children }: { children: ReactNode }) {
  const showToggle = memberTestOpenEffective();
  return (
    <>
      <AmbientHeroBackdrop />
      <IntentBeacon />
      <div className="relative z-10 flex min-h-screen flex-col">
        <AppNav pricingEnabled={PRICING_ENABLED} showToggle={showToggle} />
        <div className="flex-1">{children}</div>
        <PublicFooter />
      </div>
    </>
  );
}
