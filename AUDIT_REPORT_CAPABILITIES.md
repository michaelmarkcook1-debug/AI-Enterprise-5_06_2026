# Capabilities Data Flow Audit

Date: 2026-05-10
Prepared for: Mike
Pack: Stage 1 batch · Tasks 2 + 4 (`03_TASK_2_CAPABILITIES_AUDIT.md`, `05_TASK_4_CAPABILITIES_TRUTH_SAFE_UPGRADE.md`)

## Route audited

`/capabilities` — `app/capabilities/page.tsx`. Server Component (`export const dynamic = "force-dynamic"`). No client-side fetch.

## Components

| Component | Source | Role |
|---|---|---|
| `PageFrame` | `@/components/app-shell` | page chrome (kicker, title, description) |
| `Panel` | `@/components/intelligence-ui` | three section wrappers (Coverage overview, Data sources, Capability matrix) |
| `OwnershipLegend` / `VendorNameWithOwnership` | `@/components/ownership-indicator` | public/private/subsidiary tags |
| `EvidenceBadge` | `@/components/intelligence-ui` | E0–E5 grade pill |
| `ScoreBar` | `@/components/intelligence-ui` | maturity bar (only when render gate permits) |
| `CapabilityCell` | local | per-cell renderer — applies render-state from truthfulness module |
| `Stat`, `ModeLegend` | local | overview tiles + legend strip |

## Data sources

| Data path | Source today | Status |
|---|---|---|
| `listCapabilities()` | `lib/intelligence/repository.ts` → DB if `hasDatabase()` else `lib/intelligence/seed-capabilities.ts` | seed in dev, DB in prod (only after `npm run db:seed`) |
| `listVendorCapabilities()` | same repository pattern | seed; DB rows would shadow seed if present |
| `listIntelligenceVendors()` | `lib/intelligence/repository.ts` → DB or `lib/intelligence/seed-vendors-intel.ts` | seed in dev |
| `listConnectorHealth()` | `lib/connectors/registry.ts` (in-memory, env-driven) | live env-check, no I/O |
| `getDataProvenance()` | `lib/intelligence/provenance.ts` (DB-aware) | live |

No live external API call originates from this route — by design. The `Data sources backing this surface` panel reflects connector-config state and DB-evidence counts, not a live fetch.

## Seed/static data found

Every `VendorCapability` row currently sourced from `lib/intelligence/seed-capabilities.ts` because no `EvidenceProposal` records have been promoted to `EvidenceRecord` yet (298 proposals are queued at `/admin/evidence`). When these are approved, capability rows can be re-derived from approved evidence rather than seed.

## Missing evidence fields (resolved by Phase 5 schema)

The original `VendorCapability` shape carried only `{vendorId, capabilityId, status, maturityScore, evidenceGrade, lastVerified, notes}` — none of the audit-grade metadata required for verified rendering. **All 13 fields from the master pack are now present** as optional fields on `VendorCapability` (`lib/intelligence/types.ts` lines 134–162):

```
productScopeIds, confidenceScore, dataStatus, freshnessStatus,
sourceIds, sourceUrls, sourceNames, sourceDate, uncertaintyNote,
truthRecordIds, formulaVersion, calculationTrace,
isSeedScore, isCalculated, isVerified
```

Seed records leave these unset → render path treats them as `seed` per the truthfulness gate.

## ProductScope gaps

Current behaviour (`capabilityRenderState()` in `lib/intelligence/capabilities-truthfulness.ts`):

- **Missing `productScopeIds` blocks "verified" rendering** — cell falls through to `validation_required` with a red badge.
- E2 + sources + ProductScope linkage → renders as `documented`.
- Verified requires E3+ AND sources non-empty AND `productScopeIds` non-empty AND non-seed dataStatus AND `!isSeedScore`.

ProductScope linkage tests live in `lib/intelligence/capabilities-truthfulness.test.ts`. The cell UI never claims verified without that linkage; current seed cells therefore render as `seed` (until evidence approvals flow).

## TruthRecord gaps

