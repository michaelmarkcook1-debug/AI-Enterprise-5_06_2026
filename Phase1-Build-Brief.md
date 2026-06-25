# AI Enterprise — Phase 1 Build Brief
### Hand this to Claude Code on the `v2-new-shape` branch · 22 June 2026

**What this is:** the spec for Phase 1 of the new commercial model — the free, real-time, *owned-signal* rankings + insight engine that creates audience scale, generates the buyer-intent data asset, and earns the credibility everything else is sold on. Build *only this* first. (Full model: see `AI-Enterprise_07_Commercial-Model.html`.)

**Plain-English version:** we're building the free "shop window" that pulls in thousands of the right people and quietly records what they care about. No assessment tool, no vendor portal, no login wall yet — just the most useful, most shareable free view of the AI vendor market on the internet, built so cheaply that a flood of free users *can't* bankrupt us.

---

## 1. The goal & what "win" looks like

- **North Star:** engaged **in-market buyer** sessions and the evaluations/comparisons they run — *not* raw signups.
- **Phase 1 done =** a public, fast, Google-indexable site where a business leader can see live AI-vendor rankings, explore who depends on/threatens whom, read pointed insight, and leave their email — and where every visit is (anonymously) captured as buyer-intent signal. Served by **one** central market refresh, not per-user.

---

## 2. The hero signal (the one decision everything hangs on)

Live rankings are table stakes — Artificial Analysis already owns frontier-model leaderboards. Our **owned, un-copyable centrepiece is the Dependency / Encroachment Graph**: *who relies on whom for compute, models, infra and capital — and who is about to eat whose lunch* — in plain business language, not benchmark-speak.

> **Assumption flag:** Phase 1 is built around the dependency/encroachment graph as the hero. If you'd pick a different owned signal, change it here and the rest of the brief still holds — but pick exactly one and be THE place for it.

So Phase 1 ships **both**: the broad **SEO surface** (many ranking/vendor/comparison pages = scale) *and* the **hero graph** (the differentiated reason to come to us, not them).

---

## 3. Scope — ruthlessly

**In scope (build this):**
- Public live **rankings** (by category) + per-vendor profile pages
- The **Dependency / Encroachment graph** (interactive, screenshot-able)
- **Insight/education**: a simple articles/reports system (MDX or CMS-lite)
- **Email capture** / newsletter signup
- **Shared, batched, cached market-refresh** backend (the cost fix)
- **Buyer-intent instrumentation** (anonymous, aggregated) from day one
- **Independence firewall** baked into the data model
- SEO essentials (SSR/ISR, sitemap, metadata, canonical)

**Explicitly OUT (do not build yet — resist the urge):**
- The 3-tier assessment / shortlisting tool
- Any vendor-facing portal, billing, or "claim & pay"
- Login-walled / paid buyer features
- Deal Maker / Contract Tracker overlays
- Auto-update board decks

Anything not on the "in" list is a later phase. If Claude Code proposes building one, say no.

---

## 4. Architecture & non-negotiables

