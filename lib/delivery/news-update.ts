// Delivery-partnership SELF-UPDATE hook (tiered pipeline + non-AI news filter).
// ───────────────────────────────────────────────────────────────────────────
// Keeps the curated delivery layer current from REAL news — never by invention.
//
// Tiered routing (cheap → mid, forward-compatible with the central routing table):
//   1. classifyDeliverySignal  (CHEAP/Haiku): is this an [SI]×[vendor] AI
//      delivery-partnership signal at all? Drops non-AI / non-delivery items.
//   2. extractDeliveryPartnership (MID/Sonnet): extract partner, vendor, tier,
//      action (add|upgrade|downgrade|mark_ended), implication, and the cited URL.
//   3. applyDeliveryUpdate (DB write): ADD/UPGRADE/DOWNGRADE/mark-ended a row —
//      ONLY from a real cited item, ONLY for a KNOWN partner + KNOWN vendor.
//
// HARD honesty guards (enforced in code, not just prompt):
//   • A real citation (http(s) URL) is REQUIRED for any write. No URL → rejected.
//   • partnerId must be a known DeliveryPartner; vendorId a known IntelligenceVendor.
//     Anything else → rejected (no invented partners/partnerships).
//   • Writes set provenance = news_confirmed and stamp sourceUrls + lastVerified.
//   • Tier comes from the cited item; we NEVER auto-promote observed→direct without it.
//   • Writes touch ONLY delivery_partnership rows — never any vendor score (firewall).

import { z } from "zod";
import { extractStructured, type LLMUsage } from "../agents/llm-client";
import { getPrisma, hasDatabase } from "../prisma";
import { DELIVERY_PARTNERS, type PartnershipTier, type EvidenceTierPartnership } from "./seed";
import { loadDeliveryPartnerSeed } from "./repository";
import { INTELLIGENCE_VENDORS } from "../intelligence/seed";
import { PRICES } from "../ingestion/cost-model";

// Tunable per-step model routing (the cheap/mid tiers). Cheap models classify and
// extract only — they never generate a user-facing claim; the structured output is
// re-validated and guard-checked before any write.
const CLASSIFY_MODEL = process.env.ANTHROPIC_DELIVERY_CLASSIFY_MODEL ?? "claude-haiku-4-5";
const EXTRACT_MODEL = process.env.ANTHROPIC_DELIVERY_EXTRACT_MODEL ?? "claude-sonnet-4-6";

const PARTNER_IDS = new Set(DELIVERY_PARTNERS.map((p) => p.id));
const VENDOR_IDS = new Set(INTELLIGENCE_VENDORS.map((v) => v.id));
const PARTNER_NAME_BY_ID = new Map(DELIVERY_PARTNERS.map((p) => [p.id, p.name.toLowerCase()]));

export interface NewsItem {
  title: string;
  snippet: string;
  url: string;
}

// ── 1. Classify (cheap tier) ────────────────────────────────────────────────
export const DeliverySignalSchema = z.object({
  isDeliverySignal: z.boolean(),
  partnerId: z.string().nullable(),
  vendorId: z.string().nullable(),
  confidence: z.number().min(0).max(1),
});
export type DeliverySignal = z.infer<typeof DeliverySignalSchema>;

const CLASSIFY_SYSTEM = `You triage news items for an IT-services / GSI AI delivery-partnership tracker.
Decide ONLY whether the item reports a system-integrator / consultancy (e.g. Accenture, Deloitte, TCS, IBM Consulting)
DELIVERING or PARTNERING to implement a specific AI MODEL vendor's product (e.g. OpenAI, Anthropic, Google, Microsoft, Mistral, Meta, Cohere, IBM).
- Non-AI news, generic AI commentary, vendor-only product news, and funding/M&A are NOT delivery signals.
- Only return partnerId / vendorId from the KNOWN rosters you are given. If you cannot map BOTH to the rosters, set isDeliverySignal=false and ids null.
Be conservative: when unsure, isDeliverySignal=false.`;