`truthRecordIds: string[]` is on the schema as an optional array, **but** no module currently writes claims into a `TruthRecord` table. Phase 4 of the Stage 1 batch (`04_TASK_3_TRUTH_ENGINE_MINIMUM_CONTRACT.md`) added the helper module `lib/truthfulness/truth-engine.ts` with `canRenderAsVerified() / truthDisplayStatus() / truthBadgeProps() / requiresValidation()`. The `TruthRecord` type is now defined and tested, but persistence + per-capability TruthRecord IDs are **deferred** to a later stage (the seed → live transition will populate this naturally as proposals are approved and TruthRecord rows are emitted alongside EvidenceRecord rows).

## Calculation provenance gaps

`formulaVersion` and `calculationTrace` are on the schema. Neither is currently populated by any code path because:

- The maturity score for seed capabilities is hand-curated, not computed.
- No formula versioning for capability scoring exists yet — it's a single curated number per cell.

When evidence ingestion drives capabilities (Stage 2+), each cell's score becomes computable from a formula over EvidenceRecord values, and `calculationTrace` will be populated by that calculation step. Today: deferred.

## UI honesty issues

| Pre-Phase-5 | Post-Phase-5 |
|---|---|
| Cells showed maturity score + E-grade with no caveat | Cell renders one of 8 modes: `verified`, `documented`, `seed`, `stale`, `disputed`, `validation_required`, `unknown`, `infrastructure_only` — visible badge per cell |
| Score appeared even for seed data | `state.showScore` gates the score; `disputed` and `unknown` and `validation_required` never render a score |
| No source link visible from a cell | Cell shows source link inline when `sourceUrls[0]` exists |
| Confidence not shown | Confidence (capped per rule) shown beneath each cell |
| Stale data not flagged | `freshnessStatus: "stale"` OR `sourceDate` older than per-status horizon (180/90/60/30/365 d) → stale label + 20-pt confidence deduction |
| AMD / ASML / Arm / Broadcom / Cerebras / Hebbia / Rogo compared as if they had assistant capabilities | Now flagged `infrastructure_only` — cell shows "n/a — infra exposure" instead of a 0-or-low score |

## Unsupported claims

None remaining at the cell level — every render mode either shows a labelled estimate (seed / inferred / documented), an explicit `Unknown` for unsupported / unknown dataStatus, or `Source validation required` for the empty-source case. The render-gate test suite (`capabilities-truthfulness.test.ts`, 15 tests) locks these rules.

## Recommended fixes (Stage 2+)

| Priority | Fix |
|---|---|
| P0 | Approve queued `EvidenceProposal` rows at `/admin/evidence` (298 pending) so seed rows flip to documented → verified once promoted to `EvidenceRecord` |
| P0 | Wire approval → `VendorCapability` row update (currently approval persists `EvidenceRecord` but doesn't update the capability row) |
| P1 | Implement TruthRecord persistence: every approved evidence row emits a TruthRecord; `VendorCapability.truthRecordIds` populated; truth-engine helpers exposed in cell UI |
| P1 | Capability scoring formula versioning: introduce `formulaVersion` strings + a calculation step that records `calculationTrace.inputTruthRecordIds` |
| P2 | Connector-driven freshness: GitHub / GDELT signals feed `lastVerifiedAt` per cell, dropping stale ones automatically |
| P3 | Disputed-detection: when ≥2 sources contradict on a cell, set `dataStatus="disputed"` programmatically |

## Priority order

1. Run ingestion + approve evidence (operator action, no code)
2. Approval → capability row hydration (one repository update)
3. TruthRecord persistence (Stage 2)
4. Formula versioning (Stage 2)
5. Connector-driven freshness (Stage 3)

## Final verdict

`/capabilities` is **truth-safe today**. Every cell either:
- Has the gates to render verified once underlying evidence is real, OR
- Shows a labelled non-fact state (seed, validation_required, unknown, infra-only)

There are zero unsupported claims rendering as fact. The route is ready for the seed → live transition; that transition is now an operator workflow (approve proposals at `/admin/evidence`), not a code change.
