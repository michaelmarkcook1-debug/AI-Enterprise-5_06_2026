// Token pricing reference table — input + output pricing.
// ──────────────────────────────────────────────────────────
// Source: frontier_model_pricing_google_docs.html, captured 2026-06-02
// from public vendor API pricing pages.
//
// HONESTY CONTRACT:
//   - Public API LIST price ≠ negotiated enterprise price.
//   - Rows where price is null = not verified from a reliable live source.
//   - Some vendors add per-request/search fees on top of token cost.
//   - Verify before quoting. Seed reference data, not a contract.

export interface TokenPrice {
  id: string;
  vendorId: string;
  vendorName: string;
  modelName: string;
  /** USD per 1M input tokens. null = unverified. */
  inputPerM: number | null;
  /** USD per 1M output tokens. null = unverified. */
  outputPerM: number | null;
  /** Optional cached-input price where vendor publishes a clean line. */
  cachedInputPerM: number | null;
  /** Caveats — batch discounts, extra fees, residency premiums. */
  note: string;
  /** Official pricing page. */
  sourceUrl: string;
}

export const TOKEN_PRICING_CAPTURED_AT = "2026-06-02";

export const TOKEN_PRICING_DISCLAIMER =
  "Reference list pricing (USD per 1M tokens), captured 2026-06-02 from public vendor API pricing pages. List price ≠ negotiated enterprise price — batch APIs commonly list 50% lower; committed-use, volume, and residency terms vary. Rows with no price were not verified from a reliable live source. Seed reference data, not a contract.";

