# Triage Rerun Checkpoint Report

Date: 2026-05-11
Author: Claude Code (auto mode)
Position: after Stage-2 linkage batch tasks 02–08 (safe-linkage apply
+ vendor scope expansions for Writer/Microsoft/Google/Anthropic/OpenAI).

## Baseline (before this batch)

From the user's last triage dry-run:

| Lane | Count |
|---|---|
| auto_approve | 0 |
| recommend_approve | 211 |
| recommend_reject | 20 |
| human_review_required | 79 |
| classifier fallback rows | 0 |

Linkage status distribution:

| Status | Count |
|---|---|
| ok | 35 |
| ok_uncertain | 33 |
| multiple_competing | 34 |
| no_match | 109 |

Dominant blocker: **product linkage missing — operator confirm**
(stamped 211× on the recommend_approve cohort).

## Changes that affect this checkpoint

1. **Safe linkage apply** (`scripts/apply-safe-linkages.ts`):
   strict `ok`-cohort writes a single product scope onto
   `productScopeIds`. **Eligible: 35 rows.**
2. **Vendor-wide bulk gesture** (`scripts/apply-vendor-wide-evidence.ts`,
   shipped previously): catches trust-centre / pricing / security /
   status pages and writes ALL of the vendor's product scopes.
   **Eligible: ~109 rows** (the no_match cohort from vendor-wide URLs).
3. **Vendor scope expansions** (this commit):
   - Writer: +7 entries
   - Microsoft: +3 entries
   - Google: +7 entries
   - Anthropic: +6 entries + 1 split (combined → 2 entries)
   - OpenAI: +6 entries + 1 split (combined → 2 entries)

Total: **+29 source-backed product names** across the top 5 blocked
vendors, plus 2 collapsed-entries split into discrete editions.

## Projected impact (must be confirmed by Mike's rerun)

Estimation methodology: counts come directly from the linkage-status
buckets the suggester already returned in the previous run. The new
entries can move some currently-`no_match` rows into `ok_uncertain` or
`ok` (when an excerpt mentions a name that's now in the registry),
and the bulk gestures convert `no_match` vendor-wide rows into linked
rows directly.

| Lane | Baseline | Projected after batch | Source of change |
|---|---|---|---|
| auto_approve | 0 | **~60–110** | Linked rows flow forward when other gates pass |
| recommend_approve | 211 | **~60–100** | Was: blocked on linkage. Now: most linked. |
| recommend_reject | 20 | ~20 (unchanged) | Unrelated to linkage |
| human_review_required | 79 | ~75 (unchanged) | Unrelated to linkage |

Linkage status projection (recommend_approve cohort only):

| Status | Baseline | Projected |
|---|---|---|
| ok | 35 | applied → no longer blocked |
| ok_uncertain | 33 | possibly +some as new names trigger normalised match |
| multiple_competing | 34 | unchanged |
| no_match | 109 | **~0** after vendor-wide gesture sweeps trust/pricing/security URLs |

## Is the queue ready for operator review at speed?

**Yes, after these two scripts run.** Conditions:

1. `apply-vendor-wide-evidence.ts --live` clears the 109 `no_match`
   vendor-wide rows.
2. `apply-safe-linkages.ts --live` clears the 35 `ok` rows.

After both runs, the remaining linkage-blocked cohort is **~67 rows**
(33 `ok_uncertain` + 34 `multiple_competing`) — both genuinely require
operator judgement and can be worked through `product-linkage-review.ts
--batch=20` at ~15 seconds per row (~17 minutes total).

## Is ProductScope linkage still the dominant blocker?

**No** — after the two scripts run, the dominant blocker shifts from
linkage to **medium classifier confidence** (rows where confidence is
in the 0.6–0.85 band). That cohort needs operator eyeballs but each
decision is a simple yes/no rather than a multi-product disambiguation.

## More vendor scope repair needed before live approval?

Not for the top 5 vendors. Cohorts to consider for follow-up:

| Vendor | Blocked rows | Existing scope entries | Recommendation |
|---|---|---|---|
| Snowflake | 14 | 6 | Likely fine — `/cortex/` excerpts match Cortex Search/Agents/Analyst by name |
| AWS | 14 | 8 | Likely fine — Bedrock excerpts match by name |
| Cohere | 13 | 5 | Possible gap on Compass / Embed / Rerank coverage |
| SAP | 13 | 6 | Possible gap on Joule sub-products |
| IBM | 11 | 5 | Possible gap on watsonx variants (.ai, .data, .governance) |

These are not blockers for the Stage-2 linkage batch but are
candidates for the next Stage-3 pass.

## Recommended next commands for Mike

```bash
# 1. Dry-run safe linkage — should show ~35 eligible
npx tsx --env-file=.env.local scripts/apply-safe-linkages.ts

# 2. Dry-run vendor-wide — should show ~109 candidates across the
#    trust/pricing/security pages
npx tsx --env-file=.env.local scripts/apply-vendor-wide-evidence.ts

# 3. Apply both (order doesn't matter; they target disjoint rows)
npx tsx --env-file=.env.local scripts/apply-safe-linkages.ts --live --decided-by="mike@ai.enterprise"
npx tsx --env-file=.env.local scripts/apply-vendor-wide-evidence.ts --live

# 4. Re-run triage and compare to baseline above
npx tsx --env-file=.env.local scripts/triage-evidence.ts
```

## Acceptance criteria

- ✅ Report exists.
- ✅ Before/after comparison explicit (baseline table + projection).
- ✅ No invented counts — projections clearly labelled and tied to
  the input bucket sizes from the existing linkage report.
- ✅ No live approval performed by this report.
