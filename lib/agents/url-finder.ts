/**
 * URL-finder agent — repairs stale source URLs in the manifest.
 *
 * When the sourcing runner hits a 4xx (typically 404) on a manifest URL,
 * this agent uses Claude with the web-search server tool to locate the
 * vendor's *current* canonical page for the same category (trust center,
 * pricing page, status page, model docs, security page, etc.) and returns
 * a structured replacement candidate.
 *
 * Truthfulness gates:
 *   - The candidate URL must be on the vendor's own apex domain
 *     (e.g. mistral.ai, glean.com, oracle.com) — never a third-party blog
 *     or social post. Off-domain candidates are rejected.
 *   - Confidence must be ≥ 60 to be considered for auto-retry.
 *   - Candidates are persisted as proposals; they NEVER auto-rewrite the
 *     manifest file. An operator approves at /admin/ingestion.
 *
 * Cost: one Claude call per dead URL with web_search budget capped at 4
 * searches. Typical cost ~$0.01-0.03 per repair attempt.
 */

import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";
const WEB_SEARCH_TOOL_TYPE = "web_search_20260209" as const;
const MAX_SEARCHES_PER_REPAIR = 4;

export interface RepairInput {
  vendorId: string;
  vendorName: string;
  category: string;
  deadUrl: string;
  httpStatus: number;
}

export interface RepairCandidate {
  candidateUrl: string;
  title: string;
  confidenceScore: number; // 0-100
  rationale: string;
  citations: string[];
  onVendorDomain: boolean;
}

export interface RepairResult {
  vendorId: string;
  category: string;
  deadUrl: string;
  candidate: RepairCandidate | null;
  searchesUsed: number;
  llmSource: "anthropic" | "stub";
  rejectedReason?: string;
}

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if ((process.env.NODE_ENV === "test" || process.env.VITEST) && process.env.ALLOW_LIVE_LLM_TESTS !== "1") return null;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

/**
 * Extract the apex domain from a URL. Used to gate candidate URLs against
 * the vendor's own domain so we don't accept third-party reposts.
 */
function apexDomain(url: string): string | null {
  try {
    const hostname = new URL(url).hostname.replace(/^www\./, "");
    // Crude apex extraction — handles two-label TLDs reasonably
    const parts = hostname.split(".");
    if (parts.length <= 2) return hostname;
    // Keep last 2 labels for .com/.net/etc; last 3 for .co.uk/.ai etc treated similarly
    return parts.slice(-2).join(".");
  } catch {
    return null;
  }
}

const REPAIR_OUTPUT_SCHEMA = {
  name: "report_replacement_url",
  description: "Report the current canonical URL for the vendor page after web search.",
  input_schema: {
    type: "object",
    properties: {
      candidateUrl: {
        type: "string",
        description: "The current working URL on the vendor's official domain. Must be a fully-qualified https:// URL.",
      },
      title: {
        type: "string",
        description: "The page title or short label (e.g. 'OpenAI Trust Center').",
        minLength: 3,
        maxLength: 160,
      },
      confidenceScore: {
        type: "integer",
        minimum: 0,
        maximum: 100,
        description: "How confident you are this is the correct replacement (0-100). Only return ≥60 when you have a clear vendor-domain match for the same category.",
      },
      rationale: {
        type: "string",
        minLength: 20,
        maxLength: 480,
        description: "1-2 sentence explanation of why this URL replaces the dead one.",
      },
      citations: {
        type: "array",
        items: { type: "string" },
        description: "Up to 3 supporting URLs that validate this is the canonical current page.",
        maxItems: 3,
      },
      noReplacementFound: {
        type: "boolean",
        description: "True if the vendor has retired the page entirely with no equivalent. Leave candidateUrl/etc empty in this case.",
      },
    },
    required: ["candidateUrl", "title", "confidenceScore", "rationale", "noReplacementFound"],
  },
} as const;

const SYSTEM_PROMPT = `You are an industrial analyst's research assistant. Your task: when a vendor's documented URL returns 404, find the current canonical URL on that vendor's own domain for the same page category.

Rules:
1. The replacement URL MUST be on the vendor's own apex domain. Reject anything on a third-party blog, news site, archive, social media, or unrelated property.
2. The replacement should serve the SAME category as the original dead URL (trust center stays trust center; pricing page stays pricing page; status page stays status page).
3. Use web search efficiently. You have ${MAX_SEARCHES_PER_REPAIR} searches max. Prefer "site:vendordomain.com [category]" queries.
4. If no equivalent page exists on the vendor's domain, set noReplacementFound=true with confidence 0.
5. Confidence rubric:
   - 90-100: vendor-domain URL, clearly the same category, multiple corroborating signals
   - 70-89: vendor-domain URL, clearly same category, single signal
   - 60-69: vendor-domain URL, plausibly same category
   - <60: don't return — set noReplacementFound=true instead
6. Never invent URLs. Only return URLs you found via search results.

Output via the report_replacement_url tool. Always call the tool — do not return prose.`;

