# Pack 03 — Evidence Object Model

## Objective

Create a robust evidence model.

Every claim used by AI Enterprise should be traceable.

## Suggested Types

Create:

```text
lib/evidence/types.ts
lib/evidence/scoring.ts
lib/evidence/publishability.ts
lib/evidence/source-registry.ts
```

## Core Types

```ts
export type EvidenceGrade = "E0" | "E1" | "E2" | "E3" | "E4" | "E5";

export type SourceType =
  | "official_vendor_docs"
  | "pricing_page"
  | "model_card"
  | "trust_security_page"
  | "financial_filing"
  | "press_release"
  | "regulatory_publication"
  | "reputable_news"
  | "benchmark"
  | "customer_review"
  | "developer_platform"
  | "status_page"
  | "analyst_report"
  | "internal_research"
  | "seed"
  | "unknown";

export type LicenceStatus =
  | "approved"
  | "restricted"
  | "unknown"
  | "internal_only"
  | "do_not_display";

export type DataFreshness =
  | "fresh"
  | "acceptable"
  | "stale"
  | "expired"
  | "unknown";

export type PublishabilityStatus =
  | "publishable"
  | "publishable_with_caveat"
  | "internal_only"
  | "needs_review"
  | "blocked";

export interface IntelligenceSource {
  id: string;
  name: string;
  url?: string;
  sourceType: SourceType;
  reliability: number;
  licenceStatus: LicenceStatus;
  displayAllowed: boolean;
  notes?: string;
}

export interface EvidenceItem {
  id: string;
  claim: string;
  normalizedClaim: string;
  sourceId: string;
  sourceUrl?: string;
  sourceName: string;
  sourceType: SourceType;
  vendorIds: string[];
  capabilityIds?: string[];
  datePublished?: string;
  dateAccessed: string;
  evidenceGrade: EvidenceGrade;
  confidence: number;
  freshness: DataFreshness;
  licenceStatus: LicenceStatus;
  displayAllowed: boolean;
  extractedValue?: string | number | boolean;
  quote?: string;
  summary: string;
  reviewerStatus: "proposed" | "approved" | "rejected" | "needs_review";
  reviewerNotes?: string;
}
```

## Evidence Grade Meaning

| Grade | Meaning | Multiplier |
|---|---|---:|
| E0 | No evidence | 0.0 |
| E1 | Vendor claim only | 0.4 |
| E2 | Public documentation | 0.6 |
| E3 | Public test / sandbox / API verification | 0.75 |
| E4 | Production customer evidence | 0.9 |
| E5 | Independent audit / verified benchmark | 1.0 |

## Freshness Rules

Suggested defaults:

| Source Type | Freshness Window |
|---|---:|
| Pricing page | 30 days |
| Model card | 90 days |
| Product docs | 120 days |
| Trust/security page | 180 days |
| Financial filing | 120 days |
| Benchmark | 180 days |
| Customer review aggregate | 90 days |
| News | 30 days |
| Regulatory publication | 365 days |

## Acceptance Criteria

- Evidence model supports source, freshness, confidence and licence.
- Evidence can be attached to vendors, capabilities, scores and board claims.
- Evidence has review status.
- Display permission is explicit.
