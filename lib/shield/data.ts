// lib/shield/data.ts — The Privacy & IP Shield ledger (the buyer-weighted Trust Rank).
// Ported verbatim from The Desk (lib/shield-data.ts, 2026-07-17). Marks unchanged:
// re-deriving them here would mean re-asserting legal facts about real vendors'
// terms without re-reading the documents, which is exactly what we don't do.
// ─────────────────────────────────────────────────────────────────────────────
// CURATED, CITED REFERENCE DATA. Every mark below was verified against the
// vendor's own published document on the date stamped. Rules:
//   • protective  — a protective fact, verified in the vendor's own words
//   • conditional — protection exists but is gated (approval, mitigations, tier)
//   • adverse     — a verified fact that works against the customer
//   • unverified  — we could not verify a receipt yet → shown "—", scores 0.
// We grade the ENTERPRISE / PAID tier (the buyer's real context) and note
// free-tier caveats in the mark. Nothing is inferred beyond the quoted document.
// Deep-fill pass 2026-07-14 closed most gaps. SIX marks remain unverified and
// render "—": xAI indemnity + residency, IBM retention + residency, Alibaba
// indemnity, Reka retention. An unverified mark is an honest gap in OUR receipts,
// never a verdict on the vendor — but it scores 0, so the rank under-claims
// rather than over-claims. shieldCoverage() reports the gap count separately, so
// a low score built from adverse facts never reads as one built from absences.
//
// SCOPE IN THIS APP: model providers only — 13 of these 14 map to a tracked
// vendor (Reka does not). The other 37 vendors we rank are NOT weak on privacy;
// the Shield simply does not apply to them. Render them "not applicable", never
// a low score. Cloud resellers of these models (Azure OpenAI, Bedrock) are
// governed by the lab's terms and belong in the dependency map, not here.
//
// STALENESS: vendor terms change under us. Every mark is stamped with the date
// it was read; treat SHIELD_VERSION as a verified-as-of, not a standing truth.
//
// PROVENANCE CLASS: curated cited reference — the same class as the dependency
// graph, and it must carry the same label. It is NOT live-DB analyst-verified
// evidence, and must never be dressed as such or fed into a vendor's composite.

export const SHIELD_VERSION = "2026-07-14b";

export type MarkState = "protective" | "conditional" | "adverse" | "unverified";

export interface Mark {
  state: MarkState;
  note: string;
  source?: { name: string; url: string };
}

export interface VendorShield {
  vendor: string;
  slug: string;
  kind: "hosted-api" | "open-weights";
  marks: {
    training: Mark;
    retention: Mark;
    indemnity: Mark;
    residency: Mark;
  };
}

const V = "verified 2026-07-14";

