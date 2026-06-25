// Anonymous session hashing for buyer-intent instrumentation.
// ────────────────────────────────────────────────────────────
// IntentEvent must capture demand signal WITHOUT storing PII. This turns a
// request into an opaque, non-reversible `sessionHash` — a salted SHA-256 of
// coarse request signals plus a daily rotation bucket. It is NOT a user id:
// it can't be reversed to an IP, it rotates every UTC day, and the server salt
// never leaves the server. The brief's rule — "no PII beyond opt-in email" —
// is satisfied by construction, so Wave 4's logging has nothing to leak.
//
// The salt is read from INTENT_HASH_SALT (server-only). With no salt set we
// fall back to a fixed dev salt so local instrumentation still works; in
// production set INTENT_HASH_SALT so hashes can't be reconstructed off-box.

import { createHash } from "node:crypto";

const DEV_SALT = "ai-enterprise-dev-intent-salt";

function dayBucket(now: Date): string {
  return now.toISOString().slice(0, 10); // yyyy-mm-dd, UTC — rotates daily
}

/** Best-effort client IP from standard proxy headers (Vercel sets these). */
function clientIp(req: Request): string {
  const fwd = req.headers.get("x-forwarded-for");
  if (fwd) return fwd.split(",")[0].trim();
  return req.headers.get("x-real-ip") ?? "unknown";
}

/**
 * Opaque, daily-rotating, non-reversible session hash for a request.
 * Pure function of (salt, day, ip, user-agent, accept-language); no raw signal
 * is ever returned or stored.
 */
export function anonSessionHash(req: Request, now: Date = new Date()): string {
  const salt = process.env.INTENT_HASH_SALT || DEV_SALT;
  const parts = [
    salt,
    dayBucket(now),
    clientIp(req),
    req.headers.get("user-agent") ?? "",
    req.headers.get("accept-language") ?? "",
  ];
  return createHash("sha256").update(parts.join("|")).digest("hex").slice(0, 32);
}
