// User state API — GET + PUT for persistent browser state.
// ─────────────────────────────────────────────────────────
// Replaces sessionStorage for assessment drafts, shortlists, and
// theme preference. Until auth is wired, uses a stable user ID
// from the x-user-id header or a cookie.
//
// GET /api/user-state?kind=assessment_draft
// PUT /api/user-state  { kind: "assessment_draft", payload: {...} }

import {
  loadUserState,
  saveUserState,
  type StateKind,
} from "@/lib/user-state/store";
import { cookies } from "next/headers";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

const VALID_KINDS: StateKind[] = ["assessment_draft", "demonstrate_shortlist", "theme"];
const COOKIE_NAME = "ai-enterprise-uid";

/** Get or create a stable anonymous user ID. */
async function getUserId(request: Request): Promise<string> {
  // Prefer explicit header (for programmatic clients)
  const header = request.headers.get("x-user-id");
  if (header) return header;

  // Fall back to cookie
  const cookieStore = await cookies();
  const existing = cookieStore.get(COOKIE_NAME)?.value;
  if (existing) return existing;

  // Generate a new stable ID
  const newId = `anon_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
  cookieStore.set(COOKIE_NAME, newId, {
    httpOnly: true,
    sameSite: "lax",
    maxAge: 365 * 24 * 60 * 60, // 1 year
    path: "/",
  });
  return newId;
}

export async function GET(request: Request): Promise<Response> {
  const url = new URL(request.url);
  const kind = url.searchParams.get("kind") as StateKind | null;

  if (!kind || !VALID_KINDS.includes(kind)) {
    return Response.json({ error: "kind required: assessment_draft | demonstrate_shortlist | theme" }, { status: 400 });
  }

  const userId = await getUserId(request);
  const payload = await loadUserState(userId, kind);

  if (payload === null) {
    return Response.json({ found: false, payload: null });
  }

  return Response.json({ found: true, payload });
}

export async function PUT(request: Request): Promise<Response> {
  try {
    const body = await request.json() as { kind?: string; payload?: unknown };
    const kind = body.kind as StateKind;

    if (!kind || !VALID_KINDS.includes(kind)) {
      return Response.json({ error: "kind required: assessment_draft | demonstrate_shortlist | theme" }, { status: 400 });
    }

    if (body.payload === undefined) {
      return Response.json({ error: "payload required" }, { status: 400 });
    }

    const userId = await getUserId(request);
    await saveUserState(userId, kind, body.payload);

    return Response.json({ ok: true });
  } catch {
    return Response.json({ error: "invalid request" }, { status: 400 });
  }
}