// SCOPE: model providers only — the labs whose own terms govern your IP. Cloud
// hosts that merely resell these models (Azure OpenAI, AWS Bedrock) live in the
// dependency Map, not here.
export const SHIELD: VendorShield[] = [
  {
    vendor: "OpenAI (API)",
    slug: "openai-api",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "“Data sent to the OpenAI API is not used to train or improve OpenAI models (unless you explicitly opt in).”",
        source: { name: `OpenAI · API data controls (${V})`, url: "https://developers.openai.com/api/docs/guides/your-data" },
      },
      retention: {
        state: "protective",
        note: "Abuse logs retained ≤30 days “unless longer retention is required by law”; Zero Data Retention offered for eligible customers.",
        source: { name: `OpenAI · API data controls (${V})`, url: "https://developers.openai.com/api/docs/guides/your-data" },
      },
      indemnity: {
        state: "conditional",
        note: "Copyright Shield: OpenAI “can defend our customers and pay the costs … around copyright infringement … both to ChatGPT Enterprise and the API” — paid tiers only, with carve-outs and a cap (~prior-12-months' fees). OpenAI's own business-terms page is 403 to us, so this is via Proskauer's legal analysis.",
        source: { name: `Proskauer · analysis of OpenAI Copyright Shield (${V})`, url: "https://www.proskauer.com/blog/openais-copyright-shield-broadens-user-ip-indemnities-for-ai-created-content" },
      },
      residency: {
        state: "protective",
        note: "Regional storage incl. Europe/EEA, UK, Japan, Australia, Canada, India, Singapore, South Korea, UAE (some options approval-gated).",
        source: { name: `OpenAI · API data controls (${V})`, url: "https://developers.openai.com/api/docs/guides/your-data" },
      },
    },
  },
  {
    vendor: "Anthropic (API)",
    slug: "anthropic-api",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "“Anthropic may not train models on Customer Content from Services.” (Commercial Terms §B)",
        source: { name: `Anthropic · Commercial Terms (${V})`, url: "https://www.anthropic.com/legal/commercial-terms" },
      },
      retention: {
        state: "protective",
        note: "“Conversation content (your prompts and Claude's outputs) is not retained by default”; Zero Data Retention (on request) stores nothing at rest after the response. (Flagged/legal-hold content may be kept up to 2 years.)",
        source: { name: `Anthropic · API & data retention (${V})`, url: "https://platform.claude.com/docs/en/manage-claude/api-and-data-retention" },
      },
      indemnity: {
        state: "protective",
        note: "“Anthropic will defend Customer … alleging that Customer's paid use of the Services … or Outputs … violates any third-party intellectual property right.” (carve-outs in §K.3).",
        source: { name: `Anthropic · Commercial Terms (${V})`, url: "https://www.anthropic.com/legal/commercial-terms" },
      },
      residency: {
        state: "protective",
        note: "The Claude API offers a data-residency control (the `inference_geo` parameter on /v1/messages) — you pin where inference runs; ZDR- and HIPAA-eligible.",
        source: { name: `Anthropic · API data residency (${V})`, url: "https://platform.claude.com/docs/en/manage-claude/data-residency" },
      },
    },
  },
  {
    vendor: "Google (Gemini)",
    slug: "google-gemini",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "Paid Gemini for Google Cloud / Vertex: “Gemini doesn't use your prompts or its responses as data to train its models.” (The FREE consumer tier does train.)",
        source: { name: `Google · Gemini data governance (${V})`, url: "https://docs.cloud.google.com/gemini/docs/discover/data-governance" },
      },
      retention: {
        state: "conditional",
        note: "Paid logs “retained for limited periods” for security & policy enforcement; a default caching window can be disabled. No customer-set zero-retention verified this pass.",
        source: { name: `Google · Gemini API terms (${V})`, url: "https://ai.google.dev/gemini-api/terms" },
      },
      indemnity: {
        state: "protective",
        note: "“Our indemnity obligations now also apply to allegations that generated output infringes a third party's intellectual property rights … including copyright” — conditioned on responsible-AI practices, on GA models.",
        source: { name: `Google Cloud · GenAI indemnification (${V})`, url: "https://cloud.google.com/blog/products/ai-machine-learning/protecting-customers-with-generative-ai-indemnification" },
      },
      residency: {
        state: "protective",
        note: "“We commit to storing customer data in customer-selected locations …”; “Customers control where and how data and models are stored … preventing deployments outside specified geographic boundaries.” Regions incl. US, Canada, NL, FR, UK, DE, BE, Japan, Singapore, Korea.",
        source: { name: `Google Cloud · GenAI data-residency guarantees (${V})`, url: "https://cloud.google.com/blog/products/ai-machine-learning/google-cloud-generative-ai-data-residency-guarantees-for-data-stored-at-rest" },
      },
    },
  },
  {
    vendor: "Mistral (La Plateforme)",
    slug: "mistral-la-plateforme",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "Paid: “Mistral AI will not use Customer Data or Outputs to train its … models” except free/Vibe tiers where you haven't opted out (Commercial Terms §4.2). Free tier trains by default.",
        source: { name: `Mistral · Commercial Terms (${V})`, url: "https://legal.mistral.ai/terms/commercial-terms-of-service" },
      },
      retention: {
        state: "conditional",
        note: "Default 30-day retention, deleted after; Zero Data Retention exists but only on the Scale plan / stateless endpoints (not Vibe/Chat/agents).",
        source: { name: `Mistral · DPA (${V})`, url: "https://legal.mistral.ai/terms/data-processing-addendum" },
      },
      indemnity: {
        state: "conditional",
        note: "Indemnity covers the Products' IP (§8.1) — model Outputs are not expressly indemnified, and a carve-out excludes modified Outputs (§8.2b).",
        source: { name: `Mistral · Commercial Terms (${V})`, url: "https://legal.mistral.ai/terms/commercial-terms-of-service" },
      },
      residency: {
        state: "protective",
        note: "“By default, your data is hosted in the European Union.” (A US endpoint is available by explicit opt-in.)",
        source: { name: `Mistral · Help Center · data storage (${V})`, url: "https://help.mistral.ai/en/articles/347629" },
      },
    },
  },
  {
    vendor: "Meta (Llama, self-hosted)",
    slug: "meta-llama",
    kind: "open-weights",
    marks: {
      training: {
        state: "protective",
        note: "Structural: the open-weight license grants use/reproduce/modify — self-hosted prompts never transit Meta at all, so provider-side training is impossible by construction.",
        source: { name: `Llama 4 Community License (${V})`, url: "https://raw.githubusercontent.com/meta-llama/llama-models/main/models/llama4/LICENSE" },
      },
      retention: {
        state: "protective",
        note: "Structural: you host it, so there is nothing for Meta to retain — zero-retention by construction.",
        source: { name: `Llama 4 Community License (${V})`, url: "https://raw.githubusercontent.com/meta-llama/llama-models/main/models/llama4/LICENSE" },
      },
      indemnity: {
        state: "adverse",
        note: "“AS IS … WITHOUT WARRANTIES OF ANY KIND” incl. non-infringement, and the licensee indemnifies META — the reverse of a vendor IP shield.",
        source: { name: `Llama 4 Community License (${V})`, url: "https://raw.githubusercontent.com/meta-llama/llama-models/main/models/llama4/LICENSE" },
      },
      residency: {
        state: "protective",
        note: "Structural: runs wherever you run it — you alone choose the region (license gate: >700M MAU products need a separate Meta licence).",
        source: { name: `Llama 4 Community License (${V})`, url: "https://raw.githubusercontent.com/meta-llama/llama-models/main/models/llama4/LICENSE" },
      },
    },
  },
  {
    vendor: "DeepSeek",
    slug: "deepseek",
    kind: "hosted-api",
    marks: {
      training: {
        state: "adverse",
        note: "Trains by default: input used “to train and improve our technology, such as our machine learning models.” An opt-out exists, but training is the default.",
        source: { name: `DeepSeek · Privacy Policy (${V})`, url: "https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html" },
      },
      retention: {
        state: "adverse",
        note: "“We retain Personal Data for as long as necessary…” — no fixed window, no zero-retention control.",
        source: { name: `DeepSeek · Privacy Policy (${V})`, url: "https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html" },
      },
      indemnity: {
        state: "adverse",
        // Re-verified 2026-07-17 against the governing document. The prior mark cited
        // the Privacy Policy — the wrong instrument for indemnity, which lives in the
        // platform terms. Verdict unchanged, but the receipt now resolves and the note
        // states what the terms actually do, which is stronger than "none offered":
        // the indemnity runs the OTHER way, and non-infringement is expressly disclaimed.
        note: "Reverse indemnity — the customer indemnifies the vendor: “You agree to indemnify, defend, and hold us and our affiliates and licensors (if any) harmless against any liabilities, damages, and costs” (§7.7). DeepSeek expressly does NOT warrant that any Output will be “accurate, up-to-date, reliable, non-infringing or secure” (§7.4(3); Services are “AS IS”). Output rights are assigned to you (“any rights, title, and interests—if any”, §4.2(2)) — so you own the output and carry its IP risk alone.",
        source: {
          name: "DeepSeek · Open Platform Terms of Service, eff. 29 Apr 2026 (verified 2026-07-17)",
          url: "https://cdn.deepseek.com/policies/en-US/deepseek-open-platform-terms-of-service.html",
        },
      },
      residency: {
        state: "adverse",
        note: "“We directly collect, process and store your Personal Data in People's Republic of China” — regardless of where you are, no choice. A hard stop for many regulated enterprises.",
        source: { name: `DeepSeek · Privacy Policy (${V})`, url: "https://cdn.deepseek.com/policies/en-US/deepseek-privacy-policy.html" },
      },
    },
  },
  {
    vendor: "Cohere",
    slug: "cohere",
    kind: "hosted-api",
    marks: {
      training: {
        state: "conditional",
        note: "“You can opt out from your prompts and generations being used to train Cohere models … at any time.” Opt-out available; not off by default.",
        source: { name: `Cohere · Enterprise Data Commitments (${V})`, url: "https://cohere.com/enterprise-data-commitments" },
      },
      retention: {
        state: "protective",
        note: "“We automatically delete logged prompts and generations after 30 days …”; Zero Data Retention (“we do not log any prompts or generations”) available on request.",
        source: { name: `Cohere · Enterprise Data Commitments (${V})`, url: "https://cohere.com/enterprise-data-commitments" },
      },
      indemnity: {
        state: "protective",
        note: "SaaS §11(e) Copyright Assurance: “Cohere will defend, indemnify and hold harmless the Customer … against … Claims by a third party alleging that any Output infringes … any copyright rights.”",
        source: { name: `Cohere · SaaS Agreement (${V})`, url: "https://cohere.com/saas-agreement" },
      },
      residency: {
        state: "protective",
        note: "“Deploy through your virtual private cloud (VPC), on-premises setup, or dedicated, Cohere-managed Model Vault” — runs on any cloud (OCI/Azure/AWS/Google); data stays in your region. SOC 2 Type II.",
        source: { name: `Cohere · Security (${V})`, url: "https://cohere.com/security" },
      },
    },
  },
  {
    vendor: "xAI (Grok)",
    slug: "xai-grok",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "“xAI never trains on your API inputs or outputs without your explicit permission.”",
        source: { name: `xAI · API Security FAQ (${V})`, url: "https://docs.x.ai/docs/resources/faq-api/security" },
      },
      retention: {
        state: "protective",
        note: "“API requests and responses are temporarily stored on our servers for 30 days …”; Zero Data Retention available for enterprise accounts.",
        source: { name: `xAI · API Security FAQ (${V})`, url: "https://docs.x.ai/docs/resources/faq-api/security" },
      },
      indemnity: {
        state: "unverified",
        note: "Enterprise terms & DPA (x.ai/legal/*) return 403 to our verifier; the only reachable consumer ToS runs indemnity user→xAI. No customer output indemnity fetched.",
      },
      residency: {
        state: "unverified",
        note: "x.ai/legal enterprise terms & DPA blocked (403); no verbatim API residency statement fetched this pass.",
      },
    },
  },
  {
    vendor: "AI21 (Jamba)",
    slug: "ai21-jamba",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "“AI21 will not train AI21 Models on Customer Content.” (Terms §7.8; with an “unless agreed otherwise in writing” carve-out.)",
        source: { name: `AI21 · Terms of Use (${V})`, url: "https://www.ai21.com/terms-policies/terms-of-use/" },
      },
      retention: {
        state: "conditional",
        note: "Deletion is post-termination / after the retrieval-right period (§13.5) — no fixed short window and no zero-retention option documented.",
        source: { name: `AI21 · Terms of Use (${V})`, url: "https://www.ai21.com/terms-policies/terms-of-use/" },
      },
      indemnity: {
        state: "conditional",
        note: "You own the Output (§7.2); AI21 indemnifies claims that authorised use of the System/Model infringes copyright or patent (§12.1) — not an explicit output-IP indemnity.",
        source: { name: `AI21 · Terms of Use (${V})`, url: "https://www.ai21.com/terms-policies/terms-of-use/" },
      },
      residency: {
        state: "conditional",
        note: "Content “may be hosted and processed … in Israel, the United States, the EEA, the United Kingdom, and other locations” (§7.3) — a specific region only via Order.",
        source: { name: `AI21 · Terms of Use (${V})`, url: "https://www.ai21.com/terms-policies/terms-of-use/" },
      },
    },
  },
  {
    vendor: "IBM (Granite)",
    slug: "ibm-granite",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "IBM does not use client content or model outputs to train its foundation models; “Clients can develop AI applications using their own data along with the client protections.”",
        source: { name: `IBM · watsonx client protections (${V})`, url: "https://newsroom.ibm.com/2023-09-28-IBM-Announces-Availability-of-watsonx-Granite-Model-Series,-Client-Protections-for-IBM-watsonx-Models" },
      },
      retention: {
        state: "unverified",
        note: "watsonx trust/FAQ docs render as JS shells / return 403 — no verbatim retention window fetched.",
      },
      indemnity: {
        state: "protective",
        note: "“IBM provides an IP indemnity (contractual protection) for its foundation models” — uncapped for IBM-developed models, and IBM does not require customers to indemnify IBM.",
        source: { name: `IBM · watsonx client protections (${V})`, url: "https://newsroom.ibm.com/2023-09-28-IBM-Announces-Availability-of-watsonx-Granite-Model-Series,-Client-Protections-for-IBM-watsonx-Models" },
      },
      residency: {
        state: "unverified",
        note: "watsonx runs on selectable IBM Cloud regions, but the product/region pages returned 403 / JS-only — no verbatim residency quote fetched.",
      },
    },
  },
  {
    vendor: "Alibaba (Qwen)",
    slug: "alibaba-qwen",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "“Alibaba Cloud strictly protects data privacy and never uses your data for model training.”",
        source: { name: `Alibaba Cloud · Model Studio FAQ (${V})`, url: "https://www.alibabacloud.com/help/en/model-studio/faq-about-alibaba-cloud-model-studio" },
      },
      retention: {
        state: "protective",
        note: "Inference is transient: “transient data is not persisted … Your static data always remains in the selected region.”",
        source: { name: `Alibaba Cloud · Model Studio regions (${V})`, url: "https://www.alibabacloud.com/help/en/model-studio/regions/" },
      },
      indemnity: {
        state: "unverified",
        note: "The Model Studio master Terms of Service wasn't retrievable in quotable form — output indemnity not addressed on the FAQ; no receipt, no mark.",
      },
      residency: {
        state: "protective",
        note: "International region hosts in Singapore: “Data must not pass through the Chinese mainland” and “static data always remains in the selected region.” ⚠ Chinese-parented (Alibaba) — a sovereignty consideration despite the documented Singapore hosting.",
        source: { name: `Alibaba Cloud · Model Studio regions (${V})`, url: "https://www.alibabacloud.com/help/en/model-studio/regions/" },
      },
    },
  },
  {
    vendor: "Z.ai (GLM)",
    slug: "zai-glm",
    kind: "hosted-api",
    marks: {
      training: {
        state: "protective",
        note: "DPA: “The Company do not store any of the content the Customer or its End Users provide or generate while using our Services” — API content isn't used to train.",
        source: { name: `Z.ai · Privacy / DPA (${V})`, url: "https://docs.z.ai/legal-agreement/privacy-policy" },
      },
      retention: {
        state: "protective",
        note: "“This information is processed in real-time … and is not saved on our servers.” Real-time only for API content.",
        source: { name: `Z.ai · Privacy / DPA (${V})`, url: "https://docs.z.ai/legal-agreement/privacy-policy" },
      },
      indemnity: {
        state: "adverse",
        note: "Verified absence: the privacy policy / DPA contains no output IP indemnity, warranty, or ownership language — none offered, not a gap in our receipts.",
        source: { name: `Z.ai · Privacy / DPA (${V})`, url: "https://docs.z.ai/legal-agreement/privacy-policy" },
      },
      residency: {
        state: "conditional",
        note: "“We generally provide the Services from Singapore” (entity registered in Singapore). ⚠ Chinese-parented (Zhipu) — a PRC-sovereignty consideration despite the documented Singapore hosting.",
        source: { name: `Z.ai · Privacy / DPA (${V})`, url: "https://docs.z.ai/legal-agreement/privacy-policy" },
      },
    },
  },
  {
    vendor: "Moonshot (Kimi)",
    slug: "moonshot-kimi",
    kind: "hosted-api",
    marks: {
      training: {
        state: "adverse",
        note: "Uses inputs to improve/train — “This includes training and refining our underlying technology.” No opt-out documented; training is the default.",
        source: { name: `Moonshot · Kimi privacy (${V})`, url: "https://platform.kimi.ai/docs/agreement/userprivacy" },
      },
      retention: {
        state: "adverse",
        note: "“Account, input, and payment information are retained while your account is active” — no fixed window, no zero-retention option.",
        source: { name: `Moonshot · Kimi privacy (${V})`, url: "https://platform.kimi.ai/docs/agreement/userprivacy" },
      },
      indemnity: {
        state: "adverse",
        note: "Verified absence: no output IP indemnity, warranty, or ownership language in the published policy — none offered, not a gap in our receipts.",
        source: { name: `Moonshot · Kimi privacy (${V})`, url: "https://platform.kimi.ai/docs/agreement/userprivacy" },
      },
      residency: {
        state: "conditional",
        note: "“We store the information we collect in secure servers located in Singapore.” ⚠ Chinese-parented (Moonshot AI, Beijing) — a sovereignty consideration despite the documented Singapore servers.",
        source: { name: `Moonshot · Kimi privacy (${V})`, url: "https://platform.kimi.ai/docs/agreement/userprivacy" },
      },
    },
  },
  {
    vendor: "Reka",
    slug: "reka",
    kind: "hosted-api",
    marks: {
      training: {
        state: "conditional",
        note: "Paid requests aren't used for training unless you opt in; the FREE tier trains by default: “Reka may use Your Content to train … its machine learning models.”",
        source: { name: `Reka · Terms of Use (${V})`, url: "https://reka.ai/legal/terms-of-use" },
      },
      retention: {
        state: "unverified",
        note: "“Reka has no obligation to store any of Your Content” — a convenience disclaimer, not a documented zero-retention commitment. No receipt for a retention control.",
      },
      indemnity: {
        state: "adverse",
        note: "“Reka does not represent or warrant that you are the legal owner of the Output … You shall be solely responsible.” No output indemnity; risk sits with you.",
        source: { name: `Reka · Terms of Use (${V})`, url: "https://reka.ai/legal/terms-of-use" },
      },
      residency: {
        state: "conditional",
        note: "“The Services are controlled and offered by Reka from its facilities in the United States” — US-hosted (single region disclosed; no explicit residency commitment).",
        source: { name: `Reka · Terms of Use (${V})`, url: "https://reka.ai/legal/terms-of-use" },
      },
    },
  },
];

