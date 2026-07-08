// C16 — Pricing page. SCAFFOLD ONLY (billing OFF by default).
// Renders the tier ladder + entitlement matrix. Shows plans; charges nothing.
// The nav link to this page is gated behind PRICING_ENABLED (components/public/
// PublicNav.tsx); the page itself carries a clear "directional / not yet live"
// banner while BILLING_ENABLED is off so nobody mistakes it for a live checkout.

import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { absoluteUrl } from "@/lib/site";
import { BILLING_ENABLED, PRICING_ENABLED } from "@/lib/availability";
import { PLANS, annualMonthlyUsd, type Feature } from "@/lib/billing/plans";
import PricingTable, { type PlanView, type MatrixRow } from "@/components/pricing/PricingTable";

export const revalidate = 3600;

const TITLE = "Pricing";
const DESCRIPTION =
  "Independent, evidence-based enterprise-AI analysis — from a free market read to full assessment depth that undercuts the $45–125k incumbents on price and independence.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/pricing" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/pricing"), type: "website" },
};

const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

// Human labels for the entitlement matrix rows (order = display order).
const FEATURE_LABELS: { feature: Feature; label: string }[] = [
  { feature: "scorecard_full", label: "Full 12-domain evidence scorecard" },
  { feature: "citations_inline", label: "Inline evidence citations" },
  { feature: "weights_rerank", label: "Adjustable weights + live re-rank" },
  { feature: "interrogate", label: "Interrogate — context-lens re-run (credits)" },
  { feature: "prep_kit", label: "Vendor-meeting prep kit (credits)" },
  { feature: "watchlist_alerts", label: "Watchlist change alerts" },
  { feature: "exports", label: "Scorecard & shortlist exports" },
];

export default function PricingPage() {
  // Paywall/pricing surface is hidden until the owner deliberately reveals it
  // (PRICING_ENABLED=1). While off, the page 404s — no pricing/paywall is visible
  // anywhere on the live site (nav link already hidden, enforcement already off).
  // The scaffold stays intact behind the flag; flip it to bring pricing back.
  if (!PRICING_ENABLED) notFound();

  const plans: PlanView[] = PLANS.map((p) => ({
    id: p.id,
    name: p.name,
    tagline: p.tagline,
    priceMonthlyUsd: p.priceMonthlyUsd,
    annualMonthlyUsd: annualMonthlyUsd(p),
    creditsIncluded: p.creditsIncluded,
    highlighted: p.highlighted,
    contactSales: p.contactSales,
  }));

  const matrix: MatrixRow[] = FEATURE_LABELS.map(({ feature, label }) => ({
    feature,
    label,
    byPlan: Object.fromEntries(PLANS.map((p) => [p.id, p.features.includes(feature)])),
  }));

  return (
    <main className="mx-auto max-w-6xl px-4 py-16">
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#b08d2f] dark:text-[#d4af37]">
        Plans
      </p>
      <h1 className="font-display mt-2 text-4xl font-semibold leading-tight tracking-tight">
        Independent analysis, priced to undercut the incumbents
      </h1>
      <p className={`mt-3 max-w-2xl text-sm ${MUTED}`}>{DESCRIPTION}</p>

      {!BILLING_ENABLED && (
        <div className="mt-6 rounded-lg border border-[#d4af37]/40 bg-[#d4af37]/10 px-4 py-3 text-sm">
          <strong>Preview.</strong> Prices are directional and billing is not yet enabled — no card is
          captured and nothing is charged. Plans and caps will be confirmed before launch.
        </div>
      )}

      <PricingTable plans={plans} matrix={matrix} billingLive={BILLING_ENABLED} />

      <p className={`mt-10 text-xs ${MUTED}`}>
        Credits meter the two premium LLM actions (Interrogate re-runs and prep-kit generation). Each
        tier includes a monthly allotment; usage is always shown transparently, and hard caps prevent
        surprise overruns. Annual billing saves ~17%.
      </p>
    </main>
  );
}
