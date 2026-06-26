# v2 / Preview environment — database & email

## The problem this fixes
The project's Postgres is a single **Neon** database provisioned through the Vercel
integration. That integration injects `DATABASE_URL` (+ the `POSTGRES_*` set) into
**Production, Preview, and Development with the same value** — so Preview shares
production's database. Preview writes (migrations, member sign-ups, ingestion runs)
land in the production DB. We want Preview isolated, drift-free, and on real (or
honestly-empty) data, with production untouched.

## Decision: Neon preview branching
Give v2 / Preview its **own isolated Neon branch** instead of a separate provider.
Same provider as prod, prod-safe, cheap.

### Enable it (Neon console — one-time)
In the Neon ↔ Vercel integration settings (Neon console → your project →
**Integrations / Vercel**, or the Vercel dashboard → **Storage → the Neon database →
Settings**), turn on **automatic branching for preview deployments**
("Create a database branch for each Vercel preview deployment"). See Neon's Vercel
integration docs for the exact toggle.

Once enabled:
- Each **preview** deployment gets its **own Neon branch**; the integration points
  that deployment's `DATABASE_URL` at the branch automatically.
- **Production stays on the parent (main) branch — untouched.**
- The build's `prisma migrate deploy` runs on the branch, so its schema matches the
  code with **zero drift** (`prisma migrate status` clean — the branch inherits the
  fully-migrated parent schema, currently 11 migrations through
  `20260626000002_watchlists_email_userid_drift`).

### Data on the preview branch (important)
A Neon branch is a copy-on-write clone of the parent, so it **inherits the parent's
current data** — which today is the seed-loaded contents (see
`no-seed-strict-live-db-only`). That is acceptable because the **strict gate** never
renders seed: `getDataProvenance()` reads "seed" (no real, non-seed-signed evidence)
→ every quantitative surface shows honest "insufficient evidence".

To get the preview onto **real** data (or a genuinely clean slate):
- **Real:** run the real ingestion/refresh against the branch (admin ingestion →
  approve evidence). Provenance then flips "live" and the rankings populate.
- **Clean slate:** create the preview branch **without copying data** (or reset it),
  then `prisma migrate deploy` builds the schema from scratch — empty until ingested.
  This is the closest to "run the full migrations from scratch".

Either way: **never seed.** If no real ingestion has run, preview shows "no data yet".

## Email on Preview — log-only (documented)
Magic-link sign-in is **log-only in non-production**. When `RESEND_API_KEY` is unset
(the Preview default), `app/api/auth/request/route.ts` logs the link via
`console.info(\`[auth] magic link for <email>: <url>\`)` instead of sending an email.

To test sign-in on Preview:
1. Submit your email at `/signin`.
2. Open the deployment's runtime logs (`vercel logs <preview-url>` or the Vercel
   dashboard → the deployment → Logs) and copy the `[auth] magic link …` URL.
3. Open it **in the same browser** (the token is bound to the requesting browser via
   the `ae_signin` nonce — cross-device clicks fail by design).

To send **real** emails on Preview instead: set `RESEND_API_KEY` (+ `EMAIL_FROM`) in
the Preview environment (`vercel env add RESEND_API_KEY preview`). No code change.

## Verification checklist (after enabling branching)
- [ ] A preview deploy created a Neon branch (Neon console shows it).
- [ ] `prisma migrate status` clean on the branch (build's `migrate deploy` succeeded).
- [ ] No "AI Enterprise intelligence DB unavailable; using seed data" in preview logs
      (the silent seed fallback is already removed in deployed builds).
- [ ] Production DB + site unaffected (prod stays on the parent branch).
- [ ] Real ingestion run → rankings populate, OR honest "insufficient evidence".
- [ ] Magic-link sign-in works via the logged link (or real email if Resend set).
