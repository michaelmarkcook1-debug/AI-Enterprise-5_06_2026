// Product Linkage Assist — pure suggester.
// ─────────────────────────────────────────
// For each pending EvidenceProposal whose triage lane is recommend_approve
// solely because product linkage is missing, find the most likely
// `ProductScope` matches inside that vendor's catalogue.
//
// Suggester strategies, ordered by confidence:
//   1. EXACT name match in excerpt          → 0.95   "exact name match"
//   2. NORMALISED name match                → 0.90   "normalised name match"
//   3. STRONG token overlap (≥ 70%)         → 0.75   "token overlap N%"
//   4. SUBFACTOR / category alignment       → 0.55   "subfactor/category aligned"
//   5. SINGLE-PRODUCT vendor fallback       → 0.40   "vendor has only one product"
//
// Anything below 0.55 is reported but flagged "uncertain" — the runner
// must NOT auto-apply uncertain suggestions. The default API/CLI never
// auto-applies; auto-apply is gated on confidence ≥ 0.95 AND a single
// suggestion AND an explicit --live flag (handled in the runner layer).
//
// Pure module: no I/O, no Prisma. Used by the CLI and tests.

export interface LinkageProposalInput {
  id: string;
  vendorId: string;
  domain: string;
  subfactor: string;
  excerpt: string;
  /** Optional source URL of the proposal. When the URL contains a
   * product-page path (e.g. `/security`, `/agents`), the suggester uses
   * it as a category hint — see strategy 4b. */
  sourceUrl?: string | null;
}

export interface LinkageProductScope {
  id: string;
  vendorId: string;
  productName: string;
  productCategory: string;
}

export interface LinkageSuggestion {
  productScopeId: string;
  productName: string;
  confidence: number;
  reason: string;
  /** True iff this suggestion may be auto-applied per the linkage policy.
   * False otherwise (low confidence / multiple competing matches). */
  safeToApply: boolean;
}

export interface ProposalLinkageResult {
  proposalId: string;
  vendorId: string;
  suggestions: LinkageSuggestion[];
  /** "no_vendor_products"       — vendor has no product scope entries
   *  "no_match"                  — products exist, none matched the excerpt
   *  "multiple_competing"        — top-2 suggestions within 0.10 of each other
   *  "uncertain_top_match"       — best match scored < 0.55
   *  "ok"                        — single high-confidence suggestion
   *  "ok_uncertain"              — single suggestion but below auto-apply threshold
   */
  status:
    | "no_vendor_products"
    | "no_match"
    | "multiple_competing"
    | "uncertain_top_match"
    | "ok"
    | "ok_uncertain";
}

const AUTO_APPLY_MIN_CONFIDENCE = 0.95;
const COMPETING_MARGIN = 0.10;

// ─── Helpers ─────────────────────────────────────────────────────────────

