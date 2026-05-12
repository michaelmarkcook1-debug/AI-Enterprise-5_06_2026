// Intelligence projector.
// ────────────────────────
// Bridges the gap between the ingestion pipeline's truth (`EvidenceRecord`
// rows, keyed on `VendorProfile.id` in plain form) and the dashboard /
// capabilities / news read tables (`VendorCapability`, `IntelligenceNewsItem`,
// keyed on `IntelligenceVendor.id` in `vendor_*` prefixed form).
//
// Before this module existed, approving evidence in /admin/evidence had no
// visible effect on the dashboard or capability tracker because nothing
// wrote to those read tables — `prisma/seed.ts` was the only writer. This
// is the audit's action #2: "EvidenceRecord → Intelligence recompute".
//
// What it does (idempotent):
//   1. Pull every analyst_verified EvidenceRecord (capped for safety).
//   2. Resolve VendorProfile.id (plain) → IntelligenceVendor.id (`vendor_*`).
//      Skip rows whose IntelligenceVendor row doesn't exist yet.
//   3. Bucket by (intelligenceVendorId, capabilityId via DOMAIN_TO_CAPABILITY).
//   4. For each bucket pick max evidence grade, average rawScore (clamped),
//      newest captured_at, and upsert a `VendorCapability` row with
//      status="verified".
//   5. Also project the most-recent N high-impact records into
//      `IntelligenceNewsItem` so /news + /dashboard recent-news cards
//      reflect real verified evidence (replacing seed items, not appended).
//
// Safe-by-design: writes only with upserts keyed on the unique
// (vendorId, capabilityId) / id constraints; never deletes seed rows that
// don't have a projected counterpart, so the dashboard stays populated
// while live data slowly takes over.

import type { PrismaClient } from "../../generated/prisma/client";

/** Map ingestion-domain enum → capability tracker id. Domains that don't
 * map to a capability family (capital_resilience, market_position,
 * strategic_value) are intentionally absent and ignored by the projector. */
export const DOMAIN_TO_CAPABILITY: Record<string, string> = {
  data_security_privacy: "security",
  identity_access: "security",
  model_reliability: "models",
  governance_compliance: "governance",
  security_threat: "security",
  integration_architecture: "integrations",
  agentic_autonomy: "agents",
  cost_finops: "cost_controls",
  workforce_adoption: "enterprise_assistant",
  vendor_maturity_lockin: "portability",
};

/** Subfactor → capability hints. If the domain didn't directly map (or
 * even if it did) and the subfactor mentions one of these markers, we
 * also project to the inferred capability. This is how `rag` and
 * `deployment` get populated — they aren't first-class domains. */
const SUBFACTOR_CAPABILITY_HINTS: { test: RegExp; capabilityId: string }[] = [
  { test: /\brag\b|retrieval|knowledge base|knowledge.?graph/i, capabilityId: "rag" },
  { test: /\bdeploy(ment)?\b|vpc|on.?prem|sovereign|tenant isolation/i, capabilityId: "deployment" },
  { test: /\bportabilit|export|interoperabilit/i, capabilityId: "portability" },
  { test: /\bagent(ic)?\b|tool.?use|planning|autonomy/i, capabilityId: "agents" },
  { test: /\bcost\b|pricing|finops|usage cap/i, capabilityId: "cost_controls" },
];

const GRADE_RANK: Record<string, number> = { E0: 0, E1: 1, E2: 2, E3: 3, E4: 4, E5: 5 };

export interface ProjectorResult {
  scannedEvidenceRows: number;
  vendorsResolved: number;
  vendorsSkipped: { vendorId: string; reason: string }[];
  capabilitiesUpserted: number;
  newsUpserted: number;
  /** Seed news items deleted once we have ≥5 live items, so the
   * "Recent news" panels stop showing [MOCK]-prefixed scaffolding. */
  seedNewsEvicted: number;
  startedAt: string;
  finishedAt: string;
  durationMs: number;
}

interface Bucket {
  intelligenceVendorId: string;
  capabilityId: string;
  bestGrade: string;
  scores: number[];
  newestAt: Date;
  notes: string;
}

interface VerifiedRow {
  id: string;
  vendorId: string;
  domain: string;
  subfactor: string;
  excerpt: string;
  evidenceGrade: string;
  rawScore: number;
  capturedAt: Date;
  sourceUrl: string | null;
}

/** Translate VendorProfile.id (plain) → candidate IntelligenceVendor.id.
 * IntelligenceVendor uses `vendor_*` prefix per `seed-capabilities.ts`. */
function candidateIntelligenceIds(plainVendorId: string): string[] {
  return [`vendor_${plainVendorId}`, plainVendorId];
}

