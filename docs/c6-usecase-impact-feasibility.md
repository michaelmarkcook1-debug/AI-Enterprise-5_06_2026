# C6 — Use-case-first front door · Impact × Feasibility library (methodology + curation spec)

**Status: CONTENT PREREQUISITE — not yet buildable on real data.**
The C6 "where's my low-hanging fruit" front door needs a *curated, documented* impact × feasibility
model at the **use-case level, tailored by industry and maturity**. The codebase has the *feasibility*
inputs for free (real workflow attributes) but has **no impact data** — so, per the C6 guardrail and the
project's FACTUAL-DATA-ONLY rule, we do **not** invent it. This document is the analyst artifact that
defines the model and the exact real data an analyst must supply before the feature is built.

---

## 1. What already exists (REAL — reuse, don't rebuild)

- **Use-case taxonomy** — [`lib/use-cases.ts`](../lib/use-cases.ts): 60+ workflows, each with real
  attributes: `id`, `label`, `category`, `riskTier` (low|medium|high|critical),
  `reliabilityRequirement` (1–5), `autonomyDefault`, `complexity` (simple|moderate|complex),
  `regulatoryFlags[]`, `industries[]`/`archetypes[]`, `commonInputs[]`, `tier` (quick|guided|advanced).
- **Opportunity-value bands** — [`lib/engine.ts`](../lib/engine.ts): value-at-stake bands
  (`lt_250k, 250k_1m, 1m_5m, 5m_25m, gt_25m`) and expected-uplift bands
  (`lt_10%, 10_25%, 25_50%, gt_50%`) → priority tiers (flagship/high/medium/low). **Today these are
  driven by the buyer's OWN entered deal value**, not a curated per-use-case estimate.
- **Use-case → market-category routing** — the assessment adapter's `USE_CASE_MAP` already maps
  workflows toward the vendor categories used by the assessment hero. C6 routing reuses this.
- **Honesty conventions** — evidence grades `E0–E5`, "directional estimate" labelling
  (cf. "Market Share Est."), and the *insufficient-evidence-not-a-default* posture.

## 2. What's MISSING (the prerequisite)

A curated **Impact** estimate per **(use-case × industry)**: a value-at-stake band + an expected-uplift
band, **each with a named, citable source**, an evidence grade, a confidence, and a directional-estimate
label. There is no such dataset, no "typical ROI / effort by use-case", nowhere in code or DB. This is
the content an analyst must supply (Section 6). Until it exists, the impact axis stays
**"impact not yet evidenced"** — never a default number.

---

## 3. The Feasibility model (REAL — derived, no new data needed)

Feasibility is a **transparent, deterministic** score in `[0,1]` computed from the workflow's *existing*
real attributes plus the buyer's maturity. It is **not** fabricated — it is a documented function of
attributes the taxonomy already carries (exactly as the 12-domain composite is a function of real
domain scores). Proposed model (to implement once C6 is greenlit):

```
feasibility(workflow, maturity) =
    0.35 · complexityScore      // simple=1.0, moderate=0.6, complex=0.3
  + 0.25 · reliabilityHeadroom  // (6 − reliabilityRequirement)/5  → lower bar = more feasible
  + 0.20 · riskScore            // low=1.0, medium=0.7, high=0.4, critical=0.2
  + 0.10 · regulatoryScore      // 1 − min(regulatoryFlags.length, 5)/5
  + 0.10 · maturityFit          // buyer AI/data maturity 0..1 (from the guided input)
```
Weights are a documented default (reviewable), not tuned to any vendor or outcome. The output is shown
as a **band** (e.g. "high / medium / low feasibility"), never a false-precision decimal.
*Note:* feasibility ranks how easy a workflow is to land; it says nothing about whether it's worth doing
— that's impact.

## 4. The Impact model (CURATED — cited, the prerequisite)

Impact per **(use-case × industry)** = the *curated* value-at-stake band × expected-uplift band, mapped
onto the existing `engine.ts` priority tiers. Each row is an analyst estimate and MUST carry provenance:

| field | meaning |
|---|---|
| `useCaseId` | must match a real `id` in `lib/use-cases.ts` (validated on ingest) |
| `industryTag` | must be a real `IndustryTag` (or `*` for a horizontal estimate) |
| `valueBand` | one of the `engine.ts` value-at-stake bands |
| `upliftBand` | one of the `engine.ts` expected-uplift bands |
| `sourceName` | the NAMED source (analyst report / benchmark / case-study set) |
| `sourceUrl` | link or document reference |
| `evidenceGrade` | `E2`–`E5` (E2 public claim … E5 independent/audited study) |
| `confidence` | 0–100 |
| `asOf` | date the figure was published/observed |
| `note` | one line: scope/caveats |

No row → that (use-case, industry) shows **"impact not yet evidenced"** (feasibility-only), never a
default. No point numbers are ever shown — only bands, always labelled *directional estimate*.

## 5. Priority, routing, framing

- **Priority** = Impact × Feasibility → a 2×2 the CIO reads at a glance: **Quick win** (high/high),
  **Big bet** (high impact / lower feasibility), **Easy fill-in** (lower impact / high feasibility),
  **Question mark** (low/low). Always **draft-framed** ("a starting map to pressure-test, not a verdict").
- **Routing**: each prioritised use-case → its market category(ies) via `USE_CASE_MAP` → the
  evidence-backed vendor assessment (the hero). The front door FEEDS the assessment; it is not a dead end.
- **Guided input** (C1 calm-default): a few choices — industry, function, AI/data maturity — not a form
  marathon. The LLM **maps** the input to this library and **explains**; it never invents the library,
  the use-cases, or the impact numbers.

## 6. DATA REQUEST — what the analyst must supply (to unblock the build)

Provide, for each (use-case × industry) you want lit up, one row of the template
[`c6-usecase-library-template.csv`](./c6-usecase-library-template.csv):

1. `useCaseId` from `lib/use-cases.ts` (e.g. `contract_review`, `customer_service_agent`).
2. `industryTag` (real tag, or `*` horizontal).
3. `valueBand` + `upliftBand` from the bands above — **as bands, from a real source** (no invented point figures).
4. `sourceName` + `sourceUrl` — the named, checkable source the figure traces to.
5. `evidenceGrade` (E2–E5), `confidence` (0–100), `asOf` (date), `note`.

Coverage can be partial — start with the highest-value industries/use-cases. Everything uncovered stays
honestly "impact not yet evidenced". **Do not** send invented numbers to fill gaps; an empty cell is the
correct answer when there's no source.

## 7. Build sequence (after the data lands + a working build env)

1. Add the curated data as a provenance-carrying artifact (typed `data/usecase-impact.ts` or a
   `UseCaseImpact` Prisma model with `source/evidenceGrade/confidence` columns + validation that
   `useCaseId`/`industryTag` resolve to real entries).
2. Implement the deterministic `feasibility()` model (Section 3) — pure, tested.
3. Build the guided front-door route (industry/function/maturity → prioritised list → 2×2), gated behind
   the assessment flag, draft-framed, impact shown only where evidenced.
4. Wire routing into the assessment (`USE_CASE_MAP`).
5. `tsc` + `next build` + tests; preview; sign-off before any merge to `main`.

Until step 0 (the curated data) is delivered, C6 is **held** — exactly as the rest of the product holds
surfaces with insufficient evidence rather than floating them on a default.
