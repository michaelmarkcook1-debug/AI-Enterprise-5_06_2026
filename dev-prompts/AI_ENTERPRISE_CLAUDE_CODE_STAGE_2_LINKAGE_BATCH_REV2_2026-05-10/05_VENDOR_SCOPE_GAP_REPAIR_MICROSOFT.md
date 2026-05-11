# Claude Code Prompt 05 — Vendor Scope Gap Repair: Microsoft

Microsoft is one of the biggest blocked vendor cohorts.

## Task

Repeat the same repair workflow for `vendor_microsoft`.

Focus on:
- Microsoft 365 Copilot
- Copilot Studio
- Agent 365 where source-backed
- Azure AI Foundry / Foundry Models
- Azure AI Foundry Agent Service
- GitHub Copilot
- Azure AI Search
- governance/security adjacency only where source-backed

Rules:
- Do not confuse hosted third-party models with Microsoft-owned models.
- Keep ProductScope source-backed.
- Re-run vendor-scoped linkage review after changes.
- Write:
  `MICROSOFT_PRODUCT_SCOPE_GAP_REPORT.md`