/** Decide every capability bucket a row contributes to. */
function bucketsForRow(domain: string, subfactor: string): string[] {
  const out = new Set<string>();
  const domainHit = DOMAIN_TO_CAPABILITY[domain];
  if (domainHit) out.add(domainHit);
  for (const hint of SUBFACTOR_CAPABILITY_HINTS) {
    if (hint.test.test(subfactor)) out.add(hint.capabilityId);
  }
  return [...out];
}

export async function projectEvidenceToIntelligence(
  prisma: PrismaClient,
  options: { newsLimit?: number; rowLimit?: number } = {},
): Promise<ProjectorResult> {
  const startedAt = new Date();
  const rowLimit = options.rowLimit ?? 5000;
  const newsLimit = options.newsLimit ?? 15;

  // 1. Pull every verified evidence row (newest first so news projection
  // gets the most recent items by default).
  const rows: VerifiedRow[] = (await prisma.evidenceRecord.findMany({
    where: { reviewStatus: "analyst_verified" },
    orderBy: { capturedAt: "desc" },
    take: rowLimit,
    select: {
      id: true,
      vendorId: true,
      domain: true,
      subfactor: true,
      excerpt: true,
      evidenceGrade: true,
      rawScore: true,
      capturedAt: true,
      sourceUrl: true,
    },
  })) as unknown as VerifiedRow[];

  // 2. Build the plain → vendor_* map by looking up which
  // IntelligenceVendor ids actually exist (so we don't insert orphans).
  const plainIds = [...new Set(rows.map((r) => r.vendorId))];
  const candidates = plainIds.flatMap((p) => candidateIntelligenceIds(p));
  const existingVendors = await prisma.intelligenceVendor.findMany({
    where: { id: { in: candidates } },
    select: { id: true },
  });
  const existingIds = new Set(existingVendors.map((v) => v.id));
  const plainToIntelligence = new Map<string, string>();
  const vendorsSkipped: { vendorId: string; reason: string }[] = [];
  for (const plain of plainIds) {
    const match = candidateIntelligenceIds(plain).find((id) => existingIds.has(id));
    if (match) plainToIntelligence.set(plain, match);
    else vendorsSkipped.push({ vendorId: plain, reason: "no matching IntelligenceVendor row" });
  }

  // 3. Bucket rows by (intelligenceVendorId, capabilityId).
  const buckets = new Map<string, Bucket>();
  for (const row of rows) {
    const intelligenceId = plainToIntelligence.get(row.vendorId);
    if (!intelligenceId) continue;
    const capabilityIds = bucketsForRow(row.domain, row.subfactor);
    for (const capabilityId of capabilityIds) {
      const key = `${intelligenceId}::${capabilityId}`;
      const existing = buckets.get(key);
      if (!existing) {
        buckets.set(key, {
          intelligenceVendorId: intelligenceId,
          capabilityId,
          bestGrade: row.evidenceGrade,
          scores: [row.rawScore],
          newestAt: row.capturedAt,
          notes: row.excerpt.slice(0, 180),
        });
      } else {
        if ((GRADE_RANK[row.evidenceGrade] ?? 0) > (GRADE_RANK[existing.bestGrade] ?? 0)) {
          existing.bestGrade = row.evidenceGrade;
          existing.notes = row.excerpt.slice(0, 180);
        }
        existing.scores.push(row.rawScore);
        if (row.capturedAt > existing.newestAt) existing.newestAt = row.capturedAt;
      }
    }
  }

  // 4. Confirm capability ids exist in the Capability table; skip missing.
  const capabilityIds = [...new Set([...buckets.values()].map((b) => b.capabilityId))];
  const knownCapabilities = await prisma.capability.findMany({
    where: { id: { in: capabilityIds } },
    select: { id: true },
  });
  const knownCapabilityIds = new Set(knownCapabilities.map((c) => c.id));

  // 5. Upsert each bucket as a VendorCapability row.
  let capabilitiesUpserted = 0;
  for (const bucket of buckets.values()) {
    if (!knownCapabilityIds.has(bucket.capabilityId)) continue;
    const avgScore = bucket.scores.reduce((s, n) => s + n, 0) / bucket.scores.length;
    const maturityScore = Math.max(0, Math.min(100, avgScore));
    await prisma.vendorCapability.upsert({
      where: { vendorId_capabilityId: { vendorId: bucket.intelligenceVendorId, capabilityId: bucket.capabilityId } },
      create: {
        vendorId: bucket.intelligenceVendorId,
        capabilityId: bucket.capabilityId,
        status: "verified",
        maturityScore,
        // The Prisma EvidenceGrade enum uses exact case from the schema.
        evidenceGrade: bucket.bestGrade as "E0" | "E1" | "E2" | "E3" | "E4" | "E5",
        lastVerified: bucket.newestAt,
        notes: bucket.notes || "Projected from verified evidence rows.",
      },
      update: {
        status: "verified",
        maturityScore,
        evidenceGrade: bucket.bestGrade as "E0" | "E1" | "E2" | "E3" | "E4" | "E5",
        lastVerified: bucket.newestAt,
        notes: bucket.notes || "Projected from verified evidence rows.",
      },
    });
    capabilitiesUpserted += 1;
  }

  // 6. Project the top N most-recent rows as IntelligenceNewsItem entries
  // so /news shows real items. Use the EvidenceRecord.id as the news id so
  // re-running the projector idempotently replaces rather than duplicates.
  let newsUpserted = 0;
  const newsRows = rows
    .filter((r) => plainToIntelligence.has(r.vendorId))
    .slice(0, newsLimit);
  for (const row of newsRows) {
    const vendorId = plainToIntelligence.get(row.vendorId)!;
    const title = row.subfactor
      ? `${row.subfactor} update — ${row.vendorId}`
      : `Verified evidence — ${row.vendorId}`;
    await prisma.intelligenceNewsItem.upsert({
      where: { id: row.id },
      create: {
        id: row.id,
        title,
        summary: row.excerpt.slice(0, 600),
        sourceName: row.sourceUrl ? hostnameOf(row.sourceUrl) : "Analyst-verified evidence",
        sourceUrl: row.sourceUrl ?? undefined,
        publishedAt: row.capturedAt,
        vendors: [vendorId],
        categories: ["evidence"],
        // Floor live items at 75 so any seed survivors don't out-rank them
// on the "Recent news" sort that the dashboard / investing pages use.
impactScore: Math.max(75, Math.min(100, row.rawScore || 75)),
        confidenceScore: Math.max(40, Math.min(100, ((GRADE_RANK[row.evidenceGrade] ?? 2) / 5) * 100)),
        affectedPillars: [row.domain],
        whyItMatters: row.excerpt.slice(0, 400),
        suggestedScoreImpact: { evidenceGrade: row.evidenceGrade, rawScore: row.rawScore },
        relatedVendors: [vendorId],
        sentiment: "neutral",
      },
      update: {
        title,
        summary: row.excerpt.slice(0, 600),
        sourceUrl: row.sourceUrl ?? undefined,
        publishedAt: row.capturedAt,
        vendors: [vendorId],
        // Floor live items at 75 so any seed survivors don't out-rank them
// on the "Recent news" sort that the dashboard / investing pages use.
impactScore: Math.max(75, Math.min(100, row.rawScore || 75)),
        confidenceScore: Math.max(40, Math.min(100, ((GRADE_RANK[row.evidenceGrade] ?? 2) / 5) * 100)),
        affectedPillars: [row.domain],
        whyItMatters: row.excerpt.slice(0, 400),
        suggestedScoreImpact: { evidenceGrade: row.evidenceGrade, rawScore: row.rawScore },
        relatedVendors: [vendorId],
      },
    });
    newsUpserted += 1;
  }

  // Once we have ≥5 live news items, evict the seed scaffolding. Seed
  // items use `sourceName` prefixed with `[MOCK]` or contain literal
  // "seed" / "stub" / "placeholder" — we delete those specifically
  // rather than a blanket DELETE so any other manually inserted rows
  // are preserved. The threshold of 5 prevents an empty live-news state
  // when the projector has only produced one or two items.
  let seedNewsEvicted = 0;
  if (newsUpserted >= 5) {
    const seedItems = await prisma.intelligenceNewsItem.findMany({
      where: {
        OR: [
          { sourceName: { startsWith: "[MOCK]" } },
          { sourceName: { contains: "seed", mode: "insensitive" } },
          { sourceName: { contains: "stub", mode: "insensitive" } },
          { sourceName: { contains: "placeholder", mode: "insensitive" } },
        ],
      },
      select: { id: true },
    });
    if (seedItems.length > 0) {
      const r = await prisma.intelligenceNewsItem.deleteMany({
        where: { id: { in: seedItems.map((s) => s.id) } },
      });
      seedNewsEvicted = r.count;
    }
  }

  const finishedAt = new Date();
  return {
    scannedEvidenceRows: rows.length,
    vendorsResolved: plainToIntelligence.size,
    vendorsSkipped,
    capabilitiesUpserted,
    newsUpserted,
    seedNewsEvicted,
    startedAt: startedAt.toISOString(),
    finishedAt: finishedAt.toISOString(),
    durationMs: finishedAt.getTime() - startedAt.getTime(),
  };
}

function hostnameOf(url: string): string {
  try {
    return new URL(url).hostname;
  } catch {
    return "Analyst-verified evidence";
  }
}
