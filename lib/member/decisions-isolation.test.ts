// Mandatory cross-user isolation test: User A can never read, list, update, or
// delete User B's saved decision. Mocks the exact Prisma surface
// lib/member/decisions.ts touches on `memberDecision` (findMany/findFirst/
// create/updateMany/deleteMany) with a tiny in-memory fake, so this exercises
// the REAL ownership-scoping code in decisions.ts — not a reimplementation of
// it — without needing a live database.

import { describe, it, expect, vi, beforeEach } from "vitest";
import { ASSESSMENT_DOMAINS } from "../assessment/domain-rubric";
import { MARKET_CATEGORIES } from "../intelligence/seed";

interface Row {
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

let rows: Row[] = [];
let nextId = 1;

vi.mock("../prisma", () => ({
  hasDatabase: () => true,
  getPrisma: () => ({
    memberDecision: {
      findMany: async ({ where }: { where: { subscriberId: string } }) =>
        rows.filter((r) => r.subscriberId === where.subscriberId).sort((a, b) => +b.updatedAt - +a.updatedAt),
      findFirst: async ({ where }: { where: { id: string; subscriberId: string } }) =>
        rows.find((r) => r.id === where.id && r.subscriberId === where.subscriberId) ?? null,
      create: async ({ data }: { data: Omit<Row, "id" | "createdAt" | "updatedAt"> }) => {
        const row: Row = { id: `dec_${nextId++}`, createdAt: new Date(), updatedAt: new Date(), ...data };
        rows.push(row);
        return row;
      },
      updateMany: async ({
        where,
        data,
      }: {
        where: { id: string; subscriberId: string };
        data: Partial<Row>;
      }) => {
        let count = 0;
        rows = rows.map((r) => {
          if (r.id === where.id && r.subscriberId === where.subscriberId) {
            count++;
            return { ...r, ...data, updatedAt: new Date() };
          }
          return r;
        });
        return { count };
      },
      deleteMany: async ({ where }: { where: { id: string; subscriberId: string } }) => {
        const before = rows.length;
        rows = rows.filter((r) => !(r.id === where.id && r.subscriberId === where.subscriberId));
        return { count: before - rows.length };
      },
    },
  }),
}));

const { createMemberDecision, getMemberDecision, listMemberDecisions, updateMemberDecision, deleteMemberDecision } =
  await import("./decisions");

const ALICE = "sub_alice";
const BOB = "sub_bob";

const WEIGHTS = Object.fromEntries(ASSESSMENT_DOMAINS.map((d) => [d, 10]));
const CATEGORY = MARKET_CATEGORIES[0]!.id as string;

async function seedAliceDecision() {
  const result = await createMemberDecision(ALICE, { name: "Alice's shortlist", category: CATEGORY, weights: WEIGHTS });
  if (!result.ok) throw new Error(`seed failed: ${result.error}`);
  return result.data;
}

describe("cross-user decision isolation", () => {
  beforeEach(() => {
    rows = [];
    nextId = 1;
  });

  it("Bob cannot read Alice's decision by id — returns null, indistinguishable from not existing", async () => {
    const alice = await seedAliceDecision();
    expect(await getMemberDecision(BOB, alice.id)).toBeNull();
    expect((await getMemberDecision(ALICE, alice.id))?.id).toBe(alice.id);
  });

  it("Bob's list never includes Alice's decisions", async () => {
    await seedAliceDecision();
    expect(await listMemberDecisions(BOB)).toEqual([]);
    expect(await listMemberDecisions(ALICE)).toHaveLength(1);
  });

  it("Bob cannot update Alice's decision — zero rows affected, Alice's data unchanged", async () => {
    const alice = await seedAliceDecision();
    const asBob = await updateMemberDecision(BOB, alice.id, { name: "Hijacked", category: alice.category, weights: alice.weights });
    expect(asBob.ok).toBe(false);
    if (!asBob.ok) expect(asBob.error).toBe("not_found");
    expect((await getMemberDecision(ALICE, alice.id))?.name).toBe("Alice's shortlist");
  });

  it("Bob cannot delete Alice's decision", async () => {
    const alice = await seedAliceDecision();
    expect(await deleteMemberDecision(BOB, alice.id)).toBe(false);
    expect(await getMemberDecision(ALICE, alice.id)).not.toBeNull();
  });

  it("Alice can read, update, and delete her own decision", async () => {
    const alice = await seedAliceDecision();
    expect((await getMemberDecision(ALICE, alice.id))?.id).toBe(alice.id);
    const updated = await updateMemberDecision(ALICE, alice.id, { name: "Renamed", category: alice.category, weights: alice.weights });
    expect(updated.ok).toBe(true);
    expect(await deleteMemberDecision(ALICE, alice.id)).toBe(true);
    expect(await getMemberDecision(ALICE, alice.id)).toBeNull();
  });
});