1. **Shared central refresh — never per-user.** A scheduled job refreshes each vendor/sector **once per cycle**, writes the result to the database, and *every* visitor reads the cached result. Use overnight **batch** API calls (≈50% cheaper) and **prompt-cache** the rubric text. Public pages must do **zero** live LLM calls on page load. *(This is what lets a flood of free users be cheap instead of fatal.)*
2. **Public pages = SSR/ISR + CDN cache.** Server-render for SEO and speed; revalidate on a schedule. A page view should hit cache/DB, not compute.
3. **Independence firewall in the schema.** Scores are computed by a **transparent, deterministic rubric from cited evidence**, stored in fields that *no* commercial/vendor process can write to. Keep any future "vendor-paid" fields in a separate table from the moment you model data. Rankings must be explainable (every score links to its sources).
4. **Buyer-intent instrumentation from day one.** Log anonymous events: vendor viewed, comparison run, category browsed, plus coarse firmographics if offered (industry, company-size band). Aggregate + privacy-respecting (no PII beyond opt-in email). *This event stream is the data asset — if we don't capture it now, Phase 4 has nothing to sell.*
5. **Security & scalability (commercial-grade from the start):**
   - No API keys or secrets in client code — server-side only (env vars).
   - **Hard spend cap + kill switch** on the ingestion/refresh job (a runaway loop must hit a capped test budget, never the real card).
   - **Rate-limit** every public API route; cache aggressively.
   - Validate/sanitise all inputs; parameterised DB queries only.
   - Aggregate and anonymise all usage data; make email opt-in explicit (GDPR-friendly — you're UK/EU-facing).
   - `robots.txt`, `sitemap.xml`, canonical tags for clean indexing.

---

## 5. Build sequence (give Claude Code one wave at a time)

**Wave 1 — Foundations (the boring, load-bearing bit):**
- Data model: `Vendor`, `Score` (rubric-computed, source-cited, read-only to commercial), `Dependency`/`Signal`, `Article`, `IntentEvent`, `Subscriber`. Keep any vendor-commercial fields in a separate table.
- The shared **refresh job**: scheduled, batched, cached; writes to DB; spend-capped + kill switch.
- Env/secrets hygiene + cost guardrails.

**Wave 2 — Public SEO surface:**
- Routes: `/`, `/vendors`, `/vendors/[slug]`, `/models`, `/category/[slug]`, `/compare/[a]-vs-[b]`.
- Server-rendered rankings table + vendor profile (scores, sources, momentum, news).
- Sitemap, metadata, OG images, canonical. Lighthouse-fast.

**Wave 3 — The hero signal:**
- The **Dependency / Encroachment graph** — interactive, shareable, with a clean screenshot/OG export. Per-vendor "who they depend on / who's coming for them," in plain English.

**Wave 4 — Audience + data capture:**
- Email capture / newsletter signup + a simple insight/articles surface.
- Wire up **IntentEvent** logging across all pages; a basic internal dashboard to see the aggregated demand signal forming.

**MVP within Phase 1 (if you want a live thing fastest):** Wave 1 + the `/vendors` rankings page + ~20 vendor pages + the dependency graph + email capture. Ship that, then fill in.

---

## 6. Acceptance criteria (Phase 1 is "done" when…)

- Public pages **server-render**, are **indexable**, and load with **no live LLM call**.
- The market refresh runs **once centrally** and serves all visitors from cache/DB.
- There's a **screenshot-worthy** dependency/encroachment view people want to share.
- **Email capture** works; **IntentEvents** are logging and visible in aggregate.
- Every score is **explainable** (links to sources); **no** commercial process can write a score.
- **No secrets client-side**; ingestion is **cost-capped**; public APIs are **rate-limited**.

---

## 7. Ready-to-paste kickoff prompt for Claude Code

> You're working in the `AI-Enterprise-5_06_2026` repo on the **`v2-new-shape`** branch (Next.js). Read `Phase1-Build-Brief.md`. We're building **only Phase 1**: the free, SEO-indexable, real-time AI-vendor rankings + insight site with a Dependency/Encroachment hero graph, email capture, and anonymous buyer-intent instrumentation — served by a **single shared, batched, cached market refresh** (public pages make **no** live LLM calls).
>
> Start with **Wave 1 only**: propose the data model (keeping rankings firewalled from any future vendor-commercial fields), the shared refresh job with a hard spend cap + kill switch, and secrets/env hygiene. Show me the plan before writing code. Work in **small commits**, keep `main` untouched, and after each push confirm the Vercel preview builds. Flag anything that would add a live per-user LLM cost, weaken the independence firewall, or expand scope beyond the brief — and stop and ask before doing it.

---

## 8. Your first moves

1. In Claude Code: `git fetch origin` → `git checkout v2-new-shape`.
2. Drop this brief into the repo (or paste it in).
3. Paste the kickoff prompt above.
4. **Your first commit on the branch triggers the Vercel preview URL** — tell me when you've pushed and I'll confirm it's live from the Vercel side (as promised) and we'll have your separate workshop running.

*Holding the self-service line. Build the wedge, keep it cheap, keep the rankings clean.*
