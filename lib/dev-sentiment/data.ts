// Developer-sentiment STARTER dataset — coding models.
// ──────────────────────────────────────────────────────
// CURATED ANALYST data compiled 2026-07-04 from THREE ToS-compliant official
// sources, every figure real and cited:
//   • Hacker News — via the Algolia public API (engagement / mindshare):
//     thread counts + points, top threads linked to the real HN item.
//   • GitHub — via the REST API (adoption): stars / forks / open issues on the
//     vendor's flagship coding repo.
//   • Stack Overflow 2025 Developer Survey (admiration): where the survey
//     separately reports the model; omitted where it does not (honest gap).
// Numbers are point-in-time (2026-07-04) — this space moves weekly; re-pull
// before publish. The per-vendor `reading` is an analyst-curated qualitative
// interpretation OF these cited signals (labelled directional in the UI), never
// a measured score. HN metrics = ENGAGEMENT, not sentiment — never presented as
// sentiment. Coverage-gating + volume floors live in aggregate.ts.

import type { DevSentimentRecord } from "./types";

export const DEV_SENTIMENT_COMPILED_AT = "2026-07-04";

const SO_2025 = {
  title: "AI — 2025 Stack Overflow Developer Survey",
  url: "https://survey.stackoverflow.co/2025/ai",
  publisher: "Stack Overflow",
  date: "2025",
};

