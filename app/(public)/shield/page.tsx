// The Trust Rank — the Privacy & IP Shield ledger, ported from The Desk 2026-07-17.
// ─────────────────────────────────────────────────────────────────────────────
// PROVENANCE CLASS: curated cited reference, the same class as the dependency
// graph — and labelled the same way on the page. Every mark was read off the
// vendor's own published document on a stamped date and links back to it. It is
// NOT live-DB analyst-verified evidence, it never touches a vendor's composite
// score, and it must never be presented as either.
//
// Not gated on isLiveData(): that gate exists to stop seed ESTIMATES posing as
// measured fact. This is the opposite kind of data — no estimate anywhere, just
// quoted vendor terms with receipts. The honest framing is "verified as of a
// date", which the page states plainly, rather than darkness.

import type { Metadata } from "next";
import TrustRankTable from "@/components/shield/TrustRankTable";
import { SHIELD, SHIELD_VERSION } from "@/lib/shield/data";
import { shieldCoveredVendorIds } from "@/lib/shield/vendor-map";

export const metadata: Metadata = {
  title: "The Trust Rank — privacy & IP terms, with receipts",
  description:
    "Where the AI labs actually stand on training, retention, output IP indemnity and data residency — every mark quoted from the vendor's own terms and linked to its source. Re-weight it to your priorities.",
  alternates: { canonical: "/shield" },
};

const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";

export default function ShieldPage() {
  const gaps = SHIELD.reduce(
    (n, v) => n + Object.values(v.marks).filter((m) => m.state === "unverified").length,
    0,
  );
  const total = SHIELD.length * 4;
  const covered = shieldCoveredVendorIds().length;

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      <header className="mb-8 max-w-3xl">
        <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight">The Trust Rank</h1>
        <p className={`mt-3 text-sm leading-6 ${MUTED}`}>
          Four questions decide whether a model provider is safe to put your business on: does it{" "}
          <strong className="font-semibold">train on your data</strong>, how long does it{" "}
          <strong className="font-semibold">retain</strong> it, will it{" "}
          <strong className="font-semibold">defend you</strong> on an IP claim, and can you choose{" "}
          <strong className="font-semibold">where it lives</strong>. Every answer below is quoted from the vendor&apos;s
          own published terms and links straight back to the document. Nothing is inferred, modelled, or scored on vibes.
        </p>
        <p className={`mt-3 text-sm leading-6 ${MUTED}`}>
          We grade the <strong className="font-semibold">enterprise / paid tier</strong>, because that&apos;s the
          buyer&apos;s real context — free tiers often differ, and where they do the mark says so.
        </p>
      </header>

      <TrustRankTable />

      {/* One quiet caveat block, not a wall of badges. */}
      <section className={`mt-8 max-w-3xl space-y-3 border-t border-black/10 pt-5 text-sm leading-6 dark:border-white/10 ${MUTED}`}>
        <p>
          <strong className="font-semibold">Curated reference, verified as of {SHIELD_VERSION.slice(0, 10)}.</strong>{" "}
          Vendor terms change without notice, so treat every mark as read-on-that-date rather than a standing truth —
          the linked receipt is always the authority, not us. This ledger is analyst-curated and cited; it is not part
          of the live evidence base, and it never moves a vendor&apos;s ranking score.
        </p>
        <p>
          <strong className="font-semibold">
            {total - gaps} of {total} marks carry a receipt.
          </strong>{" "}
          The remaining {gaps} render &ldquo;—&rdquo; and score zero. That is a gap in our receipts, not a verdict on the
          vendor — so the rank under-claims rather than over-claims, and the n/4 counter beside each score tells you
          which kind of low score you&apos;re looking at.
        </p>
        <p>
          <strong className="font-semibold">Model providers only.</strong> These {SHIELD.length} are the labs whose own
          terms govern your IP; {covered} of them are vendors we rank. Clouds that resell these models (Azure OpenAI,
          Bedrock) inherit the lab&apos;s terms and belong in the dependency map instead. The other vendors we track are
          not weak here — the Shield simply doesn&apos;t apply to them.
        </p>
      </section>
    </main>
  );
}
