import type { Metadata } from "next";
import Link from "next/link";
import { absoluteUrl } from "@/lib/site";
import { getLiveModelInventory, type LiveModel } from "@/lib/model-inventory/live";
import { buildFrontierComparison, summarizeFrontierComparison } from "@/lib/model-inventory/frontier";
import FrontierFaceOff from "@/components/models/FrontierFaceOff";
import DataUnavailable from "@/components/DataUnavailable";

// Live, cited model inventory from ModelQualityBenchmark (Artificial Analysis
// Intelligence/Coding/Agentic Index). Force-dynamic so it always reflects the
// latest ingested benchmarks; no seed, no hardcoded surface — a model shows
// ONLY when it has a real, source-linked row.
export const dynamic = "force-dynamic";

const TITLE = "AI Model Inventory";
const DESCRIPTION =
  "The commercial models across enterprise AI vendors, scored on independent, cited benchmarks — with explicit data-freshness. No unlabelled estimates.";

export const metadata: Metadata = {
  title: TITLE,
  description: DESCRIPTION,
  alternates: { canonical: "/models" },
  openGraph: { title: TITLE, description: DESCRIPTION, url: absoluteUrl("/models"), type: "website" },
};

const CARD = "rounded-xl border border-black/10 dark:border-white/10 bg-white/60 dark:bg-white/5 p-5";
const MUTED = "text-[#15263c]/65 dark:text-[#eef3f8]/60";

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className={CARD}>
      <div className="text-2xl font-semibold tabular-nums">{value}</div>
      <div className={`mt-1 text-xs ${MUTED}`}>{label}</div>
    </div>
  );
}

const CATEGORY_LABEL: Record<string, string> = {
  intelligence: "Intelligence",
  coding: "Coding",
  agentic: "Agentic",
};
const catLabel = (c: string) => CATEGORY_LABEL[c] ?? c.replace(/_/g, " ");

function freshness(m: LiveModel): string {
  return m.publishDate ?? m.capturedAt.slice(0, 10);
}

export default async function ModelsPage() {
  const inv = await getLiveModelInventory();
  const frontier = buildFrontierComparison(inv);
  const frontierSummary = summarizeFrontierComparison(frontier);

  const header = (
    <header className="mb-8">
      <h1 className="font-[var(--font-display)] text-3xl font-extrabold tracking-tight">{TITLE}</h1>
      <p className={`mt-2 max-w-2xl text-sm ${MUTED}`}>{DESCRIPTION}</p>
    </header>
  );

  // Honest empty state — no benchmark evidence ingested (never a seed fallback).
  if (inv.totalModels === 0) {
    return (
      <main className="mx-auto max-w-6xl px-4 py-10">
        {header}
        <DataUnavailable
          title="Model inventory unavailable"
          detail="The model inventory appears only when backed by reviewed, source-backed benchmark evidence in our live data store. None has been ingested yet, so we hold it rather than show a hardcoded inventory as if current."
        />
      </main>
    );
  }

  return (
    <main className="mx-auto max-w-6xl px-4 py-10">
      {header}

      <FrontierFaceOff comparison={frontier} summary={frontierSummary} />

      <section className="mb-8 grid grid-cols-2 gap-3 sm:grid-cols-4">
        <Stat label="Models scored" value={inv.totalModels} />
        <Stat label="Vendors" value={inv.totalVendors} />
        <Stat label="Benchmark source" value={inv.sources.map((s) => (s === "artificial_analysis" ? "Artificial Analysis" : s)).join(", ")} />
        <Stat label="Freshest data" value={inv.freshestPublishDate ?? "—"} />
      </section>

      <section className={CARD}>
        <div className="overflow-x-auto">
          <table className="w-full border-collapse text-sm">
            <thead>
              <tr className={`text-left ${MUTED}`}>
                <th className="py-2 pr-4 font-medium">Model</th>
                <th className="py-2 pr-4 font-medium">Vendor</th>
                <th className="py-2 pr-4 font-medium tabular-nums">Headline Index</th>
                <th className="py-2 pr-4 font-medium">Benchmarks</th>
                <th className="py-2 pr-4 font-medium">As of</th>
                <th className="py-2 pr-4 font-medium">Source</th>
              </tr>
            </thead>
            <tbody>
              {inv.models.map((m) => (
                <tr key={`${m.vendorId}-${m.modelName}`} className="border-t border-black/5 dark:border-white/10 align-top">
                  <td className="py-2 pr-4 font-medium">{m.modelName}</td>
                  <td className="py-2 pr-4">{m.vendorName}</td>
                  <td className="py-2 pr-4 tabular-nums">
                    {m.headlineRating.toFixed(1)}
                    <span className={`ml-1 text-xs ${MUTED}`}>{catLabel(m.headlineCategory)}</span>
                  </td>
                  <td className="py-2 pr-4">
                    <span className="flex flex-wrap gap-1">
                      {m.categories.slice(0, 5).map((c) => (
                        <span
                          key={c.category}
                          className="rounded-full border border-black/10 dark:border-white/15 px-2 py-0.5 text-xs tabular-nums"
                          title={c.voteCount ? `${c.voteCount.toLocaleString()} votes` : undefined}
                        >
                          {catLabel(c.category)} {c.rating.toFixed(1)}
                        </span>
                      ))}
                    </span>
                  </td>
                  <td className="py-2 pr-4 whitespace-nowrap">{freshness(m)}</td>
                  <td className="py-2 pr-4">
                    <a
                      href={m.sourceUrl}
                      target="_blank"
                      rel="noopener noreferrer"
                      className="underline underline-offset-2"
                    >
                      {m.source === "artificial_analysis" ? "Artificial Analysis" : m.source}
                    </a>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <p className={`mt-4 text-xs ${MUTED}`}>
          Every rating is a real Artificial Analysis benchmark index, linked to its source and dated with a
          real per-model release date. Models appear only when a cited benchmark row exists — none are
          estimated. A vendor&apos;s absence means no benchmarked model, not a low score.
        </p>
      </section>

      <p className={`mt-6 text-sm ${MUTED}`}>
        Looking for vendor rankings? See the{" "}
        <Link href="/vendors" className="underline underline-offset-2">
          full vendor leaderboard
        </Link>
        .
      </p>
    </main>
  );
}
