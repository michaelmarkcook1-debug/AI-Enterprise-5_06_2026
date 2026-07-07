// Developer-sentiment dataset — coding models.
// ──────────────────────────────────────────────────────
// CURATED ANALYST data from FOUR ToS-compliant official sources, every figure
// real and cited. Original three compiled 2026-07-04; Hugging Face added
// 2026-07-07 (see lib/connectors/huggingface.ts):
//   • Hacker News — via the Algolia public API (engagement / mindshare):
//     thread counts + points, top threads linked to the real HN item.
//   • GitHub — via the REST API (adoption): stars / forks / open issues on the
//     vendor's flagship coding repo.
//   • Stack Overflow 2025 Developer Survey (admiration): where the survey
//     separately reports the model; omitted where it does not (honest gap).
//   • Hugging Face Hub API (adoption): cumulative downloads + likes across a
//     vendor's official org, filtered to text-generation-capable models
//     (pipeline_tag = text-generation, OR untagged with a recognized LLM-
//     family tag — HF's auto-inferred pipeline_tag is unreliable for some
//     vendors' repos, e.g. Mistral's own instruct models were mistagged
//     `null`; a naive text-generation-only filter would have silently
//     undercounted them by ~5x — fixed by also matching known architecture
//     tags, applied identically to every vendor). Valid ONLY for vendors that
//     publish open weights; closed-weight vendors (Anthropic) genuinely have
//     no Hugging Face org and honestly omit the source, never a zero.
// Numbers are point-in-time — this space moves weekly; re-pull before publish.
// The per-vendor `reading` is an analyst-curated qualitative interpretation OF
// these cited signals, tier- and coverage-gated exactly like every other
// assessment domain (E-grade, confidence, coverage) — a graded, weighted
// input like the rest of the framework, not a hedge-everything caveat on top
// of one. HN metrics = ENGAGEMENT, not sentiment — never presented as
// sentiment. Coverage-gating + volume floors live in aggregate.ts.

import type { DevSentimentRecord } from "./types";

