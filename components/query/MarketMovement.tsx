// Market Movement — high-impact ecosystem changes only.
// ──────────────────────────────────────────────────────
// Filters the classified news stream to surface only the six types
// of movement that matter to executives. Everything else is excluded.
// Every displayed item must answer: "Why does this matter?"

import { Confidence, Panel, SeedDataBadge } from "@/components/intelligence-ui";

/* ─── Movement types ─────────────────────────────────── */

interface MovementType {
  id: string;
  label: string;
  icon: string;
  /** Which news categories map to this movement type. */
  matchCategories: string[];
  /** Minimum impact score to qualify — filters out generic noise. */
  minImpact: number;
  color: string;
}

const MOVEMENT_TYPES: MovementType[] = [
  {
    id: "launches",
    label: "Major Launches",
    icon: "🚀",
    matchCategories: ["Product launch", "Model release"],
    minImpact: 50,
    color: "border-violet-300 dark:border-violet-700",
  },
  {
    id: "partnerships",
    label: "Major Partnerships",
    icon: "🤝",
    matchCategories: ["Partnership"],
    minImpact: 45,
    color: "border-sky-300 dark:border-sky-700",
  },
  {
    id: "investments",
    label: "Major Investments",
    icon: "💰",
    matchCategories: ["Funding", "Market movement"],
    minImpact: 50,
    color: "border-emerald-300 dark:border-emerald-700",
  },
  {
    id: "acquisitions",
    label: "Major Acquisitions",
    icon: "🏢",
    matchCategories: ["M&A", "Strategy signal"],
    minImpact: 55,
    color: "border-amber-300 dark:border-amber-700",
  },
  {
    id: "regulation",
    label: "Regulatory Developments",
    icon: "⚖️",
    matchCategories: ["Regulation", "Risk event"],
    minImpact: 40,
    color: "border-rose-300 dark:border-rose-700",
  },
  {
    id: "breakthroughs",
    label: "Capability Breakthroughs",
    icon: "⚡",
    matchCategories: ["Infrastructure", "Model release"],
    minImpact: 60,
    color: "border-indigo-300 dark:border-indigo-700",
  },
];

/* ─── Props ──────────────────────────────────────────── */

interface NewsItem {
  id: string;
  title: string;
  summary: string;
  whyItMatters: string;
  categories: string[];
  impactScore: number;
  confidenceScore: number;
  publishedAt: string;
  vendors: string[];
}

interface Props {
  news: NewsItem[];
  provenance: { source: "seed" | "live"; reason: string };
}

export default function MarketMovement({ news, provenance }: Props) {
  // Classify and filter — only high-impact events that match a movement type
  const movements = MOVEMENT_TYPES.map((type) => {
    const matched = news
      .filter((item) =>
        item.categories.some((c) => type.matchCategories.includes(c))
        && item.impactScore >= type.minImpact,
      )
      .sort((a, b) => b.impactScore - a.impactScore)
      .slice(0, 3);
    return { type, items: matched };
  }).filter((m) => m.items.length > 0);

  if (movements.length === 0) {
    return (
      <section className="mb-8">
        <Panel title="Market Movement">
          <p className="text-sm text-[#5f685a] dark:text-zinc-400">
            No significant market developments in the current period. Check back after the next update.
          </p>
          <SeedDataBadge label={provenance.source === "live" ? "Live" : "Seed"} provenance={provenance.source} reason={provenance.reason} />
        </Panel>
      </section>
    );
  }

  return (
    <section className="mb-8">
      <div className="mb-5">
        <h2 className="text-xl font-semibold text-[#18201b] dark:text-zinc-100">What Changed</h2>
        <p className="mt-1 text-sm text-[#5f685a] dark:text-zinc-400">
          The most important developments in the AI market right now.
          Only significant events are shown — routine announcements are filtered out.
        </p>
      </div>

      <div className="space-y-6">
        {movements.map(({ type, items }) => (
          <div key={type.id}>
            {/* Movement type header */}
            <div className="flex items-center gap-2 mb-3">
              <span className="text-lg" aria-hidden>{type.icon}</span>
              <h3 className="text-sm font-semibold uppercase tracking-wide text-[#18201b] dark:text-zinc-100">
                {type.label}
              </h3>
              <span className="rounded-full bg-[#eef2e8] px-2 py-0.5 text-[10px] font-semibold text-[#455044] dark:bg-zinc-800 dark:text-zinc-300">
                {items.length}
              </span>
            </div>

            {/* Event cards */}
            <div className="space-y-3">
              {items.map((item) => (
                <div
                  key={item.id}
                  className={`rounded-xl border-l-4 ${type.color} border border-[#dfe4da] bg-white p-4 dark:border-zinc-800 dark:bg-zinc-900`}
                >
                  {/* Title + impact */}
                  <div className="flex items-start justify-between gap-3">
                    <h4 className="text-sm font-semibold leading-5 text-[#18201b] dark:text-zinc-100">
                      {item.title}
                    </h4>
                    <div className="flex shrink-0 items-center gap-2">
                      <span className={`rounded-full px-2 py-0.5 text-[10px] font-bold ${
                        item.impactScore >= 70 ? "bg-rose-100 text-rose-800 dark:bg-rose-950/60 dark:text-rose-300"
                        : item.impactScore >= 50 ? "bg-amber-100 text-amber-800 dark:bg-amber-950/60 dark:text-amber-200"
                        : "bg-zinc-100 text-zinc-600 dark:bg-zinc-800 dark:text-zinc-400"
                      }`}>
                        Significance {item.impactScore >= 70 ? "High" : item.impactScore >= 50 ? "Medium" : "Low"}
                      </span>
                    </div>
                  </div>

                  {/* Why does this matter? — the required question */}
                  <div className="mt-3 rounded-lg bg-[#f5f7f2] px-3 py-2.5 dark:bg-zinc-800/60">
                    <div className="text-[10px] font-semibold uppercase tracking-wider text-[#697362] dark:text-zinc-500">
                      Why it matters
                    </div>
                    <p className="mt-1 text-sm leading-5 text-[#18201b] dark:text-zinc-100">
                      {item.whyItMatters}
                    </p>
                  </div>

                  {/* Metadata */}
                  <div className="mt-3 flex flex-wrap items-center gap-3 text-[10px] text-[#697362] dark:text-zinc-500">
                    <Confidence value={item.confidenceScore} />
                    {item.publishedAt && (
                      <span>{new Date(item.publishedAt).toLocaleDateString()}</span>
                    )}
                    {item.categories.slice(0, 2).map((c) => (
                      <span key={c} className="rounded bg-[#eef2e8] px-1.5 py-0.5 text-[10px] dark:bg-zinc-800">{c}</span>
                    ))}
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))}
      </div>

      <div className="mt-4">
        <SeedDataBadge
          label={provenance.source === "live" ? "Live" : "Seed"}
          provenance={provenance.source}
          reason={`${provenance.reason}. Only significant developments are shown. Routine announcements are filtered out.`}
        />
      </div>
    </section>
  );
}
