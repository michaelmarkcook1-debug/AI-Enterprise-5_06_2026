// AIE-05 — Session persistence (self-migrating raw-SQL, no Prisma migration).
// ─────────────────────────────────────────────────────────────────────────────
// Follows the established self-migrating pattern (lib/billing/credits.ts,
// lib/system/spend-ledger.ts): CREATE TABLE IF NOT EXISTS on first use, no
// migration file, so it ships without the migrate-deploy advisory-lock risk this
// codebase has hit repeatedly. Session state lives entirely here, so the client
// only holds a sessionId and refresh/return resumes cleanly.
//
// Tenant model: Organization → Seat → Session. Cost columns on every turn and on
// the finding roll up by pure SQL SUM to session / seat / org. Per-seat-correct
// from day one even though the open test site uses one default seat.
//
// Unlike the read-only stores above, WRITES here PROPAGATE errors: if a session
// can't be persisted we must not pretend it was (the API returns an honest
// failure), so nothing is silently swallowed on the write path.

import { getPrisma, hasDatabase } from "../prisma";
import type { CostColumns } from "./cost";
import type { IntentProfile, Finding, EvidenceItem, InterrogationMode } from "./types";
import { DEFAULT_INTERROGATION_MODE } from "./types";

export const DEFAULT_ORG_ID = "org_default";
export const DEFAULT_SEAT_ID = "seat_default";

