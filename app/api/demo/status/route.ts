// Public-safe demo-status JSON. No admin-token required because:
//   - The payload is structural status only (module counts, connector
//     status booleans, last-fetch timestamps).
//   - URLs / keys are NEVER included.
//   - The DEMO_SOURCE_FIRST env var doesn't gate this — the endpoint
//     simply reports whether the mode is on.
// If you want to gate this behind admin auth in production, add
// isAdminRequest() at the top; the current version is "internal demo
// status, safe to read".

import { buildDemoSummary } from "@/lib/demo/runner";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET() {
  try {
    const summary = await buildDemoSummary();
    return Response.json(summary);
  } catch (err) {
    console.error("[api/demo/status] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