/** Transparent scoring: protective 1 · conditional 0.5 · adverse/unverified 0.
 *  Unverified deliberately scores zero — under-claim beats over-claim. */
export function shieldScore(v: VendorShield): number {
  const w: Record<MarkState, number> = { protective: 1, conditional: 0.5, adverse: 0, unverified: 0 };
  const m = v.marks;
  return w[m.training.state] + w[m.retention.state] + w[m.indemnity.state] + w[m.residency.state];
}

/** How many of the four marks are actually verified (have a determination), vs.
 *  a blank "—" gap. A 2.0 from two adverse marks (4/4 verified) is a different
 *  fact from a 2.0 with two blanks (2/4) — this lets the UI say which. */
export function shieldCoverage(v: VendorShield): number {
  const m = v.marks;
  return [m.training, m.retention, m.indemnity, m.residency].filter((x) => x.state !== "unverified").length;
}

/** Ranked view: score desc, ties alphabetical (stated, boring, un-gameable). */
export function rankedShield(): (VendorShield & { score: number })[] {
  return SHIELD.map((v) => ({ ...v, score: shieldScore(v) })).sort(
    (a, b) => b.score - a.score || a.vendor.localeCompare(b.vendor),
  );
}

// ── Buyer-weighted Trust Rank ────────────────────────────────────────────────
// The fixed ranking above treats every mark equally (weight 1). A real buyer
// doesn't: a healthcare CIO may not care about output indemnity at all but
// treat residency as a hard requirement. This lets them re-weight the SAME
// verified marks — never a different fact, only a different priority.
export type ShieldDim = "training" | "retention" | "indemnity" | "residency";
export type ShieldWeights = Record<ShieldDim, number>;

