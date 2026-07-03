import type { ReactNode } from "react";
import PublicNav from "@/components/public/PublicNav";
import { PRICING_ENABLED } from "@/lib/availability";
import PublicFooter from "@/components/public/PublicFooter";
import IntentBeacon from "@/components/IntentBeacon";
import AmbientHeroBackdrop from "@/components/AmbientHeroBackdrop";

// LEAN public shell. The whole reason this route group exists: public pages get
// NONE of the dashboard's live providers or pollers — no /api/system poll, no
// DB-on-render banner — so every public page reaches document-idle. The only
// client JS here is a static nav (theme toggle) + the fire-and-forget intent
// beacon (one sendBeacon per view, never an open connection).
export default function PublicLayout({ children }: { children: ReactNode }) {
  return (
    <>
      <AmbientHeroBackdrop />
      <IntentBeacon />
      <div className="relative z-10 flex min-h-screen flex-col">
        <PublicNav pricingEnabled={PRICING_ENABLED} />
        <div className="flex-1">{children}</div>
        <PublicFooter />
      </div>
    </>
  );
}
