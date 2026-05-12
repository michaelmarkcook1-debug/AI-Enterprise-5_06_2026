/**
 * Commercial LLM Models seed inventory.
 *
 * Every record cites real official-source URLs (per prompt v2 source list).
 * Per the prompt rules:
 *   - dataStatus = "seed" until live API/docs verification flips it to "documented" (E2)
 *     or "verified" (E3+ with reachable model endpoint)
 *   - confidenceScore in [50,80] for seed records
 *   - lastVerifiedAt = null for seed records
 *   - hosted third-party records keep ownerVendorId pointing at the actual owner
 *     (Anthropic stays Anthropic on Bedrock; OpenAI stays OpenAI on Azure)
 *   - vendors with no confirmed first-party model are explicitly marked
 *     refresh-required or infrastructure-only — never invented
 *
 * NEVER add a model name, model id, or source URL that isn't in the prompt's
 * source list or directly linkable from it.
 */

import type { CommercialModel, CommercialModelSource } from "./types";

const NOW_ISO = "2026-05-10T00:00:00.000Z";

// ──────────────── Source registry (per prompt v2) ────────────────

export const SEED_MODEL_SOURCES: CommercialModelSource[] = [
  // OpenAI
  {
    id: "src_openai_models_docs",
    vendorId: "openai",
    sourceName: "OpenAI — Models documentation",
    sourceUrl: "https://platform.openai.com/docs/models",
    sourceType: "official_model_docs",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 70,
    freshnessStatus: "fresh",
    notes: "Canonical model list. Live API endpoint exists at /v1/models for E3 verification.",
  },
  {
    id: "src_openai_developers_api",
    vendorId: "openai",
    sourceName: "OpenAI — Developers API docs",
    sourceUrl: "https://developers.openai.com/api/docs/models",
    sourceType: "official_api_models_endpoint",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 72,
    freshnessStatus: "fresh",
    notes: "Developer-facing model documentation.",
  },
  // Anthropic
  {
    id: "src_anthropic_models_overview",
    vendorId: "anthropic",
    sourceName: "Anthropic — Claude Models overview",
    sourceUrl: "https://docs.anthropic.com/en/docs/about-claude/models/overview",
    sourceType: "official_model_docs",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 75,
    freshnessStatus: "fresh",
    notes: "Canonical Claude model family list.",
  },
  {
    id: "src_anthropic_models_list_api",
    vendorId: "anthropic",
    sourceName: "Anthropic — models-list API",
    sourceUrl: "https://docs.anthropic.com/en/api/models-list",
    sourceType: "official_api_models_endpoint",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 76,
    freshnessStatus: "fresh",
    notes: "Live model list endpoint enables E3 verification when reachable.",
  },
  // Google
  {
    id: "src_google_gemini_api_models",
    vendorId: "googl",
    sourceName: "Google AI — Gemini API model docs",
    sourceUrl: "https://ai.google.dev/gemini-api/docs/models",
    sourceType: "official_model_docs",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 74,
    freshnessStatus: "fresh",
    notes: "Gemini API model documentation.",
  },
  {
    id: "src_google_vertex_models",
    vendorId: "googl",
    sourceName: "Google Cloud — Vertex AI generative models",
    sourceUrl: "https://cloud.google.com/vertex-ai/generative-ai/docs/models",
    sourceType: "official_model_catalog",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 72,
    freshnessStatus: "fresh",
    notes: "Vertex catalog distinguishes first-party vs partner models.",
  },
  // Mistral
  {
    id: "src_mistral_models",
    vendorId: "mistral",
    sourceName: "Mistral AI — Models documentation",
    sourceUrl: "https://docs.mistral.ai/models",
    sourceType: "official_model_docs",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 70,
    freshnessStatus: "fresh",
    notes: "Mistral premier/open/labs/deprecated lifecycle.",
  },
  // Cohere
  {
    id: "src_cohere_models",
    vendorId: "cohere",
    sourceName: "Cohere — Models documentation",
    sourceUrl: "https://docs.cohere.com/docs/models",
    sourceType: "official_model_docs",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 70,
    freshnessStatus: "fresh",
    notes: "Command / Embed / Rerank / Aya families.",
  },
  // xAI
  {
    id: "src_xai_models",
    vendorId: "xai",
    sourceName: "xAI — Models documentation",
    sourceUrl: "https://docs.x.ai/docs/models",
    sourceType: "official_model_docs",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 65,
    freshnessStatus: "fresh",
    notes: "Grok model availability.",
  },
  // AWS Bedrock
  {
    id: "src_aws_bedrock_models",
    vendorId: "amzn",
    sourceName: "AWS — Bedrock supported foundation models",
    sourceUrl: "https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html",
    sourceType: "official_marketplace_docs",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 78,
    freshnessStatus: "fresh",
    notes: "Bedrock catalog. Hosted third-party models keep their original owner.",
  },
  // Microsoft / Azure AI Foundry
  {
    id: "src_azure_ai_foundry_models",
    vendorId: "msft",
    sourceName: "Azure AI Foundry — Models",
    sourceUrl: "https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/overview",
    sourceType: "official_marketplace_docs",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 76,
    freshnessStatus: "fresh",
    notes: "Foundry catalog includes Microsoft Phi/MAI plus partner models from OpenAI / Anthropic / Mistral / Cohere / Meta / xAI.",
  },
  {
    id: "src_azure_ai_foundry_partners",
    vendorId: "msft",
    sourceName: "Azure AI Foundry — Models from partners",
    sourceUrl: "https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/concepts/models-from-partners",
    sourceType: "official_marketplace_docs",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 76,
    freshnessStatus: "fresh",
    notes: "Distinguishes Microsoft-owned models from hosted partner models.",
  },
  // IBM
  {
    id: "src_ibm_watsonx_foundation_models",
    vendorId: "ibm",
    sourceName: "IBM — watsonx.ai foundation models",
    sourceUrl: "https://www.ibm.com/products/watsonx-ai/foundation-models",
    sourceType: "official_model_docs",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 70,
    freshnessStatus: "fresh",
    notes: "Granite families plus hosted third-party models.",
  },
  // Oracle
  {
    id: "src_oracle_genai_models",
    vendorId: "orcl",
    sourceName: "Oracle — OCI Generative AI pretrained models",
    sourceUrl: "https://docs.oracle.com/en-us/iaas/Content/generative-ai/pretrained-models.htm",
    sourceType: "official_marketplace_docs",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 70,
    freshnessStatus: "fresh",
    notes: "OCI hosts Cohere / Meta / Mistral / xAI; Oracle is host, not owner.",
  },
  // Salesforce
  {
    id: "src_salesforce_agentforce_models",
    vendorId: "crm",
    sourceName: "Salesforce — Agentforce supported models",
    sourceUrl: "https://developer.salesforce.com/docs/ai/agentforce/guide/supported-models.html",
    sourceType: "official_product_docs",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 70,
    freshnessStatus: "fresh",
    notes: "Salesforce orchestrates external providers via Einstein Trust Layer.",
  },
  // ServiceNow
  {
    id: "src_now_llm_docs",
    vendorId: "now",
    sourceName: "ServiceNow — Now LLM exploration",
    sourceUrl: "https://www.servicenow.com/docs/r/intelligent-experiences/servicenow-large-language-model-now-llm/exploring-large-language-models.html",
    sourceType: "official_product_docs",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 65,
    freshnessStatus: "fresh",
    notes: "Now LLM is a domain LLM; third-party LLMs accessed via Now LLM Service are hosted/orchestrated.",
  },
  // Writer
  {
    id: "src_writer_palmyra_models",
    vendorId: "writer",
    sourceName: "Writer — Palmyra models",
    sourceUrl: "https://dev.writer.com/home/models",
    sourceType: "official_model_docs",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 68,
    freshnessStatus: "fresh",
    notes: "Palmyra family.",
  },
  // Glean
  {
    id: "src_glean_llms",
    vendorId: "glean",
    sourceName: "Glean — LLM administration",
    sourceUrl: "https://docs.glean.com/administration/llms",
    sourceType: "official_product_docs",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 65,
    freshnessStatus: "fresh",
    notes: "Glean hosts/orchestrates external LLMs; retains original owner.",
  },
  // Harvey
  {
    id: "src_harvey_models",
    vendorId: "harvey",
    sourceName: "Harvey — supported AI models",
    sourceUrl: "https://help.harvey.ai/articles/what-ai-models-does-harvey-use",
    sourceType: "official_product_docs",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E2",
    confidenceScore: 60,
    freshnessStatus: "fresh",
    notes: "Harvey uses third-party models; Harvey is application/orchestration vendor.",
  },
  // Moveworks (not in our vendor list — included via lookup)
  // Perplexity
  {
    id: "src_perplexity_pending",
    vendorId: "perplexity",
    sourceName: "Perplexity — Sonar / Enterprise Pro docs (pending verification)",
    sourceUrl: "https://docs.perplexity.ai/",
    sourceType: "seed_placeholder",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E1",
    confidenceScore: 45,
    freshnessStatus: "unknown",
    notes: "Source list incomplete; Sonar API docs require verification before enabling models.",
  },
  // NVIDIA
  {
    id: "src_nvidia_pending",
    vendorId: "nvda",
    sourceName: "NVIDIA — NIM / Nemotron docs (verification required)",
    sourceUrl: "https://www.nvidia.com/en-us/ai-data-science/products/ai-enterprise/",
    sourceType: "seed_placeholder",
    capturedAt: NOW_ISO,
    sourceDate: "2026-05-10",
    evidenceGrade: "E1",
    confidenceScore: 50,
    freshnessStatus: "unknown",
    notes: "Nemotron model availability requires source-list refresh.",
  },
];

