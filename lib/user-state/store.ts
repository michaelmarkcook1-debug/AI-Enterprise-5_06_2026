// User state persistence — DB-backed replacement for sessionStorage.
// ────────────────────────────────────────────────────────────────────
// Stores three types of user state that previously lived only in the
// browser and were lost on tab close / device switch:
//
//   1. Assessment form drafts (in-progress form inputs)
//   2. Demonstrate shortlist (last assessment's top vendors + context)
//   3. Theme preference (light/dark)
//
// Uses a single `user_state` table with a (user_id, kind) composite
// key. Self-migrating via CREATE TABLE IF NOT EXISTS — no Prisma
// migration needed.
//
// User identity: until auth is wired, uses a stable browser
// fingerprint (passed as x-user-id header or cookie). The API routes
// handle this.

import { getPrisma, hasDatabase } from "../prisma";

const CREATE_SQL = `
CREATE TABLE IF NOT EXISTS "user_state" (
  "user_id" text NOT NULL,
  "kind" text NOT NULL,
  "payload" jsonb NOT NULL,
  "updated_at" timestamptz NOT NULL DEFAULT now(),
  PRIMARY KEY ("user_id", "kind")
);
`;

let tableReady = false;

async function ensureTable(): Promise<void> {
  if (tableReady || !hasDatabase()) return;
  try {
    await getPrisma().$executeRawUnsafe(CREATE_SQL);
    tableReady = true;
  } catch {
    // Table may already exist or DB unavailable
  }
}

export type StateKind = "assessment_draft" | "demonstrate_shortlist" | "theme";

/** Save user state to DB. Upserts by (userId, kind). */
export async function saveUserState(
  userId: string,
  kind: StateKind,
  payload: unknown,
): Promise<void> {
  if (!hasDatabase()) return;
  await ensureTable();
  try {
    await getPrisma().$executeRaw`
      INSERT INTO "user_state" ("user_id", "kind", "payload", "updated_at")
      VALUES (${userId}, ${kind}, ${JSON.stringify(payload)}::jsonb, now())
      ON CONFLICT ("user_id", "kind") DO UPDATE
        SET "payload" = EXCLUDED."payload", "updated_at" = now()
    `;
  } catch {
    // Swallow — sessionStorage fallback still works
  }
}

/** Load user state from DB. Returns null if not found. */
export async function loadUserState<T = unknown>(
  userId: string,
  kind: StateKind,
): Promise<T | null> {
  if (!hasDatabase()) return null;
  await ensureTable();
  try {
    const rows = await getPrisma().$queryRaw<Array<{ payload: unknown }>>`
      SELECT "payload" FROM "user_state"
      WHERE "user_id" = ${userId} AND "kind" = ${kind}
      LIMIT 1
    `;
    if (rows.length === 0) return null;
    return rows[0].payload as T;
  } catch {
    return null;
  }
}

/** Delete user state. */
export async function deleteUserState(
  userId: string,
  kind: StateKind,
): Promise<void> {
  if (!hasDatabase()) return;
  await ensureTable();
  try {
    await getPrisma().$executeRaw`
      DELETE FROM "user_state"
      WHERE "user_id" = ${userId} AND "kind" = ${kind}
    `;
  } catch {
    // Swallow
  }
}