const CLASSIFY_TOOL = {
  name: "classify_delivery_signal",
  description: "Whether the item is an SI×vendor AI delivery-partnership signal, and the mapped roster ids.",
  jsonSchema: {
    type: "object",
    required: ["isDeliverySignal", "partnerId", "vendorId", "confidence"],
    properties: {
      isDeliverySignal: { type: "boolean" },
      partnerId: { type: ["string", "null"] },
      vendorId: { type: ["string", "null"] },
      confidence: { type: "number", minimum: 0, maximum: 1 },
    },
    additionalProperties: false,
  },
};

const DELIVERY_KEYWORDS =
  /\b(partner|partnership|alliance|deliver|deploy|implement|integrat|rollout|roll out|adopt|system integrat|go-to-market|practice)\b/i;

/** Deterministic stub: keyword-map the item to a known partner + vendor. No LLM, no fabrication. */
function stubClassify(item: NewsItem): DeliverySignal {
  const text = `${item.title} ${item.snippet}`.toLowerCase();
  const partnerId = [...PARTNER_NAME_BY_ID.entries()].find(([, name]) => text.includes(name))?.[0] ?? null;
  const vendorId = [...VENDOR_IDS].find((id) => new RegExp(`\\b${id}\\b`, "i").test(text)) ?? null;
  const isSignal = !!partnerId && !!vendorId && DELIVERY_KEYWORDS.test(text);
  return {
    isDeliverySignal: isSignal,
    partnerId: isSignal ? partnerId : null,
    vendorId: isSignal ? vendorId : null,
    confidence: isSignal ? 0.5 : 0,
  };
}

export async function classifyDeliverySignal(item: NewsItem) {
  const roster = `KNOWN SIs (partnerId): ${DELIVERY_PARTNERS.map((p) => `${p.id} (${p.name})`).join(", ")}
KNOWN AI vendors (vendorId): ${[...VENDOR_IDS].join(", ")}`;
  return extractStructured<DeliverySignal>({
    systemPrompt: CLASSIFY_SYSTEM,
    userPrompt: `${roster}\n\nITEM:\nTITLE: ${item.title}\nSNIPPET: ${item.snippet}\nURL: ${item.url}`,
    schema: CLASSIFY_TOOL,
    parse: (raw) => DeliverySignalSchema.parse(raw),
    maxTokens: 300,
    model: CLASSIFY_MODEL,
    fallback: () => stubClassify(item),
  });
}

// ── 2. Extract (mid tier) ───────────────────────────────────────────────────
export const DeliveryExtractionSchema = z.object({
  partnerId: z.string(),
  vendorId: z.string(),
  partnershipTier: z.enum(["direct_named", "cloud_certified", "observed_implementer"]),
  evidenceTier: z.enum(["strong", "moderate", "plausible_unverified"]),
  action: z.enum(["add", "upgrade", "downgrade", "mark_ended"]),
  implication: z.string().max(600),
  sourceUrl: z.string(),
});
export type DeliveryExtraction = z.infer<typeof DeliveryExtractionSchema>;

const EXTRACT_SYSTEM = `You extract a STRUCTURED AI delivery-partnership update from one cited news item.
- partnershipTier: direct_named (formally named by the model company) | cloud_certified (via AWS/Azure/GCP competency) | observed_implementer (deploying but not formally approved).
- evidenceTier: strong (explicit, named, dated) | moderate (reported, some specifics) | plausible_unverified (hinted, second-hand).
- action: add (new) | upgrade (stronger tier/evidence than before) | downgrade | mark_ended (the item reports the partnership ended).
- sourceUrl MUST be the cited item's URL. Never invent a URL.
- Only use partnerId / vendorId from the rosters. Output exactly what the item supports — never inflate the tier.`;

const EXTRACT_TOOL = {
  name: "extract_delivery_partnership",
  description: "Structured delivery-partnership update extracted from one cited item.",
  jsonSchema: {
    type: "object",
    required: ["partnerId", "vendorId", "partnershipTier", "evidenceTier", "action", "implication", "sourceUrl"],
    properties: {
      partnerId: { type: "string" },
      vendorId: { type: "string" },
      partnershipTier: { type: "string", enum: ["direct_named", "cloud_certified", "observed_implementer"] },
      evidenceTier: { type: "string", enum: ["strong", "moderate", "plausible_unverified"] },
      action: { type: "string", enum: ["add", "upgrade", "downgrade", "mark_ended"] },
      implication: { type: "string", maxLength: 600 },
      sourceUrl: { type: "string" },
    },
    additionalProperties: false,
  },
};

