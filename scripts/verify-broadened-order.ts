// Verify the BROADENED model_quality + resulting frontier order IN-MEMORY from
// live data — no DB write. Mirrors exactly what production computes once the
// benchmark rows are seeded: same Artificial Analysis source, same blend, same
// composite.
import "./_load-env";
import { getPrisma } from "../lib/prisma";
import { fetchArtificialAnalysisModels } from "../lib/system/artificial-analysis-fetch";
import { blendModelQuality } from "../lib/system/model-quality-blend";
import { blendToDomainScore } from "../lib/assessment/model-quality-score";
import { getVendorScorecardsBatch } from "../lib/assessment/domain-scores";
import { resolveDomainWeights } from "../lib/assessment/category-weights";
import { rankVendorsByComposite, computeWeightedComposite } from "../lib/assessment/composite";
import type { DomainScore } from "../lib/assessment/domain-rubric";

const SLUG = "frontier_model_api";

async function main() {
  const now = new Date();
  const prisma = getPrisma();

  // Frontier members = vendors with a market-share estimate in this category.
  const estimates = await prisma.marketShareEstimate.findMany({
    where: { categoryId: SLUG },
    select: { vendorId: true },
  });
  const memberIds = [...new Set(estimates.map((e) => e.vendorId))];
  const vendorRows = await prisma.intelligenceVendor.findMany({
    where: { id: { in: memberIds } },
    select: { id: true, name: true },
  });
  const nameById = new Map(vendorRows.map((v) => [v.id, v.name]));

  // Broadened model_quality from LIVE Artificial Analysis indices (in-memory blend).
  const outcome = await fetchArtificialAnalysisModels();
  const blendedMQ = new Map<string, DomainScore>();
  const mqMeta = new Map<string, { score: number; cov: number; model: string }>();
  if (outcome.status === "ok") {
    const byVendor = new Map<string, typeof outcome.result.models>();
    for (const m of outcome.result.models) byVendor.set(m.vendorId, [...(byVendor.get(m.vendorId) ?? []), m]);
    for (const [vid, models] of byVendor) {
      const flagship = models
        .filter((m) => m.intelligenceIndex != null)
        .sort((a, b) => (b.intelligenceIndex ?? 0) - (a.intelligenceIndex ?? 0))[0];
      if (!flagship) continue;
      const blend = blendModelQuality(flagship);
      if (blend) {
        blendedMQ.set(vid, blendToDomainScore(blend, now));
        mqMeta.set(vid, { score: blend.score, cov: blend.contributions.length, model: flagship.modelName });
      }
    }
  }

  // Evidence-domain scorecards from the live DB (the other 12 domains).
  const scorecards = await getVendorScorecardsBatch(memberIds, now);

  const catWeights = resolveDomainWeights(SLUG);

  // Effective domain set per vendor: 12 evidence domains + broadened model_quality.
  const ranker = memberIds.flatMap((id) => {
    const sc = scorecards.get(id);
    if (!sc) return [];
    const mq = blendedMQ.get(id);
    const domains = mq ? [...sc.domains, mq] : sc.domains;
    return [{ vendorId: id, domains }];
  });

  const ranked = rankVendorsByComposite(ranker, catWeights).filter((r) => r.ranked);

  console.log(`\n══ BROADENED frontier_model_api (in-memory, live data) ══`);
  console.log("rk vendor                       comp   cov    modelQ(0-4)  idx  flagship");
  ranked.forEach((r, i) => {
    const sc = scorecards.get(r.vendorId)!;
    const mq = blendedMQ.get(r.vendorId);
    const eff = mq ? [...sc.domains, mq] : sc.domains;
    const wc = computeWeightedComposite(eff, catWeights);
    const meta = mqMeta.get(r.vendorId);
    console.log(
      `${String(i + 1).padStart(2)} ${(nameById.get(r.vendorId) ?? r.vendorId).padEnd(28).slice(0, 28)} ` +
        `${(wc.composite).toFixed(2).padStart(5)}  ${String(Math.round(wc.rawCoverage * 100)).padStart(3)}%  ` +
        `${(meta ? meta.score.toFixed(2) : "—").padStart(10)}   ${meta ? meta.cov + "/3" : "—"}  ${meta?.model ?? ""}`,
    );
  });

  console.log(
    `\nMembers: ${memberIds.length} · ranked: ${ranked.length} · Artificial Analysis: ${outcome.status}` +
      (outcome.status === "ok" ? ` (${outcome.result.models.length} models, ${outcome.result.unmappedCreators.length} unmapped creators)` : ""),
  );
  await prisma.$disconnect();
}
main().catch((e) => { console.error(e); process.exit(1); });
