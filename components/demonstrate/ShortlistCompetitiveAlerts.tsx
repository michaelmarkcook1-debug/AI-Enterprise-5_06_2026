import { Panel } from "@/components/intelligence-ui";
import type { ShortlistCompetitiveAlert } from "@/lib/services/shortlist-alerts";

const pretty = (s: string) => s.replace(/_/g, " ");

// Competitive alerts for the buyer's shortlist: a new entrant that now overlaps
// a shortlisted vendor, with a re-selection head-to-head re-scored in the
// buyer's original assessment context. Renders nothing when there are no alerts.
export default function ShortlistCompetitiveAlerts({ alerts }: { alerts: ShortlistCompetitiveAlert[] }) {
  if (alerts.length === 0) return null;
  return (
    <section className="mb-6">
      <Panel title="Competitive alerts for your shortlist">
        <p className="mb-3 text-xs leading-5 text-[#56657b] dark:text-[#a7bacd]">
          A vendor has newly gained a capability that overlaps one of your shortlisted vendors — it now competes for
          that slot. Each is re-scored head-to-head in your original assessment context so you can decide whether to
          reconsider your selection.
        </p>
        <ul className="space-y-3">
          {alerts.map((a) => {
            const c = a.comparison;
            const challengerAhead = c ? c.delta > 0 : false;
            return (
              <li
                key={`${a.shortlistedId}_${a.challengerId}_${a.capabilityId}`}
                className="rounded-lg border border-[#e6dcc3] bg-[#faf8f1] p-3 dark:border-[#223a2e] dark:bg-[#0d1f17]"
              >
                <div className="text-sm leading-5 text-[#123d2c] dark:text-[#eef3f8]">
                  <strong>{a.challengerName}</strong> now offers <strong>{a.capabilityName}</strong> — overlapping your
                  shortlisted <strong>{a.shortlistedName}</strong>{" "}
                  <span className="text-xs text-[#6b7d93] dark:text-[#8fa5bb]">(maturity {Math.round(a.challengerMaturity)})</span>
                </div>
                {c ? (
                  <div className="mt-2">
                    <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm">
                      <span className="text-[#33455e] dark:text-[#c2d1e0]">
                        {c.incumbent.name}: <strong className="tabular-nums">{c.incumbent.finalScore}</strong>{" "}
                        <span className="text-xs uppercase text-[#6b7d93]">{pretty(c.incumbent.recommendationBand)}</span>
                      </span>
                      <span className="text-[#33455e] dark:text-[#c2d1e0]">
                        {c.challenger.name}: <strong className="tabular-nums">{c.challenger.finalScore}</strong>{" "}
                        <span className="text-xs uppercase text-[#6b7d93]">{pretty(c.challenger.recommendationBand)}</span>
                      </span>
                      <span
                        className={`rounded px-1.5 py-0.5 text-xs font-bold tabular-nums ${
                          challengerAhead
                            ? "bg-rose-100 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"
                            : "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300"
                        }`}
                        title="Challenger minus incumbent, re-scored in your assessment context"
                      >
                        {c.delta > 0 ? `+${c.delta}` : c.delta} pts
                      </span>
                    </div>
                    <p className="mt-1 text-xs leading-5 text-[#54647a] dark:text-[#a7bacd]">{c.verdict}</p>
                  </div>
                ) : (
                  <p className="mt-1 text-xs text-[#6b7d93] dark:text-[#8fa5bb]">
                    Run an assessment to enable the head-to-head re-selection comparison.
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      </Panel>
    </section>
  );
}
