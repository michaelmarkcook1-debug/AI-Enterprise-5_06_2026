// The Shield, cut to one saved decision's shortlist — "is what I'm about to buy
// safe to put my business on?", answered only for the vendors actually in play.
// ─────────────────────────────────────────────────────────────────────────────
// Server component: pure read over the curated ledger, no DB, no interactivity.
//
// THE RULE THIS PANEL EXISTS TO RESPECT: the Shield grades model providers. A
// shortlist routinely contains vendors it cannot speak to (an app vendor, a
// neocloud, a chip designer). Those are NOT weak on privacy and must never be
// scored, ranked below, greyed as failures, or silently dropped. They are listed
// plainly as out-of-scope, because a buyer who sees 3 of 5 rows needs to know
// where the other 2 went — a shortlist panel that quietly omits vendors reads as
// a complete answer when it isn't.
//
// This panel never reorders the buyer's shortlist and never contributes to any
// composite. It reports; it does not judge the decision.

import { shieldForVendorId } from "@/lib/shield/vendor-map";
import { shieldScore, shieldCoverage, SHIELD_DIM_INFO, SHIELD_VERSION, type ShieldDim } from "@/lib/shield/data";
import { MARK_GLYPH, MARK_TONE, MARK_MEANING } from "@/lib/shield/marks";

const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";

export default function ShieldShortlistPanel({
  vendorIds,
  nameFor,
}: {
  vendorIds: string[];
  /** Display name from the caller's own entity map — we don't re-resolve it. */
  nameFor: (vendorId: string) => string;
}) {
  const covered = vendorIds.flatMap((vid) => {
    const s = shieldForVendorId(vid);
    return s ? [{ vid, shield: s }] : [];
  });
  const outOfScope = vendorIds.filter((vid) => !shieldForVendorId(vid));

  // Nothing on this shortlist is a model provider — say so and render no table,
  // rather than an empty grid that implies we looked and found nothing good.
  if (covered.length === 0) {
    return (
      <section className="mt-8" aria-labelledby="shield-shortlist">
        <h2 id="shield-shortlist" className="font-[var(--font-display)] text-xl font-bold tracking-tight">
          Privacy &amp; IP posture
        </h2>
        <p className={`mt-2 max-w-2xl text-sm leading-6 ${MUTED}`}>
          None of the {vendorIds.length} vendors on this shortlist is a model provider, so the Shield has nothing to
          say about them. It grades the labs whose own terms govern your IP — training, retention, output indemnity and
          residency. That&apos;s not a gap in these vendors; it&apos;s a question that doesn&apos;t apply to them.
        </p>
      </section>
    );
  }

  // Worst-first: the point of this panel is the thing that could stop the deal.
  const ranked = [...covered].sort(
    (a, b) => shieldScore(a.shield) - shieldScore(b.shield) || a.shield.vendor.localeCompare(b.shield.vendor),
  );

  return (
    <section className="mt-8" aria-labelledby="shield-shortlist">
      <div className="mb-3 flex flex-wrap items-baseline justify-between gap-2">
        <h2 id="shield-shortlist" className="font-[var(--font-display)] text-xl font-bold tracking-tight">
          Privacy &amp; IP posture
        </h2>
        <span className={`font-mono text-[12px] uppercase ${MUTED}`}>
          verified as of {SHIELD_VERSION.slice(0, 10)} · every mark links its receipt
        </span>
      </div>
      <p className={`mb-4 max-w-2xl text-sm leading-6 ${MUTED}`}>
        Weakest posture first — the thing most likely to stop this deal, not the thing that flatters it. Every mark is
        quoted from the vendor&apos;s own published terms; click any to read the source.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-collapse text-left">
          <thead>
            <tr className={`border-b border-black/10 font-mono text-[12px] uppercase tracking-wide dark:border-white/10 ${MUTED}`}>
              <th scope="col" className="py-2 pr-4 font-normal">Vendor</th>
              {SHIELD_DIM_INFO.map((d) => (
                <th key={d.key} scope="col" className="py-2 pr-3 font-normal">{d.label}</th>
              ))}
              <th scope="col" className="py-2 font-normal">Shield</th>
            </tr>
          </thead>
          <tbody>
            {ranked.map(({ vid, shield }) => (
              <tr key={vid} className="border-b border-black/5 dark:border-white/5">
                <td className="py-3 pr-4 text-sm font-semibold">{nameFor(vid)}</td>
                {(["training", "retention", "indemnity", "residency"] as ShieldDim[]).map((dim) => {
                  const mark = shield.marks[dim];
                  const chip = (
                    <span
                      title={`${MARK_MEANING[mark.state]}\n\n${mark.note}`}
                      className={`inline-flex h-7 min-w-11 items-center justify-center rounded-lg border bg-white/60 px-2 font-mono text-[12px] dark:bg-white/5 ${MARK_TONE[mark.state]}`}
                    >
                      {MARK_GLYPH[mark.state]}
                    </span>
                  );
                  return (
                    <td key={dim} className="py-3 pr-3">
                      {mark.source ? (
                        <a href={mark.source.url} target="_blank" rel="noopener noreferrer" title={`${mark.note}\n\nSource: ${mark.source.name}`}>
                          {chip}
                        </a>
                      ) : (
                        chip
                      )}
                    </td>
                  );
                })}
                <td className="py-3">
                  <span className="flex items-center gap-2">
                    <span className="font-mono text-sm font-semibold tabular-nums">{shieldScore(shield)}</span>
                    <span className={`font-mono text-[12px] tabular-nums ${shieldCoverage(shield) === 4 ? MUTED : "text-[#b08d2f] dark:text-[#d4af37]"}`}>
                      {shieldCoverage(shield)}/4
                    </span>
                  </span>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {outOfScope.length > 0 && (
        <p className={`mt-3 text-sm leading-6 ${MUTED}`}>
          <strong className="font-semibold">Not covered:</strong> {outOfScope.map(nameFor).join(", ")}. The Shield
          grades model providers only, so it has nothing to say about {outOfScope.length === 1 ? "this one" : "these"} —
          that is a question out of scope, not a weakness found.
        </p>
      )}
      <p className={`mt-2 text-sm leading-6 ${MUTED}`}>
        Analyst-curated and cited, read on the stamped date — vendor terms change without notice, so the linked receipt
        is the authority, not us. This never moves a vendor&apos;s ranking score.
      </p>
    </section>
  );
}
