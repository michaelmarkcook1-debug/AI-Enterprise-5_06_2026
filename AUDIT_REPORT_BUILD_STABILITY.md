# Build Stability Audit

Date: 2026-05-10
Prepared for: Mike
Pack: Stage 1 batch · Task 1 (`02_TASK_1_BUILD_TEST_STABILISATION.md`)

## Commands run

```bash
npx tsc --noEmit             # clean
npm test                     # 139 / 139 across 17 files
npx prisma generate          # ./generated/prisma client present + current
npm run build                # verified by Vercel deploy 11:55 UTC (commit ddd006c)
```

## Initial failures

Audit-pack §1.1 (Stage 1 README) listed five risks. State observed today:

| # | Risk in pack | Current state |
|---|---|---|
| 1 | Tests fail because `lib/prisma.ts` imports `../generated/prisma/client` when the generated client is missing | **Resolved** — `generated/prisma/client/` exists in working tree (output of `npx prisma generate` against the live Neon DB earlier this session). All 139 tests pass without touching the DB. |
| 2 | `prisma generate` may fail in restricted environments | **Mitigated** — Prisma 7.8.0 + the project's Neon `DATABASE_URL` have been verified to generate. Cold environments would still need either `DATABASE_URL` set or a `--skip-generate-client` workaround; documented in PRODUCTION.md. |
| 3 | `npm run build` may fail because of missing Prisma client | **Resolved** — same as #1. Vercel build path runs `prisma generate` automatically via the build env containing `DATABASE_URL`. |
| 4 | Next.js build may fail because `next/font/google` tries to fetch Geist / Geist Mono / Cormorant Garamond | **Not blocking on Vercel** — the Vercel build environment can reach Google Fonts so the latest preview compiles without intervention. Local cold-builds in fully-offline mode would fail; mitigation options enumerated below. |
| 5 | Tests fail when DB-only modules are imported in non-DB tests | **Resolved** — DB-only repositories (`lib/repositories/vendor-profiles.ts`, `lib/intelligence/repository.ts`) wrap their Prisma calls in try/catch with seed-intelligence fallback. `lib/repositories/vendor-profiles.ts` got this fallback explicitly during the `/assessment` 500 fix. |

## Root causes (resolved already)

- **Prisma client absent on first run.** Resolved by running `prisma generate` once after `vercel env pull` provided `DATABASE_URL`. The output is in `generated/prisma/client/` — gitignored (`/generated/prisma/`) so each environment regenerates.
- **Implicit DB requirement in non-DB tests.** Resolved earlier by routing repositories through `hasDatabase()` gates with seed fallbacks.

## Files changed (this audit pass)

None. Build stability work was completed in earlier sessions; this pass only ran the verification commands and produced this report.

## Fixes applied (cumulative across recent sessions)

- `lib/repositories/vendor-profiles.ts` — try/catch fallback to seed intelligence on Prisma error (Phase 1 of master pack v1)
- `lib/intelligence/repository.ts` — `databaseOrSeed()` helper already wraps every read
- `prisma/seed.ts` — transaction timeout bumped to 60s for serverless DB cold-starts
- `lib/prisma.ts` — singleton with `hasDatabase()` gate

## Final test/build status

| Step | Result |
|---|---|
| `npx tsc --noEmit` | ✅ clean |
| `npm test` | ✅ 139 passed, 0 failed, across 17 test files |
| `npx prisma generate` | ✅ generated client current |
| Vercel `npm run build` (last preview) | ✅ ready, deployment URL `https://ranking-engine-q1mencjho-...` |

## Remaining risks

1. **Google Fonts in offline / restricted-network builds** — unchanged from pack §1.4. The codebase still imports `Geist`, `Geist_Mono`, and `Cormorant_Garamond` from `next/font/google` in `app/layout.tsx`. Mitigations available, none applied this pass:
   - Replace with self-hosted via `next/font/local` (download .woff2, ship in `/public/fonts/`)
   - Drop Cormorant entirely and use the system serif stack (`ui-serif, Georgia`)
   - Conditionally fall back to system fonts if the build env lacks network egress
   The current Vercel target reaches Google Fonts at build time so this is non-blocking for the production deploy path. Flag remains open if the deployment target ever moves to an air-gapped CI runner.
2. **Prisma migrations vs. fresh databases.** A brand-new DB without `prisma migrate deploy` having run will surface the existing fallback to seed (no 500), but operators must remember to migrate before evidence-approval. Documented in PRODUCTION.md.
3. **No CI runner yet.** Tests pass locally and on Vercel, but there's no GitHub Actions / equivalent enforcing them on PRs. Stage 2+ task.

## Recommendation

Build stability is **acceptable for Stage 1 progression**. Switching to Codex for parallel feature work (per `07_COACHING_AND_SWITCH_TO_CODEX.md`) is safe from a build-reliability standpoint. The Google Fonts mitigation is the only outstanding item; defer until the deployment target changes.
