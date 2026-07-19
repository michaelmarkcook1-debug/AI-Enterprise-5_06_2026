// The Privacy & IP Trust Rank, cut to ONE vendor, for its live profile page.
// ─────────────────────────────────────────────────────────────────────────────
// This is the "live data link" between the curated Trust Rank (/shield) and the
// live vendor pages: a buyer reading Anthropic's profile sees Anthropic's own
// training / retention / indemnity / residency posture inline, each mark linking
// its receipt, with a jump to the full ranking.
//
// Server component, pure read over the crosswalk. Renders NOTHING for a vendor
// the Shield doesn't cover (a chip designer, a neocloud, an app vendor) — the
// Shield grades model providers, so its silence on those is "not applicable",
// never a low score. Firewalled: it reports the vendor's own terms, it never
// touches the composite ranking.

import Link from "next/link";
import { shieldForVendorId } from "@/lib/shield/vendor-map";
import { shieldScore, shieldCoverage, SHIELD_DIM_INFO, SHIELD_VERSION, type ShieldDim } from "@/lib/shield/data";
import { MARK_GLYPH, MARK_TONE, MARK_MEANING } from "@/lib/shield/marks";

const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";

export default function VendorShieldPanel({ vendorId }: { vendorId: string }) {
  const shield = shieldForVendorId(vendorId);
  if (!shield) return null; // out of scope for the Shield — show nothing, not a zero.

  const score = shieldScore(shield);
  const cov = shieldCoverage(shield);

  return (
    <section className="mt-3 rounded-xl border border-[#123d2c]/12 bg-white/60 p-4 dark:border-white/10 dark:bg-white/5" aria-labelledby="vendor-shield">
      <div className="mb-2 flex flex-wrap items-baseline justify-between gap-2">
        <h3 id="vendor-shield" className="text-sm font-semibold text-[#123d2c] dark:text-[#eef3f8]">
          Privacy &amp; IP Trust Rank
        </h3>
        <span className="flex items-center gap-2">
          <span className="font-mono text-sm font-semibold tabular-nums text-[#123d2c] dark:text-[#eef3f8]">{score}/4</span>
          <span
            title={`${cov} of 4 dimensions verified — a blank ("—") is a gap in our receipts, scored 0, not a verdict on the vendor.`}
            className={`font-mono text-[12px] tabular-nums ${cov === 4 ? MUTED : "text-[#b08d2f] dark:text-[#d4af37]"}`}
          >
            {cov}/4 verified
          </span>
        </span>
      </div>

      <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
        {SHIELD_DIM_INFO.map((d) => {
          const mark = shield.marks[d.key as ShieldDim];
          const chip = (
            <span
              title={`${MARK_MEANING[mark.state]}\n\n${mark.note}`}
              className={`inline-flex h-6 w-8 items-center justify-center rounded-md border bg-white/70 font-mono text-[12px] dark:bg-white/5 ${MARK_TONE[mark.state]}`}
            >
              {MARK_GLYPH[mark.state]}
            </span>
          );
          return (
            <div key={d.key} className="flex flex-col gap-1">
              <span className={`text-[12px] leading-tight ${MUTED}`}>{d.label}</span>
              {mark.source ? (
                <a href={mark.source.url} target="_blank" rel="noopener noreferrer" title={`${mark.note}\n\nSource: ${mark.source.name}`}>
                  {chip}
                </a>
              ) : (
                chip
              )}
            </div>
          );
        })}
      </div>

      <p className={`mt-3 text-[12px] leading-5 ${MUTED}`}>
        Each mark is quoted from the vendor&apos;s own published terms, verified {SHIELD_VERSION.slice(0, 10)} — curated
        reference, never part of the ranking score.{" "}
        <Link href="/shield" className="font-medium text-[#a07f1f] underline-offset-2 hover:underline dark:text-[#d4af37]">
          See the full Trust Rank →
        </Link>
      </p>
    </section>
  );
}
