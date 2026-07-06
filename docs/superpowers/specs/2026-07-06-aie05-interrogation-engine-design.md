# AIE-05 — The Interrogation Engine (Design)

**Ticket:** AIE-05, AI Enterprise Phase 2 Build Tickets
**Author:** Claude (with Michael Cook)
**Date:** 2026-07-06
**Status:** Approved for implementation planning

---

## 1. Objective

A CIO arrives with a real problem — "I am X, I have Y, I want to get to Z." Instead of a
static tick-box form, the platform asks a small number of nuanced, **adaptive** questions
(later questions genuinely depend on earlier answers), works out what they are actually
trying to achieve, and returns a tailored, **written finding** they could not have got from
a search engine.

Hard constraints from the ticket:
- **Grounded and traceable** (AnalystGenius rule): nothing appears that cannot be traced to
  a real basis; the engine never invents facts.
- **Model-tier discipline:** mid tier (Sonnet-class) for the adaptive questioning flow;
  reasoning tier (Opus-class) **only** for the final synthesis — the one place in the whole
  product where the reasoning tier is justified.
- **Per-customer inference cost** measured and attributable (Phase 2 makes this required, not
  merely non-blocking).
- **Useful even when the peer pool (AIE-07) is thin or empty** — leans on Phase-1 market data
  until the private pool fills.

## 2. Decisions locked with the owner

1. **Tenant model:** `Organization` is a first-class concept; members/seats belong to one.
   Sessions, cost, and (future) pool contribution roll up to the org. (Owner: "b".)
