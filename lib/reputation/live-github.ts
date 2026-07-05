// Live GitHub reputation fetcher.
// ────────────────────────────────
// Fetches real-time GitHub repo stats for each vendor's flagship repo.
// No API key required for public repos (unauthenticated rate limit: 60/hr).
// Falls back gracefully to seed data when rate-limited or repo not found.

import type { DeveloperReputation } from "./seed";

// Vendor → flagship GitHub repo mapping. Keys are CANONICAL plain spine ids
// (matching DeveloperReputation.vendorId) — previously these used a "vendor_"
// prefix that matched nothing, so live stars never merged into reputation.
const VENDOR_REPOS: Record<string, string> = {
  openai: "openai/openai-python",
  anthropic: "anthropics/anthropic-sdk-python",
  google: "google-gemini/generative-ai-python",
  meta: "meta-llama/llama",
  mistral: "mistralai/mistral-inference",
  cohere: "cohere-ai/cohere-python",
  ibm: "IBM/watsonx-ai-python-sdk",
  xai: "xai-org/grok-1",
  writer: "writer/writer-python",
  // New vendors (June 2026) — flagship public repos.
  deepseek: "deepseek-ai/DeepSeek-V3",
  alibaba: "QwenLM/Qwen",
  nvidia: "NVIDIA/NeMo",
  databricks: "databricks/dbrx",
  together: "togethercomputer/together-python",
  fireworks: "fw-ai/cookbook",
};

interface GitHubRepoStats {
  stargazers_count: number;
  forks_count: number;
  open_issues_count: number;
  subscribers_count: number;
  updated_at: string;
}

export interface LiveGitHubSignal {
  vendorId: string;
  repo: string;
  stars: number;
  forks: number;
  openIssues: number;
  watchers: number;
  lastUpdated: string;
  fetchedAt: string;
}

async function fetchRepoStats(repo: string): Promise<GitHubRepoStats | null> {
  try {
    const res = await fetch(`https://api.github.com/repos/${repo}`, {
      headers: {
        accept: "application/vnd.github.v3+json",
        "user-agent": "AI-Enterprise-Reputation-Fetcher",
      },
      next: { revalidate: 3600 }, // Cache for 1 hour
    });
    if (!res.ok) return null;
    return (await res.json()) as GitHubRepoStats;
  } catch {
    return null;
  }
}

/** True when this vendor has a mapped flagship repo — call before fetching to
 *  skip the network round-trip for vendors with no GitHub signal (Harvey,
 *  Hebbia, Rogo, Moveworks, etc.). */
export function hasLiveGitHubRepo(vendorId: string): boolean {
  return vendorId in VENDOR_REPOS;
}

/**
 * Fetch the live GitHub signal for ONE vendor. Used on the public vendor
 * profile — deliberately single-repo (not fetchLiveGitHubSignals' all-vendor
 * loop) so a single page view costs exactly one GitHub call, not ~15; the
 * underlying fetch() already sets `next: { revalidate: 3600 }`, so Next's
 * data cache absorbs repeat views within the hour. null when unmapped,
 * rate-limited, or the repo lookup fails — never a fabricated fallback.
 */
export async function fetchLiveGitHubSignalForVendor(vendorId: string): Promise<LiveGitHubSignal | null> {
  const repo = VENDOR_REPOS[vendorId];
  if (!repo) return null;
  const stats = await fetchRepoStats(repo);
  if (!stats) return null;
  return {
    vendorId,
    repo,
    stars: stats.stargazers_count,
    forks: stats.forks_count,
    openIssues: stats.open_issues_count,
    watchers: stats.subscribers_count,
    lastUpdated: stats.updated_at,
    fetchedAt: new Date().toISOString(),
  };
}

/**
 * Fetch live GitHub signals for all mapped vendors.
 * Returns null entries for vendors without repos or on rate limit.
 */
export async function fetchLiveGitHubSignals(): Promise<LiveGitHubSignal[]> {
  const fetchedAt = new Date().toISOString();
  const results: LiveGitHubSignal[] = [];

  // Sequential to respect GitHub rate limits (60/hr unauthenticated)
  for (const [vendorId, repo] of Object.entries(VENDOR_REPOS)) {
    const stats = await fetchRepoStats(repo);
    if (stats) {
      results.push({
        vendorId,
        repo,
        stars: stats.stargazers_count,
        forks: stats.forks_count,
        openIssues: stats.open_issues_count,
        watchers: stats.subscribers_count,
        lastUpdated: stats.updated_at,
        fetchedAt,
      });
    }
  }

  return results;
}

/**
 * Merge live GitHub signals into seed developer reputation data.
 * Updates githubScore based on real star counts, preserving other
 * seed fields until those sources go live too.
 */
export function mergeGitHubIntoReputation(
  seed: DeveloperReputation[],
  live: LiveGitHubSignal[],
): DeveloperReputation[] {
  const byVendor = new Map(live.map((l) => [l.vendorId, l]));

  return seed.map((s) => {
    const l = byVendor.get(s.vendorId);
    if (!l) return s;

    // Derive a githubScore from stars — logarithmic scale, capped at 100
    const starScore = Math.min(100, Math.round(Math.log10(Math.max(1, l.stars)) * 20));

    return {
      ...s,
      githubScore: starScore,
      githubStars: l.stars,
      githubRepo: l.repo,
      githubLastFetched: l.fetchedAt,
      cellStatus: {
        ...s.cellStatus,
        github: "verified" as const,
      },
    };
  });
}
