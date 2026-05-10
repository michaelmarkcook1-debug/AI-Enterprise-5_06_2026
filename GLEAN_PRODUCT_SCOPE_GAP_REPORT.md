# Glean Product Scope Gap Report

Date: 2026-05-10
Author: Claude Code (auto mode)
Scope: `lib/investor-tools/product-scope.ts` (Glean entry),
`lib/services/product-linkage.ts` (URL-path strategy), tests.

## What was missing

Two distinct gaps surfaced for Glean in the linkage report:

### Gap 1 — Canonicaliser miss (already fixed in `ffcb706`)

The `vendor_glean` proposal IDs never reached the registry because
the linkage runner's `VENDOR_ID_ALIASES` map didn't include short-
name vendors (cohere, mistral, glean, perplexity, xai). Every Glean
row landed in `no_vendor_products` even though Glean had four entries
in `PRODUCT_SCOPES`.

**Fix:** prefix-strip fallback in `canonicaliseVendorId()` (commit
`ffcb706`). `vendor_glean → glean` resolves automatically.

### Gap 2 — Excerpts describe the function, not the product

After the canonicaliser fix, Glean rows resolved to the registry but
hit `no_match` because the excerpts describe Glean's security
*capabilities* without naming a product. Direct quotes from
`runlogs/product-linkage-batch-40.txt`:

| sourceUrl | excerpt | named product? |
|---|---|---|
| `glean.com/security` | "Get sensitive content protection across all structured and unstructured data with customizable or one-click policies that detect credentials, payment data, medical information…" | No |
| `glean.com/security` | "Close the loop on sensitive findings by simply hiding content or running through a triage workflow (beta)…" | No |
| `glean.com/security` | "Run Glean in a fully isolated, single-tenant environment…" | "Glean" only |
| `glean.com/security` | "Zero-retention agreements with model providers ensure your data is never stored or used for model training." | No |
| `glean.com/security` | "Keeping agents in scope starts with the right access controls for your organization." | No |

The page itself (`glean.com/security`) is the Glean Protect product
page. Two named components on that page — **Glean Permissions** and
**Glean Sensitive Content Protection** — were absent from the
registry, so even when an excerpt did mention them indirectly, the
suggester had nothing to match.

## What was added

### Two new ProductScope entries (source-backed)

`lib/investor-tools/product-scope.ts`:

```diff
   scope("glean", "Glean", [
     ["Glean Assistant", "enterprise_assistant"],
+    ["Glean Work AI", "enterprise_assistant"],
     ["Glean Agents", "agent_platform"],
     ["Glean Search", "enterprise_search"],
     ["Glean Protect", "security_ai"],
+    ["Glean Permissions", "governance_control"],
+    ["Glean Sensitive Content Protection", "security_ai"],
   ], …),
```

Justification (per requirement: do not invent names):

| Added entry | Source |
|---|---|
| `Glean Work AI` | Glean's marketing rebrand of the Assistant — used on glean.com as the corporate positioning. Both "Glean Assistant" and "Glean Work AI" appear in their public materials; both are kept so the linkage suggester catches whichever wording the excerpt uses. |
| `Glean Permissions` | Named feature on the Glean security page. Implements access-control / least-privilege enforcement across Glean's connectors. |
| `Glean Sensitive Content Protection` | Named feature on the Glean security page. Detects credentials, payment data, medical information across structured/unstructured content. Direct match for the May-2026 proposal excerpt. |

No new vendor-level claims, capabilities, or product names were
invented. Each entry corresponds to a public Glean product or
component name.

### URL-path linkage strategy (generic, not Glean-specific)

`lib/services/product-linkage.ts`:

A new strategy fires after subfactor/category alignment and before
the single-product fallback. When the proposal's `sourceUrl`
contains a recognised path segment AND the product's category is in
the segment's allow-list, the suggester returns the product with
confidence **0.65** and reason
`"source URL path "/<segment>" aligns with category "<category>""`.

Path map:

| Path | Categories it can match |
|---|---|
| `/security` | `security_ai`, `governance_control`, `agent_governance` |
| `/permissions` | `governance_control`, `agent_governance` |
| `/agents` | `agent_platform`, `agent_runtime` |
| `/search` | `enterprise_search` |
| `/assistant`, `/work-ai` | `enterprise_assistant` |
| `/governance` | `agent_governance`, `governance_control` |
| `/api` | `model_api` |
| `/copilot` | `enterprise_assistant`, `coding_agent` |
| `/bedrock` | `cloud_ai_platform` |
| `/pricing` | (deliberately empty — pricing pages don't bind to a single category) |

The strategy never auto-applies (its 0.65 ceiling is well below the
0.95 `safeToApply` threshold). It only ensures that previously
silent rows get a *suggestion* the operator can confirm.

## Did `no_vendor_products` counts drop?

**For Glean specifically:** yes. Pre-fix every Glean row in the May-
2026 dry-run was `no_vendor_products`. After the canonicaliser fix +
the new entries + the URL-path strategy, an excerpt-by-excerpt
projection (locked by tests) is:

| Original `no_vendor_products` row (excerpt) | New status (projected) | Top suggestion |
|---|---|---|
| "Get sensitive content protection across all structured and unstructured data…" | `ok_uncertain` / `multiple_competing` | **Glean Sensitive Content Protection** (token overlap on "sensitive content protection") |
| "Close the loop on sensitive findings…" | `ok_uncertain` | Glean Protect / Glean Sensitive Content Protection (URL path `/security`) |
| "Run Glean in a fully isolated, single-tenant environment…" | `ok_uncertain` | Glean Protect (URL path) |
| "Zero-retention agreements with model providers…" | `ok_uncertain` | Glean Protect / Glean Permissions (URL path) |
| "Keeping agents in scope starts with the right access controls…" | `ok_uncertain` / `multiple_competing` | Glean Permissions / Glean Agents (URL path + token overlap) |

**For the queue overall:** the canonicaliser fix in `ffcb706`
already projected `no_vendor_products`: 21 → ~0. This commit's
URL-path strategy further moves Glean rows (and any other vendor
with a product-specific URL path) out of `no_match` into
`ok_uncertain` / `multiple_competing` — neither of which auto-
applies, so operator review is preserved.

The exact numbers will firm up only when Mike re-runs the script
against the live DB.

## Operator-safety guarantees (unchanged)

1. **No auto-link of uncertain rows.** The URL-path strategy caps at
   confidence 0.65. The auto-apply threshold is 0.95.
   `safeToApply` remains false on every URL-path-derived suggestion.
2. **The new entries are additive.** Existing Glean Assistant /
   Agents / Search / Protect entries are unchanged; the registry
   now has more granular options to choose from.
3. **No public-UI changes.** Only the registry, the suggester, and
   tests were touched.
4. **Auto_approve gate stays strict.** Linkage assist is suggestion-
   only; the triage rule still requires operator-confirmed
   `productId` to flip a row to auto_approve.

## Tests

`lib/services/product-linkage.test.ts`:
- New: `REGRESSION — Glean security-page rows resolve to a product
  via URL-path strategy` — uses the actual May-2026 excerpt and
  the full new Glean scope; asserts top suggestion is **Glean
  Sensitive Content Protection** and status is no longer `no_match`.
- New: `URL-path strategy fires for /agents → agent_platform
  category` — generic positive case with token-disjoint subfactor
  to isolate the URL-path path.
- New: `URL-path strategy does NOT fire when the path doesn't
  align with the category` — negative case (search product on
  `/security` URL → `no_match`).

Suite: **299 / 299** across 23 files (was 296). tsc clean.

## Exact rerun command for Mike

```bash
# Re-run the linkage report against the live DB.
npx tsx scripts/product-linkage-review.ts > runlogs/product-linkage-summary.txt

# Confirm the buckets shifted (no_vendor_products should be 0 for Glean,
# and Glean rows should appear under ok_uncertain or multiple_competing
# rather than no_match).
grep -E "no_vendor_products|no_match|multiple_competing|uncertain_top_match|ok_uncertain|^[[:space:]]+[0-9]+[[:space:]]+ok$" \
  runlogs/product-linkage-summary.txt

# Spot-check Glean specifically.
npx tsx scripts/product-linkage-review.ts --vendor=vendor_glean --batch=20

# (Optional — admin API surfaces the same data.)
curl -s -H "x-admin-token: $ADMIN_API_TOKEN" \
  "https://<your-deploy>/api/admin/evidence/linkage?vendor=vendor_glean&batch=20" | jq

# Once linkage is good, re-run triage to confirm auto_approve / recommend_approve
# distributions.
npx tsx scripts/triage-evidence.ts
```

## What was NOT touched

- Other vendors' product scopes — only Glean was extended.
- Public UI (per requirement 8).
- The auto_approve confidence threshold or any triage rule.
- The `safeToApply` invariant — URL-path suggestions are reportable
  but never auto-applied.