export async function extractDeliveryPartnership(item: NewsItem, signal: DeliverySignal) {
  return extractStructured<DeliveryExtraction | null>({
    systemPrompt: EXTRACT_SYSTEM,
    userPrompt: `LIKELY partnerId: ${signal.partnerId}\nLIKELY vendorId: ${signal.vendorId}\n\nITEM:\nTITLE: ${item.title}\nSNIPPET: ${item.snippet}\nURL: ${item.url}`,
    schema: EXTRACT_TOOL,
    parse: (raw) => DeliveryExtractionSchema.parse(raw),
    maxTokens: 500,
    model: EXTRACT_MODEL,
    // No LLM → no fabricated extraction. The classifier already mapped ids; without
    // a model we cannot responsibly assign a tier/action, so we extract nothing.
    fallback: () => null,
  });
}

// ── 3. Apply (DB write, guarded) ─────────────────────────────────────────────
const TIER_RANK: Record<PartnershipTier, number> = { observed_implementer: 0, cloud_certified: 1, direct_named: 2 };
const EV_RANK: Record<EvidenceTierPartnership, number> = { plausible_unverified: 0, moderate: 1, strong: 2 };

export interface ApplyResult {
  applied: boolean;
  action: DeliveryExtraction["action"];
  partnerId: string;
  vendorId: string;
  reason: string;
}

/* eslint-disable @typescript-eslint/no-explicit-any */
export interface DeliveryWriteDelegate {
  findUnique(args: any): Promise<any>;
  findFirst(args: any): Promise<any>;
  upsert(args: any): Promise<any>;
  update(args: any): Promise<any>;
  updateMany(args: any): Promise<any>;
}
/* eslint-enable @typescript-eslint/no-explicit-any */

function isRealCitation(url: string | undefined | null): boolean {
  return typeof url === "string" && /^https?:\/\/[^\s]+\.[^\s]+/i.test(url.trim());
}

/**
 * Apply one extracted update with the hard honesty guards. Pure of any score
 * table — touches delivery_partnership only. Pass a delegate for testing; defaults
 * to the live Prisma delegate.
 */
