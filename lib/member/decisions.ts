// Member saved-decision persistence.
// ─────────────────────────────────────────────────────────────────
// Sibling to lib/member/watchlist.ts — same shape, same firewall (no read or
// write of any score/ranking table, plain ids/JSON only), same rule: every
// query is scoped to the caller's subscriberId. UNLIKE the watchlist (one row
// per subscriber), a member can have MANY named decisions, so ownership is
// enforced per-row: every mutation's WHERE clause includes subscriberId, so a
// request for another member's id matches zero rows — never partially applies,
// never confirms whether that id exists at all.
//
// A saved decision is a PRIVATE LENS: it stores what the member chose, and is
// re-applied against CURRENT live scores at read time by the caller (this
// module never joins to a score table itself). Saving/reopening one can never
// change a global weight or the published composite.

import { getPrisma, hasDatabase } from "../prisma";
import type { Prisma } from "../../generated/prisma/client";
import { ENTITIES } from "../intelligence/entities";
import { MARKET_CATEGORIES } from "../intelligence/seed";
import { ASSESSMENT_DOMAINS } from "../assessment/domain-rubric";
import type { DomainId } from "../types";

function toInputJson(value: unknown): Prisma.InputJsonValue {
  return JSON.parse(JSON.stringify(value)) as Prisma.InputJsonValue;
}

// Shortlist entries carry the DB vendorId (RerankVendor.vendorId, e.g. from
// CategoryRerank/InterrogatePanel) — NOT the URL slug. id !== slug for some
// vendors (e.g. alibaba/moonshot/zai), so validating against slugs would
// silently drop those vendors' shortlist entries on save.
const VALID_VENDOR_IDS = new Set(ENTITIES.map((e) => e.id));
const VALID_CATEGORY_IDS = new Set(MARKET_CATEGORIES.map((c) => c.id as string));

const MAX_NAME_LENGTH = 120;
const MAX_NOTE_LENGTH = 500;
const MAX_SHORTLIST = 50;

export interface DecisionShortlistItem {
  vendorId: string;
  note?: string;
}

export interface MemberDecisionView {
  id: string;
  name: string;
  category: string;
  weights: Record<DomainId, number>;
  shortlist: DecisionShortlistItem[];
  asOfDate: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface SanitizedDecisionInput {
  name: string;
  category: string;
  weights: Record<DomainId, number>;
  shortlist: DecisionShortlistItem[];
  asOfDate: string | null;
}

export type SanitizeResult = { ok: true; data: SanitizedDecisionInput } | { ok: false; error: string };

/** Pure validation. REQUIRED fields (name, category, all 12 domain weights)
 *  fail loud on a bad request rather than silently substituting a value the
 *  member never chose — a decision is supposed to reproduce their exact
 *  intent. Optional/list fields (shortlist, asOfDate) follow the watchlist's
 *  lenient convention: drop unknown/invalid entries rather than reject the
 *  whole save over one bad shortlist item. Exported for tests. */
export function sanitizeDecision(input: unknown): SanitizeResult {
  const i = (input ?? {}) as Record<string, unknown>;

  const name = typeof i.name === "string" ? i.name.trim().slice(0, MAX_NAME_LENGTH) : "";
  if (!name) return { ok: false, error: "name is required" };

  const category = typeof i.category === "string" ? i.category.trim() : "";
  if (!category || !VALID_CATEGORY_IDS.has(category)) return { ok: false, error: "category is invalid" };

  const rawWeights = (i.weights ?? {}) as Record<string, unknown>;
  const weights = {} as Record<DomainId, number>;
  for (const domain of ASSESSMENT_DOMAINS) {
    const v = rawWeights[domain];
    if (typeof v !== "number" || !Number.isFinite(v) || v < 0) {
      return { ok: false, error: `weights.${domain} must be a non-negative number` };
    }
    weights[domain] = v;
  }

  const shortlistRaw = Array.isArray(i.shortlist) ? i.shortlist : [];
  const seen = new Set<string>();
  const shortlist: DecisionShortlistItem[] = [];
  for (const entry of shortlistRaw) {
    const e = (entry ?? {}) as Record<string, unknown>;
    const vendorId = typeof e.vendorId === "string" ? e.vendorId.trim() : "";
    if (!vendorId || !VALID_VENDOR_IDS.has(vendorId) || seen.has(vendorId)) continue;
    seen.add(vendorId);
    const note = typeof e.note === "string" && e.note.trim().length > 0 ? e.note.trim().slice(0, MAX_NOTE_LENGTH) : undefined;
    shortlist.push(note ? { vendorId, note } : { vendorId });
    if (shortlist.length >= MAX_SHORTLIST) break;
  }

  const asOfDate = typeof i.asOfDate === "string" && /^\d{4}-\d{2}-\d{2}$/.test(i.asOfDate) ? i.asOfDate : null;

  return { ok: true, data: { name, category, weights, shortlist, asOfDate } };
}

/** Exported so lib/member/decision-shares.ts's PUBLIC (unauthenticated) read
 *  path can render a MemberDecision row fetched by id — via the share token,
 *  never via getMemberDecision (which requires a subscriberId the visitor
 *  doesn't have) — without a second hand-copy of this row→view mapping. */
export function toView(row: {
  id: string;
  name: string;
  category: string;
  weights: unknown;
  shortlist: unknown;
  asOfDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}): MemberDecisionView {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    weights: row.weights as Record<DomainId, number>,
    shortlist: (row.shortlist as DecisionShortlistItem[] | null) ?? [],
    asOfDate: row.asOfDate,
    createdAt: row.createdAt.toISOString(),
    updatedAt: row.updatedAt.toISOString(),
  };
}

