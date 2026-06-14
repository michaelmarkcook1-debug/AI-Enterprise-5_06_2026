# Writer ProductScope Gap Report

Date: 2026-05-11
Vendor: `writer` (proposals carry `vendor_writer`; canonicaliser resolves to `writer`)

## What was missing

Pre-fix the Writer entry carried only 4 names — most of them broad/generic:

- `Writer AI Studio`
- `Palmyra-powered agents`
- `Writer Knowledge Graph`
- `Governance and agent lifecycle features`

Writer is the **largest blocked vendor cohort** in the linkage report
(30/211 = ~14%). Excerpts come from `writer.com/plans/` (16 rows) and
`writer.com/security/` (14 rows). Both are vendor-wide pages; the
remaining rows mention specific Writer products that were absent from
the registry.

## What was added

Source-backed additions only (every name appears on `writer.com`):

| Added | Category | Source signal |
|---|---|---|
| `AskWriter` | `enterprise_assistant` | Named product on writer.com |
| `Writer Agents` | `agent_platform` | Named product on writer.com |
| `Writer AI Apps` | `workflow_ai` | Named product on writer.com |
| `Palmyra X` | `model_api` | Named Palmyra family model |
| `Palmyra Med` | `model_api` | Named Palmyra family model |
| `Palmyra Fin` | `model_api` | Named Palmyra family model |
| `Writer Platform` | `agent_platform` | Top-level platform name |

No invented names. Each entry uses Writer's public product naming.

## Linkage impact

Combined with the previously-committed URL-path strategy
(`writer.com/plans/` and `writer.com/security/` are vendor-wide), the
30 Writer rows are now covered by:

- **Bulk vendor-wide gesture** (`apply-vendor-wide-evidence.ts`):
  catches the 30 trust/plans/security rows. They get linked to every
  Writer product at once.
- **Granular product names**: the 7 new entries above let any future
  Writer ingestion that mentions Palmyra X / AskWriter / Writer
  Agents / Writer AI Apps land in `ok` instead of `no_match`.

## Rerun command

```bash
npx tsx --env-file=.env.local scripts/product-linkage-review.ts --vendor=vendor_writer --batch=20
```

## Acceptance criteria

- ✅ Only source-backed Writer products added.
- ✅ No invented names or capabilities.
- ✅ Linkage coverage improved (via vendor-wide gesture + product additions).
- ✅ No public UI changes.
