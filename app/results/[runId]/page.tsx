// Results page — server component that pre-fetches from DB.
// ──────────────────────────────────────────────────────────
// When a user shares a results URL or returns after closing the browser,
// the server pre-fetches the assessment result from PostgreSQL so the
// page renders immediately without a client-side fetch waterfall.
// The client ResultsView accepts `serverData` and skips sessionStorage
// + API fetch when it's provided.

import { getPersistedAssessmentResult } from "@/lib/services/assessment-service";
import type { AssessmentResult } from "@/lib/types";
import ResultsView from "./ResultsView";

export const dynamic = "force-dynamic";

export default async function ResultsPage({ params }: { params: Promise<{ runId: string }> }) {
  const { runId } = await params;
  const decoded = decodeURIComponent(runId);

  // Pre-fetch from DB — returns null if not found or no DB configured.
  let serverData: AssessmentResult | null = null;
  try {
    const raw = await getPersistedAssessmentResult(decoded);
    if (raw && typeof raw === "object") {
      serverData = raw as unknown as AssessmentResult;
    }
  } catch {
    // DB unavailable — ResultsView will fall back to sessionStorage → API fetch
  }

  return <ResultsView runId={decoded} serverData={serverData} />;
}
