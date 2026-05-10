# Claude Code Prompt 04 — Task 3: Truth Engine Minimum Contract

Implement the minimum Truth Engine contract needed to make `/capabilities` and future modules truth-safe.

## Goal

All rendered material data must have:
- data status
- evidence grade
- confidence
- source/evidence metadata or unknown/validation-required label

## Models

Create or harden these types/models.

### EvidenceSource

```ts
type EvidenceSource = {
  id: string;
  entityType: string;
  entityId: string;
  sourceType: string;
  sourceName: string;
  sourceUrl?: string;
  sourceDate?: string;
  capturedAt: string;
  publisher?: string;
  isOfficialSource?: boolean;
  isPrimarySource?: boolean;
  isLicensedSource?: boolean;
  evidenceGrade: EvidenceGrade;
  confidenceScore: number;
  freshnessStatus: FreshnessStatus;
  notes?: string;
};
```

### TruthRecord

```ts
type TruthRecord = {
  id: string;
  entityType: string;
  entityId: string;
  claimType: string;
  claimText: string;
  numericValue?: number;
  unit?: string;
  period?: string;
  geography?: string;
  sourceIds: string[];
  evidenceGrade: EvidenceGrade;
  confidenceScore: number;
  dataStatus: DataStatus;
  freshnessStatus: FreshnessStatus;
  uncertaintyNote?: string;
  createdAt: string;
  updatedAt?: string;
  lastVerifiedAt?: string;
  expiryDate?: string;
};
```

### Enums

```ts
type EvidenceGrade = "E0" | "E1" | "E2" | "E3" | "E4" | "E5";

type DataStatus =
  | "verified"
  | "documented"
  | "tested"
  | "estimated"
  | "inferred"
  | "seed"
  | "stale"
  | "disputed"
  | "unknown"
  | "unsupported";

type FreshnessStatus = "fresh" | "aging" | "stale" | "unknown";
```

## Rendering helpers

Create helpers:

```ts
canRenderAsVerified(record: TruthRecord): boolean
truthDisplayStatus(record: TruthRecord): string
truthBadgeProps(record: TruthRecord): BadgeProps
requiresValidation(record: TruthRecord): boolean
```

Rules:
- E0 cannot render as verified.
- Seed data must show seed label.
- Stale data must show stale label.
- Low confidence must show warning.
- Missing sourceIds must show source validation required.
- Disputed data must show disputed badge.
- Unsupported data must render Unknown, not as a fact.

## Tests

Add tests for:
- verified path
- seed path
- stale path
- unsupported path
- missing source path
- disputed path
- low-confidence path

## Acceptance criteria

- Truth Engine helpers exist.
- Tests pass.
- Existing UI can consume these helpers.
- No new fake data.
