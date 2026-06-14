// Client-side user-state helpers.
// ────────────────────────────────
// Wraps the /api/user-state API with sessionStorage as a fast local
// cache. Write-through: saves to both sessionStorage AND DB. Read:
// sessionStorage first, then DB fallback.

import type { StateKind } from "./store";

const API = "/api/user-state";

/** Save state to both sessionStorage (fast) and DB (durable). */
export async function saveState(kind: StateKind, payload: unknown): Promise<void> {
  // Local cache first (instant)
  try {
    window.sessionStorage.setItem(`ai-e:${kind}`, JSON.stringify(payload));
  } catch {}

  // DB write (durable, fire-and-forget)
  try {
    await fetch(API, {
      method: "PUT",
      headers: { "content-type": "application/json" },
      body: JSON.stringify({ kind, payload }),
    });
  } catch {}
}

/** Load state: sessionStorage first, DB fallback. */
export async function loadState<T = unknown>(kind: StateKind): Promise<T | null> {
  // Try local cache first (instant, no round-trip)
  try {
    const local = window.sessionStorage.getItem(`ai-e:${kind}`);
    if (local) return JSON.parse(local) as T;
  } catch {}

  // Fall back to DB
  try {
    const res = await fetch(`${API}?kind=${kind}`);
    if (!res.ok) return null;
    const data = await res.json() as { found: boolean; payload: T | null };
    if (data.found && data.payload !== null) {
      // Backfill local cache so next read is instant
      try {
        window.sessionStorage.setItem(`ai-e:${kind}`, JSON.stringify(data.payload));
      } catch {}
      return data.payload;
    }
  } catch {}

  return null;
}
