import Link from "next/link";
import type { DomainScore } from "@/lib/assessment/domain-rubric";
import type { DomainId } from "@/lib/types";
import { DOMAIN_LABEL } from "@/lib/assessment/domain-labels";

// Competitive Intel — a cross-vendor capability heatmap (rows = domains, cols =
// vendors), rendered ENTIRELY from the live 12-domain composites/scorecards.
// It is a VIEW of the ranking, NOT a new score: every cell is the vendor's
// existing evidence-graded domain score, and an unscored domain reads
// "insufficient" exactly as it does everywhere else — no fabrication, one engine.

const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

export interface IntelVendor {
  vendorId: string;
  vendorName: string;
  vendorSlug: string;
  domains: DomainScore[]; // the category's effective domain set (incl. model_quality / dev_sentiment when active)
}

/** 0–5 → gold intensity (on-brand, theme-safe). Insufficient renders blank. */
function cellStyle(score: number): string {
  if (score >= 4) return "bg-[#d4af37]/80 text-[#0a1f38]";
  if (score >= 3) return "bg-[#d4af37]/55 text-[#0a1f38]";
  if (score >= 2) return "bg-[#d4af37]/35";
  if (score >= 1) return "bg-[#d4af37]/18";
  return "bg-[#d4af37]/8";
}

export default function CompetitiveIntelHeatmap({
  vendors,
  domainOrder,
}: {
  vendors: IntelVendor[];
  domainOrder: DomainId[];
}) {
  if (vendors.length < 2) return null;

  // Index each vendor's scores by domain for O(1) cell lookup.
  const scoreOf = new Map<string, Map<DomainId, DomainScore>>();
  for (const v of vendors) {
    scoreOf.set(v.vendorId, new Map(v.domains.map((d) => [d.domain, d])));
  }

  return (
    <section className="mt-8 rounded-xl border border-black/10 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
      <div className="mb-1 flex flex-wrap items-baseline justify-between gap-2">
        <h2 className="font-[var(--font-display)] text-xl font-extrabold tracking-tight">
          Competitive intel — capability heatmap
        </h2>
        <span className={`text-[11px] ${MUTED}`}>A view of the live composite — not a new score</span>
      </div>
      <p className={`mb-4 text-xs ${MUTED}`}>
        Every cell is the vendor&apos;s evidence-graded 0–5 domain score from the same assessment
        that drives the ranking. Blank = insufficient evidence (never inferred). Read across a row
        to compare vendors on one capability; down a column for a vendor&apos;s profile.
      </p>

      <div className="overflow-x-auto">
        <table className="w-full min-w-[640px] border-separate border-spacing-0 text-left">
          <thead>
            <tr>
              <th className={`sticky left-0 z-10 bg-white/60 pb-2 pr-3 text-[11px] font-semibold uppercase tracking-wide dark:bg-transparent ${MUTED}`}>
                Domain
              </th>
              {vendors.map((v) => (
                <th key={v.vendorId} className="pb-2 pr-2 text-center">
                  <Link
                    href={`/vendors/${v.vendorSlug}`}
                    className="text-[11px] font-semibold underline-offset-2 hover:underline"
                    title={v.vendorName}
                  >
                    {v.vendorName.length > 12 ? `${v.vendorName.slice(0, 11)}…` : v.vendorName}
                  </Link>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {domainOrder.map((domain) => (
              <tr key={domain} className="border-t border-black/5 dark:border-white/10">
                <td className={`sticky left-0 z-10 max-w-[220px] bg-white/60 py-1.5 pr-3 align-middle text-xs dark:bg-transparent`}>
                  {DOMAIN_LABEL[domain]}
                </td>
                {vendors.map((v) => {
                  const d = scoreOf.get(v.vendorId)?.get(domain);
                  const scored = d && d.state === "scored";
                  return (
                    <td key={v.vendorId} className="px-1 py-1 text-center align-middle">
                      {scored ? (
                        <span
                          className={`inline-block w-full rounded px-1.5 py-1 text-xs font-medium tabular-nums ${cellStyle(d.score)}`}
                          title={`${v.vendorName} · ${DOMAIN_LABEL[domain]}: ${d.score.toFixed(1)}/5 (${d.bestGrade}${d.lowConfidence ? ", low confidence" : ""})`}
                        >
                          {d.score.toFixed(1)}
                        </span>
                      ) : (
                        <span className={`inline-block rounded px-1.5 py-1 text-[10px] ${MUTED}`} title="Insufficient evidence — no score">
                          —
                        </span>
                      )}
                    </td>
                  );
                })}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      <p className={`mt-3 text-[11px] ${MUTED}`}>
        Same engine, one honesty spine: scores are capped by evidence grade, insufficient stays
        insufficient (—), and nothing is inferred to fill a cell. Open any vendor for the cited working.
      </p>
    </section>
  );
}