export const DEV_SENTIMENT_COMPILED_AT = "2026-07-07";

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
      {
        source: "huggingface",
        measures: "adoption",
        signalWeight: 10268,
        metric: "11,467,499 cumulative downloads · 10,268 cumulative likes across 5 text-generation models (the gpt-oss family) on the official openai Hugging Face org — OpenAI's first open-weight release line",
        citations: [{ title: "openai on Hugging Face", url: "https://huggingface.co/openai", publisher: "Hugging Face", date: "2026-07-07" }],
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
      {
        source: "huggingface",
        measures: "adoption",
        signalWeight: 18501,
        metric: "10,714,017 cumulative downloads · 18,501 cumulative likes across 105 text-generation models (the Gemma family) on the official google Hugging Face org",
        citations: [{ title: "google on Hugging Face", url: "https://huggingface.co/google", publisher: "Hugging Face", date: "2026-07-07" }],
      },
    ],
    reading: {
      tag: "leaning_positive",
      rationale:
        "Strong adoption (106k★ CLI) and the top SO admiration rank for Gemini Reasoning, with solid HN engagement and real open-weight adoption via the Gemma family on Hugging Face. Developer coding mindshare on HN trails Anthropic but the signal is genuinely positive and source-diverse.",
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
      {
        source: "huggingface",
        measures: "adoption",
        signalWeight: 52641,
        metric: "26,841,009 cumulative downloads · 52,641 cumulative likes across 81 text-generation models (V3 / R1 families) on the official deepseek-ai Hugging Face org — among the largest real open-model adoption footprints tracked",
        citations: [{ title: "deepseek-ai on Hugging Face", url: "https://huggingface.co/deepseek-ai", publisher: "Hugging Face", date: "2026-07-07" }],
      },
    ],
    reading: {
      tag: "leaning_positive",
      rationale:
        "Consistent, engaged HN discussion around open-weight releases, solid repo adoption, and a very large real Hugging Face adoption footprint (26.8M downloads, 52.6k likes across the V3/R1 catalog). Three independent sources → strong, not merely moderate.",
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
      {
        source: "huggingface",
        measures: "adoption",
        signalWeight: 50431,
        metric: "182,013,941 cumulative downloads · 50,431 cumulative likes across 305 text-generation models (the Qwen family) on the official Qwen Hugging Face org — the largest cumulative download count of any tracked vendor",
        citations: [{ title: "Qwen on Hugging Face", url: "https://huggingface.co/Qwen", publisher: "Hugging Face", date: "2026-07-07" }],
      },
    ],
    reading: {
      tag: "leaning_positive",
      rationale:
        "Strong, growing HN mindshare for the open-weight Qwen-Coder line (repeated flagship-coding launches well received), real repo adoption, and by far the largest Hugging Face download footprint of any tracked vendor (182M+ across the Qwen catalog). Three independent sources → strong; developers praise open-weight coding quality.",
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
      {
        source: "huggingface",
        measures: "adoption",
        signalWeight: 25755,
        metric: "10,580,671 cumulative downloads · 25,755 cumulative likes across 36 text-generation models on the official mistralai Hugging Face org — real open-model adoption, but HN discussion of the coding-specific Codestral line has not kept pace",
        citations: [{ title: "mistralai on Hugging Face", url: "https://huggingface.co/mistralai", publisher: "Hugging Face", date: "2026-07-07" }],
      },
    ],
    // HN is below its floor and HF, while real, is one source alone → still only
    // 1 counting source (need ≥2) → aggregate.ts correctly reads "insufficient".
    // Genuine open-model adoption exists (Hugging Face); it's the coding-specific
    // developer-forum discussion that remains thin — an honest, evidenced gap,
    // not one Hugging Face alone can close for THIS vendor.
    reading: {
      tag: "mixed",
      rationale:
        "Codestral drew interest at its 2024 launches but HN discussion has since thinned, and there is no separate flagship coding-agent repo or SO-survey line. Real open-model adoption is visible on Hugging Face (10.6M downloads across the Mistral catalog), but that alone doesn't clear the 2-source diversity bar. Directional at best.",
    },
  },

  // ── Meta / Llama family — previously read "insufficient" on HN+GitHub alone;
  //    real Hugging Face adoption (added 2026-07-07) clears the gap honestly ──
  {
    vendorId: "meta",
    subject: "Meta (Llama family / Code Llama)",
    sources: [
      {
        source: "hackernews",
        measures: "engagement",
        signalWeight: 665,
        metric: "2 HN stories ≥50 points, both early-2024 · ~665 total points — Code Llama has since been effectively superseded; general Llama releases draw less dedicated HN coding-thread discussion than the model's real-world adoption would suggest",
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
      {
        source: "huggingface",
        measures: "adoption",
        signalWeight: 56053,
        metric: "31,263,314 cumulative downloads · 56,053 cumulative likes across 56 text-generation models (the Llama family) on the official meta-llama Hugging Face org — the highest cumulative like-count of any tracked vendor, reflecting the Llama family's real weight as the de facto open-model base for local/self-hosted developer use",
        citations: [{ title: "meta-llama on Hugging Face", url: "https://huggingface.co/meta-llama", publisher: "Hugging Face", date: "2026-07-07" }],
      },
    ],
    reading: {
      tag: "leaning_positive",
      rationale:
        "Code Llama specifically is stale and effectively superseded, and dedicated coding-thread HN discussion of Meta's models remains thin. But the broader Llama family shows real, substantial developer adoption on Hugging Face — the highest cumulative like-count (56,053) of any tracked vendor and 31.3M downloads across 56 models — the clearest real-world signal that Llama is a widely-used open-weight base for coding and general developer workloads. GitHub + Hugging Face are two independent, floor-clearing sources; HN alone stays thin.",
    },
  },
];
