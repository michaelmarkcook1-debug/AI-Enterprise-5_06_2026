# Claude Code Prompt 01 — Master Context

You are working inside the AI Enterprise codebase for Mike.

AI Enterprise is an executive-grade market intelligence platform for enterprise AI.

It includes:
- Dashboard
- Vendor Intelligence
- Market Tracker
- News Intelligence
- Capabilities
- Assessment
- Briefings
- Watchlists
- Investor Tools

Investor Tools includes:
- Investment Intelligence
- Investment Simulator
- Public AI Stocks
- IPO Watch
- Indirect Exposure Map
- Investment Briefings
- Investor Watchlist

## Core problem

The product still relies too heavily on seed/static data.

The priority is not new UI. The priority is making the platform truth-safe and source-backed.

The target architecture is:

```text
source → evidence → claim → calculation → output → chart
```

## Non-negotiable rule

No hallucinated, unsupported, stale, fake, or unverified output may appear as fact.

If data is missing, stale, seed, inferred, or unverified, the app must say so.

Use labels:
- verified
- documented
- tested
- estimated
- inferred
- seed
- stale
- disputed
- unknown
- unsupported

Evidence grades:
- E0: no evidence
- E1: vendor claim only
- E2: public documentation
- E3: public test, sandbox/API verification, or live API/model-list verification
- E4: production customer evidence
- E5: independent audit, verified benchmark, filing, audited report, or third-party validation

## Current known issues from audit

1. Full test suite failed because `lib/prisma.ts` imports `../generated/prisma/client`, but the generated Prisma client is missing.
2. `prisma generate` may fail in restricted environments because of `DATABASE_URL` and Prisma binary downloads.
3. `npm run build` may fail because of missing Prisma client.
4. Next.js build may fail because `next/font/google` tries to fetch Google Fonts.
5. `/capabilities` uses seed capability data from `lib/intelligence/seed-capabilities.ts`.
6. `/capabilities` lacks audit-grade metadata per capability:
   - sourceUrl
   - sourceName
   - sourceDate
   - confidenceScore
   - dataStatus
   - freshnessStatus
   - uncertaintyNote
   - ProductScope linkage
   - TruthRecord linkage
   - calculation provenance
   - formula version
7. Commercial LLM model inventory is better structured but still needs live verification.
8. Free-source connector suite is not fully implemented.

## Operating instruction

Before making changes:
1. Inspect the repo.
2. Identify package manager and framework.
3. Find routes:
   - `/dashboard`
   - `/capabilities`
   - `/investor-tools`
   - `/api/*`
4. Run:
   - `npm test`
   - `npm run build`
   - `npx tsc --noEmit` if configured
5. Record failures.
6. Fix only what is in the current prompt.
7. Add or update tests.
8. Never fabricate live data.

## Do not

- Do not remove existing modules.
- Do not add new visual features before fixing data provenance.
- Do not label seed data as verified.
- Do not treat hosted third-party models as first-party.
- Do not treat private IPO-watch companies as directly investable.
- Do not suppress uncertainty notes.

## First outcome expected

A stable repo where test/build failures are known or fixed, and where `/capabilities` can be upgraded without making the data problem worse.
