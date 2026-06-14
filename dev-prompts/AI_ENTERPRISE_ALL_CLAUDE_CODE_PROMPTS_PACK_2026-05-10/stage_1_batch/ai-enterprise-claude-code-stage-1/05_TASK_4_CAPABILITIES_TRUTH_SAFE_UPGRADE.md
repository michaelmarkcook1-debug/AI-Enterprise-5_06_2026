# Claude Code Prompt 05 — Task 4: Upgrade /capabilities to Truth-Safe Capability Intelligence

Upgrade `/capabilities` from seed capability matrix to truth-safe capability intelligence.

## Required data type

Upgrade or create:

```ts
type CapabilityRecord = {
  id: string;
  vendorId: string;
  vendorName: string;
  capabilityId: string;
  capabilityName: string;
  capabilityCategory: string;
  productScopeIds: string[];
  status: "available" | "preview" | "partial" | "unknown" | "deprecated" | "not_available";
  maturityScore?: number;
  evidenceGrade: EvidenceGrade;
  confidenceScore: number;
  dataStatus: DataStatus;
  freshnessStatus: FreshnessStatus;
  sourceIds: string[];
  sourceUrls?: string[];
  sourceNames?: string[];
  sourceDate?: string;
  lastVerifiedAt?: string;
  uncertaintyNote?: string;
  truthRecordIds: string[];
  formulaVersion?: string;
  calculationTrace?: CalculationTrace;
  isSeedScore: boolean;
  isCalculated: boolean;
  isVerified: boolean;
};
```

```ts
type CalculationTrace = {
  formulaVersion: string;
  inputTruthRecordIds: string[];
  inputValues: Record<string, unknown>;
  outputValue: number;
  confidenceScore: number;
  computedAt: string;
};
```

## ProductScope linkage

Every capability must map to at least one ProductScope item.

If missing:
- do not show as verified
- show “Capability source validation required”
- block or warn in UI
- fail tests if marked verified

## UI requirements

Every capability cell or row must display:
- status
- score
- evidence badge
- data-status badge
- confidence score
- source link or “Source validation required”
- stale warning if stale
- uncertainty tooltip
- seed warning if seed
- calculation/provenance drawer if available

## Seed data handling

If current seed data is retained:
- mark `dataStatus = "seed"`
- mark `isSeedScore = true`
- mark `confidenceScore <= 50` unless source-backed
- show “Seed score — not verified”

Do not let seed data appear as live intelligence.

## Capability overview

Add or update summary cards:
- total vendors
- products in scope
- capabilities tracked
- verified capabilities
- documented capabilities
- seed/inferred capabilities
- stale capabilities
- unknown capabilities
- unsupported claims blocked

## Tests

Add tests:
- no capability renders verified without sourceIds
- seed capability shows seed label
- stale capability shows stale label
- missing ProductScope blocks verified display
- capability with E0 renders Unknown / requires validation
- capability score displays confidence
- source metadata appears in drilldown

## Acceptance criteria

- `/capabilities` renders.
- All capability records have dataStatus and evidenceGrade.
- Seed values are clearly labelled.
- Source validation gaps are visible.
- Tests pass.