// ──────────────── Models ────────────────
//
// Helper to keep records consistent. All seed records use these defaults; any
// field can be overridden per-record.
function model(partial: Partial<CommercialModel> & {
  id: string;
  vendorId: string;
  vendorName: string;
  modelName: string;
  modelFamily: string;
  ownerVendorId: string;
  ownerVendorName: string;
  ownershipType: CommercialModel["ownershipType"];
  availabilityStage: CommercialModel["availabilityStage"];
  commercialAvailability: CommercialModel["commercialAvailability"];
  modelCategory: CommercialModel["modelCategory"];
  sourceIds: string[];
  sourceUrls: string[];
  sourceNames: string[];
}): CommercialModel {
  return {
    hostingVendorId: partial.ownerVendorId === partial.vendorId ? null : partial.vendorId,
    hostingVendorName: partial.ownerVendorId === partial.vendorId ? null : partial.vendorName,
    modelId: null,
    modality: ["text"],
    accessChannel: "api",
    contextWindow: null,
    inputModalities: ["text"],
    outputModalities: ["text"],
    toolSupport: [],
    pricingSummary: null,
    sourceDate: "2026-05-10",
    capturedAt: NOW_ISO,
    evidenceGrade: "E2",
    confidenceScore: 70,
    dataStatus: "seed",
    uncertaintyNote: "Seed record from official documentation URL. Live verification (API model-list endpoint) required to flip to verified.",
    lifecycleStatus:
      partial.availabilityStage === "ga" ? "active"
        : partial.availabilityStage === "preview" ? "preview"
        : partial.availabilityStage === "beta" ? "beta"
        : partial.availabilityStage === "deprecated" ? "deprecated"
        : partial.availabilityStage === "retired" ? "retired"
        : "unknown",
    deprecationDate: null,
    lastVerifiedAt: null,
    ...partial,
  } as CommercialModel;
}

