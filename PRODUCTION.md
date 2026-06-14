# AI Enterpise — Production Runbook

This is the operator playbook for taking the platform from "seed-data demo"
to "live data flowing into the dashboard". Every step is automated; the only
human-in-loop touchpoints are credential provisioning and evidence approval.

> **Honest framing:** the architecture is production-ready. The data is not.
> What follows is exactly what's needed to flip every "seed estimate" badge
> to "live".

---

## Status check (run anywhere, anytime)

```bash
npm run prod:check
```

Or open **`/admin/production-status`** in the browser for the same check live.

A green tick means the gate is passing. A red cross blocks production. An
amber dot is a recommended-but-not-required gap.

---

## Required environment variables

| Var | Why | Get it |
|---|---|---|
| `DATABASE_URL` | Persistence for evidence, runs, watchlists | Vercel Marketplace → Neon / Supabase, copy connection string |
| `ANTHROPIC_API_KEY` | Real LLM extractor + classifier (vs deterministic stubs) | console.anthropic.com → API keys |
| `ADMIN_API_TOKEN` | Auth gate on `/api/admin/*` mutating routes | `openssl rand -hex 32` |

Without these, the app runs but every quantitative number on the dashboard
stays seed-labelled.

---

## Going live in 7 commands

```bash
# 1. Set env
export DATABASE_URL="postgres://…"
export ANTHROPIC_API_KEY="sk-ant-…"
export ADMIN_API_TOKEN="$(openssl rand -hex 32)"

# 2. Apply schema + seed the assessment vendors
npx prisma migrate deploy
npm run db:seed

# 3. Verify everything is wired
npm run prod:check          # exits 0 when ready

# 4. Build + start
npm run build
npm start

# 5. Run real ingestion against the 51-source manifest
npm run ingest              # all vendors
# or per-vendor:
npm run ingest -- --vendor vendor_microsoft

# 6. Open the admin reviewer
#    http://localhost:3000/admin/evidence
#    Approve high-quality proposals; rejects skip the engine.

# 7. Refresh the dashboard
#    http://localhost:3000/dashboard → "SEED ESTIMATE" flips to "LIVE"
```

That's it. No additional code changes.

---

## What "live" actually changes

| Surface | Before (seed) | After |
|---|---|---|
| Dashboard top badge | `SEED ESTIMATE` | `LIVE` |
| Vendor profiles | inline mock numbers | source-cited evidence with `E2`–`E5` grades |
| Assessment scoring | runs against curated seed evidence | runs against analyst-verified evidence rows |
| News feed | `[MOCK] AnalystGenius synthesis` | (deferred — see "What's still seed below") |
| Market shares | seeded | (deferred — see below) |
| IPO forecast | model_estimate_not_fact | unchanged — IPO addendum stays modelled until S-1 |

---

## What's still seed even after going live

These surfaces require additional **agents** beyond the evidence extractor.
Code is present (or stubbed), but the loop is not yet wired:

- **News intelligence** — needs an RSS / press-release ingestion agent that
  classifies items into the existing `NewsItem` schema with `affectedPillars`
  + `suggestedScoreImpact`. Plumbing exists in `lib/agents/`.
- **Market share** — needs a triangulation agent (analyst PDFs + earnings
  releases + GitHub/jobs telemetry). `MarketShareEstimate` schema is ready.
- **IPO forecast refresh** — disabled by spec until S-1 / F-1 evidence
  emerges. The `MissingIPODataChecklist` enumerates what unblocks each.
- **Capability tracker** — needs a doc-snapshot diff agent. Schema ready.

See `lib/intelligence/seed.ts` for the surfaces still labelled `dataStatus: "seed"`.

---

## Operator surfaces

| Path | Purpose |
|---|---|
| `/admin/production-status` | Live readiness gates — same as `npm run prod:check` |
| `/admin/ingestion` | Trigger ingestion runs against the manifest |
| `/admin/evidence` | Review + approve / reject proposals |
| `/api/admin/sourcing/run` | Programmatic ingestion trigger |
| `/api/admin/sourcing/logs` | Tail of every fetch / extract / classify / promote step |
| `/api/admin/production-status` | JSON readiness report (CI-friendly) |
| `logs/sourcing/{date}.ndjson` | Forensic on-disk log (one event per line) |

---

## Source manifest

51 URLs across 20 vendors live in `lib/sourcing/manifest.ts`. Operator-editable.
Adding a new entry teaches the system about a new evidence source. Removing one
stops the pipeline pulling from it.

```bash
npm run ingest -- --url https://trust.openai.com/   # one URL
npm run ingest -- --vendor vendor_openai            # one vendor
npm run ingest -- --dry-run                         # extract, do not persist
```

---

## Truthfulness guardrails

- Every claim carries `dataStatus`, `evidenceGrade`, `confidenceScore`, and
  source citations. Rendered through `renderClaim()` which displays "Unknown"
  / "Stale data — refresh required" / "Seed estimate — not verified" when the
  gates fail. See `lib/truthfulness/render-claim.ts`.
- E0 evidence cannot render as a verified claim.
- Stale-after gate flips display to "stale" tone past the threshold.
- The dashboard's `seed estimate` ↔ `live` badge is computed from
  `getDataProvenance()` against the actual `EvidenceRecord` count — never
  hard-coded.

---

## Deploying on Vercel

1. Push to a git remote
2. `vercel link` → connect project
3. Add the three env vars in the Vercel dashboard (`Production` scope)
4. Deploy preview first to verify `/admin/production-status` reports green
5. Promote to production
6. Schedule ingestion via Vercel Cron (`/api/admin/sourcing/run` triggered nightly)

---

## Cost ceiling for the LLM pipeline

The extractor + classifier are claude-sonnet-class calls. Per-vendor full
manifest run is ~4–8 sources × 2 LLM calls (extract + classify) ≈ 12–24 calls,
≤ 30k tokens. Across the 20-vendor universe that's ~250–500 calls, ~600k tokens
per refresh. At Sonnet pricing this is well under $5 per full refresh.
