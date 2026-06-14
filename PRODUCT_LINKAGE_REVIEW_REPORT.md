# Product Linkage Review Report

Date: 2026-05-10
Author: Claude Code (auto mode)
Scope: `lib/services/product-linkage.ts`,
`lib/services/product-linkage-runner.ts`,
`scripts/product-linkage-review.ts`,
`app/api/admin/evidence/linkage/route.ts`,
`lib/services/product-linkage.test.ts`.

## Why 182 rows are blocked

After the classifier repair + reclassify pass, the triage policy now
routes **182 of 310** pending proposals to `recommend_approve` instead
of `auto_approve`. The single blocker on every one of those rows is
the same gate, encoded in `lib/services/triage.ts` →
`hasProductMatch`:

```ts
const hasProductMatch = (() => {
  if (input.productId) return true;
  if (!input.productMention) return false;
  ...
})();
```

The triage runner currently passes `productId: undefined` and
`productMention: undefined` for every proposal — `EvidenceProposal`
doesn't yet carry either field. With no product linkage, the rule
correctly demotes the row from `auto_approve` to `recommend_approve`
with the reason `"product linkage missing — operator confirm"`.

The fix is not "loosen the gate". The gate is doing exactly what we
want — refusing to flip a seed cell to `verified` until the evidence
is bound to a specific product. The fix is to **assist the operator**
in supplying the binding for each row.

## What can be auto-suggested safely

For each pending recommend_approve row, the new
`suggestLinkage(proposal, scopesForVendor)` runs five strategies in
descending confidence, returning every match it finds:

| Strategy | Confidence | Auto-applicable? |
|---|---|---|
| Exact product name in excerpt (case-insensitive) | 0.95 | **Yes** — only when no other product also fired ≥ 0.85 |
| Normalised name match (whitespace/punct collapsed) | 0.90 | No — operator confirm |
| Strong token overlap ≥ 70% | 0.76 – 0.85 | No |
| Subfactor / category alignment | 0.55 | No |
| Single-product vendor fallback | 0.40 | No |

The **only** condition under which a suggestion is marked
`safeToApply: true` is:

1. Confidence ≥ 0.95 (exact-name match), AND
2. The next-best suggestion is < 0.95 — no competing tie.

Locked by the `INVARIANT — nothing below 0.95 confidence is ever
safeToApply` test. Per the requirements (item 4), the runner does
**not** auto-link uncertain rows: even when `safeToApply` is true,
none of the current call paths apply the link automatically. The
admin API and CLI are read-only. Auto-apply is a deliberate future
gesture, not a default.

### Per-row `status` outcomes

The suggester returns one of:

| Status | Meaning | Operator action |
|---|---|---|
| `ok` | Single suggestion, ≥ 0.95, no competitor — eligible to apply | Confirm with one click |
| `ok_uncertain` | Top suggestion < 0.95 OR competing alternative ≥ 0.85 | Pick from list |
| `multiple_competing` | Top two within 0.10 of each other | Disambiguate |
| `uncertain_top_match` | Best suggestion < 0.55 | Decide if any apply |
| `no_match` | No product name / category aligned | Manual selection or reject |
| `no_vendor_products` | Vendor has no scope entries in the registry | Add to registry first |

## What remains human review

Anything not `status === "ok"`. Concretely:

- Rows where the best match scored < 0.95 (most common case — name
  appears in paraphrased form, not literal).
- Rows where two products both matched strongly (e.g. excerpts that
  mention both `"Microsoft 365 Copilot"` and `"GitHub Copilot"`).
- Rows whose excerpt covers a vendor-level claim with no product
  scope at all (e.g. "Microsoft achieved SOC 2 Type II" — applies to
  the vendor, not a single product).
- Rows from vendors the registry doesn't yet cover.

## Per-row counts (run on demand)

The aggregate report sliced by every requested dimension:

```bash
npx tsx scripts/product-linkage-review.ts
```

prints these tables:

- **By linkage status** — distribution across the six outcome buckets
  above. The fastest read for "how many rows can be one-click confirmed".
- **By vendor (top 15)** — how concentrated the workload is. If 80%
  of the 182 rows are from 3 vendors, the operator can sweep them
  vendor-by-vendor.