export const DEV_SENTIMENT_DATA: DevSentimentRecord[] = [
  // ── Anthropic / Claude — the clear developer-community leader ──────────────
  {
    vendorId: "anthropic",
    subject: "Claude (Claude Code / Sonnet / Opus)",
    sources: [
      {
        source: "hackernews",
        measures: "engagement",
        signalWeight: 36075,
        metric: "44 HN stories ≥50 points since 2024 · ~36,075 total points — by far the highest coding-model mindshare on HN",
        citations: [
          { title: "Claude Opus 4.6", url: "https://news.ycombinator.com/item?id=46902223", publisher: "Hacker News", date: "2026-02-05" },
          { title: "Claude 3.7 Sonnet and Claude Code", url: "https://news.ycombinator.com/item?id=43163011", publisher: "Hacker News", date: "2025-02-24" },
          { title: "Claude Opus 4.7", url: "https://news.ycombinator.com/item?id=47793411", publisher: "Hacker News", date: "2026-04-16" },
        ],
        topThreads: [
          { title: "Claude Opus 4.6", points: 2346, comments: 1031, date: "2026-02-05", url: "https://news.ycombinator.com/item?id=46902223" },
          { title: "Claude 3.7 Sonnet and Claude Code", points: 2127, comments: 963, date: "2025-02-24", url: "https://news.ycombinator.com/item?id=43163011" },
          { title: "Claude Opus 4.7", points: 1959, comments: 1452, date: "2026-04-16", url: "https://news.ycombinator.com/item?id=47793411" },
          { title: "Claude Opus 4.8", points: 1774, comments: 1376, date: "2026-05-28", url: "https://news.ycombinator.com/item?id=48311647" },
        ],
      },
      {
        source: "github",
        measures: "adoption",
        signalWeight: 136050,
        metric: "anthropics/claude-code — 136,050★ · 21,884 forks · 9,808 open issues (the most-starred coding-agent repo)",
        citations: [{ title: "anthropics/claude-code", url: "https://github.com/anthropics/claude-code", publisher: "GitHub", date: "2026-07-04" }],
      },
      {
        source: "stackoverflow_survey",
        measures: "admiration",
        signalWeight: 100,
        metric: "Claude Sonnet — the most-admired LLM among developers (67.5% admired) and second-most-desired (33%); used by 45% of professional developers",
        citations: [SO_2025],
      },
    ],
    reading: {
      tag: "positive",
      rationale:
        "Leads all three sources: highest HN coding mindshare by a wide margin, the most-starred coding-agent repo, and the #1 most-admired LLM in the SO survey. Strong, source-diverse, positive developer signal.",
    },
  },

  // ── OpenAI / Codex & GPT ───────────────────────────────────────────────────
  {
    vendorId: "openai",
    subject: "OpenAI (Codex CLI / GPT-5 coding)",
    sources: [
      {
        source: "hackernews",
        measures: "engagement",
        signalWeight: 2660,
        metric: "~10 HN stories ≥50 points since 2024 · ~2,660 total points — steady but well below Anthropic's coding mindshare",
        citations: [
          { title: "OpenAI Codex CLI: Lightweight coding agent that runs in your terminal", url: "https://news.ycombinator.com/item?id=43708025", publisher: "Hacker News", date: "2025-04-16" },
          { title: "GPT-5 vs. Sonnet: Complex Agentic Coding", url: "https://news.ycombinator.com/item?id=44838303", publisher: "Hacker News", date: "2025-08-08" },
        ],
        topThreads: [
          { title: "OpenAI Codex CLI: Lightweight coding agent that runs in your terminal", points: 516, comments: 289, date: "2025-04-16", url: "https://news.ycombinator.com/item?id=43708025" },
          { title: "GPT-5 vs. Sonnet: Complex Agentic Coding", points: 172, comments: 141, date: "2025-08-08", url: "https://news.ycombinator.com/item?id=44838303" },
        ],
      },
      {
        source: "github",
        measures: "adoption",
        signalWeight: 95493,
        metric: "openai/codex — 95,493★ · 14,164 forks · 8,194 open issues",
        citations: [{ title: "openai/codex", url: "https://github.com/openai/codex", publisher: "GitHub", date: "2026-07-04" }],
      },
      {
        source: "stackoverflow_survey",
        measures: "adoption",
        signalWeight: 100,
        metric: "OpenAI GPT models top the SO survey for usage — 82% of developers used them for development work in the past year",
        citations: [SO_2025],
      },
    ],
    reading: {
      tag: "leaning_positive",
      rationale:
        "Top adoption (82% SO usage, 95k★) but notably lower HN coding mindshare than Anthropic, and HN threads frequently compare Codex/GPT unfavourably to Claude for agentic coding. Broadly positive on adoption, mixed on developer preference for coding specifically.",
    },
  },

  // ── Google / Gemini ────────────────────────────────────────────────────────
  {
    vendorId: "google",
    subject: "Google (Gemini CLI / Gemini coding)",
    sources: [
      {
        source: "hackernews",
        measures: "engagement",
        signalWeight: 5689,
        metric: "~16 HN stories ≥50 points since 2024 · ~5,689 total points (Gemini CLI launch drove the peak)",
        citations: [
          { title: "Gemini CLI", url: "https://news.ycombinator.com/item?id=44376919", publisher: "Hacker News", date: "2025-06-25" },
          { title: "Gemini CLI tips and tricks for agentic coding", url: "https://news.ycombinator.com/item?id=46060508", publisher: "Hacker News", date: "2025-11-26" },
        ],
        topThreads: [
          { title: "Gemini CLI", points: 1428, comments: 788, date: "2025-06-25", url: "https://news.ycombinator.com/item?id=44376919" },
          { title: "Gemini CLI tips and tricks for agentic coding", points: 403, comments: 145, date: "2025-11-26", url: "https://news.ycombinator.com/item?id=46060508" },
        ],
      },
      {
        source: "github",
        measures: "adoption",
        signalWeight: 105733,
        metric: "google-gemini/gemini-cli — 105,733★ · 14,204 forks · 1,342 open issues",
        citations: [{ title: "google-gemini/gemini-cli", url: "https://github.com/google-gemini/gemini-cli", publisher: "GitHub", date: "2026-07-04" }],
      },
      {
        source: "stackoverflow_survey",
        measures: "admiration",
        signalWeight: 100,
        metric: "Gemini Reasoning ranked the most-admired LLM in the SO survey (ahead of Claude Sonnet)",
        citations: [SO_2025],
      },
    ],
    reading: {
      tag: "leaning_positive",
      rationale:
        "Strong adoption (106k★ CLI) and the top SO admiration rank for Gemini Reasoning, with solid HN engagement. Developer coding mindshare on HN trails Anthropic but the signal is genuinely positive and source-diverse.",
    },
  },

  // ── DeepSeek ───────────────────────────────────────────────────────────────
  {
    vendorId: "deepseek",
    subject: "DeepSeek (DeepSeek-Coder / V3)",
    sources: [
      {
        source: "hackernews",
        measures: "engagement",
        signalWeight: 3365,
        metric: "~13 HN stories ≥50 points since 2024 · ~3,365 total points (open-weight release cadence drives discussion)",
        citations: [
          { title: "DeepSeek-v3.2: Pushing the frontier of open large language models", url: "https://news.ycombinator.com/item?id=46108780", publisher: "Hacker News", date: "2025-12-01" },
          { title: "DeepSeek Coder: Let the Code Write Itself", url: "https://news.ycombinator.com/item?id=39209814", publisher: "Hacker News", date: "2024-01-31" },
        ],
        topThreads: [
          { title: "DeepSeek-v3.2: Pushing the frontier of open large language models", points: 982, comments: 465, date: "2025-12-01", url: "https://news.ycombinator.com/item?id=46108780" },
          { title: "DeepSeek-v3.1", points: 778, comments: 263, date: "2025-08-21", url: "https://news.ycombinator.com/item?id=44976764" },
        ],
      },
      {
        source: "github",
        measures: "adoption",
        signalWeight: 23804,
        metric: "deepseek-ai/DeepSeek-Coder — 23,804★ · 2,870 forks · 166 open issues",
        citations: [{ title: "deepseek-ai/DeepSeek-Coder", url: "https://github.com/deepseek-ai/DeepSeek-Coder", publisher: "GitHub", date: "2026-07-04" }],
      },
    ],
    reading: {
      tag: "leaning_positive",
      rationale:
        "Consistent, engaged HN discussion around open-weight releases and solid repo adoption; developers rate it well on cost-per-quality. Two-source signal (no separate SO-survey line) → moderate, not strong.",
    },
  },

  // ── Alibaba / Qwen ─────────────────────────────────────────────────────────
  {
    vendorId: "alibaba",
    subject: "Alibaba (Qwen3-Coder / Qwen Coder)",
    sources: [
      {
        source: "hackernews",
        measures: "engagement",
        signalWeight: 4551,
        metric: "~10 HN stories ≥50 points since 2024 · ~4,551 total points — the leading open-weight coding model by HN mindshare",
        citations: [
          { title: "Qwen3.6-35B-A3B: Agentic coding power, now open to all", url: "https://news.ycombinator.com/item?id=47792764", publisher: "Hacker News", date: "2026-04-16" },
          { title: "Qwen3-Coder: Agentic coding in the world", url: "https://news.ycombinator.com/item?id=44653072", publisher: "Hacker News", date: "2025-07-22" },
        ],
        topThreads: [
          { title: "Qwen3.6-35B-A3B: Agentic coding power, now open to all", points: 1274, comments: 532, date: "2026-04-16", url: "https://news.ycombinator.com/item?id=47792764" },
          { title: "Qwen3.6-27B: Flagship-Level Coding in a 27B Dense Model", points: 993, comments: 458, date: "2026-04-22", url: "https://news.ycombinator.com/item?id=47863217" },
        ],
      },
      {
        source: "github",
        measures: "adoption",
        signalWeight: 16667,
        metric: "QwenLM/Qwen3-Coder — 16,667★ · 1,211 forks · 108 open issues",
        citations: [{ title: "QwenLM/Qwen3-Coder", url: "https://github.com/QwenLM/Qwen3-Coder", publisher: "GitHub", date: "2026-07-04" }],
      },
    ],
    reading: {
      tag: "leaning_positive",
      rationale:
        "Strong, growing HN mindshare for the open-weight Qwen-Coder line (repeated flagship-coding launches well received) plus real repo adoption. Two-source signal → moderate; developers praise open-weight coding quality.",
    },
  },

  // ── Mistral / Codestral ────────────────────────────────────────────────────
  {
    vendorId: "mistral",
    subject: "Mistral (Codestral)",
    sources: [
      {
        source: "hackernews",
        measures: "engagement",
        signalWeight: 1200,
        metric: "~5 HN stories ≥50 points, mostly the 2024 Codestral launches · ~1,200 relevant points — modest, and cadence has slowed",
        citations: [
          { title: "Codestral: Mistral's Code Model", url: "https://news.ycombinator.com/item?id=40512250", publisher: "Hacker News", date: "2024-05-29" },
          { title: "Codestral Mamba", url: "https://news.ycombinator.com/item?id=40977103", publisher: "Hacker News", date: "2024-07-16" },
        ],
        topThreads: [
          { title: "Codestral: Mistral's Code Model", points: 457, comments: 214, date: "2024-05-29", url: "https://news.ycombinator.com/item?id=40512250" },
          { title: "Codestral Mamba", points: 485, comments: 138, date: "2024-07-16", url: "https://news.ycombinator.com/item?id=40977103" },
        ],
      },
    ],
    // Single-source, older + modest → aggregate.ts will read this "insufficient".
    reading: {
      tag: "mixed",
      rationale:
        "Codestral drew interest at its 2024 launches but HN discussion has since thinned and there is no separate flagship coding-agent repo or SO-survey line — a single, ageing source. Directional at best.",
    },
  },

  // ── Meta / Code Llama — honestly thin ──────────────────────────────────────
  {
    vendorId: "meta",
    subject: "Meta (Code Llama)",
    sources: [
      {
        source: "hackernews",
        measures: "engagement",
        signalWeight: 665,
        metric: "2 HN stories ≥50 points, both early-2024 · ~665 total points — Code Llama has since been effectively superseded",
        citations: [
          { title: "Meta AI releases Code Llama 70B", url: "https://news.ycombinator.com/item?id=39178886", publisher: "Hacker News", date: "2024-01-29" },
        ],
        topThreads: [
          { title: "Meta AI releases Code Llama 70B", points: 598, comments: 294, date: "2024-01-29", url: "https://news.ycombinator.com/item?id=39178886" },
        ],
      },
      {
        source: "github",
        measures: "adoption",
        signalWeight: 16300,
        metric: "meta-llama/codellama — 16,300★ but a low-velocity, effectively archived repo (116 open issues, minimal recent activity)",
        citations: [{ title: "meta-llama/codellama", url: "https://github.com/meta-llama/codellama", publisher: "GitHub", date: "2026-07-04" }],
      },
    ],
    // Thin + stale → aggregate.ts reads "insufficient developer-sentiment data".
  },
];
