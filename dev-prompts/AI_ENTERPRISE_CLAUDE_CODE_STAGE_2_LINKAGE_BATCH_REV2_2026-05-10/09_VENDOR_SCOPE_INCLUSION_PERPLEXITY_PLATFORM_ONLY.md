# Claude Code Prompt 09 — Add Perplexity as Platform Vendor Only

Add Perplexity into AI Enterprise in a truth-safe way.

Scope:
1. Add ProductScope coverage for `vendor_perplexity`.
2. Add CommercialModel inventory entries for Perplexity.
3. Add capability coverage for Perplexity.
4. Add vendor intelligence/news intelligence coverage for Perplexity if those modules use ProductScope/vendor registry.
5. Do NOT include Perplexity in Investor Tools or Investor Intelligence.
6. Do NOT treat Perplexity as an investable, IPO-watch, or investor-ranked vendor.
7. Do NOT change public UI beyond making Perplexity appear correctly in platform/product/capability surfaces.

Use only source-backed official Perplexity sources.

Perplexity products/features to add if source-backed:
- Enterprise Pro
- Enterprise Max
- Search API
- Sonar API
- Agent API
- Sonar
- Sonar Pro
- Sonar Reasoning Pro
- Sonar Deep Research

Required ProductScope fields:
- vendorId
- vendorName
- productName
- productCategory
- productDescription
- measurementScope
- includedInModules
- sourceStatus
- sourceName
- sourceUrl
- evidenceGrade
- confidenceScore
- uncertaintyNotes
- lastVerified

Required CommercialModel rules:
- first-party Perplexity models only if officially documented as Perplexity models
- third-party models in Agent API must be marked hosted_third_party or equivalent
- Agent API itself is a product, not a model

Required capability categories:
- enterprise_search
- model_api
- reasoning_research
- cited_answers
- grounded_web_search
- enterprise_plan
- hosted_third_party_access where applicable

Required exclusion rules:
- Exclude `vendor_perplexity` from:
  - Investment Intelligence
  - Investment Simulator
  - Public AI Stocks
  - IPO Watch
  - Indirect Exposure Map
  - Investor Briefings
  - Investor Watchlist
  - all investment universes
  - all portfolio builders
  - all investor scoring
  - all post-IPO / valuation / share-price modelling

After changes:
1. Re-run ProductScope / model inventory / capability tests.
2. Re-run vendor-scoped linkage review if Perplexity rows exist:
   `npx tsx scripts/product-linkage-review.ts --vendor=vendor_perplexity --batch=20`
3. Write `PERPLEXITY_PLATFORM_SCOPE_REPORT.md` with:
   - what was added
   - what was excluded
   - first-party vs third-party distinctions
   - exact files changed

Official sources to use:
- https://docs.perplexity.ai/getting-started/models
- https://docs.perplexity.ai/docs/sonar/models/sonar
- https://docs.perplexity.ai/docs/sonar/models/sonar-pro
- https://docs.perplexity.ai/docs/agent-api/models
- https://www.perplexity.ai/help-center/en/articles/10354842-what-is-the-perplexity-api-platform
- https://www.perplexity.ai/help-center/en/articles/10352986-pricing-billing-for-enterprise-pro

Do not weaken truth/evidence standards.
