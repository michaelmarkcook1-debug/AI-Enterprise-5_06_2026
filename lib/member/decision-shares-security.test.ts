// Mandatory security tests for read-only decision sharing — this is the
// acceptance criteria for a PUBLIC surface, not a nice-to-have. Mocks the
// exact Prisma surface both decisions.ts and decision-shares.ts touch (on
// `memberDecision` and `memberDecisionShare`) with a tiny in-memory fake, so
// this exercises the REAL ownership/token-verification code, not a
// reimplementation of it, without a live database.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { createHash } from "node:crypto";
import { ASSESSMENT_DOMAINS } from "../assessment/domain-rubric";
import { MARKET_CATEGORIES } from "../intelligence/seed";

interface DecisionRow {
  id: string;
  subscriberId: string;
  name: string;
  category: string;
  weights: unknown;
  shortlist: unknown;
  asOfDate: string | null;
  createdAt: Date;
  updatedAt: Date;
}
interface ShareRow {
  id: string;
  decisionId: string;
  subscriberId: string;
  tokenHash: string;
  displayName: string | null;
  expiresAt: Date;
  revokedAt: Date | null;
  viewCount: number;
  lastAccessedAt: Date | null;
  createdAt: Date;
}

let decisions: DecisionRow[] = [];
let shares: ShareRow[] = [];
let nextDecisionId = 1;
let nextShareId = 1;