export type SessionStatus =
  | "in_progress"
  | "synthesizing"
  | "complete"
  | "synthesis_failed"
  | "abandoned";

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "ai_organization" (
  "id"         TEXT PRIMARY KEY,
  "name"       TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE TABLE IF NOT EXISTS "ai_seat" (
  "id"         TEXT PRIMARY KEY,
  "org_id"     TEXT NOT NULL,
  "label"      TEXT NOT NULL,
  "created_at" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
CREATE INDEX IF NOT EXISTS "ai_seat_org_idx" ON "ai_seat" ("org_id");
CREATE TABLE IF NOT EXISTS "ai_interrogation_session" (
  "id"             TEXT PRIMARY KEY,
  "seat_id"        TEXT NOT NULL,
  "org_id"         TEXT NOT NULL,
  "status"         TEXT NOT NULL DEFAULT 'in_progress',
  "intent_profile" JSONB,
  "created_at"     TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "completed_at"   TIMESTAMP(3)
);
CREATE INDEX IF NOT EXISTS "ai_session_seat_idx" ON "ai_interrogation_session" ("seat_id");
CREATE INDEX IF NOT EXISTS "ai_session_org_idx" ON "ai_interrogation_session" ("org_id");
CREATE TABLE IF NOT EXISTS "ai_interrogation_turn" (
  "id"            TEXT PRIMARY KEY,
  "session_id"    TEXT NOT NULL,
  "ordinal"       INTEGER NOT NULL,
  "role"          TEXT NOT NULL,
  "content"       TEXT NOT NULL,
  "model"         TEXT,
  "input_tokens"  BIGINT NOT NULL DEFAULT 0,
  "output_tokens" BIGINT NOT NULL DEFAULT 0,
  "cost_usd"      DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at"    TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
-- UNIQUE, not just indexed: a colliding ordinal (a concurrency bug) must fail
-- loudly at the DB rather than silently overwrite/duplicate a turn.
CREATE UNIQUE INDEX IF NOT EXISTS "ai_turn_session_ordinal_uq" ON "ai_interrogation_turn" ("session_id", "ordinal");
CREATE TABLE IF NOT EXISTS "ai_finding" (
  "id"                TEXT PRIMARY KEY,
  "session_id"        TEXT NOT NULL UNIQUE,
  "markdown"          TEXT NOT NULL,
  "evidence_refs"     JSONB,
  "cited_source_urls" JSONB,
  "model"             TEXT,
  "input_tokens"      BIGINT NOT NULL DEFAULT 0,
  "output_tokens"     BIGINT NOT NULL DEFAULT 0,
  "cost_usd"          DOUBLE PRECISION NOT NULL DEFAULT 0,
  "created_at"        TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP
);
`;

// Additive column on the table above (Prompt: quick/comprehensive toggle).
// CREATE TABLE IF NOT EXISTS is a no-op once the table already exists in
// prod, so a new column needs its own idempotent ALTER — same pattern
// lib/pool/incentive.ts already established for this table family.
const ALTER_SQL = `
ALTER TABLE "ai_interrogation_session" ADD COLUMN IF NOT EXISTS "mode" TEXT NOT NULL DEFAULT 'comprehensive';
`;

let tablesEnsured = false;
async function ensureTables(): Promise<void> {
  if (tablesEnsured) return;
  await getPrisma().$executeRawUnsafe(CREATE_SQL);
  await getPrisma().$executeRawUnsafe(ALTER_SQL);
  tablesEnsured = true;
}

function id(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}${Math.random().toString(36).slice(2, 10)}`;
}

function requireDb(): void {
  if (!hasDatabase()) throw new Error("interrogation: no database configured — sessions require persistence");
}

/** Idempotently ensure the default org + seat exist (the open test site's
 *  single seat). Safe to call on every session start. */
export async function ensureDefaults(): Promise<void> {
  requireDb();
  await ensureTables();
  const db = getPrisma();
  await db.$executeRaw`
    INSERT INTO "ai_organization" ("id", "name")
    VALUES (${DEFAULT_ORG_ID}, 'Default (test site)')
    ON CONFLICT ("id") DO NOTHING`;
  await db.$executeRaw`
    INSERT INTO "ai_seat" ("id", "org_id", "label")
    VALUES (${DEFAULT_SEAT_ID}, ${DEFAULT_ORG_ID}, 'Default seat')
    ON CONFLICT ("id") DO NOTHING`;
}

export interface TurnRow {
  ordinal: number;
  /** "meter" = a cost-only row (a concluding questioner call or a failed
   *  synthesis attempt): it carries burned-token cost but is NOT part of the
   *  conversation, so it never renders in the transcript or counts as a
   *  question. It still sums into the cost rollups. */
  role: "question" | "answer" | "meter";
  content: string;
}

export interface SessionRow {
  id: string;
  seatId: string;
  orgId: string;
  status: SessionStatus;
  mode: InterrogationMode;
  intentProfile: IntentProfile | null;
  turns: TurnRow[];
}

/** Create a session and persist the opening statement as turn 0 (an answer). */
export async function createSession(input: {
  openingText: string;
  seatId?: string;
  orgId?: string;
  mode?: InterrogationMode;
}): Promise<string> {
  requireDb();
  await ensureDefaults();
  const db = getPrisma();
  const sessionId = id("sess");
  const seatId = input.seatId ?? DEFAULT_SEAT_ID;
  const orgId = input.orgId ?? DEFAULT_ORG_ID;
  const mode = input.mode ?? DEFAULT_INTERROGATION_MODE;
  await db.$executeRaw`
    INSERT INTO "ai_interrogation_session" ("id", "seat_id", "org_id", "status", "mode")
    VALUES (${sessionId}, ${seatId}, ${orgId}, 'in_progress', ${mode})`;
  await db.$executeRaw`
    INSERT INTO "ai_interrogation_turn" ("id", "session_id", "ordinal", "role", "content")
    VALUES (${id("turn")}, ${sessionId}, 0, 'answer', ${input.openingText.slice(0, 4000)})`;
  return sessionId;
}

export async function getSession(sessionId: string): Promise<SessionRow | null> {
  requireDb();
  await ensureTables();
  const db = getPrisma();
  const rows = await db.$queryRaw<
    Array<{ id: string; seat_id: string; org_id: string; status: string; mode: string; intent_profile: unknown }>
  >`SELECT "id", "seat_id", "org_id", "status", "mode", "intent_profile"
      FROM "ai_interrogation_session" WHERE "id" = ${sessionId}`;
  const s = rows[0];
  if (!s) return null;
  const turnRows = await db.$queryRaw<Array<{ ordinal: number; role: string; content: string }>>`
    SELECT "ordinal", "role", "content" FROM "ai_interrogation_turn"
      WHERE "session_id" = ${sessionId} ORDER BY "ordinal" ASC`;
  return {
    id: s.id,
    seatId: s.seat_id,
    orgId: s.org_id,
    status: s.status as SessionStatus,
    mode: (s.mode as InterrogationMode) || DEFAULT_INTERROGATION_MODE,
    intentProfile: (s.intent_profile as IntentProfile | null) ?? null,
    turns: turnRows.map((t) => ({ ordinal: Number(t.ordinal), role: t.role as TurnRow["role"], content: t.content })),
  };
}

/** Count how many QUESTION turns have been asked in a session. */
export function countQuestions(session: SessionRow): number {
  return session.turns.filter((t) => t.role === "question").length;
}

/** Next ordinal (max + 1). */
function nextOrdinal(session: SessionRow): number {
  return session.turns.reduce((m, t) => Math.max(m, t.ordinal), -1) + 1;
}

/** Append a question turn (carries the questioner call's cost). Mutates the
 *  passed session's turns so subsequent appends in the same request stay
 *  ordinally monotonic without a re-fetch. */
export async function appendQuestion(
  session: SessionRow,
  question: string,
  cost: CostColumns,
): Promise<void> {
  requireDb();
  const ordinal = nextOrdinal(session);
  const content = question.slice(0, 2000);
  await getPrisma().$executeRaw`
    INSERT INTO "ai_interrogation_turn"
      ("id", "session_id", "ordinal", "role", "content", "model", "input_tokens", "output_tokens", "cost_usd")
    VALUES (${id("turn")}, ${session.id}, ${ordinal}, 'question', ${content},
      ${cost.model}, ${cost.inputTokens}, ${cost.outputTokens}, ${cost.costUsd})`;
  session.turns.push({ ordinal, role: "question", content });
}

/** Append a user answer turn (no LLM cost). */
export async function appendAnswer(session: SessionRow, answer: string): Promise<void> {
  requireDb();
  const ordinal = nextOrdinal(session);
  const content = answer.slice(0, 4000);
  await getPrisma().$executeRaw`
    INSERT INTO "ai_interrogation_turn" ("id", "session_id", "ordinal", "role", "content")
    VALUES (${id("turn")}, ${session.id}, ${ordinal}, 'answer', ${content})`;
  session.turns.push({ ordinal, role: "answer", content });
}

/** Append a cost-only "meter" turn — burned tokens with no conversational
 *  content (a concluding questioner call, or a failed synthesis attempt). Keeps
 *  spend truthful even when no question/finding row carries the cost. */
export async function appendMeter(session: SessionRow, note: string, cost: CostColumns): Promise<void> {
  requireDb();
  const ordinal = nextOrdinal(session);
  const content = note.slice(0, 200);
  await getPrisma().$executeRaw`
    INSERT INTO "ai_interrogation_turn"
      ("id", "session_id", "ordinal", "role", "content", "model", "input_tokens", "output_tokens", "cost_usd")
    VALUES (${id("turn")}, ${session.id}, ${ordinal}, 'meter', ${content},
      ${cost.model}, ${cost.inputTokens}, ${cost.outputTokens}, ${cost.costUsd})`;
  session.turns.push({ ordinal, role: "meter", content });
}

export async function setStatus(sessionId: string, status: SessionStatus): Promise<void> {
  requireDb();
  await getPrisma().$executeRaw`
    UPDATE "ai_interrogation_session" SET "status" = ${status} WHERE "id" = ${sessionId}`;
}

export async function setIntentProfile(sessionId: string, profile: IntentProfile): Promise<void> {
  requireDb();
  await getPrisma().$executeRaw`
    UPDATE "ai_interrogation_session"
      SET "intent_profile" = ${JSON.stringify(profile)}::jsonb WHERE "id" = ${sessionId}`;
}

/** Persist the finding (one per session) + its evidence refs and synthesis cost,
 *  and mark the session complete. The finding cost is the SUM across all
 *  synthesis attempts (a failed attempt still burned tokens → still counted). */
export async function saveFinding(input: {
  sessionId: string;
  finding: Finding;
  evidenceRefs: EvidenceItem[];
  cost: CostColumns;
}): Promise<void> {
  requireDb();
  const db = getPrisma();
  await db.$executeRaw`
    INSERT INTO "ai_finding"
      ("id", "session_id", "markdown", "evidence_refs", "cited_source_urls",
       "model", "input_tokens", "output_tokens", "cost_usd")
    VALUES (${id("find")}, ${input.sessionId}, ${input.finding.markdown},
      ${JSON.stringify(input.evidenceRefs)}::jsonb, ${JSON.stringify(input.finding.citedSourceUrls)}::jsonb,
      ${input.cost.model}, ${input.cost.inputTokens}, ${input.cost.outputTokens}, ${input.cost.costUsd})
    ON CONFLICT ("session_id") DO UPDATE SET
      "markdown" = EXCLUDED."markdown",
      "evidence_refs" = EXCLUDED."evidence_refs",
      "cited_source_urls" = EXCLUDED."cited_source_urls",
      "model" = EXCLUDED."model",
      "input_tokens" = EXCLUDED."input_tokens",
      "output_tokens" = EXCLUDED."output_tokens",
      "cost_usd" = EXCLUDED."cost_usd"`;
  await db.$executeRaw`
    UPDATE "ai_interrogation_session"
      SET "status" = 'complete', "completed_at" = CURRENT_TIMESTAMP WHERE "id" = ${input.sessionId}`;
}

export interface StoredFinding {
  markdown: string;
  citedSourceUrls: string[];
  evidenceRefs: EvidenceItem[];
}

export async function getFinding(sessionId: string): Promise<StoredFinding | null> {
  requireDb();
  await ensureTables();
  const rows = await getPrisma().$queryRaw<
    Array<{ markdown: string; cited_source_urls: unknown; evidence_refs: unknown }>
  >`SELECT "markdown", "cited_source_urls", "evidence_refs" FROM "ai_finding" WHERE "session_id" = ${sessionId}`;
  const f = rows[0];
  if (!f) return null;
  return {
    markdown: f.markdown,
    citedSourceUrls: (f.cited_source_urls as string[] | null) ?? [],
    evidenceRefs: (f.evidence_refs as EvidenceItem[] | null) ?? [],
  };
}

// ── Cost rollups (the Phase-2 per-customer attribution, live from turn 1) ─────
export async function getSessionCost(sessionId: string): Promise<number> {
  requireDb();
  await ensureTables();
  const db = getPrisma();
  const t = await db.$queryRaw<Array<{ total: number | null }>>`
    SELECT COALESCE(SUM("cost_usd"), 0)::double precision AS total
      FROM "ai_interrogation_turn" WHERE "session_id" = ${sessionId}`;
  const f = await db.$queryRaw<Array<{ total: number | null }>>`
    SELECT COALESCE(SUM("cost_usd"), 0)::double precision AS total
      FROM "ai_finding" WHERE "session_id" = ${sessionId}`;
  return Number(t[0]?.total ?? 0) + Number(f[0]?.total ?? 0);
}

export interface CostRollup {
  turnsUsd: number;
  findingsUsd: number;
  totalUsd: number;
  sessions: number;
}

export async function getOrgCostRollup(orgId: string): Promise<CostRollup> {
  requireDb();
  await ensureTables();
  const db = getPrisma();
  const turns = await db.$queryRaw<Array<{ total: number | null }>>`
    SELECT COALESCE(SUM(t."cost_usd"), 0)::double precision AS total
      FROM "ai_interrogation_turn" t
      JOIN "ai_interrogation_session" s ON s."id" = t."session_id"
      WHERE s."org_id" = ${orgId}`;
  const finds = await db.$queryRaw<Array<{ total: number | null }>>`
    SELECT COALESCE(SUM(f."cost_usd"), 0)::double precision AS total
      FROM "ai_finding" f
      JOIN "ai_interrogation_session" s ON s."id" = f."session_id"
      WHERE s."org_id" = ${orgId}`;
  const count = await db.$queryRaw<Array<{ n: bigint }>>`
    SELECT COUNT(*)::bigint AS n FROM "ai_interrogation_session" WHERE "org_id" = ${orgId}`;
  const turnsUsd = Number(turns[0]?.total ?? 0);
  const findingsUsd = Number(finds[0]?.total ?? 0);
  return { turnsUsd, findingsUsd, totalUsd: turnsUsd + findingsUsd, sessions: Number(count[0]?.n ?? 0) };
}