2. **Access, for now:** a **fully functional test site — open (no auth gate) but attached to a
   single default seat under a single default org**, so the per-seat plumbing is real and
   correct from day one and needs no rework when auth is switched on later. (Owner: "b, but for
   now we need this to be a fully functional test site. so make it open but attached to one
   seat".)
3. **Stopping condition:** always ask **at least 2** questions, then **dynamically** decide
   whether more are warranted, with **no user-facing cap** (owner: "c with uncapped"). A
   background bug-guard constant force-synthesizes at a high turn count purely so a logic bug
   cannot spiral cost; it is invisible in normal use.
4. **Grounding architecture:** two-phase, evidence-first (approved option A). A deterministic,
   no-LLM retrieval step assembles the cited evidence bundle; the reasoning-tier synthesizer
   can only speak to that bundle. Fabrication is blocked by construction, not by prompt
   discipline.
5. **Finding format:** ~**180 words** (owner: "180ish is the sweetspot"), honest about data
   gaps and confidence (owner: "keep honesty"), and able to show **both** the public-disclosure
   peer layer and the future private anonymized-pool layer together, clearly distinguished
   (owner: "it should be able to include both"), degrading gracefully when the pool layer is
   absent (which is 100% of the time until AIE-06/07 ship).
6. **Answer input:** hybrid, governed by a rule for accuracy (see §5). Taxonomy-backed chips
   for the closed dimensions that key the evidence lookup (`vertical`, `sizeBand`, `region`),
   **sourced from the real taxonomy constants in `lib/peer/segments.ts`, not model-invented**;
   pure free text for the open dimensions (`goal`, `constraints`). Free text always available
   as an escape hatch even when chips are shown.

## 3. What already exists (do not rebuild)

- **3-tier model routing** (Haiku/Sonnet/Opus, env-overridable): `lib/agents/llm-client.ts`.
- **Anti-fabrication citation-allowlist parsing:** used by `components/chat/TabChat.tsx` +
  `lib/agents/tab-chat.ts` and by the composite-lens reweighting call. Reused for the
  synthesizer's citation guard.
- **Phase-1 market data to ground against (real, live, cited):**
  - `lib/model-inventory/frontier.ts` — 4-vendor LMArena Elo comparison (AIE-01).
  - `lib/peer/segments.ts` — the segment taxonomy: `VERTICALS` (16), `SIZE_BANDS` (4),
    `REGIONS` (5), and `segmentId()`. **The categorical chips are literally these constants**,
    and the intent profile's segment key joins directly to the benchmark data below.
  - `lib/peer/segment-benchmarks.ts`, `lib/peer/peer-adoption-data.ts` — the public-disclosure
    peer/BTOS benchmark layer, keyed by `segmentId`.
- **Per-request token usage is already computed** at every LLM call in `llm-client.ts` — but
  currently discarded. This design persists it.

**Explicitly NOT reused:** the existing "Interrogate" feature
(`app/api/member/assessment/interrogate/route.ts`, `lib/agents/composite-lens.ts`) is a
static-form → single-Opus-call → weight-reweighting tool. It is a different feature that
shares a name; AIE-05 is a from-scratch build, not an extension of it.

## 4. Data model (Prisma, self-migrating per existing pattern)

- **`Organization`** — `id`, `name`, `createdAt`. The tenant boundary. One default row
  (`org_default`) seeded now.
- **`Seat`** — `id`, `orgId` → Organization, `label`, `createdAt`. The per-seat cost unit. One
  default seat (`seat_default`) under the default org now. Links to a Member when auth is
  switched on.
- **`InterrogationSession`** — `id`, `seatId` → Seat, `orgId` (denormalized for fast org
  rollups), `status` (`in_progress` | `synthesizing` | `complete` | `synthesis_failed` |
  `abandoned`), `intentProfile` (JSON, filled when the questioner emits `ready`), `createdAt`,
  `completedAt`.
- **`InterrogationTurn`** — `id`, `sessionId`, `ordinal`, `role` (`question` | `answer`),
  `content`, and per-call cost columns (`model`, `inputTokens`, `outputTokens`, `costUsd`).
  One row per question and per answer. Where the currently-discarded token data lands.
- **`Finding`** — `id`, `sessionId` (one-to-one), `markdown` (the ~180-word finding),
  `evidenceRefs` (JSON — the exact cited sources handed to the synthesizer, so every claim is
  auditable back to its basis), `model`, cost columns, `createdAt`.

Cost rolls up by pure SQL `SUM`: turns + finding → session; sessions by `seatId` → seat; by
`orgId` → org. Per-seat-correct from day one despite only one seat existing.

## 5. Adaptive flow (the questioner loop)

Two thin API routes + one client component. Session state lives entirely in the DB (client
holds only a `sessionId`, so refresh/return resumes cleanly).

1. **Start.** `POST /api/interrogate/start` — creates a session (`in_progress`) under the
   default seat/org, persists the CIO's opening free-text as turn 0 (`answer`), calls the
   questioner for the first question.
2. **Questioner call** (mid-tier / Sonnet) — forced structured output (the composite-lens
   pattern), returns one of:
   - `{ action: "ask", question, options? }` — the next question, with **optional** suggested
     answer chips.
   - `{ action: "ready", intentProfile: { vertical, sizeBand, region, goal, constraints[] } }`
     — enough signal; stop asking. (`vertical`/`sizeBand`/`region` match the `Segment` type in
     `lib/peer/segments.ts` exactly, so the profile keys join to the benchmark data with no
     renaming.)
   - **Enforced in code, not the prompt:** turns 1–2 are always `ask` (the "minimum 2"). From
     turn 3 on, `ready` is allowed. No user-facing cap. Background bug-guard `MAX_TURNS = 12`
     force-synthesizes if `ready` never fires (a seatbelt against a logic bug, not a UX cap).
3. **Answer.** `POST /api/interrogate/answer` persists the answer, re-calls the questioner,
   and either returns the next question or transitions the session to `synthesizing` and kicks
   synthesis.

**Answer-input rule (for accuracy, not just speed):**
- **Closed, taxonomy-backed dimensions** (`vertical`, `sizeBand`, `region`) → chips **drawn
  from the real `lib/peer/segments.ts` constants**. This guarantees the intent profile's
  segment key joins to real evidence with zero translation loss (a free-texted "biggish bank
  in the northeast" would force a lossy model translation into the enum and can pull the wrong
  benchmark).
- **Open dimensions** (`goal`, `constraints`) → **pure free text**. Chips here would anchor the
  CIO into pre-set options and systematically miss the real answer (closed-question priming
  bias).
- **Free text is always available** even when chips are shown — chips are an accelerant, never
  a cage. Whether clicked or typed, the answer persists as the same `InterrogationTurn`, so
  chips add zero complexity to cost/state/grounding.

**Honesty guard at the question stage:** the questioner may only gather intent. It is barred
from asserting any market fact mid-conversation (a chip can say "Financial services" but never
"Financial services, where 34% already use AI"). Facts appear only in the final grounded
finding.

## 6. Retrieval + synthesis (evidence-first core)

On `ready`, the intent profile is saved and control passes to a **deterministic retrieval step
(pure code, no LLM):**

1. **Resolve the segment** — `segmentId({ vertical, sizeBand, region })` (exact, since all
   three came from real-taxonomy chips).
2. **Assemble the evidence bundle**, each item carrying its real citation:
   - **Model layer** — `getFrontierComparison()` (live LMArena data); if the goal names a
     capability, that category's real leaders.
   - **Peer layer — public** — `segment-benchmarks.ts` + `peer-adoption-data.ts` matches for
     the segment, with exact-match / adjacent-match / no-match flagged honestly.
   - **Peer layer — private pool** — a placeholder call returning empty today (AIE-06/07 do not
     exist). When the pool lands it slots in here as a second labelled layer; the synthesizer
     already renders "both," so no rework.
3. **Compute honest coverage flags** — e.g. `exactSegmentMatch`, `nearestMatch`,
   `poolContributors: 0`. These drive the finding's confidence line.

Then the **synthesizer** (reasoning-tier / Opus — the only reasoning-tier call in the product):
- Receives the intent profile + evidence bundle + coverage flags, **and nothing else** (no open
  web, no raw DB).
- Writes the **~180-word** finding in the approved structure: *Your situation / Model fit / What
  peers are doing / Bottom line / Confidence.*
- Constrained by the **citation-allowlist guard** (TabChat/composite-lens pattern): every named
  source must exist in the bundle, or the finding is rejected and regenerated. An unbacked claim
  cannot survive.
- The exact evidence items handed to it are persisted to `Finding.evidenceRefs` — every finding
  is auditable back to its basis forever.

Outcome: fabrication structurally blocked (model sees only pre-fetched cited evidence); dual-layer
peer requirement native (public now, public+pool later); honesty enforced (coverage → confidence
line); tier split exactly per ticket (one reasoning call per completed session, nowhere else).

**Approved finding shape (reference — this is "good," ~180 words):**

> ### Coding copilot standardization — regional banking, 200-engineer org
> **Your situation:** standardizing one frontier model across engineering, in a sector where AI
> adoption is real but concentrated among the largest players.
> **Model fit.** On coding, OpenAI's gpt-5.4-high currently leads the four tracked frontier
> models (1,495 Elo), ahead of Google's gemini-3.5-flash (1,493) and xAI's grok-4.20-beta
> (1,462). Caveat: Anthropic's overall-strongest model (claude-opus-4-6-thinking, #1 at 1,501)
> has no cited coding score of its own — but a different Anthropic model, claude-opus-4-6, leads
> all four at 1,535. If Anthropic is on your shortlist, you'd deploy that specific model.
> (Source: LMArena, 2026-07-02.)
> **What peers are doing.** Finance & Insurance firms report AI use at 33.9% vs a 19.8% national
> rate — but that jumps to 63% among the largest firms, so scale peers drive the average.
> (Source: US Census BTOS, May 2026.) Morgan Stanley has built OpenAI-based advisor tooling;
> Wells Fargo deployed Google Cloud's agentic stack. No regional bank at your AUM band has a
> disclosed deployment in our data yet — a gap in what's public, not evidence peers aren't
> moving.
> **Bottom line.** OpenAI edges coding today; Anthropic is close on a different model. You'd be
> ahead of your immediate peer set, not behind.
> *Confidence: model comparison high (direct benchmark); peer comparison moderate (sector survey
> + named large-institution disclosures, not size-matched peer data).*

## 7. Cost attribution

`llm-client.ts` already returns `usage` (input/output tokens) per call but discards it. Add a thin
`logInferenceCost({ model, usage, sessionId, turnId })` that maps tokens → USD via a small
per-model rate table (real published rates, one place to update) and writes the cost columns on
the owning `InterrogationTurn` (or `Finding`). Because every call is tied to a turn/finding →
session → seat → org, cost rolls up by SQL `SUM` at any level with no separate metering table and
no double-counting. Read models: `getSessionCost(sessionId)`, `getOrgCostRollup(orgId)` (for an
admin view later; not user-facing now). Unknown model → fail loud (never silently cost $0). This
satisfies "per-customer inference cost measured and attributable" live from the first session.

## 8. Error handling — fail honest, never fake

- **Questioner call fails** (timeout/API): session stays `in_progress`; client shows a retryable
  "couldn't reach the engine" state. No fabricated question, no silent skip.
- **Synthesizer fails:** session → `synthesis_failed` (not `complete`); user sees an honest
  "couldn't complete your finding — retry"; retry re-runs synthesis against the same saved
  evidence bundle (cheap, deterministic inputs). Never a partial/made-up finding.
- **Retrieval finds no matching evidence** (empty bundle): a *valid* outcome, not an error. The
  synthesizer runs with an explicit "no segment evidence available" flag, leans only on the
  model layer, and says so — the "useful even when the pool is thin/empty" requirement extended
  to the public layer too.
- **Citation-guard rejection** (synthesizer named an out-of-bundle source): auto-regenerate once
  with a stricter instruction; on a second failure, surface `synthesis_failed` rather than ship
  an ungrounded finding. Under-claim, never over-claim.
- **Failed calls still burned tokens** → still cost-attributed, so cost data stays truthful.

## 9. Testing + file layout

**Testing** (esbuild parse-gate + vitest pure-function units; no reliance on the slow local dev
server; the two LLM calls are seams that take an injected client, so tests use a deterministic
fake — fast, free, offline):
- Flow control — "first two turns always `ask`," "`ready` allowed from turn 3," "bug-guard forces
  synthesis at MAX_TURNS."
- Retrieval/segment resolution — intent profile → `segmentId` → correct bundle, incl.
  exact/adjacent/no-match/empty-bundle.
- Cost mapping — tokens+model → USD, incl. unknown-model fail-loud guard.
- Citation guard — out-of-bundle source rejected, in-bundle passes (the anti-fabrication test,
  most cases).
- A `fabrication-auditor` pass before ship (this feature is a fabrication surface).

**File layout** (mirrors `lib/agents/*` + `lib/model-inventory/*`):
```
prisma/schema.prisma            + Organization, Seat, InterrogationSession,
                                  InterrogationTurn, Finding
lib/interrogation/
  types.ts                      IntentProfile, EvidenceBundle, coverage flags
  questioner.ts                 mid-tier loop step (pure core + client seam)
  retrieval.ts                  deterministic evidence assembly (no LLM)
  synthesis.ts                  reasoning-tier finding writer + citation guard
  cost.ts                       logInferenceCost + rollup read models
  session-store.ts              DB read/write for session/turn/finding
  *.test.ts                     the unit suites above
app/api/interrogate/
  start/route.ts                POST — create session + first question
  answer/route.ts               POST — persist answer, next Q or synthesize
  finding/[sessionId]/route.ts  GET — fetch completed finding + evidence refs
components/interrogate/
  InterrogationFlow.tsx         client: question, chips + free text, progress, finding
app/(public)/interrogate/page.tsx   mounts the flow (open, default seat/org)
lib/seed-interrogation.ts       seeds org_default + seat_default (idempotent)
```

## 10. Open items deferred to the owner (not blocking AIE-05 build)

These belong to later Phase-2 tickets; AIE-05 is designed not to block any of them:
- **Minimum-count floor (k-anonymity)** for AIE-07's private pool — a policy number only the owner
  sets. AIE-05's retrieval already has the placeholder "private pool" slot that will enforce it.
- **How "companies like yours" is sliced** beyond vertical × size × region — already the taxonomy
  AIE-05 uses; extendable.
- **Consent/terms wording** for AIE-06 contribution — legal, not engineering.
- **AIE-08 incentive design** — go-to-market.

## 11. Scope boundary

This spec covers **AIE-05 only**. It deliberately does **not** build: AIE-06 (consent +
anonymization pipeline), AIE-07 (private pool aggregation + minimum-count floor), or AIE-08
(seeding/incentive). It leaves clean seams for all three (the `Organization`/`Seat` tenant
boundary, the empty private-pool retrieval slot, the dual-layer-ready synthesizer). Auth gating
is out of scope for now by owner decision (open test site, single default seat).