- **By domain/subfactor (top 15)** — useful for spotting subfactors
  whose excerpts always read at the vendor level (no product-name
  mentions) and need manual treatment.
- **By sourceUrl (top 15)** — cluster recurring URLs (e.g. a vendor
  trust centre that mentions every product). One judgement call there
  often resolves a dozen rows.

The same JSON is available at `GET /api/admin/evidence/linkage`.

## Batch-review mode

```bash
npx tsx scripts/product-linkage-review.ts --batch=20
npx tsx scripts/product-linkage-review.ts --batch=20 --offset=20
npx tsx scripts/product-linkage-review.ts --batch=20 --vendor=msft
```

Prints 20 recommend_approve rows at a time with full per-row detail:

```
[1] cm0...abc
    vendor       : msft
    domain       : data_security_privacy
    subfactor    : tenant_isolation
    grade        : E2
    classifier   : 78%
    source       : https://learn.microsoft.com/.../security
    excerpt      : Microsoft 365 Copilot supports tenant-isolated...
    linkage      : ok
      • 95%  msft_microsoft_365_copilot ✓ safe
        reason: exact name match: "Microsoft 365 Copilot"
```

The `✓ safe` flag appears only when the linkage rule's invariants
allow auto-apply. The CLI itself never applies — it prints the data
and exits.

## Operator safety guarantees

1. **Read-only by default.** The runner, the admin API, and the CLI
   never write to the DB.
2. **No auto-link of uncertain rows.** `safeToApply` requires
   confidence ≥ 0.95 AND no competing match ≥ 0.95. Locked by the
   INVARIANT test.
3. **auto_approve gate stays strict.** The triage rule still requires
   `productId` to be set OR `productMention` to match the registry —
   the linkage assist is a recommendation layer, not a triage bypass.
4. **No public-UI changes.** This commit ships an admin API + a CLI.
   The `/admin/evidence` review UI continues to render the existing
   triage badges; product-linkage suggestions are visible only through
   the new admin endpoint.

## Next commands for Mike

```bash
# 1. Aggregate report — counts by vendor / domain+subfactor / sourceUrl /
#    linkage status. Run first to understand distribution.
npx tsx scripts/product-linkage-review.ts

# 2. Batch review the first 20. Each row prints excerpt, source, grade,
#    classifier confidence, and the top-3 linkage suggestions with
#    confidence + reason.
npx tsx scripts/product-linkage-review.ts --batch=20

# 3. Continue through the queue 20 at a time.
npx tsx scripts/product-linkage-review.ts --batch=20 --offset=20
npx tsx scripts/product-linkage-review.ts --batch=20 --offset=40
# … repeat through offset=160 to cover all 182 rows.

# 4. If a single vendor dominates the queue, scope to it:
npx tsx scripts/product-linkage-review.ts --vendor=msft --batch=20

# 5. Same data via the admin API (e.g. for a future UI integration).
curl -s -H "x-admin-token: $ADMIN_API_TOKEN" \
  "https://<your-deploy>/api/admin/evidence/linkage" | jq

curl -s -H "x-admin-token: $ADMIN_API_TOKEN" \
  "https://<your-deploy>/api/admin/evidence/linkage?batch=20&offset=0" | jq
```

After the operator has stepped through the 182 rows and applied
linkages (manually, via the existing approval endpoint), re-run
triage:

```bash
npx tsx scripts/triage-evidence.ts
```

Expected: rows where the operator confirmed an `ok`-status linkage
flip from `recommend_approve` to `auto_approve`. The other lanes
(`recommend_reject`, `human_review_required`, `classifier fallback`)
are unaffected — the linkage assist only addresses the
`product linkage missing` gate.

## Future enhancements (deferred)

1. **Persist linkage decisions.** Today the suggester runs every
   time. If we add `productScopeIds: String[]` to `EvidenceProposal`
   the operator's confirmation can persist and the triage rule can
   read it directly.
2. **Auto-apply on `safeToApply`.** Once persistence is wired, gate
   the auto-apply on the existing `ok` status check + an
   `--auto-apply-safe` CLI flag (still opt-in).
3. **Operator-side admin UI.** A small drawer in `/admin/evidence`
   that lists the top-3 suggestions per recommend_approve row with
   click-to-confirm. Out of scope per requirement 7 ("do not change
   public UI").
