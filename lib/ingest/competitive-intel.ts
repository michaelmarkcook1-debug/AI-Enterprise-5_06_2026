// External competitive-intelligence ingest — the receiving end for Mic's
// scheduled AI-competitive-intelligence Routine (cloud agent).
// ─────────────────────────────────────────────────────────────────────────────
// TWO honest channels, both through EXISTING machinery — nothing new is trusted:
//
//   NEWS  → IntelligenceNewsItem rows (same idempotent id scheme as the in-app
//           competitive monitor, so the two ingest paths dedupe against each
//           other). Real, named, https-cited sources ONLY — the same bar the
//           news feed already enforces. Items are tagged `external_intel` so
//           provenance is never laundered.
//
//   MODEL → EvidenceProposal rows (the PRE-APPROVAL triage queue). External
//           findings NEVER touch canonical scores directly: they become
//           proposals that must pass the admin triage gate (the integrity
//           moment) before projection. Grade is CAPPED at E3 — an external
//           routine cannot assert E4/E5; only analyst review upgrades.
//
// FACTUAL-DATA-ONLY: every row requires a real https source URL and a named
// source; placeholder/seed/mock strings are rejected; unknown vendors are
// rejected (never invented); scores are clamped, never defaulted upward.

import { createHash } from "node:crypto";
import type { PrismaClient } from "../../generated/prisma/client";
import type { DomainId as PrismaDomainId } from "../../generated/prisma/enums";
import { DOMAIN_TO_PILLAR, type DomainId } from "../types";
import { isDataVendorSource } from "../intelligence/source-quality";

// ── Wire types (the contract the Routine POSTs) ───────────────────────────────

export interface ExternalFinding {
  vendorId: string;
  title: string;
  summary: string;
  sourceName: string;
  sourceUrl: string;
  publishedAt: string; // ISO date (YYYY-MM-DD or full ISO)
  whyItMatters: string;
  category?: string; // e.g. partnership | model_release | funding | enterprise_deal | regulatory
  sentiment?: "positive" | "neutral" | "negative";
  impactScore?: number; // 0-100 (routine's directional estimate; clamped)
  confidenceScore?: number; // 0-100 (clamped)
}

export interface ExternalProposal {
  vendorId: string;
  domain: string; // must be a real DomainId (model_quality excluded — synthesized, never proposed)
  subfactor: string;
  excerpt: string; // the actual quoted/cited evidence text
  sourceUrl: string;
  proposedGrade: "E1" | "E2" | "E3"; // hard cap — external can never assert E4/E5
  proposedRawScore: number; // 0-5
  rationale?: string;
  confidence?: number; // 0-1
}

export interface RejectedItem {
  index: number;
  reason: string;
}

// ── Validation (pure — unit-tested) ──────────────────────────────────────────

const SEEDY = /\[MOCK\]|placeholder|lorem ipsum|example\.com|<<|REQUIRED>>|\bseed\b|\bstub\b/i;
const VALID_SENTIMENTS = new Set(["positive", "neutral", "negative"]);
// model_quality is synthesized at read-time from Arena Elo — never proposable.
const PROPOSABLE_DOMAINS = new Set<string>(
  (Object.keys(DOMAIN_TO_PILLAR) as DomainId[]).filter((d) => d !== "model_quality"),
);
const EXTERNAL_GRADES = new Set(["E1", "E2", "E3"]);

function isRealHttpsUrl(url: string): boolean {
  try {
    const u = new URL(url);
    return u.protocol === "https:" && !!u.hostname && u.hostname.includes(".") && !SEEDY.test(url);
  } catch {
    return false;
  }
}

function parsePublishedAt(s: string): Date | null {
  const t = Date.parse(s);
  if (Number.isNaN(t)) return null;
  const d = new Date(t);
  // Reject dates more than a day in the future (clock skew allowance only).
  if (d.getTime() > Date.now() + 86_400_000) return null;
  return d;
}

const clamp01to100 = (n: number | undefined, fallback: number) =>
  typeof n === "number" && Number.isFinite(n) ? Math.min(100, Math.max(0, Math.round(n))) : fallback;

/** null = valid; string = rejection reason. `knownVendors` = live roster ids. */
export function validateFinding(f: ExternalFinding, knownVendors: Set<string>): string | null {
  if (!f || typeof f !== "object") return "not an object";
  if (!f.vendorId || !knownVendors.has(f.vendorId)) return `unknown vendorId "${f?.vendorId ?? ""}" — vendors are never invented`;
  if (!f.title || f.title.trim().length < 8) return "title too short (min 8 chars)";
  if (!f.summary || f.summary.trim().length < 20) return "summary too short (min 20 chars)";
  if (!f.whyItMatters || f.whyItMatters.trim().length < 20) return "whyItMatters too short (min 20 chars)";
  if (!f.sourceName || f.sourceName.trim().length < 3) return "sourceName required (named source)";
  if (isDataVendorSource(f.sourceName)) return `sourceName "${f.sourceName}" is a data-vendor feed, not a primary source`;
  if (SEEDY.test(f.sourceName) || SEEDY.test(f.title) || SEEDY.test(f.summary)) return "placeholder/seed content rejected";
  if (!f.sourceUrl || !isRealHttpsUrl(f.sourceUrl)) return "sourceUrl must be a real https URL";
  if (!parsePublishedAt(f.publishedAt)) return "publishedAt invalid or in the future";
  if (f.sentiment !== undefined && !VALID_SENTIMENTS.has(f.sentiment)) return `sentiment "${f.sentiment}" invalid`;
  return null;
}

