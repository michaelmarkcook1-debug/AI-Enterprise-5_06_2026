# AI Enterprise — Release Notes

## 2026-05-10 · Truth surfacing + 11 free-source connectors

### Highlights

- 🔴 **Bold-red NOT-LIVE labelling** — every page top now carries a red banner
  with one-line reason + two CTAs while the portal renders from seed.
  `SeedDataBadge` callsites everywhere flipped from subtle gray to bold red
  with a pulsing dot, "NOT LIVE:" prefix, and a tooltip explaining what to do.
- 🌐 **11 free / official-source connectors implemented** — SEC EDGAR, FRED,
  BLS, BEA, EIA, US Treasury Fiscal Data, Alpha Vantage, GDELT, GitHub,
  Congress.gov, Federal Register. All fully implemented (no stubs).
- 🛠️ **`/admin/data-sources`** — read-only console grouped by category with
  health, env-var requirements, last-fetch outcome, and an enable guide.
- 🤖 **URL-repair agent** — when ingestion hits a 4xx, Claude + web-search
  finds the current canonical URL on the vendor's apex domain, persists a
  `ManifestPatch`, and (≥75 confidence) retries the fetch in-flight.
- 🟡 **298 evidence proposals persisted** to Neon Postgres from the last
  ingest run — pending review at `/admin/evidence`.

### Changed

- `components/intelligence-ui.tsx` — `SeedDataBadge` upgraded to red+pulsing
  when seed; quiet green when live
- `components/NotLiveBanner.tsx` (new) — global red strip below TopNav
- `app/layout.tsx` — wires NotLiveBanner

### Added

- `lib/connectors/types.ts` — `Connector`, `ConnectorHealth`, `FetchResult`
- `lib/connectors/{sec,fred,bls,bea,eia,fiscalData,alphaVantage,gdelt,github,congress,federalRegister}.ts`
- `lib/connectors/registry.ts` + `registry.test.ts` (6 tests)
- `lib/evidence/{normalise,freshness,confidence}.ts`
- `app/api/data-sources/{status,refresh,[connectorId]}/route.ts`
- `app/admin/data-sources/page.tsx`
- `lib/agents/url-finder.ts` — Claude + `web_search_20260209` server tool
- `prisma/schema.prisma` — `ManifestPatch` model + `PatchStatus` enum
- `components/admin/ManifestPatchesPanel.tsx`

### Fixed

- `/assessment` 500 — `vendor-profiles` now falls back to seed intelligence
  when Prisma queries fail (e.g. fresh DB without migrations applied)
- Prisma seed transaction timeout bumped to 60s for serverless DBs

### Tests

- 124/124 passing (was 118; +6 connector + truthfulness gate tests)
- `npx tsc --noEmit` clean

### Known limitations

1. Most data still seed — connectors built and 298 proposals queued, but
   none approved yet → `getDataProvenance` still returns `seed` → red
   banner stays visible
2. `/capabilities` schema upgrade (Phase 5 in the master prompt pack) is
   tracked in `AUDIT_REPORT_CAPABILITIES.md` but not yet shipped
3. No cron / scheduled refresh wired for connectors yet — they fetch on
   demand only via `POST /api/data-sources/refresh`
4. Vercel preview deployments are SSO-protected; treat with `vercel curl`

### Deployment notes

- `vercel env pull .env.local --environment=development`
- `npx prisma migrate deploy` (Neon migrations 20260507003000_initial_backend
  + 20260510061919_add_manifest_patches both applied)
- `npx tsx prisma/seed.ts` (idempotent — safe to re-run)
- Set the 6 free API keys per `AUDIT_REPORT_DATA_CONNECTIONS.md` checklist
- Then `vercel deploy --prod --yes`