export async function applyDeliveryUpdate(
  ex: DeliveryExtraction,
  opts: { delegate?: DeliveryWriteDelegate; now?: Date } = {},
): Promise<ApplyResult> {
  const now = opts.now ?? new Date();
  const base: Omit<ApplyResult, "applied" | "reason"> = { action: ex.action, partnerId: ex.partnerId, vendorId: ex.vendorId };

  // Guard 1: known entities only — no invented partners/partnerships.
  if (!PARTNER_IDS.has(ex.partnerId)) return { ...base, applied: false, reason: "unknown_partner" };
  if (!VENDOR_IDS.has(ex.vendorId)) return { ...base, applied: false, reason: "unknown_vendor" };
  // Guard 2: a real citation is mandatory for ANY write.
  if (!isRealCitation(ex.sourceUrl)) return { ...base, applied: false, reason: "no_citation" };

  const delegate = opts.delegate ?? (hasDatabase() ? (getPrisma().deliveryPartnership as unknown as DeliveryWriteDelegate) : null);
  if (!delegate) return { ...base, applied: false, reason: "no_database" };

  const whereUnique = {
    deliveryPartnerId_aiVendorId_partnershipTier: {
      deliveryPartnerId: ex.partnerId,
      aiVendorId: ex.vendorId,
      partnershipTier: ex.partnershipTier,
    },
  };

  if (ex.action === "mark_ended") {
    // End ONLY the specific tier the citation reports — never every tier for the pair.
    // (A cited item about an observed_implementer winding down must not wipe a
    // confirmed direct_named row, which would also deflate deliveryReach.)
    const res = await delegate.updateMany({
      where: { deliveryPartnerId: ex.partnerId, aiVendorId: ex.vendorId, partnershipTier: ex.partnershipTier, endedAt: null },
      data: { endedAt: now, provenance: "news_confirmed", sourceUrls: [ex.sourceUrl], lastVerified: now },
    });
    const count = (res as { count?: number })?.count ?? 0;
    return { ...base, applied: count > 0, reason: count > 0 ? "ended" : "no_active_row_to_end" };
  }

  // For a tier-CHANGING action, locate the active row for this (partner,vendor) pair
  // at ANY tier so an upgrade/downgrade MOVES the tier in place — ending the old-tier
  // row — instead of creating a second parallel edge (the unique key is per-tier, so a
  // tier change is end-old + write-new). This keeps exactly one active row per logical
  // relationship, so reach never double-counts and the panel never shows a dup.
  if (ex.action === "upgrade" || ex.action === "downgrade") {
    const active = await delegate
      .findFirst({ where: { deliveryPartnerId: ex.partnerId, aiVendorId: ex.vendorId, endedAt: null } })
      .catch(() => null);
    if (active) {
      const dTier = TIER_RANK[ex.partnershipTier] - TIER_RANK[active.partnershipTier as PartnershipTier];
      const dEv = EV_RANK[ex.evidenceTier] - EV_RANK[active.evidenceTier as EvidenceTierPartnership];
      const stronger = dTier > 0 || (dTier === 0 && dEv > 0);
      const weaker = dTier < 0 || (dTier === 0 && dEv < 0);
      if (ex.action === "upgrade" && !stronger) return { ...base, applied: false, reason: "not_an_upgrade" };
      if (ex.action === "downgrade" && !weaker) return { ...base, applied: false, reason: "not_a_downgrade" };
      if (active.partnershipTier !== ex.partnershipTier) {
        // Supersede the old-tier row so exactly one active row per relationship survives.
        await delegate.updateMany({
          where: { deliveryPartnerId: ex.partnerId, aiVendorId: ex.vendorId, partnershipTier: active.partnershipTier, endedAt: null },
          data: { endedAt: now },
        });
      }
    }
    // No active row → nothing to upgrade/downgrade; falls through to an add at the cited tier.
  }

  const existing = await delegate.findUnique({ where: whereUnique }).catch(() => null);

  await delegate.upsert({
    where: whereUnique,
    create: {
      deliveryPartnerId: ex.partnerId,
      aiVendorId: ex.vendorId,
      partnershipTier: ex.partnershipTier,
      evidenceTier: ex.evidenceTier,
      provenance: "news_confirmed",
      source: ex.implication.slice(0, 280),
      sourceUrls: [ex.sourceUrl],
      industries: [],
      regions: [],
      implementationAreas: [],
      lastVerified: now,
      endedAt: null,
    },
    update: {
      evidenceTier: ex.evidenceTier,
      provenance: "news_confirmed",
      sourceUrls: [ex.sourceUrl],
      lastVerified: now,
      endedAt: null, // a fresh cited update reactivates a previously-ended row
    },
  });
  return { ...base, applied: true, reason: existing ? ex.action : "add" };
}

// ── Runner: orchestrate classify → extract → apply, logging token spend per tier ──
export interface DeliveryUpdateSummary {
  itemsSeen: number;
  signals: number;
  applied: number;
  rejected: { reason: string; partnerId: string; vendorId: string }[];
  tokensByTier: { classify: { input: number; output: number }; extract: { input: number; output: number } };
  results: ApplyResult[];
}

function addUsage(acc: { input: number; output: number }, u: LLMUsage) {
  acc.input += u.inputTokens;
  acc.output += u.outputTokens;
}