export function validateProposal(p: ExternalProposal, knownVendors: Set<string>): string | null {
  if (!p || typeof p !== "object") return "not an object";
  if (!p.vendorId || !knownVendors.has(p.vendorId)) return `unknown vendorId "${p?.vendorId ?? ""}" — vendors are never invented`;
  if (!PROPOSABLE_DOMAINS.has(p.domain)) return `domain "${p?.domain ?? ""}" is not a proposable assessment domain`;
  if (!p.subfactor || p.subfactor.trim().length < 3) return "subfactor required";
  if (!p.excerpt || p.excerpt.trim().length < 40) return "excerpt too short (min 40 chars — the cited evidence text)";
  if (SEEDY.test(p.excerpt)) return "placeholder/seed excerpt rejected";
  if (!p.sourceUrl || !isRealHttpsUrl(p.sourceUrl)) return "sourceUrl must be a real https URL";
  if (!EXTERNAL_GRADES.has(p.proposedGrade)) return `proposedGrade "${p?.proposedGrade ?? ""}" rejected — external intel is capped at E3; E4/E5 require analyst review`;
  if (typeof p.proposedRawScore !== "number" || p.proposedRawScore < 0 || p.proposedRawScore > 5) return "proposedRawScore must be 0-5";
  if (p.confidence !== undefined && (typeof p.confidence !== "number" || p.confidence < 0 || p.confidence > 1)) return "confidence must be 0-1";
  return null;
}

// ── Persistence (same shapes the in-app pipeline writes) ─────────────────────

/** BYTE-IDENTICAL to competitive-monitor.ts newsItemId() — same (vendor|url|day)
 *  hash and same `compintel_` prefix, so the external and in-app paths upsert
 *  the SAME row for the same story instead of duplicating it. */
export function newsItemId(vendorId: string, sourceUrl: string, publishedAt: string): string {
  const h = createHash("sha1").update(`${vendorId}|${sourceUrl}|${publishedAt}`).digest("hex");
  return `compintel_${h.slice(0, 24)}`;
}

// Type-only Prisma import (no runtime client at module scope — the validators
// above stay pure/testable; the route passes the real client in).
export async function persistFinding(db: PrismaClient, f: ExternalFinding): Promise<void> {
  const publishedDay = f.publishedAt.slice(0, 10);
  const id = newsItemId(f.vendorId, f.sourceUrl, publishedDay);
  const impact = clamp01to100(f.impactScore, 40); // conservative default — below the breaking-news floor
  const confidence = clamp01to100(f.confidenceScore, 50);
  const categories = [f.category?.trim() || "market", "external_intel"];
  await db.intelligenceNewsItem.upsert({
    where: { id },
    create: {
      id,
      title: f.title.trim(),
      summary: f.summary.trim(),
      sourceName: f.sourceName.trim(),
      sourceUrl: f.sourceUrl,
      publishedAt: new Date(`${publishedDay}T00:00:00.000Z`),
      vendors: [f.vendorId],
      categories,
      impactScore: impact,
      confidenceScore: confidence,
      affectedPillars: [],
      whyItMatters: `[external intel] ${f.whyItMatters.trim()}`,
      suggestedScoreImpact: [],
      relatedVendors: [],
      sentiment: f.sentiment ?? "neutral",
    },
    update: {
      title: f.title.trim(),
      summary: f.summary.trim(),
      impactScore: impact,
      confidenceScore: confidence,
      whyItMatters: `[external intel] ${f.whyItMatters.trim()}`,
      sentiment: f.sentiment ?? "neutral",
    },
  });
}

export async function persistProposal(db: PrismaClient, p: ExternalProposal, jobId: string): Promise<void> {
  await db.evidenceProposal.create({
    data: {
      jobId,
      vendorId: p.vendorId,
      // Validated against PROPOSABLE_DOMAINS above (persisted domains only,
      // model_quality excluded) — safe narrowing to the Prisma enum.
      domain: p.domain as PrismaDomainId,
      subfactor: p.subfactor.trim(),
      excerpt: p.excerpt.trim(),
      proposedGrade: p.proposedGrade,
      proposedRawScore: Math.min(5, Math.max(0, p.proposedRawScore)),
      sourceUrl: p.sourceUrl,
      capturedAt: new Date(),
      classifierConfidence: p.confidence ?? 0,
      classifierRationale: `${p.rationale?.trim() ?? "no rationale supplied"} (external competitive-intel routine — pending triage)`,
      classificationFailed: false,
      confidenceIsFallback: p.confidence === undefined,
    },
  });
}
