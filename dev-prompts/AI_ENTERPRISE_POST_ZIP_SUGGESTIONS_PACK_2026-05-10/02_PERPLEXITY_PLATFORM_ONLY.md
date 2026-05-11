# Claude Code Prompt 02 — Add Perplexity as Platform Vendor Only

Update AI Enterprise so Perplexity is included from the platform/product/capability lens only.

## Include Perplexity in:
- ProductScope
- Commercial Model Inventory
- Capabilities
- Vendor Intelligence
- News Intelligence
- Market Dashboard where product/model coverage is relevant

## Exclude Perplexity from:
- Investor Tools
- Investment Intelligence
- Investment Simulator
- Public AI Stocks
- IPO Watch
- Indirect Exposure Map
- Investor Briefings
- Investor Watchlist
- all investment scoring
- all valuation / post-IPO / share-price logic
- all portfolio universes

## Product scope guidance

Use only source-backed official Perplexity sources.

Include if source-backed:
- Enterprise Pro
- Enterprise Max
- Search API
- Sonar API
- Agent API
- Sonar
- Sonar Pro
- Sonar Reasoning Pro
- Sonar Deep Research

## Rules

- First-party Perplexity models must be officially documented.
- Third-party models available through Agent API must be marked hosted_third_party or equivalent.
- Agent API is a product, not a model.
- Do not treat Perplexity as investable or IPO-trackable inside Investor Tools.

## Deliverables

1. Add/update ProductScope entries for `vendor_perplexity`
2. Add/update CommercialModel records for first-party Perplexity models
3. Add/update Capability records for Perplexity
4. Add tests proving Perplexity is present in platform modules and absent from Investor Tools modules
5. Write:
   `PERPLEXITY_PLATFORM_SCOPE_REPORT.md`