export async function runDeliveryNewsUpdate(items: NewsItem[]): Promise<DeliveryUpdateSummary> {
  const summary: DeliveryUpdateSummary = {
    itemsSeen: items.length,
    signals: 0,
    applied: 0,
    rejected: [],
    tokensByTier: { classify: { input: 0, output: 0 }, extract: { input: 0, output: 0 } },
    results: [],
  };

  for (const item of items) {
    const cls = await classifyDeliverySignal(item);
    addUsage(summary.tokensByTier.classify, cls.usage);
    if (!cls.data.isDeliverySignal) continue; // non-AI / non-delivery filtered out

    summary.signals += 1;
    const ext = await extractDeliveryPartnership(item, cls.data);
    addUsage(summary.tokensByTier.extract, ext.usage);
    if (!ext.data) continue; // no responsible extraction (e.g. no model) → no write

    const res = await applyDeliveryUpdate(ext.data);
    summary.results.push(res);
    if (res.applied) summary.applied += 1;
    else summary.rejected.push({ reason: res.reason, partnerId: res.partnerId, vendorId: res.vendorId });
  }

  return summary;
}

// ── Pipeline step: self-update from recently-ingested news ───────────────────
const COST = (inTok: number, outTok: number, p: typeof PRICES.haiku) =>
  (inTok / 1e6) * p.inputPerMTok + (outTok / 1e6) * p.outputPerMTok;

export interface DeliveryRefreshStep {
  skipped?: string;
  seedPartners: number;
  itemsSeen: number;
  signals: number;
  applied: number;
  rejected: number;
  rejectedReasons: Record<string, number>;
  tokensIn: number;
  tokensOut: number;
  estimatedCostUsd: number;
}

/**
 * Daily-refresh step. Ensures the curated base exists in the DB (idempotent,
 * never overwrites a news_confirmed row), then runs the tiered self-update over
 * the most-recent cited news items. Only items WITH a source URL are considered
 * (a write needs a real citation). Failure-tolerant: returns a summary even when
 * the DB or LLM is unavailable.
 */
export async function runDeliveryUpdateFromRecentNews(
  opts: { now?: Date; sinceDays?: number; limit?: number } = {},
): Promise<DeliveryRefreshStep> {
  const empty: DeliveryRefreshStep = {
    seedPartners: 0, itemsSeen: 0, signals: 0, applied: 0, rejected: 0,
    rejectedReasons: {}, tokensIn: 0, tokensOut: 0, estimatedCostUsd: 0,
  };
  if (!hasDatabase()) return { ...empty, skipped: "no_database" };

  // 1. Ensure the curated base is present (idempotent; preserves upgrades).
  const seeded = await loadDeliveryPartnerSeed().catch(() => ({ partners: 0, partnerships: 0 }));

  // 2. Pull recent cited news items.
  const now = opts.now ?? new Date();
  const since = new Date(now.getTime() - (opts.sinceDays ?? 30) * 86_400_000);
  const rows = await getPrisma()
    .intelligenceNewsItem.findMany({
      where: { publishedAt: { gte: since }, sourceUrl: { not: null } },
      orderBy: { publishedAt: "desc" },
      take: opts.limit ?? 300,
      select: { title: true, summary: true, sourceUrl: true },
    })
    .catch(() => [] as { title: string; summary: string; sourceUrl: string | null }[]);

  const items: NewsItem[] = rows
    .filter((r) => !!r.sourceUrl)
    .map((r) => ({ title: r.title, snippet: r.summary, url: r.sourceUrl as string }));

  // 3. Run the tiered self-update.
  const sum = await runDeliveryNewsUpdate(items);

  const tokensIn = sum.tokensByTier.classify.input + sum.tokensByTier.extract.input;
  const tokensOut = sum.tokensByTier.classify.output + sum.tokensByTier.extract.output;
  const estimatedCostUsd =
    COST(sum.tokensByTier.classify.input, sum.tokensByTier.classify.output, PRICES.haiku) +
    COST(sum.tokensByTier.extract.input, sum.tokensByTier.extract.output, PRICES.sonnet);

  const rejectedReasons: Record<string, number> = {};
  for (const r of sum.rejected) rejectedReasons[r.reason] = (rejectedReasons[r.reason] ?? 0) + 1;

  return {
    seedPartners: seeded.partners,
    itemsSeen: sum.itemsSeen,
    signals: sum.signals,
    applied: sum.applied,
    rejected: sum.rejected.length,
    rejectedReasons,
    tokensIn,
    tokensOut,
    estimatedCostUsd: Math.round(estimatedCostUsd * 10000) / 10000,
  };
}