vi.mock("../prisma", () => ({
  hasDatabase: () => true,
  getPrisma: () => ({
    memberDecision: {
      // Ownership-scoped read (used by getMemberDecision, and by createShare's
      // ownership check before minting a share).
      findFirst: async ({ where }: { where: { id: string; subscriberId: string } }) =>
        decisions.find((d) => d.id === where.id && d.subscriberId === where.subscriberId) ?? null,
      // UN-scoped read by id only — used ONLY by getSharedDecisionView, after
      // the token has already been verified. Never called with a caller-
      // supplied decisionId anywhere in decision-shares.ts.
      findUnique: async ({ where }: { where: { id: string } }) => decisions.find((d) => d.id === where.id) ?? null,
      create: async ({ data }: { data: Omit<DecisionRow, "id" | "createdAt" | "updatedAt"> }) => {
        const row: DecisionRow = { id: `dec_${nextDecisionId++}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        decisions.push(row);
        return row;
      },
    },
    memberDecisionShare: {
      findMany: async ({ where }: { where: { subscriberId: string; decisionId: string } }) =>
        shares
          .filter((s) => s.subscriberId === where.subscriberId && s.decisionId === where.decisionId)
          .sort((a, b) => +b.createdAt - +a.createdAt),
      findUnique: async ({ where }: { where: { tokenHash: string } }) =>
        shares.find((s) => s.tokenHash === where.tokenHash) ?? null,
      create: async ({ data }: { data: Omit<ShareRow, "id" | "createdAt" | "viewCount" | "lastAccessedAt" | "revokedAt"> }) => {
        const row: ShareRow = {
          id: `shr_${nextShareId++}`,
          createdAt: new Date(),
          viewCount: 0,
          lastAccessedAt: null,
          revokedAt: null,
          ...data,
        };
        shares.push(row);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; decisionId: string; subscriberId: string; revokedAt: null };
        data: { revokedAt: Date };
      }) => {
        let count = 0;
        shares = shares.map((s) => {
          if (s.id === where.id && s.decisionId === where.decisionId && s.subscriberId === where.subscriberId && s.revokedAt === null) {
            count++;
            return { ...s, ...data };
          }
          return s;
        });
        return { count };
      },
      update: async ({ where, data }: { where: { id: string }; data: { viewCount: { increment: number }; lastAccessedAt: Date } }) => {
        const idx = shares.findIndex((s) => s.id === where.id);
        if (idx === -1) throw new Error("not found");
        shares[idx] = { ...shares[idx]!, viewCount: shares[idx]!.viewCount + data.viewCount.increment, lastAccessedAt: data.lastAccessedAt };
        return shares[idx];
      },
    },
  }),
}));

const { createMemberDecision } = await import("./decisions");
const { createShare, listShares, revokeShare, getSharedDecisionView } = await import("./decision-shares");

const ALICE = "sub_alice";
const BOB = "sub_bob";
const WEIGHTS = Object.fromEntries(ASSESSMENT_DOMAINS.map((d) => [d, 10]));
const CATEGORY = MARKET_CATEGORIES[0]!.id as string;

function sha256(s: string): string {
  return createHash("sha256").update(s).digest("hex");
}

async function seedAliceDecision() {
  const result = await createMemberDecision(ALICE, { name: "Alice's shortlist", category: CATEGORY, weights: WEIGHTS });
  if (!result.ok) throw new Error(`seed failed: ${result.error}`);
  return result.data;
}

describe("decision sharing — owner-side authorization", () => {
  beforeEach(() => {
    decisions = [];
    shares = [];
    nextDecisionId = 1;
    nextShareId = 1;
  });

  it("Bob cannot create a share for Alice's decision", async () => {
    const alice = await seedAliceDecision();
    const result = await createShare(BOB, alice.id, {});
    expect(result.ok).toBe(false);
    if (!result.ok) expect(result.error).toBe("not_found");
    expect(shares).toHaveLength(0);
  });

  it("Bob cannot list Alice's shares for her decision", async () => {
    const alice = await seedAliceDecision();
    await createShare(ALICE, alice.id, {});
    expect(await listShares(BOB, alice.id)).toEqual([]);
    expect(await listShares(ALICE, alice.id)).toHaveLength(1);
  });

  it("Bob cannot revoke Alice's share", async () => {
    const alice = await seedAliceDecision();
    const created = await createShare(ALICE, alice.id, {});
    if (!created.ok) throw new Error("setup failed");
    expect(await revokeShare(BOB, alice.id, created.data.id)).toBe(false);
    const stillListed = await listShares(ALICE, alice.id);
    expect(stillListed[0]!.status).toBe("active");
  });

  it("Alice can create, list, and revoke her own share", async () => {
    const alice = await seedAliceDecision();
    const created = await createShare(ALICE, alice.id, { displayName: "team", expiresInDays: 7 });
    expect(created.ok).toBe(true);
    if (!created.ok) return;
    expect(created.data.rawToken).toMatch(/^[0-9a-f]{64}$/); // 256-bit CSPRNG, hex
    expect(created.data.url).toContain(created.data.rawToken);

    const list = await listShares(ALICE, alice.id);
    expect(list).toHaveLength(1);
    expect(list[0]!.status).toBe("active");

    expect(await revokeShare(ALICE, alice.id, created.data.id)).toBe(true);
    const afterRevoke = await listShares(ALICE, alice.id);
    expect(afterRevoke[0]!.status).toBe("revoked");
  });
});

describe("decision sharing — public token verification (fail-closed)", () => {
  beforeEach(() => {
    decisions = [];
    shares = [];
    nextDecisionId = 1;
    nextShareId = 1;
  });

  it("a valid, active token resolves to the right decision", async () => {
    const alice = await seedAliceDecision();
    const created = await createShare(ALICE, alice.id, { displayName: "procurement" });
    if (!created.ok) throw new Error("setup failed");

    const view = await getSharedDecisionView(created.data.rawToken);
    expect(view).not.toBeNull();
    expect(view!.decision.id).toBe(alice.id);
    expect(view!.displayName).toBe("procurement");
  });

  it("a forged/garbage token is denied", async () => {
    const alice = await seedAliceDecision();
    await createShare(ALICE, alice.id, {});
    expect(await getSharedDecisionView("not-a-real-token")).toBeNull();
    expect(await getSharedDecisionView("")).toBeNull();
    expect(await getSharedDecisionView("0".repeat(64))).toBeNull(); // well-formed shape, wrong value
  });

  it("a revoked token is denied — 404-shaped null, same as a token that never existed", async () => {
    const alice = await seedAliceDecision();
    const created = await createShare(ALICE, alice.id, {});
    if (!created.ok) throw new Error("setup failed");
    await revokeShare(ALICE, alice.id, created.data.id);
    expect(await getSharedDecisionView(created.data.rawToken)).toBeNull();
  });

  it("an expired token is denied", async () => {
    const alice = await seedAliceDecision();
    const created = await createShare(ALICE, alice.id, {});
    if (!created.ok) throw new Error("setup failed");
    // Force expiry directly on the fake store (simulates time passing).
    const row = shares.find((s) => s.id === created.data.id)!;
    row.expiresAt = new Date(Date.now() - 1000);
    expect(await getSharedDecisionView(created.data.rawToken)).toBeNull();
  });

  it("revoked and expired and forged are INDISTINGUISHABLE to the caller — always exactly `null`, never a different shape", async () => {
    const alice = await seedAliceDecision();
    const revoked = await createShare(ALICE, alice.id, {});
    const expired = await createShare(ALICE, alice.id, {});
    if (!revoked.ok || !expired.ok) throw new Error("setup failed");
    await revokeShare(ALICE, alice.id, revoked.data.id);
    shares.find((s) => s.id === expired.data.id)!.expiresAt = new Date(Date.now() - 1000);

    const results = await Promise.all([
      getSharedDecisionView(revoked.data.rawToken),
      getSharedDecisionView(expired.data.rawToken),
      getSharedDecisionView("totally-forged-garbage"),
    ]);
    for (const r of results) expect(r).toBeNull();
  });

  it("token A can never resolve to decision B — a share is scoped to exactly the one decision it was created for", async () => {
    const aliceResult = await createMemberDecision(ALICE, { name: "A", category: CATEGORY, weights: WEIGHTS });
    const bobResult = await createMemberDecision(BOB, { name: "B", category: CATEGORY, weights: WEIGHTS });
    if (!aliceResult.ok || !bobResult.ok) throw new Error("setup failed");

    const aliceShare = await createShare(ALICE, aliceResult.data.id, {});
    if (!aliceShare.ok) throw new Error("setup failed");

    const view = await getSharedDecisionView(aliceShare.data.rawToken);
    expect(view!.decision.id).toBe(aliceResult.data.id);
    expect(view!.decision.id).not.toBe(bobResult.data.id);
  });

  it("getSharedDecisionView's only input is the raw token — there is no decisionId parameter for a caller to smuggle a different id through", () => {
    expect(getSharedDecisionView.length).toBeLessThanOrEqual(2); // (rawToken, db?) — no decisionId slot exists
  });

  it("a successful view bumps viewCount and lastAccessedAt without ever touching the decision or storing PII", async () => {
    const alice = await seedAliceDecision();
    const created = await createShare(ALICE, alice.id, {});
    if (!created.ok) throw new Error("setup failed");

    await getSharedDecisionView(created.data.rawToken);
    await getSharedDecisionView(created.data.rawToken);

    const row = shares.find((s) => s.id === created.data.id)!;
    expect(row.viewCount).toBe(2);
    expect(row.lastAccessedAt).not.toBeNull();
    // The row's own fields are the only thing tracked — assert no extra
    // PII-shaped keys (ip/userAgent/referrer) were ever introduced.
    expect(Object.keys(row).sort()).toEqual(
      ["createdAt", "decisionId", "displayName", "expiresAt", "id", "lastAccessedAt", "revokedAt", "subscriberId", "tokenHash", "viewCount"].sort(),
    );
  });

  it("the raw token is a 256-bit CSPRNG value, and only its sha256 hash is ever persisted", async () => {
    const alice = await seedAliceDecision();
    const created = await createShare(ALICE, alice.id, {});
    if (!created.ok) throw new Error("setup failed");
    const row = shares.find((s) => s.id === created.data.id)!;
    expect(row.tokenHash).toBe(sha256(created.data.rawToken));
    expect(row.tokenHash).not.toBe(created.data.rawToken);
    // The stored row is exactly what a DB compromise would expose — confirm
    // the raw token cannot be trivially found inside it.
    expect(JSON.stringify(row)).not.toContain(created.data.rawToken);
  });
});
