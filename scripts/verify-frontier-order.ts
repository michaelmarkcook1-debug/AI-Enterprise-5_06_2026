// One-off verification: compute the live frontier_model_api order via the EXACT
// production path (getCategoryComposite) + surface each vendor's Arena-Elo →
// model_quality 0–5 synthesis, so we can sign off the new order before merge.
import "./_load-env";

import { getCategoryComposite } from "../lib/ranking/category-composite";
import { getVendorScorecardsBatch } from "../lib/assessment/domain-scores";
import { categoryActivatesModelQuality } from "../lib/assessment/category-weights";
import { activeDomains } from "../lib/assessment/composite";
import { DOMAIN_LABEL } from "../lib/assessment/domain-labels";
import { ARENA_ELO_SOURCE_URL } from "../lib/system/elo-fetch";
import { getPrisma } from "../lib/prisma";

const prisma = getPrisma();

const SLUG = "frontier_model_api";

async function main() {
  const now = new Date();
  const composite = await getCategoryComposite(SLUG);
  if (!composite) {
    console.log(`No composite for ${SLUG} (category missing or read failure).`);
    return;
  }
  const { category, ranked, incomplete, isLive, methodologyNote, resolvedDomainWeights, lowDiscrimination, anomalies } =
    composite;

  console.log("══════════════════════════════════════════════════════════════════");
  console.log(`CATEGORY: ${category.name} (${category.id})`);
  console.log(`isLive: ${isLive}   lowDiscrimination: ${lowDiscrimination}`);
  console.log("══════════════════════════════════════════════════════════════════");

  const active = activeDomains(resolvedDomainWeights);
  console.log(`\nACTIVE DOMAINS (${active.length}) + resolved weights:`);
  for (const d of active) {
    const pct = ((resolvedDomainWeights[d] ?? 0) * 100).toFixed(1).padStart(5);
    console.log(`  ${pct}%  ${d}  — ${DOMAIN_LABEL[d]}`);
  }
  console.log(`  activatesModelQuality: ${categoryActivatesModelQuality(category.id)}`);

  // Pull each ranked/held vendor's scorecard (carries the synthesized
  // model_quality DomainScore) + raw Arena Elo rows so we can show the
  // model_quality 0–5 synthesis next to the ELO it came from.
  const allIds = [...ranked, ...incomplete].map((v) => v.vendorId);
  const scorecards = await getVendorScorecardsBatch(allIds);
  const mq = new Map(
    [...scorecards.entries()].flatMap(([id, sc]) => (sc.modelQuality ? [[id, sc.modelQuality] as const] : [])),
  );
  // Raw ELO pillar rows for citation/sanity.
  const eloRows = await prisma.intelligencePillarScore.findMany({
    where: { vendorId: { in: allIds }, pillar: "model_quality" },
    select: { vendorId: true, capabilityScore: true, evidenceGrade: true },
  });
  const eloByVendor = new Map(eloRows.map((r) => [r.vendorId, r]));

  console.log(`\n────────── RANKED (${ranked.length}) ──────────`);
  console.log("rk  vendor                       comp  conf  cov(dom)   tier        modelQ(0-5)  ← Arena Elo");
  for (const v of ranked) {
    const m = mq.get(v.vendorId);
    const elo = eloByVendor.get(v.vendorId);
    const mqStr = m ? `${m.state === "scored" ? m.score.toFixed(2) : m.state}` : "—";
    const eloStr = elo ? `${Math.round(elo.capabilityScore)}` : "—";
    console.log(
      `${String(v.rank).padStart(2)}  ` +
        `${v.vendorName.padEnd(28).slice(0, 28)} ` +
        `${(v.assessmentComposite ?? 0).toFixed(2).padStart(5)} ` +
        `${String(v.compositeConfidence ?? 0).padStart(4)}% ` +
        `${String(v.domainScored).padStart(2)}/${String(v.domainTotal).padEnd(2)}     ` +
        `${(v.tier ?? "—").padEnd(10)}  ` +
        `${mqStr.padStart(10)}   ${eloStr}`,
    );
  }

  console.log(`\n────────── HELD / INCOMPLETE (${incomplete.length}) ──────────`);
  for (const v of incomplete) {
    const m = mq.get(v.vendorId);
    const elo = eloByVendor.get(v.vendorId);
    const mqStr = m ? (m.state === "scored" ? m.score.toFixed(2) : m.state) : "—";
    const eloStr = elo ? `${Math.round(elo.capabilityScore)}` : "—";
    console.log(
      `    ${v.vendorName.padEnd(28).slice(0, 28)} ` +
        `${String(v.domainScored).padStart(2)}/${String(v.domainTotal).padEnd(2)}  ` +
        `modelQ=${mqStr.padStart(10)}  elo=${eloStr}  — ${v.excludedReason ?? ""}`,
    );
  }

  console.log(`\n────────── ELO COVERAGE (model_quality pillar rows present) ──────────`);
  console.log(`  ${eloRows.length} of ${allIds.length} member vendors have a model_quality (Arena Elo) row.`);
  const sampleGrade = eloRows[0]?.evidenceGrade;
  console.log(`  citation: ${ARENA_ELO_SOURCE_URL}  (evidence grade e.g. ${sampleGrade ?? "?"})`);

  if (anomalies && anomalies.length > 0) {
    console.log(`\n⚠ ANOMALIES (${anomalies.length}):`);
    for (const a of anomalies) console.log(`  ${a}`);
  } else {
    console.log(`\n✓ No ranking anomalies flagged.`);
  }

  console.log(`\n────────── METHODOLOGY NOTE ──────────\n${methodologyNote}`);

  await prisma.$disconnect();
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
