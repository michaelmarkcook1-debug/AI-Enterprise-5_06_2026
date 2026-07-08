// Seeds the shared test-buyer account with a small sample shortlist + one
// saved decision, so the buyer-home dashboard is demo-able immediately rather
// than opening empty for every fresh tester. Idempotent — only writes when
// the account has nothing yet, so a real tester's own changes are never
// overwritten on a later visit. Real vendor ids/category, real domain
// weights (resolveDomainWeights) — a plausible starting point, not fabricated
// scores (a saved decision only stores weights + a shortlist; it never writes
// a score itself, see lib/member/decisions.ts's own firewall note).

import { getMemberWatchlist, saveMemberWatchlist } from "./watchlist";
import { listMemberDecisions, createMemberDecision } from "./decisions";
import { resolveDomainWeights } from "../assessment/category-weights";

const SAMPLE_VENDOR_SLUGS = ["anthropic", "openai", "google", "microsoft"];
const SAMPLE_CATEGORY = "frontier_model_api";
const SAMPLE_DECISION_NAME = "Frontier model shortlist (sample)";

export async function ensureTestBuyerSeeded(subscriberId: string): Promise<void> {
  const [watchlist, decisions] = await Promise.all([
    getMemberWatchlist(subscriberId),
    listMemberDecisions(subscriberId),
  ]);

  if (watchlist.vendors.length === 0 && watchlist.categories.length === 0) {
    await saveMemberWatchlist(subscriberId, {
      vendors: SAMPLE_VENDOR_SLUGS,
      categories: [SAMPLE_CATEGORY],
      useCases: [],
      currentStack: [],
    });
  }

  if (decisions.length === 0) {
    await createMemberDecision(subscriberId, {
      name: SAMPLE_DECISION_NAME,
      category: SAMPLE_CATEGORY,
      weights: resolveDomainWeights(SAMPLE_CATEGORY),
      shortlist: [{ vendorId: "anthropic" }, { vendorId: "openai" }],
      asOfDate: null,
    });
  }
}
