// LLM client wrapper. Uses Anthropic SDK; falls back to a deterministic stub
// when ANTHROPIC_API_KEY is unset so dev/CI/test environments still work.

import Anthropic from "@anthropic-ai/sdk";

// Structured extraction (sourcing, classification) is a mechanical task that
// doesn't need a frontier model — default to Haiku for ~3-5x lower cost.
// Override with ANTHROPIC_EXTRACT_MODEL if a specific extraction needs more.
const DEFAULT_MODEL = process.env.ANTHROPIC_EXTRACT_MODEL ?? "claude-haiku-4-5";

export interface ExtractParams<T> {
  systemPrompt: string;
  userPrompt: string;
  schema: { name: string; description: string; jsonSchema: unknown };
  parse: (raw: unknown) => T;
  maxTokens?: number;
  // Per-call model override for tiered routing (cheap classify vs mid/frontier
  // extract). Defaults to DEFAULT_MODEL (Haiku). Forward-compatible with a
  // central routing table — callers pass the tier they need.
  model?: string;
  // Deterministic fallback when no API key is configured
  fallback: () => T;
}

export interface LLMUsage {
  inputTokens: number;
  outputTokens: number;
  model: string;
}

export interface LLMResult<T> {
  data: T;
  usage: LLMUsage;
  source: "anthropic" | "stub";
}

/** Wrap a STATIC system-prompt string in Anthropic's ephemeral prompt-cache
 *  block shape. Only ever pass content here that is byte-identical across
 *  calls — anything that varies per-request (a vendor name, a document
 *  excerpt, a timestamp) must stay in the user message, never here, or the
 *  cached prefix changes every call and nothing is ever reused.
 *
 *  Gotcha (not an error, just a silent no-op): each model has a minimum
 *  cacheable prefix length — Haiku 4.5 requires ~4,096 tokens; below that the
 *  API ignores cache_control with no warning. A short static prompt gains
 *  nothing from this wrapper until it (plus any cached tool definitions)
 *  crosses that floor. Do not pad content to reach it — a prompt that's
 *  genuinely short just doesn't benefit from caching yet. */
export function cachedSystemBlock(text: string): { type: "text"; text: string; cache_control: { type: "ephemeral" } }[] {
  return [{ type: "text", text, cache_control: { type: "ephemeral" } }];
}

/** Best-effort visibility into whether caching actually fired on a call.
 *  cache_creation_input_tokens > 0 means this call WROTE the cache;
 *  cache_read_input_tokens > 0 means a later call within the ~5-minute TTL
 *  REUSED it at ~10% of input price. Both fields are simply absent (not an
 *  error) on stub results or when the prefix is under the model's minimum. */
export function logCacheUsage(label: string, usage: Anthropic.Message["usage"]): void {
  const u = usage as Anthropic.Message["usage"] & {
    cache_creation_input_tokens?: number;
    cache_read_input_tokens?: number;
  };
  console.log(
    `[cache] ${label}: input=${usage.input_tokens} output=${usage.output_tokens} ` +
      `cache_creation=${u.cache_creation_input_tokens ?? 0} cache_read=${u.cache_read_input_tokens ?? 0}`,
  );
}

let _client: Anthropic | null = null;
function getClient(): Anthropic | null {
  if ((process.env.NODE_ENV === "test" || process.env.VITEST) && process.env.ALLOW_LIVE_LLM_TESTS !== "1") return null;
  if (!process.env.ANTHROPIC_API_KEY) return null;
  if (!_client) _client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });
  return _client;
}

export function hasLLM(): boolean {
  if ((process.env.NODE_ENV === "test" || process.env.VITEST) && process.env.ALLOW_LIVE_LLM_TESTS !== "1") return false;
  return Boolean(process.env.ANTHROPIC_API_KEY);
}

export async function extractStructured<T>(params: ExtractParams<T>): Promise<LLMResult<T>> {
  const client = getClient();
  if (!client) {
    return {
      data: params.fallback(),
      usage: { inputTokens: 0, outputTokens: 0, model: "stub" },
      source: "stub",
    };
  }

  const model = params.model ?? DEFAULT_MODEL;
  let message: Anthropic.Message;
  try {
    message = await client.messages.create({
      model,
      max_tokens: params.maxTokens ?? 4096,
      // Prompt-cache the system/rubric prompt: it is identical across every
      // source URL in a refresh run, so caching it makes the repeated input
      // ~10× cheaper (cache reads are 0.1× input price). Below the model's
      // minimum cacheable length the directive is simply ignored — safe either
      // way. The shared central refresh is the only caller, so this is a direct
      // cost win on the pipeline that has to scale cheaply.
      system: cachedSystemBlock(params.systemPrompt),
      tools: [
        {
          name: params.schema.name,
          description: params.schema.description,
          input_schema: params.schema.jsonSchema as Anthropic.Tool["input_schema"],
        },
      ],
      tool_choice: { type: "tool", name: params.schema.name },
      messages: [{ role: "user", content: params.userPrompt }],
    });
  } catch (err) {
    // Preserve the Anthropic HTTP status + error type on the re-thrown error so
    // every caller's catch can show "401 authentication_error" / "rate_limit_error"
    // / "billing_error" instead of a generic message — the difference between
    // "rotate the key", "raise the spend cap", and "wait out the rate limit".
    const e = err as { status?: number; error?: { type?: string }; type?: string };
    const status = e?.status;
    const apiType = e?.error?.type ?? e?.type;
    const enriched = new Error(
      `anthropic ${status ?? ""} ${apiType ?? ""}: ${(err as Error)?.message ?? String(err)}`.replace(/\s{2,}/g, " ").trim(),
    );
    throw Object.assign(enriched, { status, anthropicType: apiType, cause: err });
  }

  logCacheUsage(`extractStructured:${params.schema.name}`, message.usage);

  const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("LLM returned no tool_use block");

  const data = params.parse(toolUse.input);
  return {
    data,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      model,
    },
    source: "anthropic",
  };
}
