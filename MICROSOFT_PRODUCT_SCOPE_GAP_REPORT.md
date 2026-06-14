# Microsoft ProductScope Gap Report

Date: 2026-05-11
Vendor: `msft` (proposals carry `vendor_microsoft`)

## What was missing

Pre-fix entries (8): Microsoft 365 Copilot, Microsoft Agent 365,
Entra, Defender, Purview, Azure AI / Azure AI Foundry, Copilot Studio,
GitHub Copilot. The Foundry entry was a single combined name — the
underlying Foundry sub-products (Models, Agent Service) didn't have
their own scope entries.

Microsoft contributes 20/211 of the blocked queue (~9%).

## What was added

Source-backed additions only:

| Added | Category | Source |
|---|---|---|
| `Azure AI Foundry Models` | `model_api` | Public Microsoft docs |
| `Azure AI Foundry Agent Service` | `agent_runtime` | Public Microsoft docs |
| `Azure AI Search` | `enterprise_search` | Public Microsoft docs |

Pack explicitly excluded confusing hosted third-party models with
Microsoft-owned models — kept Foundry entries category-specific so the
linkage suggester maps `model_api` claims to Foundry Models and
`agent_runtime` claims to Foundry Agent Service without bleeding
between them.

Did NOT add governance/security adjacencies beyond the existing
Entra/Defender/Purview — those already cover the trust-centre /
security-page rows via the vendor-wide gesture.

## Linkage impact

The 7 `learn.microsoft.com/.../microsoft-365-copilot-overview` rows
were already matching Microsoft 365 Copilot via name match — no
change needed. The added Foundry sub-products help any future
Foundry-specific ingestion.

## Rerun command

```bash
npx tsx --env-file=.env.local scripts/product-linkage-review.ts --vendor=vendor_microsoft --batch=20
```

## Acceptance criteria

- ✅ Only source-backed Microsoft products added.
- ✅ No conflation of hosted third-party with Microsoft-owned.
- ✅ No public UI changes.