export const TOKEN_PRICING: TokenPrice[] = [
  // ─── OpenAI ────────────────────────────────────────────────────
  { id: "tp_openai_gpt55", vendorId: "openai", vendorName: "OpenAI", modelName: "GPT-5.5", inputPerM: 5, outputPerM: 30, cachedInputPerM: 0.5, note: "Enterprise API pricing; cached input tiers available on some models.", sourceUrl: "https://openai.com/api/pricing/" },
  { id: "tp_openai_gpt54", vendorId: "openai", vendorName: "OpenAI", modelName: "GPT-5.4", inputPerM: 2.5, outputPerM: 15, cachedInputPerM: 0.25, note: "Enterprise API pricing; cached input tiers available on some models.", sourceUrl: "https://openai.com/api/pricing/" },
  { id: "tp_openai_gpt54_mini", vendorId: "openai", vendorName: "OpenAI", modelName: "GPT-5.4-mini", inputPerM: 0.75, outputPerM: 4.5, cachedInputPerM: 0.075, note: "Enterprise API pricing; cached input tiers available on some models.", sourceUrl: "https://openai.com/api/pricing/" },
  // ─── Anthropic ─────────────────────────────────────────────────
  { id: "tp_anthropic_opus48", vendorId: "anthropic", vendorName: "Anthropic", modelName: "Claude Opus 4.8", inputPerM: 5, outputPerM: 25, cachedInputPerM: 0.5, note: "Enterprise API pricing; prompt caching and batch discounts available.", sourceUrl: "https://www.anthropic.com/pricing" },
  { id: "tp_anthropic_opus46", vendorId: "anthropic", vendorName: "Anthropic", modelName: "Claude Opus 4.6", inputPerM: 5, outputPerM: 25, cachedInputPerM: 0.5, note: "Enterprise API pricing; prompt caching and batch discounts available.", sourceUrl: "https://www.anthropic.com/pricing" },
  { id: "tp_anthropic_sonnet46", vendorId: "anthropic", vendorName: "Anthropic", modelName: "Claude Sonnet 4.6", inputPerM: 3, outputPerM: 15, cachedInputPerM: 0.3, note: "Enterprise API pricing; prompt caching and batch discounts available.", sourceUrl: "https://www.anthropic.com/pricing" },
  { id: "tp_anthropic_haiku45", vendorId: "anthropic", vendorName: "Anthropic", modelName: "Claude Haiku 4.5", inputPerM: 1, outputPerM: 5, cachedInputPerM: 0.1, note: "Enterprise API pricing; prompt caching and batch discounts available.", sourceUrl: "https://www.anthropic.com/pricing" },
  // ─── Google DeepMind ───────────────────────────────────────────
  { id: "tp_google_25_pro", vendorId: "google", vendorName: "Google DeepMind", modelName: "Gemini 2.5 Pro", inputPerM: 1.25, outputPerM: 10, cachedInputPerM: 0.31, note: "Enterprise API pricing; some models have tiered long-context rates.", sourceUrl: "https://ai.google.dev/pricing" },
  { id: "tp_google_25_flash", vendorId: "google", vendorName: "Google DeepMind", modelName: "Gemini 2.5 Flash", inputPerM: 0.3, outputPerM: 2.5, cachedInputPerM: 0.075, note: "Enterprise API pricing; some models have tiered long-context rates.", sourceUrl: "https://ai.google.dev/pricing" },
  { id: "tp_google_25_flash_lite", vendorId: "google", vendorName: "Google DeepMind", modelName: "Gemini 2.5 Flash-Lite", inputPerM: 0.1, outputPerM: 0.4, cachedInputPerM: null, note: "Enterprise API pricing; some models have tiered long-context rates.", sourceUrl: "https://ai.google.dev/pricing" },
  // ─── Mistral ───────────────────────────────────────────────────
  { id: "tp_mistral_large", vendorId: "mistral", vendorName: "Mistral", modelName: "Mistral Large", inputPerM: 2, outputPerM: 6, cachedInputPerM: null, note: "Enterprise API pricing; model families vary by inference endpoint.", sourceUrl: "https://mistral.ai/pricing" },
  { id: "tp_mistral_small", vendorId: "mistral", vendorName: "Mistral", modelName: "Mistral Small", inputPerM: 0.2, outputPerM: 0.6, cachedInputPerM: null, note: "Enterprise API pricing; model families vary by inference endpoint.", sourceUrl: "https://mistral.ai/pricing" },
  { id: "tp_mistral_codestral", vendorId: "mistral", vendorName: "Mistral", modelName: "Codestral", inputPerM: 0.2, outputPerM: 0.6, cachedInputPerM: null, note: "Enterprise API pricing; model families vary by inference endpoint.", sourceUrl: "https://mistral.ai/pricing" },
  { id: "tp_mistral_nemo", vendorId: "mistral", vendorName: "Mistral", modelName: "Mistral Nemo", inputPerM: 0.15, outputPerM: 0.15, cachedInputPerM: null, note: "Enterprise API pricing; model families vary by inference endpoint.", sourceUrl: "https://mistral.ai/pricing" },
  // ─── Cohere ────────────────────────────────────────────────────
  { id: "tp_cohere_command_rplus", vendorId: "cohere", vendorName: "Cohere", modelName: "Command R+", inputPerM: 2.5, outputPerM: 10, cachedInputPerM: null, note: "Enterprise API pricing; generation plus embeddings/rerank split by product.", sourceUrl: "https://cohere.com/pricing" },
  { id: "tp_cohere_command_a", vendorId: "cohere", vendorName: "Cohere", modelName: "Command A", inputPerM: 2.5, outputPerM: 10, cachedInputPerM: null, note: "Enterprise API pricing; generation plus embeddings/rerank split by product.", sourceUrl: "https://cohere.com/pricing" },
  { id: "tp_cohere_command_r", vendorId: "cohere", vendorName: "Cohere", modelName: "Command R", inputPerM: 0.15, outputPerM: 0.6, cachedInputPerM: null, note: "Enterprise API pricing; generation plus embeddings/rerank split by product.", sourceUrl: "https://cohere.com/pricing" },
  { id: "tp_cohere_command_r7b", vendorId: "cohere", vendorName: "Cohere", modelName: "Command R7B", inputPerM: 0.0375, outputPerM: 0.15, cachedInputPerM: null, note: "Enterprise API pricing; generation plus embeddings/rerank split by product.", sourceUrl: "https://cohere.com/pricing" },
  // ─── xAI ───────────────────────────────────────────────────────
  { id: "tp_xai_grok4", vendorId: "xai", vendorName: "xAI", modelName: "Grok 4", inputPerM: 3, outputPerM: 15, cachedInputPerM: null, note: "Enterprise API pricing; batch and fast variants may differ by route.", sourceUrl: "https://docs.x.ai/docs/models" },
  { id: "tp_xai_grok3", vendorId: "xai", vendorName: "xAI", modelName: "Grok 3", inputPerM: 3, outputPerM: 15, cachedInputPerM: null, note: "Enterprise API pricing; batch and fast variants may differ by route.", sourceUrl: "https://docs.x.ai/docs/models" },
  { id: "tp_xai_grok41_fast", vendorId: "xai", vendorName: "xAI", modelName: "Grok 4.1 Fast", inputPerM: 0.2, outputPerM: 0.5, cachedInputPerM: null, note: "Enterprise API pricing; batch and fast variants may differ by route.", sourceUrl: "https://docs.x.ai/docs/models" },
  // ─── Perplexity ────────────────────────────────────────────────
  { id: "tp_pplx_sonar", vendorId: "perplexity", vendorName: "Perplexity", modelName: "Sonar", inputPerM: 5, outputPerM: 25, cachedInputPerM: null, note: "Enterprise search-answer API pricing. Per-request/search fees apply on top.", sourceUrl: "https://docs.perplexity.ai/docs/pricing" },
  // ─── Meta ──────────────────────────────────────────────────────
  { id: "tp_meta_llama4_maverick", vendorId: "meta", vendorName: "Meta", modelName: "Llama 4 Maverick", inputPerM: 0.85, outputPerM: 0.27, cachedInputPerM: null, note: "Enterprise/hosted API pricing through providers.", sourceUrl: "https://llama.meta.com/" },
  { id: "tp_meta_llama4_scout", vendorId: "meta", vendorName: "Meta", modelName: "Llama 4 Scout", inputPerM: 0.34, outputPerM: 0.11, cachedInputPerM: null, note: "Enterprise/hosted API pricing through providers.", sourceUrl: "https://llama.meta.com/" },
  // ─── DeepSeek ──────────────────────────────────────────────────
  { id: "tp_deepseek_v32", vendorId: "deepseek", vendorName: "DeepSeek", modelName: "DeepSeek V3.2", inputPerM: 0.14, outputPerM: 0.28, cachedInputPerM: null, note: "Enterprise API pricing where published.", sourceUrl: "https://platform.deepseek.com/usage" },
  // ─── Alibaba Qwen ──────────────────────────────────────────────
  { id: "tp_qwen3_32b", vendorId: "alibaba", vendorName: "Alibaba Qwen", modelName: "Qwen3 32B", inputPerM: 0.59, outputPerM: 0.29, cachedInputPerM: null, note: "Enterprise API pricing where published.", sourceUrl: "https://www.alibabacloud.com/product/model-studio" },
  // ─── Unverified / no reliable source ──────────────────────────
  { id: "tp_nvidia_nemotron", vendorId: "nvidia", vendorName: "NVIDIA Nemotron", modelName: "Nemotron (family)", inputPerM: null, outputPerM: null, cachedInputPerM: null, note: "Pricing not verified from a reliable live enterprise source.", sourceUrl: "https://build.nvidia.com/explore/discover" },
  { id: "tp_zai_glm", vendorId: "zai", vendorName: "Z.ai / GLM", modelName: "GLM-4.5", inputPerM: null, outputPerM: null, cachedInputPerM: null, note: "Pricing not verified from a reliable live enterprise source.", sourceUrl: "https://bigmodel.cn" },
  { id: "tp_aleph_alpha", vendorId: "aleph_alpha", vendorName: "Aleph Alpha", modelName: "Luminous family", inputPerM: null, outputPerM: null, cachedInputPerM: null, note: "Pricing not verified from a reliable live enterprise source.", sourceUrl: "https://aleph-alpha.com" },
  { id: "tp_lighton", vendorId: "lighton", vendorName: "LightOn", modelName: "Reasoning family", inputPerM: null, outputPerM: null, cachedInputPerM: null, note: "Pricing not verified from a reliable live enterprise source.", sourceUrl: "https://lighton.ai" },
  { id: "tp_falcon", vendorId: "falcon", vendorName: "Falcon TI", modelName: "Falcon family", inputPerM: null, outputPerM: null, cachedInputPerM: null, note: "Pricing not verified from a reliable live enterprise source.", sourceUrl: "https://falconllm.tii.ae" },
  { id: "tp_baidu_ernie", vendorId: "baidu", vendorName: "Baidu ERNIE", modelName: "ERNIE family", inputPerM: null, outputPerM: null, cachedInputPerM: null, note: "Pricing not verified from a reliable live enterprise source.", sourceUrl: "https://qianfan.cloud.baidu.com" },
  { id: "tp_tencent", vendorId: "tencent", vendorName: "Tencent Hunyuan", modelName: "Hunyuan family", inputPerM: null, outputPerM: null, cachedInputPerM: null, note: "Pricing not verified from a reliable live enterprise source.", sourceUrl: "https://hunyuan.tencent.com" },
];

export const PRICING_VENDORS: string[] = Array.from(
  new Set(TOKEN_PRICING.map((p) => p.vendorName)),
);

export function pricingForVendorIds(vendorIds: string[]): TokenPrice[] {
  if (vendorIds.length === 0) return TOKEN_PRICING;
  const want = new Set(vendorIds.map((v) => v.replace(/^vendor_/, "")));
  return TOKEN_PRICING.filter((p) => want.has(p.vendorId));
}