function normalise(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

function tokens(text: string): Set<string> {
  return new Set(normalise(text).split(" ").filter(Boolean));
}

function tokenOverlap(a: string, b: string): number {
  const ta = tokens(a);
  const tb = tokens(b);
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  return inter / ta.size; // recall over the product-name tokens
}

/** Map a URL path segment to a product category. Conservative: only
 * fires when a known product-page path (e.g. `/security`, `/agents`,
 * `/search`) appears in the URL AND aligns with the product's
 * category. Returns the matched path segment or null. */
function matchUrlPathToCategory(url: string, category: string): string | null {
  let pathname: string;
  try {
    pathname = new URL(url).pathname.toLowerCase();
  } catch {
    return null;
  }
  const PATH_TO_CATEGORIES: Record<string, string[]> = {
    security: ["security_ai", "governance_control", "agent_governance"],
    permissions: ["governance_control", "agent_governance"],
    agents: ["agent_platform", "agent_runtime"],
    search: ["enterprise_search"],
    assistant: ["enterprise_assistant"],
    "work-ai": ["enterprise_assistant"],
    governance: ["agent_governance", "governance_control"],
    pricing: [], // pricing pages don't bind to a single category
    api: ["model_api"],
    bedrock: ["cloud_ai_platform"],
    copilot: ["enterprise_assistant", "coding_agent"],
  };
  for (const [segment, allowedCategories] of Object.entries(PATH_TO_CATEGORIES)) {
    if (allowedCategories.length === 0) continue;
    if (pathname.includes(`/${segment}`) && allowedCategories.includes(category)) {
      return segment;
    }
  }
  return null;
}

/** Subfactor / category alignment. Both are loose strings; we look for
 * a shared content stem (e.g. subfactor "coding_agent_evals" + category
 * "coding_agent" → match). */
function subfactorAlignsCategory(subfactor: string, category: string): boolean {
  const s = subfactor.toLowerCase();
  const c = category.toLowerCase();
  if (!s || !c) return false;
  // Direct token overlap
  const sTok = new Set(s.split(/[^a-z0-9]+/));
  const cTok = c.split(/[^a-z0-9]+/);
  return cTok.some((t) => t.length >= 4 && sTok.has(t));
}

// ─── Suggester ───────────────────────────────────────────────────────────

export function suggestLinkage(
  proposal: LinkageProposalInput,
  scopesForVendor: LinkageProductScope[],
): ProposalLinkageResult {
  if (scopesForVendor.length === 0) {
    return {
      proposalId: proposal.id,
      vendorId: proposal.vendorId,
      suggestions: [],
      status: "no_vendor_products",
    };
  }

  const excerpt = proposal.excerpt;
  const excerptLower = excerpt.toLowerCase();
  const excerptNormalised = normalise(excerpt);

  const raw: LinkageSuggestion[] = [];
  for (const scope of scopesForVendor) {
    const productName = scope.productName;
    const productNameLower = productName.toLowerCase();
    const productNameNormalised = normalise(productName);

    // 1. Exact name match (case-insensitive substring).
    if (excerptLower.includes(productNameLower)) {
      raw.push({
        productScopeId: scope.id,
        productName,
        confidence: 0.95,
        reason: `exact name match: "${productName}"`,
        safeToApply: false, // resolved at the end
      });
      continue;
    }

    // 2. Normalised name match (handles punctuation/whitespace differences).
    if (productNameNormalised.length > 0 && excerptNormalised.includes(productNameNormalised)) {
      raw.push({
        productScopeId: scope.id,
        productName,
        confidence: 0.90,
        reason: `normalised name match: "${productName}"`,
        safeToApply: false,
      });
      continue;
    }

    // 3. Strong token overlap.
    const overlap = tokenOverlap(productName, excerpt);
    if (overlap >= 0.7) {
      raw.push({
        productScopeId: scope.id,
        productName,
        confidence: 0.55 + 0.30 * overlap, // 0.76–0.85 band
        reason: `token overlap ${(overlap * 100).toFixed(0)}% on "${productName}"`,
        safeToApply: false,
      });
      continue;
    }

    // 4. Subfactor/category alignment (weakest by-itself signal).
    if (subfactorAlignsCategory(proposal.subfactor, scope.productCategory)) {
      raw.push({
        productScopeId: scope.id,
        productName,
        confidence: 0.55,
        reason: `subfactor "${proposal.subfactor}" aligns with category "${scope.productCategory}"`,
        safeToApply: false,
      });
      continue;
    }

    // 4b. Source-URL path hint. When the proposal's source URL contains
    // a product-page path that maps to this product's category, surface
    // the product as a category-aligned suggestion. Helps with vendor
    // pages whose excerpts describe the *function* without naming the
    // product (e.g. glean.com/security mentions sensitive-content
    // protection without saying "Glean Protect").
    if (proposal.sourceUrl) {
      const urlMatch = matchUrlPathToCategory(proposal.sourceUrl, scope.productCategory);
      if (urlMatch) {
        raw.push({
          productScopeId: scope.id,
          productName,
          confidence: 0.65,
          reason: `source URL path "/${urlMatch}" aligns with category "${scope.productCategory}"`,
          safeToApply: false,
        });
        continue;
      }
    }
  }

  // 5. Single-product fallback — only if NO other suggestion fired.
  if (raw.length === 0 && scopesForVendor.length === 1) {
    const only = scopesForVendor[0];
    raw.push({
      productScopeId: only.id,
      productName: only.productName,
      confidence: 0.40,
      reason: `vendor has only one product scope (${only.productName})`,
      safeToApply: false,
    });
  }

  // Sort by confidence desc, drop dups by id (keep highest-confidence).
  const byId = new Map<string, LinkageSuggestion>();
  for (const s of raw.sort((a, b) => b.confidence - a.confidence)) {
    if (!byId.has(s.productScopeId)) byId.set(s.productScopeId, s);
  }
  const suggestions = [...byId.values()];

  // Resolve status + safeToApply flags.
  if (suggestions.length === 0) {
    return {
      proposalId: proposal.id,
      vendorId: proposal.vendorId,
      suggestions: [],
      status: "no_match",
    };
  }
  const top = suggestions[0];
  const second = suggestions[1];
  let status: ProposalLinkageResult["status"];
  if (second && top.confidence - second.confidence < COMPETING_MARGIN && top.confidence < 1) {
    status = "multiple_competing";
  } else if (top.confidence < 0.55) {
    status = "uncertain_top_match";
  } else if (top.confidence >= AUTO_APPLY_MIN_CONFIDENCE && (!second || second.confidence < AUTO_APPLY_MIN_CONFIDENCE)) {
    status = "ok";
    top.safeToApply = true;
  } else {
    status = "ok_uncertain";
  }

  return {
    proposalId: proposal.id,
    vendorId: proposal.vendorId,
    suggestions,
    status,
  };
}

export const LINKAGE_AUTO_APPLY_MIN_CONFIDENCE = AUTO_APPLY_MIN_CONFIDENCE;