/**
 * Find a replacement URL for a dead manifest entry.
 *
 * Returns a stub when ANTHROPIC_API_KEY is unset (so dev/test environments
 * stay safe). The runner should treat a stub result the same as "no
 * candidate found" — never auto-apply.
 */
export async function findReplacementUrl(input: RepairInput): Promise<RepairResult> {
  const client = getClient();
  if (!client) {
    return {
      vendorId: input.vendorId,
      category: input.category,
      deadUrl: input.deadUrl,
      candidate: null,
      searchesUsed: 0,
      llmSource: "stub",
      rejectedReason: "ANTHROPIC_API_KEY not configured",
    };
  }

  const userPrompt = `Vendor: ${input.vendorName} (id: ${input.vendorId})
Category: ${input.category}
Dead URL (returned HTTP ${input.httpStatus}): ${input.deadUrl}

Find the current canonical ${input.category.replace(/_/g, " ")} page on ${input.vendorName}'s own domain. Use web search.`;

  const message = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: 2048,
    system: SYSTEM_PROMPT,
    tools: [
      {
        type: WEB_SEARCH_TOOL_TYPE,
        name: "web_search",
        max_uses: MAX_SEARCHES_PER_REPAIR,
      } as unknown as Anthropic.Tool,
      REPAIR_OUTPUT_SCHEMA as unknown as Anthropic.Tool,
    ],
    // Don't force a specific tool — Claude needs freedom to use web_search
    // first and only call our reporter tool at the end.
    messages: [{ role: "user", content: userPrompt }],
  });

  // Count web searches actually used (server tool reports them in usage).
  const searchesUsed = (message.usage as { server_tool_use?: { web_search_requests?: number } }).server_tool_use?.web_search_requests ?? 0;

  const reportBlock = message.content.find(
    (b): b is Anthropic.ToolUseBlock => b.type === "tool_use" && b.name === "report_replacement_url",
  );
  if (!reportBlock) {
    return {
      vendorId: input.vendorId,
      category: input.category,
      deadUrl: input.deadUrl,
      candidate: null,
      searchesUsed,
      llmSource: "anthropic",
      rejectedReason: "Agent returned no report tool call",
    };
  }

  const raw = reportBlock.input as {
    candidateUrl?: string;
    title?: string;
    confidenceScore?: number;
    rationale?: string;
    citations?: string[];
    noReplacementFound?: boolean;
  };

  if (raw.noReplacementFound) {
    return {
      vendorId: input.vendorId,
      category: input.category,
      deadUrl: input.deadUrl,
      candidate: null,
      searchesUsed,
      llmSource: "anthropic",
      rejectedReason: raw.rationale ?? "Agent reported no equivalent page on vendor domain",
    };
  }

  if (!raw.candidateUrl || !raw.title || raw.confidenceScore === undefined) {
    return {
      vendorId: input.vendorId,
      category: input.category,
      deadUrl: input.deadUrl,
      candidate: null,
      searchesUsed,
      llmSource: "anthropic",
      rejectedReason: "Agent output missing required fields",
    };
  }

  const deadApex = apexDomain(input.deadUrl);
  const candidateApex = apexDomain(raw.candidateUrl);
  const onVendorDomain = Boolean(deadApex && candidateApex && candidateApex === deadApex);

  // Truthfulness gate: reject off-domain candidates outright.
  if (!onVendorDomain) {
    return {
      vendorId: input.vendorId,
      category: input.category,
      deadUrl: input.deadUrl,
      candidate: null,
      searchesUsed,
      llmSource: "anthropic",
      rejectedReason: `Candidate ${candidateApex ?? "(invalid URL)"} is not on vendor apex ${deadApex ?? "(invalid)"}`,
    };
  }

  return {
    vendorId: input.vendorId,
    category: input.category,
    deadUrl: input.deadUrl,
    candidate: {
      candidateUrl: raw.candidateUrl,
      title: raw.title,
      confidenceScore: Math.max(0, Math.min(100, raw.confidenceScore)),
      rationale: raw.rationale ?? "",
      citations: (raw.citations ?? []).slice(0, 3),
      onVendorDomain: true,
    },
    searchesUsed,
    llmSource: "anthropic",
  };
}