/** Equal weights (1 each) — reproduces the fixed rankedShield() order exactly. */
export const DEFAULT_SHIELD_WEIGHTS: ShieldWeights = { training: 1, retention: 1, indemnity: 1, residency: 1 };

export const SHIELD_DIM_INFO: { key: ShieldDim; label: string; blurb: string }[] = [
  { key: "training", label: "Won't train on our data", blurb: "Keeps your prompts and outputs out of the model." },
  { key: "retention", label: "Retention / zero-retention", blurb: "How long — and whether — your data is stored." },
  { key: "indemnity", label: "Output IP indemnity", blurb: "Vendor defends you on third-party IP claims." },
  { key: "residency", label: "Data residency", blurb: "Where your data is processed and stored." },
];

const MARK_WEIGHT: Record<MarkState, number> = { protective: 1, conditional: 0.5, adverse: 0, unverified: 0 };

/** Score a vendor under buyer-supplied dimension weights. Same marks, same
 *  0/0.5/1 per-mark scale — only the dimension weights change. */
export function shieldScoreWeighted(v: VendorShield, weights: ShieldWeights): number {
  const m = v.marks;
  return (
    weights.training * MARK_WEIGHT[m.training.state] +
    weights.retention * MARK_WEIGHT[m.retention.state] +
    weights.indemnity * MARK_WEIGHT[m.indemnity.state] +
    weights.residency * MARK_WEIGHT[m.residency.state]
  );
}

/** Ranked under buyer weights; max = the total achievable score for THIS
 *  weight set, so the progress bar always reads relative to what's possible. */
export function rankedShieldWeighted(weights: ShieldWeights): (VendorShield & { score: number; max: number })[] {
  const max = weights.training + weights.retention + weights.indemnity + weights.residency;
  return SHIELD.map((v) => ({ ...v, score: Math.round(shieldScoreWeighted(v, weights) * 100) / 100, max })).sort(
    (a, b) => b.score - a.score || a.vendor.localeCompare(b.vendor),
  );
}
