# Anthropic ProductScope Gap Report

Date: 2026-05-11
Vendor: `anthropic` (proposals carry `vendor_anthropic`)

## What was missing

Pre-fix entries (5): Claude, Claude Enterprise / Team, Claude API,
Claude Code, Claude model family. The `Claude Enterprise / Team`
combined entry collapsed two distinct editions, and named API
capabilities (tool use, computer use, citations, batch processing,
extended context) were absent.

Anthropic contributes 17/211 of the blocked queue (~8%). 7 of them
come from `anthropic.com/pricing` — that's a vendor-wide page.

## What was added / split

Source-backed additions, every name from `anthropic.com` or the
public API docs:

| Added | Category | Source |
|---|---|---|
| `Claude Enterprise` | `enterprise_assistant` | Split from combined entry |
| `Claude for Work` | `enterprise_assistant` | anthropic.com edition name |
| `Claude Team` | `enterprise_assistant` | Split from combined entry |
| `Messages API` | `model_api` | docs.anthropic.com endpoint name |
| `Tool use` | `model_api` | Named API capability |
| `Computer use` | `model_api` | Named API capability |
| `Citations` | `rag_knowledge` | Named API capability |
| `Batch processing` | `model_api` | Named API capability |
| `Extended context (1M)` | `model_api` | Named API capability |

The combined `Claude Enterprise / Team` entry was retired in favour of
the two split entries. The split helps linkage when an excerpt
mentions one edition but not the other.

API capabilities are categorised as `model_api` because they ship as
features of the Anthropic API rather than separate products.
Categorising `Citations` as `rag_knowledge` reflects its function
(grounded answers with source attribution).

## Linkage impact

The 7 pricing-page rows route through the vendor-wide gesture. The
10 remaining excerpts (typically referencing Claude API features,
Claude Code, or Claude Enterprise) now have specific catalog entries
to match.

## Rerun command

```bash
npx tsx --env-file=.env.local scripts/product-linkage-review.ts --vendor=vendor_anthropic --batch=20
```

## Acceptance criteria

- ✅ Only source-backed Anthropic products/capabilities added.
- ✅ No invented edition names.
- ✅ Split combined entry into discrete editions.
- ✅ No public UI changes.
