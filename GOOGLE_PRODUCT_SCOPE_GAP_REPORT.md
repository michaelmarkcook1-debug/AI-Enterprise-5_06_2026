# Google ProductScope Gap Report

Date: 2026-05-11
Vendor: `googl` (proposals carry `vendor_google`)

## What was missing

Pre-fix entries (7): Gemini Enterprise, Gemini models, Vertex AI,
Vertex AI Studio, Vertex AI Agent Builder, Agent Development Kit,
TPU exposure. The Vertex line was covered but several named Google AI
products from the pack were absent.

Google contributes 18/211 of the blocked queue (~9%).

## What was added

Source-backed additions only:

| Added | Category | Source |
|---|---|---|
| `Google Agentspace` | `enterprise_assistant` | Google Cloud product |
| `Agent2Agent protocol` | `agent_runtime` | Google open protocol |
| `Gemini Code Assist` | `coding_agent` | Google Cloud product |
| `Model Garden` | `cloud_ai_platform` | Vertex feature, named product |
| `Model Armor` | `security_ai` | Google Cloud security product |
| `BigQuery AI` | `data_ai_platform` | Named integration on Google Cloud |
| `Workspace Gemini` | `enterprise_assistant` | Workspace integration |

No invented naming or packaging. All entries map to Google Cloud or
Workspace product pages.

## Linkage impact

The 7 `status.cloud.google.com/` rows route through the vendor-wide
gesture. The 11 remaining excerpts referencing Vertex / Gemini sub-
products now have a wider catalogue to match against.

## Rerun command

```bash
npx tsx --env-file=.env.local scripts/product-linkage-review.ts --vendor=vendor_google --batch=20
```

## Acceptance criteria

- ✅ Only source-backed Google products added.
- ✅ No invented naming or packaging.
- ✅ No public UI changes.