export async function listMemberDecisions(subscriberId: string): Promise<MemberDecisionView[]> {
  if (!hasDatabase()) return [];
  const rows = await getPrisma().memberDecision.findMany({
    where: { subscriberId },
    orderBy: { updatedAt: "desc" },
  });
  return rows.map(toView);
}

/** Fetch ONE decision, scoped to the caller. Returns null both when the id
 *  doesn't exist AND when it belongs to another member — indistinguishable on
 *  purpose, so a lookup never confirms another member's id is real. */
export async function getMemberDecision(subscriberId: string, id: string): Promise<MemberDecisionView | null> {
  if (!hasDatabase()) return null;
  const row = await getPrisma().memberDecision.findFirst({ where: { id, subscriberId } });
  return row ? toView(row) : null;
}

export type DecisionWriteResult = { ok: true; data: MemberDecisionView } | { ok: false; error: string };

export async function createMemberDecision(subscriberId: string, input: unknown): Promise<DecisionWriteResult> {
  const result = sanitizeDecision(input);
  if (!result.ok) return result;
  if (!hasDatabase()) return { ok: false, error: "no_database" };
  const row = await getPrisma().memberDecision.create({
    data: {
      subscriberId,
      name: result.data.name,
      category: result.data.category,
      weights: result.data.weights,
      shortlist: toInputJson(result.data.shortlist),
      asOfDate: result.data.asOfDate,
    },
  });
  return { ok: true, data: toView(row) };
}

/** Ownership enforced IN the mutation's WHERE clause, not by a separate
 *  fetch-then-check: updateMany({ where: { id, subscriberId } }) matches zero
 *  rows for an id that belongs to someone else, so a wrong-owner request can
 *  never partially apply and never learns whether that id exists at all. */
export async function updateMemberDecision(subscriberId: string, id: string, input: unknown): Promise<DecisionWriteResult> {
  const result = sanitizeDecision(input);
  if (!result.ok) return result;
  if (!hasDatabase()) return { ok: false, error: "no_database" };
  const res = await getPrisma().memberDecision.updateMany({
    where: { id, subscriberId },
    data: {
      name: result.data.name,
      category: result.data.category,
      weights: result.data.weights,
      shortlist: toInputJson(result.data.shortlist),
      asOfDate: result.data.asOfDate,
    },
  });
  if (res.count === 0) return { ok: false, error: "not_found" };
  const row = await getPrisma().memberDecision.findFirst({ where: { id, subscriberId } });
  return row ? { ok: true, data: toView(row) } : { ok: false, error: "not_found" };
}

/** Same WHERE-clause ownership enforcement as update — a non-owned id deletes
 *  zero rows. Returns whether a row was actually deleted. */
export async function deleteMemberDecision(subscriberId: string, id: string): Promise<boolean> {
  if (!hasDatabase()) return false;
  const res = await getPrisma().memberDecision.deleteMany({ where: { id, subscriberId } });
  return res.count > 0;
}