export const SEED_MODELS: CommercialModel[] = [
  // ───────────── OpenAI (first-party) ─────────────
  model({
    id: "model_openai_gpt5",
    vendorId: "openai", vendorName: "OpenAI",
    ownerVendorId: "openai", ownerVendorName: "OpenAI",
    modelName: "GPT-5", modelFamily: "GPT", modelCategory: "multimodal",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    inputModalities: ["text", "image"], outputModalities: ["text"], toolSupport: ["function_calling"],
    sourceIds: ["src_openai_models_docs", "src_openai_developers_api"],
    sourceUrls: ["https://platform.openai.com/docs/models", "https://developers.openai.com/api/docs/models"],
    sourceNames: ["OpenAI — Models documentation", "OpenAI — Developers API docs"],
  }),
  model({
    id: "model_openai_o4",
    vendorId: "openai", vendorName: "OpenAI",
    ownerVendorId: "openai", ownerVendorName: "OpenAI",
    modelName: "o4 reasoning series", modelFamily: "o-series", modelCategory: "reasoning",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_openai_models_docs"],
    sourceUrls: ["https://platform.openai.com/docs/models"],
    sourceNames: ["OpenAI — Models documentation"],
    uncertaintyNote: "Reasoning-tier model family per official model docs. Variants and exact model IDs require live API verification.",
  }),

  // ───────────── Anthropic (first-party) ─────────────
  model({
    id: "model_anthropic_claude_opus_47",
    vendorId: "anthropic", vendorName: "Anthropic",
    ownerVendorId: "anthropic", ownerVendorName: "Anthropic",
    modelName: "Claude Opus 4.7", modelFamily: "Claude", modelCategory: "multimodal",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    inputModalities: ["text", "image"], outputModalities: ["text"], toolSupport: ["function_calling", "computer_use"],
    contextWindow: 1_000_000,
    sourceIds: ["src_anthropic_models_overview", "src_anthropic_models_list_api"],
    sourceUrls: ["https://docs.anthropic.com/en/docs/about-claude/models/overview", "https://docs.anthropic.com/en/api/models-list"],
    sourceNames: ["Anthropic — Claude Models overview", "Anthropic — models-list API"],
  }),
  model({
    id: "model_anthropic_claude_sonnet_47",
    vendorId: "anthropic", vendorName: "Anthropic",
    ownerVendorId: "anthropic", ownerVendorName: "Anthropic",
    modelName: "Claude Sonnet 4.7", modelFamily: "Claude", modelCategory: "llm_text",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_anthropic_models_overview"],
    sourceUrls: ["https://docs.anthropic.com/en/docs/about-claude/models/overview"],
    sourceNames: ["Anthropic — Claude Models overview"],
  }),
  model({
    id: "model_anthropic_claude_haiku",
    vendorId: "anthropic", vendorName: "Anthropic",
    ownerVendorId: "anthropic", ownerVendorName: "Anthropic",
    modelName: "Claude Haiku", modelFamily: "Claude", modelCategory: "llm_text",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_anthropic_models_overview"],
    sourceUrls: ["https://docs.anthropic.com/en/docs/about-claude/models/overview"],
    sourceNames: ["Anthropic — Claude Models overview"],
  }),

  // ───────────── Google (first-party) ─────────────
  model({
    id: "model_google_gemini_25_pro",
    vendorId: "googl", vendorName: "Alphabet",
    ownerVendorId: "googl", ownerVendorName: "Alphabet",
    modelName: "Gemini 2.5 Pro", modelFamily: "Gemini", modelCategory: "multimodal",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    inputModalities: ["text", "image", "audio", "video"], outputModalities: ["text"],
    sourceIds: ["src_google_gemini_api_models", "src_google_vertex_models"],
    sourceUrls: ["https://ai.google.dev/gemini-api/docs/models", "https://cloud.google.com/vertex-ai/generative-ai/docs/models"],
    sourceNames: ["Google AI — Gemini API model docs", "Google Cloud — Vertex AI generative models"],
  }),
  model({
    id: "model_google_gemini_25_flash",
    vendorId: "googl", vendorName: "Alphabet",
    ownerVendorId: "googl", ownerVendorName: "Alphabet",
    modelName: "Gemini 2.5 Flash", modelFamily: "Gemini", modelCategory: "multimodal",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_google_gemini_api_models"],
    sourceUrls: ["https://ai.google.dev/gemini-api/docs/models"],
    sourceNames: ["Google AI — Gemini API model docs"],
  }),
  model({
    id: "model_google_gemma3",
    vendorId: "googl", vendorName: "Alphabet",
    ownerVendorId: "googl", ownerVendorName: "Alphabet",
    modelName: "Gemma 3", modelFamily: "Gemma", modelCategory: "llm_text",
    ownershipType: "open_weight", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_google_gemini_api_models"],
    sourceUrls: ["https://ai.google.dev/gemini-api/docs/models"],
    sourceNames: ["Google AI — Gemini API model docs"],
    uncertaintyNote: "Open-weight family. Commercial use governed by Gemma terms; not a hosted commercial API in the same sense as Gemini.",
  }),

  // ───────────── Mistral (first-party) ─────────────
  model({
    id: "model_mistral_large",
    vendorId: "mistral", vendorName: "Mistral AI",
    ownerVendorId: "mistral", ownerVendorName: "Mistral AI",
    modelName: "Mistral Large", modelFamily: "Mistral premier", modelCategory: "llm_text",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_mistral_models"],
    sourceUrls: ["https://docs.mistral.ai/models"],
    sourceNames: ["Mistral AI — Models documentation"],
  }),
  model({
    id: "model_mistral_codestral",
    vendorId: "mistral", vendorName: "Mistral AI",
    ownerVendorId: "mistral", ownerVendorName: "Mistral AI",
    modelName: "Codestral", modelFamily: "Mistral coding", modelCategory: "coding",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_mistral_models"],
    sourceUrls: ["https://docs.mistral.ai/models"],
    sourceNames: ["Mistral AI — Models documentation"],
  }),

  // ───────────── Cohere (first-party) ─────────────
  model({
    id: "model_cohere_command_r_plus",
    vendorId: "cohere", vendorName: "Cohere",
    ownerVendorId: "cohere", ownerVendorName: "Cohere",
    modelName: "Command R+", modelFamily: "Command", modelCategory: "llm_text",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_cohere_models"],
    sourceUrls: ["https://docs.cohere.com/docs/models"],
    sourceNames: ["Cohere — Models documentation"],
  }),
  model({
    id: "model_cohere_embed",
    vendorId: "cohere", vendorName: "Cohere",
    ownerVendorId: "cohere", ownerVendorName: "Cohere",
    modelName: "Embed", modelFamily: "Embed", modelCategory: "embedding",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_cohere_models"],
    sourceUrls: ["https://docs.cohere.com/docs/models"],
    sourceNames: ["Cohere — Models documentation"],
  }),
  model({
    id: "model_cohere_rerank",
    vendorId: "cohere", vendorName: "Cohere",
    ownerVendorId: "cohere", ownerVendorName: "Cohere",
    modelName: "Rerank", modelFamily: "Rerank", modelCategory: "reranking",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_cohere_models"],
    sourceUrls: ["https://docs.cohere.com/docs/models"],
    sourceNames: ["Cohere — Models documentation"],
  }),

  // ───────────── xAI (first-party) ─────────────
  model({
    id: "model_xai_grok",
    vendorId: "xai", vendorName: "xAI",
    ownerVendorId: "xai", ownerVendorName: "xAI",
    modelName: "Grok", modelFamily: "Grok", modelCategory: "llm_text",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_xai_models"],
    sourceUrls: ["https://docs.x.ai/docs/models"],
    sourceNames: ["xAI — Models documentation"],
    uncertaintyNote: "Specific Grok variants and IDs require live xAI API verification.",
  }),

  // ───────────── AWS (first-party Nova/Titan + hosted third-party) ─────────────
  model({
    id: "model_amzn_nova",
    vendorId: "amzn", vendorName: "Amazon",
    ownerVendorId: "amzn", ownerVendorName: "Amazon",
    modelName: "Amazon Nova", modelFamily: "Nova", modelCategory: "multimodal",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_aws_bedrock_models"],
    sourceUrls: ["https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html"],
    sourceNames: ["AWS — Bedrock supported foundation models"],
  }),
  model({
    id: "model_amzn_titan",
    vendorId: "amzn", vendorName: "Amazon",
    ownerVendorId: "amzn", ownerVendorName: "Amazon",
    modelName: "Amazon Titan", modelFamily: "Titan", modelCategory: "embedding",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_aws_bedrock_models"],
    sourceUrls: ["https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html"],
    sourceNames: ["AWS — Bedrock supported foundation models"],
  }),
  // Hosted third-party on Bedrock — owner stays original
  model({
    id: "model_bedrock_anthropic_claude",
    vendorId: "amzn", vendorName: "Amazon",
    ownerVendorId: "anthropic", ownerVendorName: "Anthropic",
    modelName: "Claude (hosted on Bedrock)", modelFamily: "Claude", modelCategory: "multimodal",
    ownershipType: "hosted_third_party", availabilityStage: "ga",
    commercialAvailability: "hosted_on_marketplace",
    sourceIds: ["src_aws_bedrock_models"],
    sourceUrls: ["https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html"],
    sourceNames: ["AWS — Bedrock supported foundation models"],
  }),
  model({
    id: "model_bedrock_meta_llama",
    vendorId: "amzn", vendorName: "Amazon",
    ownerVendorId: "meta", ownerVendorName: "Meta",
    modelName: "Llama (hosted on Bedrock)", modelFamily: "Llama", modelCategory: "llm_text",
    ownershipType: "hosted_third_party", availabilityStage: "ga",
    commercialAvailability: "hosted_on_marketplace",
    sourceIds: ["src_aws_bedrock_models"],
    sourceUrls: ["https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html"],
    sourceNames: ["AWS — Bedrock supported foundation models"],
  }),
  model({
    id: "model_bedrock_mistral",
    vendorId: "amzn", vendorName: "Amazon",
    ownerVendorId: "mistral", ownerVendorName: "Mistral AI",
    modelName: "Mistral (hosted on Bedrock)", modelFamily: "Mistral", modelCategory: "llm_text",
    ownershipType: "hosted_third_party", availabilityStage: "ga",
    commercialAvailability: "hosted_on_marketplace",
    sourceIds: ["src_aws_bedrock_models"],
    sourceUrls: ["https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html"],
    sourceNames: ["AWS — Bedrock supported foundation models"],
  }),
  model({
    id: "model_bedrock_cohere",
    vendorId: "amzn", vendorName: "Amazon",
    ownerVendorId: "cohere", ownerVendorName: "Cohere",
    modelName: "Cohere Command (hosted on Bedrock)", modelFamily: "Command", modelCategory: "llm_text",
    ownershipType: "hosted_third_party", availabilityStage: "ga",
    commercialAvailability: "hosted_on_marketplace",
    sourceIds: ["src_aws_bedrock_models"],
    sourceUrls: ["https://docs.aws.amazon.com/bedrock/latest/userguide/models-supported.html"],
    sourceNames: ["AWS — Bedrock supported foundation models"],
  }),

  // ───────────── Microsoft (first-party Phi/MAI/Copilot + hosted third-party) ─────────────
  model({
    id: "model_msft_phi",
    vendorId: "msft", vendorName: "Microsoft",
    ownerVendorId: "msft", ownerVendorName: "Microsoft",
    modelName: "Phi", modelFamily: "Phi", modelCategory: "llm_text",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_azure_ai_foundry_models"],
    sourceUrls: ["https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/overview"],
    sourceNames: ["Azure AI Foundry — Models"],
  }),
  // Microsoft AI Internal models (MAI series) — Microsoft's first-party
  // frontier models developed internally, sitting alongside the OpenAI
  // partnership in Foundry.
  model({
    id: "model_msft_mai",
    vendorId: "msft", vendorName: "Microsoft",
    ownerVendorId: "msft", ownerVendorName: "Microsoft",
    modelName: "MAI (Microsoft AI)", modelFamily: "MAI", modelCategory: "multimodal",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_azure_ai_foundry_models"],
    sourceUrls: ["https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/overview"],
    sourceNames: ["Azure AI Foundry — Models"],
  }),
  // Copilot product family — Microsoft's first-party assistant brand,
  // packaged across M365, GitHub, Dynamics, Security, and Sales/Service.
  // Each variant is a first-party Microsoft product even though the
  // underlying LLM is OpenAI GPT served via Azure AI Foundry.
  model({
    id: "model_msft_copilot_m365",
    vendorId: "msft", vendorName: "Microsoft",
    ownerVendorId: "msft", ownerVendorName: "Microsoft",
    modelName: "Microsoft 365 Copilot", modelFamily: "Copilot", modelCategory: "llm_text",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_azure_ai_foundry_models"],
    sourceUrls: ["https://www.microsoft.com/en-us/microsoft-365/copilot"],
    sourceNames: ["Microsoft 365 Copilot — official product page"],
  }),
  model({
    id: "model_msft_copilot_github",
    vendorId: "msft", vendorName: "Microsoft",
    ownerVendorId: "msft", ownerVendorName: "Microsoft",
    modelName: "GitHub Copilot", modelFamily: "Copilot", modelCategory: "coding",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_azure_ai_foundry_models"],
    sourceUrls: ["https://github.com/features/copilot"],
    sourceNames: ["GitHub Copilot — official product page"],
  }),
  model({
    id: "model_msft_copilot_studio",
    vendorId: "msft", vendorName: "Microsoft",
    ownerVendorId: "msft", ownerVendorName: "Microsoft",
    modelName: "Copilot Studio", modelFamily: "Copilot", modelCategory: "llm_text",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_azure_ai_foundry_models"],
    sourceUrls: ["https://www.microsoft.com/en-us/microsoft-copilot/microsoft-copilot-studio"],
    sourceNames: ["Microsoft Copilot Studio — official product page"],
  }),
  model({
    id: "model_msft_copilot_dynamics",
    vendorId: "msft", vendorName: "Microsoft",
    ownerVendorId: "msft", ownerVendorName: "Microsoft",
    modelName: "Dynamics 365 Copilot", modelFamily: "Copilot", modelCategory: "llm_text",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_azure_ai_foundry_models"],
    sourceUrls: ["https://www.microsoft.com/en-us/dynamics-365/solutions/ai"],
    sourceNames: ["Dynamics 365 Copilot — official product page"],
  }),
  model({
    id: "model_msft_copilot_security",
    vendorId: "msft", vendorName: "Microsoft",
    ownerVendorId: "msft", ownerVendorName: "Microsoft",
    modelName: "Microsoft Security Copilot", modelFamily: "Copilot", modelCategory: "llm_text",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_azure_ai_foundry_models"],
    sourceUrls: ["https://www.microsoft.com/en-us/security/business/ai-machine-learning/microsoft-security-copilot"],
    sourceNames: ["Microsoft Security Copilot — official product page"],
  }),
  // Hosted on Azure AI Foundry — owner stays original
  model({
    id: "model_azure_openai_gpt",
    vendorId: "msft", vendorName: "Microsoft",
    ownerVendorId: "openai", ownerVendorName: "OpenAI",
    modelName: "OpenAI GPT (Azure AI Foundry)", modelFamily: "GPT", modelCategory: "multimodal",
    ownershipType: "hosted_third_party", availabilityStage: "ga",
    commercialAvailability: "hosted_on_marketplace",
    sourceIds: ["src_azure_ai_foundry_models", "src_azure_ai_foundry_partners"],
    sourceUrls: ["https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/overview", "https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/concepts/models-from-partners"],
    sourceNames: ["Azure AI Foundry — Models", "Azure AI Foundry — Models from partners"],
  }),
  model({
    id: "model_azure_anthropic_claude",
    vendorId: "msft", vendorName: "Microsoft",
    ownerVendorId: "anthropic", ownerVendorName: "Anthropic",
    modelName: "Claude (Azure AI Foundry)", modelFamily: "Claude", modelCategory: "multimodal",
    ownershipType: "hosted_third_party", availabilityStage: "ga",
    commercialAvailability: "hosted_on_marketplace",
    sourceIds: ["src_azure_ai_foundry_partners"],
    sourceUrls: ["https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/concepts/models-from-partners"],
    sourceNames: ["Azure AI Foundry — Models from partners"],
  }),
  model({
    id: "model_azure_mistral",
    vendorId: "msft", vendorName: "Microsoft",
    ownerVendorId: "mistral", ownerVendorName: "Mistral AI",
    modelName: "Mistral (Azure AI Foundry)", modelFamily: "Mistral", modelCategory: "llm_text",
    ownershipType: "hosted_third_party", availabilityStage: "ga",
    commercialAvailability: "hosted_on_marketplace",
    sourceIds: ["src_azure_ai_foundry_partners"],
    sourceUrls: ["https://learn.microsoft.com/en-us/azure/ai-foundry/foundry-models/concepts/models-from-partners"],
    sourceNames: ["Azure AI Foundry — Models from partners"],
  }),

  // ───────────── IBM (Granite first-party) ─────────────
  model({
    id: "model_ibm_granite",
    vendorId: "ibm", vendorName: "IBM",
    ownerVendorId: "ibm", ownerVendorName: "IBM",
    modelName: "Granite", modelFamily: "Granite", modelCategory: "llm_text",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_ibm_watsonx_foundation_models"],
    sourceUrls: ["https://www.ibm.com/products/watsonx-ai/foundation-models"],
    sourceNames: ["IBM — watsonx.ai foundation models"],
  }),
  model({
    id: "model_ibm_granite_code",
    vendorId: "ibm", vendorName: "IBM",
    ownerVendorId: "ibm", ownerVendorName: "IBM",
    modelName: "Granite Code", modelFamily: "Granite", modelCategory: "coding",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_ibm_watsonx_foundation_models"],
    sourceUrls: ["https://www.ibm.com/products/watsonx-ai/foundation-models"],
    sourceNames: ["IBM — watsonx.ai foundation models"],
  }),
  model({
    id: "model_ibm_granite_guardian",
    vendorId: "ibm", vendorName: "IBM",
    ownerVendorId: "ibm", ownerVendorName: "IBM",
    modelName: "Granite Guardian", modelFamily: "Granite", modelCategory: "guardrail_safety",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_ibm_watsonx_foundation_models"],
    sourceUrls: ["https://www.ibm.com/products/watsonx-ai/foundation-models"],
    sourceNames: ["IBM — watsonx.ai foundation models"],
  }),

  // ───────────── Oracle (host only — third-party) ─────────────
  model({
    id: "model_oci_cohere",
    vendorId: "orcl", vendorName: "Oracle",
    ownerVendorId: "cohere", ownerVendorName: "Cohere",
    modelName: "Cohere (hosted on OCI)", modelFamily: "Command", modelCategory: "llm_text",
    ownershipType: "hosted_third_party", availabilityStage: "ga",
    commercialAvailability: "hosted_on_marketplace",
    sourceIds: ["src_oracle_genai_models"],
    sourceUrls: ["https://docs.oracle.com/en-us/iaas/Content/generative-ai/pretrained-models.htm"],
    sourceNames: ["Oracle — OCI Generative AI pretrained models"],
  }),
  model({
    id: "model_oci_meta",
    vendorId: "orcl", vendorName: "Oracle",
    ownerVendorId: "meta", ownerVendorName: "Meta",
    modelName: "Llama (hosted on OCI)", modelFamily: "Llama", modelCategory: "llm_text",
    ownershipType: "hosted_third_party", availabilityStage: "ga",
    commercialAvailability: "hosted_on_marketplace",
    sourceIds: ["src_oracle_genai_models"],
    sourceUrls: ["https://docs.oracle.com/en-us/iaas/Content/generative-ai/pretrained-models.htm"],
    sourceNames: ["Oracle — OCI Generative AI pretrained models"],
  }),

  // ───────────── Salesforce (orchestration / Default model) ─────────────
  model({
    id: "model_crm_default_orchestration",
    vendorId: "crm", vendorName: "Salesforce",
    ownerVendorId: "crm", ownerVendorName: "Salesforce",
    modelName: "Salesforce Default model (Einstein Trust Layer)", modelFamily: "Agentforce", modelCategory: "domain_specific",
    ownershipType: "underlying_product_model", availabilityStage: "ga",
    commercialAvailability: "underlying_product_model",
    sourceIds: ["src_salesforce_agentforce_models"],
    sourceUrls: ["https://developer.salesforce.com/docs/ai/agentforce/guide/supported-models.html"],
    sourceNames: ["Salesforce — Agentforce supported models"],
    uncertaintyNote: "Salesforce orchestrates external providers; Default model used inside Agentforce is not customer-selectable as a standalone API.",
  }),
  model({
    id: "model_crm_hosted_external",
    vendorId: "crm", vendorName: "Salesforce",
    ownerVendorId: "openai", ownerVendorName: "OpenAI",
    modelName: "Supported provider models (OpenAI, Anthropic, Google)", modelFamily: "Multi-provider", modelCategory: "llm_text",
    ownershipType: "hosted_third_party", availabilityStage: "ga",
    commercialAvailability: "hosted_on_marketplace",
    sourceIds: ["src_salesforce_agentforce_models"],
    sourceUrls: ["https://developer.salesforce.com/docs/ai/agentforce/guide/supported-models.html"],
    sourceNames: ["Salesforce — Agentforce supported models"],
    uncertaintyNote: "Multiple providers supported. Source confirms list; ownership remains with each underlying provider.",
  }),

  // ───────────── ServiceNow (Now LLM domain + hosted) ─────────────
  model({
    id: "model_now_llm",
    vendorId: "now", vendorName: "ServiceNow",
    ownerVendorId: "now", ownerVendorName: "ServiceNow",
    modelName: "Now LLM", modelFamily: "Now LLM", modelCategory: "domain_specific",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "underlying_product_model",
    sourceIds: ["src_now_llm_docs"],
    sourceUrls: ["https://www.servicenow.com/docs/r/intelligent-experiences/servicenow-large-language-model-now-llm/exploring-large-language-models.html"],
    sourceNames: ["ServiceNow — Now LLM exploration"],
    uncertaintyNote: "ServiceNow domain LLM. Not customer-selectable as a general API.",
  }),
  model({
    id: "model_now_llm_service_hosted",
    vendorId: "now", vendorName: "ServiceNow",
    ownerVendorId: "openai", ownerVendorName: "OpenAI",
    modelName: "Third-party LLMs via Now LLM Service", modelFamily: "Multi-provider", modelCategory: "llm_text",
    ownershipType: "hosted_third_party", availabilityStage: "ga",
    commercialAvailability: "hosted_on_marketplace",
    sourceIds: ["src_now_llm_docs"],
    sourceUrls: ["https://www.servicenow.com/docs/r/intelligent-experiences/servicenow-large-language-model-now-llm/exploring-large-language-models.html"],
    sourceNames: ["ServiceNow — Now LLM exploration"],
    uncertaintyNote: "Now LLM Service brokers third-party LLMs; ownership remains with each provider.",
  }),

  // ───────────── Writer (Palmyra first-party) ─────────────
  model({
    id: "model_writer_palmyra_x5",
    vendorId: "writer", vendorName: "Writer",
    ownerVendorId: "writer", ownerVendorName: "Writer",
    modelName: "Palmyra X5", modelFamily: "Palmyra", modelCategory: "llm_text",
    ownershipType: "first_party", availabilityStage: "ga",
    commercialAvailability: "api_available",
    sourceIds: ["src_writer_palmyra_models"],
    sourceUrls: ["https://dev.writer.com/home/models"],
    sourceNames: ["Writer — Palmyra models"],
  }),

  // ───────────── Glean (orchestration) ─────────────
  model({
    id: "model_glean_hosted",
    vendorId: "glean", vendorName: "Glean",
    ownerVendorId: "openai", ownerVendorName: "OpenAI",
    modelName: "Configured LLMs (OpenAI, Google, Anthropic, AWS, Meta)", modelFamily: "Multi-provider", modelCategory: "llm_text",
    ownershipType: "hosted_third_party", availabilityStage: "ga",
    commercialAvailability: "hosted_on_marketplace",
    sourceIds: ["src_glean_llms"],
    sourceUrls: ["https://docs.glean.com/administration/llms"],
    sourceNames: ["Glean — LLM administration"],
    uncertaintyNote: "Glean is a model hub; supported LLMs remain owned by their original providers.",
  }),

  // ───────────── Harvey (orchestration) ─────────────
  model({
    id: "model_harvey_used",
    vendorId: "harvey", vendorName: "Harvey",
    ownerVendorId: "anthropic", ownerVendorName: "Anthropic",
    modelName: "Models used by Harvey (Anthropic, OpenAI, Google)", modelFamily: "Multi-provider", modelCategory: "llm_text",
    ownershipType: "hosted_third_party", availabilityStage: "ga",
    commercialAvailability: "hosted_on_marketplace",
    sourceIds: ["src_harvey_models"],
    sourceUrls: ["https://help.harvey.ai/articles/what-ai-models-does-harvey-use"],
    sourceNames: ["Harvey — supported AI models"],
    uncertaintyNote: "Harvey is an application/orchestration vendor; models remain owned by their original providers.",
  }),

  // ───────────── Perplexity (refresh required) ─────────────
  model({
    id: "model_perplexity_refresh",
    vendorId: "perplexity", vendorName: "Perplexity",
    ownerVendorId: "perplexity", ownerVendorName: "Perplexity",
    modelName: "Sonar (verification required)", modelFamily: "Sonar", modelCategory: "unknown",
    ownershipType: "unknown", availabilityStage: "unknown",
    commercialAvailability: "unknown",
    sourceIds: ["src_perplexity_pending"],
    sourceUrls: ["https://docs.perplexity.ai/"],
    sourceNames: ["Perplexity — Sonar / Enterprise Pro docs (pending verification)"],
    evidenceGrade: "E1", confidenceScore: 45, dataStatus: "unknown",
    uncertaintyNote: "Perplexity Sonar API model inventory requires source-list refresh before commercial-availability claims can be made.",
  }),

  // ───────────── NVIDIA (refresh required) ─────────────
  model({
    id: "model_nvidia_refresh",
    vendorId: "nvda", vendorName: "Nvidia",
    ownerVendorId: "nvda", ownerVendorName: "Nvidia",
    modelName: "Nemotron / NIM (verification required)", modelFamily: "Nemotron", modelCategory: "unknown",
    ownershipType: "unknown", availabilityStage: "unknown",
    commercialAvailability: "unknown",
    sourceIds: ["src_nvidia_pending"],
    sourceUrls: ["https://www.nvidia.com/en-us/ai-data-science/products/ai-enterprise/"],
    sourceNames: ["NVIDIA — NIM / Nemotron docs (verification required)"],
    evidenceGrade: "E1", confidenceScore: 50, dataStatus: "unknown",
    uncertaintyNote: "Nemotron and NIM model availability requires official-source refresh.",
  }),

  // ───────────── Deprecated example (truthfulness gate test) ─────────────
  model({
    id: "model_anthropic_claude2_deprecated",
    vendorId: "anthropic", vendorName: "Anthropic",
    ownerVendorId: "anthropic", ownerVendorName: "Anthropic",
    modelName: "Claude 2", modelFamily: "Claude", modelCategory: "llm_text",
    ownershipType: "first_party", availabilityStage: "deprecated",
    commercialAvailability: "not_commercially_available",
    sourceIds: ["src_anthropic_models_overview"],
    sourceUrls: ["https://docs.anthropic.com/en/docs/about-claude/models/overview"],
    sourceNames: ["Anthropic — Claude Models overview"],
    deprecationDate: "2025-07-21",
  }),
];

/**
 * Vendors in our universe with no first-party commercial LLM and no third-party
 * hosted via their platform. They appear in the dashboard with an
 * "infrastructure-only" or "refresh required" badge — never invented entries.
 */
export const INFRASTRUCTURE_ONLY_VENDOR_IDS = ["amd", "avgo", "asml", "arm", "snow", "sap", "databricks", "cerebras", "hebbia", "rogo"];
