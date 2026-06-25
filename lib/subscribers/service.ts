// Subscriber service — double opt-in lifecycle.
// ─────────────────────────────────────────────
// The only PII the product holds is an opt-in email. Flow:
//   1. capture  → row created status="pending" + a one-time confirmToken
//   2. confirm  → token validated → status="confirmed"
//   3. unsubscribe → status="unsubscribed"
// Re-subscribing a pending/unsubscribed email reissues a fresh token. An
// already-confirmed email is a no-op (we don't leak its status to the caller).

import { randomBytes } from "node:crypto";
import { getPrisma, hasDatabase } from "../prisma";

export type SubscribeOutcome = "pending" | "already_confirmed" | "no_database";

export interface SubscribeResult {
  outcome: SubscribeOutcome;
  /** Present only when a confirmation is required (outcome="pending"). */
  confirmToken?: string;
  email: string;
}

function normalizeEmail(raw: string): string {
  return raw.trim().toLowerCase();
}

function newToken(): string {
  return randomBytes(24).toString("hex");
}

/** Create or refresh a pending subscriber and return its confirm token. */
export async function captureSubscriber(input: {
  email: string;
  source?: string;
  industry?: string;
}): Promise<SubscribeResult> {
  const email = normalizeEmail(input.email);
  if (!hasDatabase()) return { outcome: "no_database", email };

  const prisma = getPrisma();
  const existing = await prisma.subscriber.findUnique({ where: { email } });
  if (existing?.status === "confirmed") {
    return { outcome: "already_confirmed", email };
  }

  const confirmToken = newToken();
  await prisma.subscriber.upsert({
    where: { email },
    create: {
      email,
      status: "pending",
      source: input.source ?? null,
      industry: input.industry ?? null,
      confirmToken,
    },
    update: {
      status: "pending",
      confirmToken,
      source: input.source ?? existing?.source ?? null,
      industry: input.industry ?? existing?.industry ?? null,
      unsubscribedAt: null,
    },
  });
  return { outcome: "pending", confirmToken, email };
}

/** Confirm a subscriber by token. Returns true if a pending row was confirmed. */
export async function confirmSubscriber(token: string): Promise<boolean> {
  if (!hasDatabase() || !token) return false;
  const prisma = getPrisma();
  const row = await prisma.subscriber.findUnique({ where: { confirmToken: token } });
  if (!row) return false;
  // Keep confirmToken as the stable handle for the unsubscribe link in future
  // emails (it's a random per-subscriber secret). Re-confirming is idempotent.
  await prisma.subscriber.update({
    where: { id: row.id },
    data: { status: "confirmed", confirmedAt: new Date() },
  });
  return true;
}

/** Unsubscribe by token (the same handle emailed to the subscriber). */
export async function unsubscribeByToken(token: string): Promise<boolean> {
  if (!hasDatabase() || !token) return false;
  const prisma = getPrisma();
  const row = await prisma.subscriber.findUnique({ where: { confirmToken: token } });
  if (!row) return false;
  await prisma.subscriber.update({
    where: { id: row.id },
    data: { status: "unsubscribed", unsubscribedAt: new Date() },
  });
  return true;
}
