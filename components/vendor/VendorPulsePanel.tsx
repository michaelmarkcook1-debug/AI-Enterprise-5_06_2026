// The Pulse — per-vendor "what moved & why" daily briefing.
// ──────────────────────────────────────────────────────────
// AnalystGenius vendor-tab #1, assembled as a VIEW over data the profile already
// loads: recent vendor news (what moved) + the composite standing/momentum
// delta (the reality). DRAFT-framed (C4) — a starting read to pressure-test, not
// a verdict. Reads canonical, writes nothing. No new feed, no fabricated
// narrative: it only arranges cited news + the real evidence standing.

const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

export interface PulseNews {
  title: string;
  whyItMatters?: string;
  sourceName: string;
  sourceUrl?: string;
  publishedAt: string;
  impactScore: number;
}

export interface VendorPulseProps {
  vendorName: string;
  /** Recent cited news for this vendor (newest-first). */
  news: PulseNews[];
  /** Composite standing, when the vendor is ranked in a category. */
  standing?: { rank: number; peers: number; categoryName: string } | null;
  /** Overall-score momentum: signed delta over `days`, from real snapshots. */
  momentum?: { overallDelta: number; days: number } | null;
}

function ageLabel(iso: string): string {
  const days = Math.floor((Date.now() - Date.parse(iso)) / 86_400_000);
  if (Number.isNaN(days)) return "";
  if (days <= 0) return "today";
  if (days === 1) return "1 day ago";
  return `${days} days ago`;
}

export default function VendorPulsePanel({ vendorName, news, standing, momentum }: VendorPulseProps) {
  // "What moved" — the most consequential recent items (impact-ranked, capped).
  const moved = [...news].sort((a, b) => b.impactScore - a.impactScore).slice(0, 3);
  // Momentum band on the 0–100 composite scale: <1pt either way reads as steady.
  const dir = momentum ? (momentum.overallDelta > 1 ? "up" : momentum.overallDelta < -1 ? "down" : "flat") : null;

  return (
    <div>
      <div className="mb-2 flex flex-wrap items-center gap-2">
        <p className={`text-xs ${MUTED}`}>
          What moved for {vendorName} and where the evidence stands — a starting read over the cited
          news feed and the live composite.
        </p>
        <span className="rounded-full border border-sky-400/40 bg-sky-500/10 px-2 py-0.5 text-[10px] font-semibold uppercase tracking-wide text-sky-700 dark:text-sky-300">
          Draft — pressure-test it
        </span>
      </div>

      {/* The read — real evidence standing + momentum (no narrative invented). */}
      <div className="mb-3 flex flex-wrap gap-2 text-xs">
        {standing ? (
          <span className="rounded-lg border border-black/10 px-2.5 py-1 dark:border-white/10">
            Evidence standing: <strong>#{standing.rank}</strong> of {standing.peers} in {standing.categoryName}
          </span>
        ) : (
          <span className={`rounded-lg border border-black/10 px-2.5 py-1 dark:border-white/10 ${MUTED}`}>
            Not yet ranked on verified evidence
          </span>
        )}
        {dir && (
          <span
            className={`rounded-lg border px-2.5 py-1 ${
              dir === "up"
                ? "border-emerald-500/30 text-emerald-700 dark:text-emerald-300"
                : dir === "down"
                  ? "border-rose-500/30 text-rose-700 dark:text-rose-300"
                  : "border-black/10 dark:border-white/10 " + MUTED
            }`}
          >
            Momentum {dir === "up" ? "▲" : dir === "down" ? "▼" : "▪"}{" "}
            {dir === "flat" ? "steady" : `${momentum!.overallDelta > 0 ? "+" : ""}${momentum!.overallDelta.toFixed(1)} pts over ${momentum!.days}d`}
          </span>
        )}
      </div>

      {/* What moved — cited news, impact-ranked. */}
      {moved.length === 0 ? (
        <p className={`text-sm ${MUTED}`}>No cited news for {vendorName} in the current feed.</p>
      ) : (
        <ul className="space-y-2.5">
          {moved.map((n, i) => (
            <li key={i} className="rounded-lg border border-black/5 p-3 dark:border-white/10">
              {n.sourceUrl ? (
                <a href={n.sourceUrl} target="_blank" rel="noopener noreferrer" className="text-sm font-medium underline-offset-2 hover:underline">
                  {n.title}
                </a>
              ) : (
                <span className="text-sm font-medium">{n.title}</span>
              )}
              {n.whyItMatters && <p className={`mt-1 text-xs leading-5 ${MUTED}`}>{n.whyItMatters}</p>}
              <p className={`mt-1 text-[11px] ${MUTED}`}>
                {n.sourceName} · {ageLabel(n.publishedAt)} · impact {Math.round(n.impactScore)}
                <span className="ml-1">(directional estimate)</span>
              </p>
            </li>
          ))}
        </ul>
      )}

      <p className={`mt-2 text-[11px] ${MUTED}`}>
        The Pulse is a view over the cited news feed + the live evidence composite — impact scores
        are directional, the standing is evidence-graded, and the framing is a draft to challenge.
      </p>
    </div>
  );
}
