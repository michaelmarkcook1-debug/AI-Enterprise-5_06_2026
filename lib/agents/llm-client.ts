// LLM client wrapper. Uses Anthropic SDK; falls back to a deterministic stub
// when ANTHROPIC_API_KEY is unset so dev/CI/test environments still work.

import Anthropic from "@anthropic-ai/sdk";

const DEFAULT_MODEL = process.env.ANTHROPIC_MODEL ?? "claude-sonnet-4-6";

export interface ExtractParams<T> {
  systemPrompt: string;
  userPrompt: string;
  schema: { name: string; description: string; jsonSchema: unknown };
  parse: (raw: unknown) => T;
  maxTokens?: number;
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

  const message = await client.messages.create({
    model: DEFAULT_MODEL,
    max_tokens: params.maxTokens ?? 4096,
    system: params.systemPrompt,
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

  const toolUse = message.content.find((b): b is Anthropic.ToolUseBlock => b.type === "tool_use");
  if (!toolUse) throw new Error("LLM returned no tool_use block");

  const data = params.parse(toolUse.input);
  return {
    data,
    usage: {
      inputTokens: message.usage.input_tokens,
      outputTokens: message.usage.output_tokens,
      model: DEFAULT_MODEL,
    },
    source: "anthropic",
  };
}
