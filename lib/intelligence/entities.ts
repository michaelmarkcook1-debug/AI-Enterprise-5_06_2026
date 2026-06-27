// ─────────────────────────────────────────────────────────────────────────
// Shared enterprise-AI entity dataset (Query tab + cross-tab consumers).
//
// WHY THIS FILE EXISTS
// The Query v2 page originally defined its `ENTITIES` array, role types and a
// hand-maintained `WINNING_BY_LAYER` list *inside* the page component
// (app/query-v2/QueryV2Client.tsx). That locked the data to one tab and let
// the "winning by layer" list drift out of sync with the entity roster
// (e.g. SoftBank appeared as an Investor winner but was never a tracked
// entity). Lifting the data here makes it a single source of truth that
// Understand / Assess / Monitor and any future tab can import, and lets the
// layer-winners be DERIVED from the entities so they can never disagree.
//
// DATA STATUS: directional, evidence-labelled seed intelligence. Scores are
// analyst estimates, not audited fact. Each entity carries an evidenceGrade
// (E1–E5) and a dataCaveats note. Newly added entities (June 2026) are sourced
// from public reporting cited in the accompanying change notes.
// ─────────────────────────────────────────────────────────────────────────

export type Role =
  | "Platform Vendor"
  | "Model Provider"
  | "Application Vendor"
  | "Infrastructure Player"
  | "Investor"
  | "Hardware Provider"
  | "Data & Services Provider"
  | "Cloud / Hosting Provider"
  | "Sovereign / Regional AI"
  | "Regulator / Policy Actor"
  | "Open-Source Ecosystem"
  | "Vertical Specialist";

export type CategoryKey =
  | "all"
  | "platforms"
  | "models"
  | "applications"
  | "infrastructure"
  | "investors"
  | "hardware"
  | "sovereign"
  | "vertical";

export type Ownership = "public" | "private" | "subsidiary";

// Infrastructure sub-band (Silicon / Cloud Compute / Neocloud). Optional so
// non-infrastructure entities and legacy records stay valid. Used by the
// next batch (Infrastructure sub-banding); harmless to carry now.
export type InfraBand = "silicon" | "cloud_compute" | "neocloud" | "inference" | "data_platform";

// ─────────────────────────────────────────────────────────────────────────
// PER-ROLE SCORING (AI-market scope).
// A multi-role giant (Microsoft, Google, AWS, NVIDIA, Meta) does NOT have one
// honest score: its AI-platform position differs sharply from its first-party
// AI-model IP, its AI-infrastructure capacity, and its AI-capital influence.
// `roleScores` lets one canonical entity express a distinct, defensible score
// for each role it plays. When a category lens is active the leaderboard ranks
// and displays the role-specific score; the global composite remains the
// entity's strongest AI-market position for the "All" market-map view.
//
// IMPORTANT (scope): every number here is an AI-market-only analyst estimate —
// e.g. Microsoft's "Model Provider" score reflects first-party Phi/MAI IP, NOT
// GPT (which is OpenAI's model accessed via Azure = hosted + investment).
// ─────────────────────────────────────────────────────────────────────────
export interface RoleScore {
  leadership: number;   // 0-100 AI-market leadership in THIS role
  innovation: number;   // 0-100 R&D velocity / differentiation in THIS role
  readiness: number;    // 0-100 enterprise readiness in THIS role
  reach: number;        // 0-100 ecosystem reach in THIS role
  confidence: number;   // 0-100 analyst confidence in this role estimate
  evidenceGrade: Entity["evidenceGrade"];
  rationale: string;    // why this role scores where it does, AI-scope only
}
export type RoleScores = Partial<Record<Role, RoleScore>>;

export type Entity = {
  id: string;
  name: string;
  slug: string;
  ownership: Ownership;
  primaryRole: Role;
  secondaryRoles: Role[];
  /** Capability-aware, scale-compressed ranking score (see rankingLeadership). */
  leadershipScore: number;
  /** Raw analyst market-leadership score, BEFORE the blend/compression. Persist
   *  THIS (not leadershipScore) into raw primitives like overallScore. */
  marketLeadership: number;
  momentum: number;
  ecosystemReach: number;
  risk: "low" | "medium" | "high";
  confidence: number;
  usageShare: number;
  innovation: number;
  readiness: number;
  movement: { dx: number; dy: number };
  deltas: {
    leadership: number;
    reach: number;
    adoption: number;
    infrastructure: number;
    risk: number;
  };
  modelsOwned: string[];
  hostedThirdParty: string[];
  infrastructureExposure: string[];
  investorRelationships: string[];
  hardwareDependencies: string[];
  cioInterpretation: string;
  evidenceGrade: "E1" | "E2" | "E3" | "E4" | "E5";
  dataCaveats: string;
  // Evidence depth + honesty band. evidenceDepth = count of analyst_verified
  // EvidenceRecord rows backing this vendor (0 = pure seed, no verified data).
  // dataConfidence is derived from it (see evidenceDepthBand) so every surface
  // can mark un-evidenced scores instead of presenting them as authoritative.
  evidenceDepth: number;
  dataConfidence: "verified" | "limited" | "seed";
  // Optional infra sub-band (primary + optional secondary), for the
  // Silicon / Cloud / Neocloud grouping. Absent = not yet banded.
  infraBand?: InfraBand;
  infraBandSecondary?: InfraBand;
  // Optional per-role AI-market score profile. Present for multi-role giants
  // whose single composite would mislead across category lenses.
  roleScores?: RoleScores;
};

// ── Leadership downgrade (Jun 2026) ──────────────────────────────────────────
// The leadership / ranking score used to be a pass-through of raw market
// position, which let incumbency — distribution scale, cloud reach, capital —
// tower over genuine AI capability and made the rankings fail the sniff test.
// The fix is `rankingLeadership()`, applied once at entity construction (and
// mirrored in the live DB adapter) so every surface agrees. It is two stages:
//
//  1. blendLeadership(): dilute raw market leadership with capability signals.
//     Most roles: 50% market leadership, 30% enterprise readiness, 20% innovation.
//     MODEL PROVIDERS: 70% / 10% / 20% — readiness is downgraded because for a
//     model ranking raw capability (incl. the Arena-ELO model_quality pillar
//     carried in overallScore) should dominate, and a high readiness weight
//     double-counted enterprise_control (already a base pillar) — letting
//     optimistically-seeded enterprise pillars float a lab above higher-ELO
//     peers. The scale compression below (not a deweighting of readiness) is what
//     demotes incumbents in the OTHER roles, so readiness stays meaningful there —
//     it stops immature, high-risk labs from floating above enterprise-ready
//     platforms. Innovation is kept small because in the live path it is
//     momentum-derived (noisy); leadership should be steadier.
//  2. compressScaleLeadership(): for the pure scale / distribution / capital roles
//     (Platform, Cloud / Hosting, Investor) the score is compressed halfway toward
//     a strong-but-not-leading 70 anchor. Being the #1 investor or cloud reseller
//     is not the same as leading on AI merit. This is what actually drops the
//     giants below the capability labs in the HEADLINE ranking — so it is applied
//     to the entity's composite (keyed on primary role) AND to per-role scores,
//     not just the per-role tables (where it was previously inert in production).
//
//     CAPABILITY CARVE-OUT: an entity whose primary tag is a scale role but which
//     is genuinely a frontier-model house (a strong Model Provider role score) is
//     NOT compressed — otherwise Google (primary tag "Platform Vendor", but a
//     top-tier Gemini model house) would be wrongly demoted like Microsoft, whose
//     model role is mid-pack. The Model-role score is the signal that separates a
//     real AI-capability leader from a distribution/capital incumbent.
//
// Capability roles (Model Provider, Application Vendor, Infrastructure, Hardware,
// Sovereign, …) are left intact — that leadership is earned on the technology.
const LEADERSHIP_SCALE_ANCHOR = 70;
const LEADERSHIP_BY_SCALE_ROLES: ReadonlySet<Role> = new Set<Role>([
  "Platform Vendor",
  "Cloud / Hosting Provider",
  "Investor",
]);
// A scale-primary entity with a Model Provider role at or above this leadership
// is treated as a genuine capability house and exempt from scale compression.
const CAPABILITY_HOUSE_MODEL_THRESHOLD = 75;

const finite = (x: number): number => (Number.isFinite(x) ? x : 0);

/** Capability-aware blend of a raw market-leadership score.
 *
 * MODEL PROVIDERS use a readiness-downgraded weighting (Jun 2026): readiness is
 * cut to 0.10 and the freed weight moves to market leadership (which carries the
 * Arena-ELO model_quality pillar). Rationale: for a *model* ranking, raw model
 * quality should dominate enterprise readiness — and readiness double-counts
 * enterprise_control, which is already a base pillar inside overallScore, so a
 * high 0.30 readiness weight let optimistically-seeded enterprise pillars prop
 * vendors above higher-ELO peers. Every other role keeps the original
 * 0.50/0.30/0.20, where enterprise readiness is genuinely more load-bearing.
 * primaryRole is optional + defaults to the original weights so other callers
 * are unaffected. */
export function blendLeadership(
  marketLeadership: number,
  readiness: number,
  innovation: number,
  primaryRole?: Role,
): number {
  const [wO, wR, wI] = primaryRole === "Model Provider"
    ? [0.7, 0.1, 0.2]
    : [0.5, 0.3, 0.2];
  const blended = wO * finite(marketLeadership) + wR * finite(readiness) + wI * finite(innovation);
  return Math.round(Math.max(0, Math.min(100, blended)));
}

/**
 * Compress a leadership value toward the 70 anchor when `role` is a pure
 * scale / distribution / capital role and the value sits above the anchor.
 * Capability roles and sub-anchor values pass through unchanged.
 */
export function compressScaleLeadership(leadership: number, role: Role): number {
  if (LEADERSHIP_BY_SCALE_ROLES.has(role) && leadership > LEADERSHIP_SCALE_ANCHOR) {
    return Math.round(LEADERSHIP_SCALE_ANCHOR + (leadership - LEADERSHIP_SCALE_ANCHOR) * 0.5);
  }
  return Math.round(leadership);
}

/**
 * The final leadership / ranking score: capability-aware blend, then a
 * scale-role compression keyed on the entity's PRIMARY role (with the
 * capability carve-out described above). This is the value the leaderboard,
 * quadrant and category lenses rank on, so the scale penalty reaches the
 * headline ranking — not only the per-role layer tables.
 */
export function rankingLeadership(
  marketLeadership: number,
  readiness: number,
  innovation: number,
  primaryRole: Role,
  roleScores?: RoleScores,
): number {
  const blended = blendLeadership(marketLeadership, readiness, innovation, primaryRole);
  if (!LEADERSHIP_BY_SCALE_ROLES.has(primaryRole)) return blended;
  // Carve-out: a genuine frontier-model house keeps its blended score even when
  // its primary tag is a platform/cloud/capital role.
  const modelLeadership = roleScores?.["Model Provider"]?.leadership ?? 0;
  if (modelLeadership >= CAPABILITY_HOUSE_MODEL_THRESHOLD) return blended;
  return compressScaleLeadership(blended, primaryRole);
}

function compressScaleRoleLeadership(roleScores: RoleScores): RoleScores {
  const out: RoleScores = {};
  for (const [role, score] of Object.entries(roleScores) as Array<[Role, RoleScore]>) {
    out[role] = { ...score, leadership: compressScaleLeadership(score.leadership, role) };
  }
  return out;
}

export function entity(
  id: string,
  name: string,
  ownership: Ownership,
  primaryRole: Role,
  secondaryRoles: Role[],
  leadershipScore: number,
  momentum: number,
  ecosystemReach: number,
  risk: Entity["risk"],
  confidence: number,
  usageShare: number,
  innovation: number,
  readiness: number,
  movementTuple: [number, number],
  deltaTuple: [number, number, number, number, number],
  modelsOwned: string[],
  hostedThirdParty: string[],
  infrastructureExposure: string[],
  investorRelationships: string[],
  hardwareDependencies: string[],
  cioInterpretation: string,
  evidenceGrade: Entity["evidenceGrade"],
  dataCaveats: string,
  bands?: { infraBand?: InfraBand; infraBandSecondary?: InfraBand; roleScores?: RoleScores },
): Entity {
  const roleScores = bands?.roleScores ? compressScaleRoleLeadership(bands.roleScores) : undefined;
  return {
    id,
    name,
    slug: id === "alibaba-qwen" ? "alibaba" : id === "moonshot-kimi" ? "moonshot" : id === "zhipu-glm" ? "zai" : id,
    ownership,
    primaryRole,
    secondaryRoles,
    leadershipScore: rankingLeadership(leadershipScore, readiness, innovation, primaryRole, roleScores),
    marketLeadership: leadershipScore,
    momentum,
    ecosystemReach,
    risk,
    confidence,
    usageShare,
    innovation,
    readiness,
    movement: { dx: movementTuple[0], dy: movementTuple[1] },
    deltas: {
      leadership: deltaTuple[0],
      reach: deltaTuple[1],
      adoption: deltaTuple[2],
      infrastructure: deltaTuple[3],
      risk: deltaTuple[4],
    },
    modelsOwned,
    hostedThirdParty,
    infrastructureExposure,
    investorRelationships,
    hardwareDependencies,
    cioInterpretation,
    evidenceGrade,
    dataCaveats,
    // The static roster carries no DB-verified evidence by definition, so it is
    // honestly labelled 'seed'. The live adapter overrides these from real
    // analyst_verified counts.
    evidenceDepth: 0,
    dataConfidence: "seed",
    infraBand: bands?.infraBand,
    infraBandSecondary: bands?.infraBandSecondary,
    roleScores,
  };
}

/**
 * Single source of truth for the evidence-confidence band. Driven by the count
 * of analyst_verified EvidenceRecord rows backing a vendor:
 *   ≥10 verified · 1–9 limited · 0 seed (no verified evidence).
 * Both the live adapter and any static labelling import this so the thresholds
 * never drift.
 */
export function evidenceDepthBand(depth: number): Entity["dataConfidence"] {
  return depth >= 10 ? "verified" : depth >= 1 ? "limited" : "seed";
}

export const ENTITIES: Entity[] = [
  entity("microsoft", "Microsoft", "public", "Platform Vendor", ["Application Vendor", "Investor", "Infrastructure Player", "Model Provider", "Cloud / Hosting Provider"], 91, 72, 96, "medium", 86, 18.8, 76, 91, [2, 1], [3, 4, 3, 2, 1], ["Phi", "MAI"], ["OpenAI GPT", "Mistral", "Llama"], ["Azure AI", "Azure OpenAI", "GitHub", "Microsoft 365", "Entra"], ["OpenAI strategic investment", "Mistral partnership"], ["NVIDIA GPU supply", "AMD MI-series optionality"], "Microsoft ranks as a platform leader because it controls enterprise distribution, cloud deployment, identity/security surfaces, Copilot applications and Azure AI access. It should not be treated as only a model provider, despite owning Phi and MAI model assets.", "E4", "Strong public evidence, but Copilot usage, Azure-hosted model traffic and first-party model share must be separated.", { infraBand: "cloud_compute", infraBandSecondary: "silicon", roleScores: {
    "Platform Vendor":          { leadership: 91, innovation: 74, readiness: 92, reach: 95, confidence: 86, evidenceGrade: "E4", rationale: "The #1 enterprise AI platform: Copilot distribution across 400M+ M365 seats, Azure AI control plane, Entra/Purview governance for AI, and procurement leverage. This is where the 91 is genuinely earned." },
    "Cloud / Hosting Provider": { leadership: 87, innovation: 72, readiness: 90, reach: 90, confidence: 82, evidenceGrade: "E4", rationale: "Azure AI capacity + Azure OpenAI are top-tier, but a notch behind AWS on raw breadth and behind AWS/Google on mature custom AI silicon (Maia/Cobalt are gen-1 vs Trainium2/TPU v5)." },
    "Infrastructure Player":    { leadership: 86, innovation: 71, readiness: 88, reach: 88, confidence: 80, evidenceGrade: "E3", rationale: "Massive AI datacentre buildout and networking, but compute is largely NVIDIA-dependent; first-party silicon is early." },
    "Model Provider":           { leadership: 56, innovation: 60, readiness: 70, reach: 58, confidence: 60, evidenceGrade: "E3", rationale: "FIRST-PARTY model IP only — Phi (capable small models) + MAI (early, unproven at frontier). Microsoft's apparent model strength is OpenAI's GPT accessed via Azure: that is hosted third-party + investment, NOT Microsoft model IP. As a model house it is mid-pack." },
    "Application Vendor":        { leadership: 84, innovation: 76, readiness: 88, reach: 90, confidence: 82, evidenceGrade: "E4", rationale: "Copilot across M365, GitHub Copilot, Security Copilot — deepest packaged-AI application footprint in the enterprise." },
    "Investor":                 { leadership: 93, innovation: 70, readiness: 88, reach: 88, confidence: 88, evidenceGrade: "E4", rationale: "The OpenAI capped-profit stake (~$13B+) plus the Mistral position is arguably the single most valuable AI capital position on earth — it tops the capital-influence table." },
  } }),
  entity("openai", "OpenAI", "private", "Model Provider", ["Application Vendor"], 94, 74, 89, "medium", 78, 17.6, 90, 78, [1, 1], [2, 2, 4, 0, 2], ["GPT", "o-series", "image/audio models"], [], ["Azure distribution", "API platform", "ChatGPT Enterprise"], ["Microsoft strategic investment"], ["NVIDIA GPU supply", "cloud partner capacity"], "OpenAI remains the model and product cadence shaper, but enterprise buyers should separate model quality from operating controls, data-retention evidence and dependency on Microsoft/Azure distribution.", "E3", "Usage share is directional and heavily influenced by public mindshare, API visibility and ChatGPT Enterprise references."),
  entity("anthropic", "Anthropic", "private", "Model Provider", ["Application Vendor"], 95, 76, 84, "medium", 76, 19, 88, 80, [2, 2], [3, 3, 5, 1, 1], ["Claude Opus", "Claude Sonnet", "Claude Haiku"], [], ["AWS Bedrock", "Google Vertex AI", "Snowflake", "Databricks"], ["Amazon investment", "Google investment"], ["NVIDIA GPU supply", "AWS Trainium exposure"], "Anthropic is a model provider with rising application pull through Claude Code and computer-use patterns. Its enterprise attractiveness is strongest where reasoning, coding and safety posture matter more than packaged suite breadth.", "E3", "Distribution is multi-cloud but partner-dependent; first-party enterprise application footprint is narrower than Microsoft or Google."),
  entity("google", "Google", "public", "Platform Vendor", ["Model Provider", "Cloud / Hosting Provider", "Hardware Provider", "Application Vendor"], 88, 69, 88, "medium", 82, 14.9, 84, 82, [1, 1], [1, 2, 2, 3, 0], ["Gemini", "Imagen", "Veo", "Gemma"], ["Anthropic Claude via Vertex"], ["Google Cloud", "Vertex AI", "Workspace", "TPU ecosystem"], ["Anthropic investment"], ["TPUs", "NVIDIA GPUs"], "Google is both platform and model provider: Gemini, Workspace, Vertex AI and TPU infrastructure should be read as one integrated stack, with enterprise traction strongest in cloud/data-heavy and Workspace-heavy estates.", "E4", "Public evidence is broad; commercial share varies by Workspace, Cloud and model API segment.", { infraBand: "cloud_compute", infraBandSecondary: "silicon", roleScores: {
    "Model Provider":           { leadership: 83, innovation: 90, readiness: 84, reach: 86, confidence: 84, evidenceGrade: "E4", rationale: "Gemini is genuinely frontier FIRST-PARTY model IP (very high innovation), but on ENTERPRISE COMMERCIAL model share Google is a clear #3 (~20%) behind Anthropic and OpenAI — so its model leadership sits just behind them, not ahead. Owns the full stack from research (DeepMind) to model to serving." },
    "Hardware Provider":        { leadership: 84, innovation: 86, readiness: 80, reach: 70, confidence: 80, evidenceGrade: "E4", rationale: "TPU v5/v6 is the only credible at-scale alternative to NVIDIA for frontier training — very high AI-hardware leadership, but largely captive (consumed internally / via Cloud, not broadly merchant-sold)." },
    "Platform Vendor":          { leadership: 86, innovation: 84, readiness: 82, reach: 86, confidence: 82, evidenceGrade: "E4", rationale: "Vertex AI + Workspace AI are strong, but enterprise platform distribution and procurement leverage trail Microsoft." },
    "Cloud / Hosting Provider": { leadership: 83, innovation: 82, readiness: 82, reach: 80, confidence: 80, evidenceGrade: "E4", rationale: "GCP is #3 cloud but the most AI-native of the three; Vertex hosts first-party Gemini plus third-party (Anthropic) models." },
    "Application Vendor":        { leadership: 78, innovation: 78, readiness: 80, reach: 84, confidence: 78, evidenceGrade: "E3", rationale: "Gemini in Workspace reaches huge seat counts, but enterprise workflow depth trails Microsoft Copilot." },
    "Investor":                 { leadership: 80, innovation: 68, readiness: 82, reach: 76, confidence: 80, evidenceGrade: "E4", rationale: "Multi-billion Anthropic position gives Google a major frontier-lab capital stake alongside its own first-party models." },
  } }),
  entity("aws", "AWS", "public", "Platform Vendor", ["Cloud / Hosting Provider", "Investor", "Infrastructure Player"], 86, 68, 92, "medium", 84, 10.6, 72, 86, [1, 0], [2, 3, 2, 4, 0], ["Nova", "Titan"], ["Claude", "Llama", "Mistral"], ["Bedrock", "SageMaker", "AWS AI infrastructure"], ["Anthropic investment"], ["Trainium", "Inferentia", "NVIDIA GPUs"], "AWS is a platform and infrastructure control plane with model optionality. It wins where buyers want cloud-native deployment depth rather than a single assistant or model brand.", "E4", "Bedrock adoption and hosted-model mix are hard to disaggregate from AWS account penetration.", { infraBand: "cloud_compute", infraBandSecondary: "silicon", roleScores: {
    "Cloud / Hosting Provider": { leadership: 88, innovation: 72, readiness: 88, reach: 92, confidence: 86, evidenceGrade: "E4", rationale: "AWS's strongest AI role: #1 cloud with the deepest AI deployment capacity, Bedrock model catalog and the widest enterprise account penetration." },
    "Infrastructure Player":    { leadership: 86, innovation: 74, readiness: 86, reach: 88, confidence: 84, evidenceGrade: "E4", rationale: "Trainium2 / Inferentia2 are the most mature merchant-accessible (via-cloud) custom AI silicon outside Google's captive TPUs; huge datacentre scale." },
    "Platform Vendor":          { leadership: 82, innovation: 70, readiness: 86, reach: 88, confidence: 82, evidenceGrade: "E4", rationale: "Bedrock + SageMaker are a strong AI control plane, but AWS sells building blocks rather than a packaged assistant brand, so platform-leadership is a notch below Microsoft." },
    "Investor":                 { leadership: 84, innovation: 68, readiness: 86, reach: 80, confidence: 84, evidenceGrade: "E4", rationale: "The ~$8B Anthropic position plus Bedrock distribution makes AWS a top-tier frontier-lab capital and distribution partner." },
    "Model Provider":           { leadership: 60, innovation: 62, readiness: 74, reach: 64, confidence: 64, evidenceGrade: "E3", rationale: "FIRST-PARTY models only — Nova + Titan are real and cost-efficient but not frontier. Like Microsoft, AWS's headline model access is third-party (Claude/Llama/Mistral via Bedrock), not first-party IP." },
  } }),
  entity("nvidia", "NVIDIA", "public", "Hardware Provider", ["Infrastructure Player", "Investor"], 90, 73, 94, "low", 84, 8.2, 78, 88, [3, 1], [2, 5, 4, 6, -1], ["Nemotron"], [], ["CUDA", "DGX Cloud", "GPU supply", "AI Enterprise software"], ["Strategic investments across AI ecosystem"], ["Own GPU and networking stack"], "NVIDIA is the upstream hardware and software ecosystem winner. For CIOs, it is a dependency and infrastructure-cost signal more than a direct application shortlist name.", "E4", "Infrastructure exposure is high, but downstream enterprise usage share should not be treated as vendor application share.", { infraBand: "silicon", infraBandSecondary: "neocloud", roleScores: {
    "Hardware Provider":     { leadership: 96, innovation: 90, readiness: 90, reach: 96, confidence: 90, evidenceGrade: "E4", rationale: "The defining AI-hardware company — GPUs + CUDA + networking are the substrate the entire frontier-AI market trains and serves on. In an AI-market-only view it is the single highest-leverage entity." },
    "Infrastructure Player": { leadership: 88, innovation: 86, readiness: 86, reach: 90, confidence: 86, evidenceGrade: "E4", rationale: "CUDA software moat, DGX Cloud, AI Enterprise software and NVLink/InfiniBand networking extend NVIDIA well beyond the chip into the AI infrastructure stack." },
    "Investor":              { leadership: 78, innovation: 72, readiness: 80, reach: 82, confidence: 80, evidenceGrade: "E3", rationale: "Strategic stakes across the AI ecosystem (neoclouds, model labs, robotics) make NVIDIA a major shaper of who gets compute — capital influence amplifies its hardware dominance." },
  } }),
  entity("meta", "Meta", "public", "Model Provider", ["Open-Source Ecosystem", "Application Vendor"], 78, 66, 80, "medium", 66, 3.5, 78, 55, [1, 0], [1, 3, 2, 0, 1], ["Llama"], [], ["Open-weight ecosystem", "hyperscaler hosting"], [], ["NVIDIA GPUs"], "Meta matters because Llama changes enterprise negotiation leverage and open-weight strategy — but as a FIRST-PARTY enterprise model vendor it is a minor commercial player: no managed enterprise model service, no first-party enterprise controls, and tiny direct commercial share. Read Meta's strength as open-weights influence, not enterprise model leadership.", "E2", "Enterprise controls and serving come from hosting partners, not Meta first-party; commercial model share is small versus the influence of the open weights.", { roleScores: {
    "Open-Source Ecosystem": { leadership: 86, innovation: 82, readiness: 70, reach: 88, confidence: 74, evidenceGrade: "E3", rationale: "Llama anchors the open-weight ecosystem — the reference point that resets enterprise negotiating leverage on closed-model pricing. This is Meta's strongest AI role, and the only one where it genuinely leads." },
    "Model Provider":        { leadership: 63, innovation: 77, readiness: 52, reach: 66, confidence: 64, evidenceGrade: "E2", rationale: "As a first-party ENTERPRISE COMMERCIAL model vendor Meta is mid-pack at best: Llama is capable, but Meta sells no managed enterprise model service, ships no first-party enterprise controls/SLAs, and captures tiny direct commercial share — serving and governance come from hosting partners. The open-weights leverage (scored separately, 86) is the real story, not enterprise model leadership." },
    "Application Vendor":    { leadership: 62, innovation: 66, readiness: 55, reach: 72, confidence: 60, evidenceGrade: "E2", rationale: "Meta AI is consumer-led; first-party enterprise application footprint is thin — a very different (and weaker) story than its open-source leadership." },
  } }),
  entity("mistral", "Mistral AI", "private", "Model Provider", ["Sovereign / Regional AI", "Open-Source Ecosystem"], 82, 70, 68, "medium", 67, 4.9, 80, 66, [2, 1], [3, 2, 2, 0, 1], ["Large", "Medium", "Small", "Codestral", "Magistral"], [], ["Azure AI Foundry", "La Plateforme"], ["Microsoft partnership"], ["NVIDIA GPUs"], "Mistral is the clearest European sovereign-model alternative with open-weight leverage, but buyers still need to validate enterprise controls and account support depth.", "E2", "Momentum is visible; enterprise production evidence remains more selective than US hyperscaler-backed peers."),
  entity("cohere", "Cohere (incl. Aleph Alpha)", "private", "Model Provider", ["Data & Services Provider", "Sovereign / Regional AI"], 63, 62, 64, "medium", 69, 3.6, 68, 68, [1, 1], [1, 2, 1, 0, 1], ["Command", "Embed", "Rerank", "Pharia (ex-Aleph Alpha)", "Luminous (ex-Aleph Alpha)"], [], ["Private deployment", "RAG workloads", "STACKIT sovereign cloud"], ["Oracle partnership", "Schwarz/STACKIT backing"], ["NVIDIA GPUs"], "Cohere completed its merger with Aleph Alpha in April 2026 (~$20B combined entity, Cohere shareholders ~90%), forming a transatlantic Canadian-German sovereign-AI champion for regulated sectors. Strongest where private deployment, data residency and RAG outweigh broad-market visibility.", "E2", "Merger is recent (Apr 2026); integration of Pharia/Luminous model lines and combined go-to-market is still consolidating. Aleph Alpha is no longer tracked as a separate entity."),
  entity("ibm", "IBM", "public", "Platform Vendor", ["Model Provider", "Data & Services Provider"], 67, 62, 69, "low", 78, 3.0, 61, 76, [0, 0], [1, 1, 0, 1, -1], ["Granite"], ["Mistral", "Llama"], ["watsonx", "Red Hat", "hybrid cloud"], [], ["NVIDIA GPUs", "IBM Z acceleration"], "IBM is a control, governance and hybrid-AI benchmark. It is less of a hype leader, but it matters in regulated deployments where auditability outranks speed.", "E4", "Momentum is more conservative; score should be weighted differently for high-control buyers. AI-scope recalibration (Jun 2026): composite cut 74→67 — watsonx/Granite are a solid governance-AI story but modest in AI-market terms; the prior score leaned on IBM's general enterprise/services reputation."),
  entity("databricks", "Databricks", "private", "Data & Services Provider", ["Platform Vendor", "Infrastructure Player"], 78, 67, 76, "medium", 74, 3.7, 71, 74, [1, 1], [2, 2, 2, 2, 0], ["Mosaic AI platform (DBRX model retired Apr 2025)"], ["Claude", "Llama", "Mistral"], ["Lakehouse", "Mosaic AI", "model serving"], [], ["NVIDIA GPUs", "cloud GPUs"], "Databricks is a build-and-data platform: high relevance for enterprises treating governed data as the AI foundation, less so for packaged assistant-only needs. Its model strategy is now host-third-party (native Claude via the Anthropic partnership); the first-party DBRX model line was retired in April 2025, though the Mosaic AI platform remains central.", "E3", "Category share depends heavily on data engineering maturity and existing lakehouse footprint. First-party frontier-model IP (DBRX) is deprecated — do not credit Databricks with a first-party model.", { infraBand: "data_platform" }),
  entity("snowflake", "Snowflake", "public", "Data & Services Provider", ["Platform Vendor", "Infrastructure Player"], 76, 64, 73, "medium", 73, 3.2, 68, 73, [1, 0], [1, 1, 1, 2, 0], ["Arctic"], ["Claude", "Mistral", "Llama"], ["Cortex AI", "Snowpark", "Data Cloud"], [], ["Cloud GPU supply"], "Snowflake is a governed data-cloud AI player. CIOs should read it as a data/control layer rather than a standalone frontier model competitor.", "E3", "First-party model claims are secondary to data-cloud adoption and partner model access.", { infraBand: "data_platform" }),
  entity("servicenow", "ServiceNow", "public", "Application Vendor", ["Platform Vendor", "Vertical Specialist"], 74, 66, 78, "medium", 76, 3.1, 70, 78, [1, 1], [2, 2, 2, 1, 0], ["Now LLM"], ["OpenAI", "Azure OpenAI"], ["Now Platform", "ITSM/HR workflows"], [], ["Cloud GPU supply"], "ServiceNow is an application/workflow platform for enterprise service processes. Its agent story is strongest where workflows and approvals already live in ServiceNow.", "E3", "Adoption should be read by ITSM/HR/service workflow, not generic enterprise AI share. AI-scope recalibration (Jun 2026): composite cut 79→74 — the score now reflects Now Assist specifically, not ServiceNow's ITSM platform dominance."),
  entity("salesforce", "Salesforce", "public", "Application Vendor", ["Platform Vendor", "Data & Services Provider"], 73, 65, 77, "medium", 75, 2.8, 69, 77, [1, 0], [1, 1, 1, 0, 1], ["Einstein family"], ["OpenAI", "Anthropic", "Google"], ["Agentforce", "Data Cloud", "CRM workflows"], [], ["Cloud GPU supply"], "Salesforce is an application-layer agent platform where CRM workflow ownership drives adoption. Cost and per-action economics need careful buyer scrutiny.", "E3", "CRM and service workflow share should not be projected to broad AI platform share. AI-scope recalibration (Jun 2026): composite cut 78→73 — the score now reflects Agentforce specifically, not Salesforce's CRM install-base dominance."),
  entity("oracle", "Oracle", "public", "Platform Vendor", ["Cloud / Hosting Provider", "Infrastructure Player"], 70, 61, 74, "medium", 72, 2.7, 63, 74, [0, 0], [1, 1, 0, 2, 0], [], ["Cohere", "Llama"], ["OCI", "Oracle Database", "sovereign regions"], ["Cohere partnership"], ["NVIDIA GPUs"], "Oracle is relevant where database, enterprise applications and OCI infrastructure are already strategic. Sovereign and dedicated cloud claims need region-level validation.", "E2", "AI leadership varies sharply by Oracle estate depth and workload. AI-scope recalibration (Jun 2026): composite cut 75→70 to strip the database/ERP install-base halo — OCI capacity and the Stargate JV are the genuine AI strengths, not Fusion AI breadth.", { infraBand: "cloud_compute" }),
  entity("perplexity", "Perplexity", "private", "Application Vendor", ["Model Provider"], 72, 66, 61, "medium", 58, 2.6, 72, 58, [1, 1], [1, 1, 2, 0, 1], ["Sonar"], ["OpenAI", "Anthropic"], ["Search and research product"], [], ["Cloud GPU supply"], "Perplexity is best read as an AI search and research application with model-provider characteristics through Sonar, not a horizontal enterprise platform.", "E2", "Enterprise controls and source quality evidence should be tested before knowledge-work scale-up."),
  entity("harvey", "Harvey", "private", "Vertical Specialist", ["Application Vendor"], 76, 68, 57, "medium", 61, 2.5, 69, 64, [2, 1], [2, 1, 3, 0, 1], [], ["Multi-provider"], ["Legal workflow product"], [], ["Cloud GPU supply"], "Harvey is a vertical specialist with strong legal workflow credibility. It can outperform horizontal platforms in law and professional-services use cases.", "E2", "Vertical concentration and pricing opacity limit broad-market extrapolation."),
  entity("rogo", "Rogo", "private", "Vertical Specialist", ["Application Vendor"], 69, 57, 46, "medium", 52, 1.6, 61, 55, [0, 0], [1, 0, 1, 0, 1], [], ["Multi-provider"], ["Financial research workflows"], [], ["Cloud GPU supply"], "Rogo is a financial-services specialist; useful for domain shortlists, but scale evidence and horizontal proof remain the diligence points.", "E1", "Small sample of public proof means confidence should stay conservative."),
  entity("writer", "Writer", "private", "Application Vendor", ["Model Provider"], 73, 61, 58, "medium", 60, 2.2, 64, 66, [1, 1], [1, 1, 1, 0, 0], ["Palmyra"], [], ["Enterprise content workflow platform"], [], ["Cloud GPU supply"], "Writer is an enterprise application and model provider for governed content and knowledge workflows. It is not a universal platform, but it can win specific business-user use cases.", "E2", "Category is crowded; broad enterprise scale proof matters."),
  entity("moveworks", "Moveworks", "subsidiary", "Application Vendor", ["Vertical Specialist"], 62, 60, 55, "medium", 63, 1.9, 62, 68, [0, 0], [1, 0, 1, 0, 0], [], ["Multi-provider"], ["Employee support automation"], [], ["Cloud GPU supply"], "Moveworks is now a ServiceNow subsidiary (acquisition closed Dec 2025, ~$2.85B) and is being folded into ServiceNow's Now Assist / Employee Center front-door rather than competing as a standalone platform. Strongest in IT and HR support-automation where deflection and resolution metrics are measurable, but read it as a captive ServiceNow capability, not an independent enterprise-AI leader.", "E2", "Owned by ServiceNow since Dec 2025; standalone competitive positioning no longer applies — assess within the ServiceNow platform."),
  entity("deepseek", "DeepSeek", "private", "Model Provider", ["Sovereign / Regional AI", "Open-Source Ecosystem"], 87, 71, 65, "high", 55, 2.4, 84, 53, [3, 0], [2, 1, 3, 0, 3], ["R1", "V3"], [], ["API platform", "open release ecosystem"], [], ["GPU access constraints"], "DeepSeek is a cost-per-quality disruptor for model strategy, but regulated buyers must treat jurisdiction, data transfer and access compliance as gating factors.", "E1", "Performance and pricing signals are strong; enterprise controls and geopolitical access are uncertain."),
  entity("alibaba-qwen", "Alibaba / Qwen", "public", "Model Provider", ["Cloud / Hosting Provider", "Sovereign / Regional AI", "Open-Source Ecosystem"], 90, 66, 70, "high", 58, 2.3, 78, 58, [1, 1], [1, 2, 2, 1, 2], ["Qwen"], [], ["Alibaba Cloud Model Studio"], [], ["GPU and accelerator supply"], "Qwen matters as a global frontier alternative with multilingual and regional reach. Western enterprise adoption depends on jurisdiction and procurement policy.", "E1", "Signals are strongest in APAC and open-weight contexts; global enterprise controls need validation.", { infraBand: "cloud_compute" }),
  entity("moonshot-kimi", "Moonshot / Kimi", "private", "Model Provider", ["Sovereign / Regional AI"], 88, 63, 52, "high", 48, 1.4, 73, 50, [1, 0], [1, 0, 1, 0, 1], ["Kimi"], [], ["Platform API"], [], ["GPU supply"], "Moonshot/Kimi is a long-context and reasoning contender. It is useful for market scanning, but not yet a default enterprise platform choice.", "E1", "Enterprise packaging, procurement access and controls remain early."),
  entity("zhipu-glm", "Zhipu / GLM", "private", "Model Provider", ["Sovereign / Regional AI"], 90, 58, 49, "high", 46, 1.2, 70, 49, [0, 0], [0, 0, 1, 0, 1], ["GLM"], [], ["API and regional enterprise deployments"], [], ["GPU supply"], "Zhipu/GLM is relevant for jurisdictional diversity and China-market coverage, with limited Western enterprise readiness evidence.", "E1", "Confidence is low outside domestic/regional contexts."),
  entity("coreweave", "CoreWeave", "private", "Infrastructure Player", ["Cloud / Hosting Provider"], 74, 70, 79, "medium", 61, 1.7, 69, 73, [2, 1], [1, 3, 2, 5, 1], [], [], ["GPU cloud", "AI training infrastructure"], ["NVIDIA ecosystem ties"], ["NVIDIA GPUs"], "CoreWeave is a high-signal infrastructure player. It matters for supply, hosting and training capacity, not as an enterprise application vendor.", "E2", "Dependency and customer concentration should be watched.", { infraBand: "neocloud" }),
  entity("amd", "AMD", "public", "Hardware Provider", ["Infrastructure Player"], 70, 65, 67, "medium", 70, 1.5, 65, 70, [1, 0], [1, 2, 1, 3, 0], [], [], ["MI accelerator ecosystem"], [], ["Own accelerator roadmap"], "AMD is an alternative accelerator provider that affects negotiating leverage and supply diversification more than direct AI application choice.", "E3", "Software ecosystem maturity remains the key counterweight to hardware performance.", { infraBand: "silicon" }),
  entity("broadcom", "Broadcom", "public", "Hardware Provider", ["Infrastructure Player"], 68, 62, 76, "low", 68, 1.3, 60, 73, [0, 0], [0, 2, 0, 3, -1], [], [], ["AI networking", "custom silicon"], [], ["Own networking and ASIC exposure"], "Broadcom is part of the infrastructure dependency map through networking and custom silicon — arguably the second-broadest AI-infrastructure footprint after NVIDIA: ~60% of the custom-AI-ASIC/XPU market (Google TPU, Meta MTIA, etc.) plus the Tomahawk/Jericho networking inside most large training clusters. CIO relevance is indirect but important for cloud cost and capacity.", "E3", "Enterprise buyer visibility is indirect through cloud and infrastructure suppliers; AI revenue is concentrated in a handful of hyperscaler accounts.", { infraBand: "silicon" }),
  entity("tsmc", "TSMC", "public", "Hardware Provider", ["Infrastructure Player"], 72, 60, 82, "low", 78, 1.4, 58, 83, [0, 0], [0, 4, 0, 4, -1], [], [], ["Semiconductor fabrication", "advanced process nodes"], [], ["Own fabrication capacity"], "TSMC is the fabrication backbone for AI hardware. It is a supply-chain and geopolitical risk signal rather than a direct software vendor.", "E4", "Risk is supply-chain and geopolitical, not product-fit.", { infraBand: "silicon" }),
  entity("xai", "xAI", "private", "Model Provider", ["Application Vendor", "Infrastructure Player"], 92, 66, 59, "medium", 47, 1.4, 74, 54, [1, 1], [1, 1, 1, 2, 1], ["Grok"], [], ["Colossus compute build-out", "X distribution"], [], ["NVIDIA GPU supply", "Oracle OCI exposure"], "xAI is a model provider with compute-scale ambitions and consumer distribution through X. Enterprise readiness evidence remains thin.", "E1", "Treat as watch-list until enterprise controls and customer proof mature.", { infraBand: "neocloud" }),

  // ───────────────────────────────────────────────────────────────────────
  // NEW ENTITIES (added June 2026) — sourced from public reporting.
  // Scores remain directional/seed, consistent with the existing roster.
  // ───────────────────────────────────────────────────────────────────────

  // ── Neoclouds & inference layer (completes Infrastructure) ──────────────
  entity("cerebras", "Cerebras", "public", "Hardware Provider", ["Infrastructure Player", "Cloud / Hosting Provider"], 74, 71, 72, "medium", 64, 1.9, 80, 66, [3, 2], [2, 4, 3, 5, 0], ["WSE-3 wafer-scale"], ["Llama (inference)", "Mistral (inference)"], ["Cerebras Inference cloud", "Condor Galaxy"], ["OpenAI $20B+ procurement + warrants (up to ~10%)", "G42 ties"], ["Own wafer-scale silicon", "TSMC fabrication"], "Cerebras is an independent wafer-scale inference challenger that IPO'd in May 2026 (~$56B day-one valuation) anchored by a $20B+ OpenAI compute commitment. For CIOs it is a latency/throughput and supply-diversification signal more than a direct application choice.", "E3", "Historically heavy revenue concentration (G42); OpenAI deal reduces but does not remove customer-concentration risk. IPO valuation is market-set, not a usage-share measure.", { infraBand: "silicon", infraBandSecondary: "inference" }),

  entity("groq", "Groq", "private", "Infrastructure Player", ["Cloud / Hosting Provider"], 66, 60, 58, "high", 50, 0.9, 70, 52, [-2, 1], [1, 1, 1, 2, 3], [], ["Llama (LPU inference)", "Mistral (LPU inference)", "DeepSeek (LPU inference)"], ["GroqCloud LPU inference"], ["Existing investors (Disruptive, Infinitum) backstopping ~$650M raise"], ["Own LPU technology (licensed to NVIDIA Dec 2025)"], "Groq pivoted from chip maker to inference neocloud after NVIDIA's ~$20B Dec-2025 licensing/acquihire stripped its senior engineering team. GroqCloud survives and is raising ~$650M, but the technical moat and roadmap are now uncertain. Treat as watch-list infrastructure, not a stable dependency.", "E1", "Post-acquihire roadmap unproven; most chip engineers moved to NVIDIA. Inference unit economics vs GPU clouds remain unverified as of mid-2026.", { infraBand: "neocloud", infraBandSecondary: "inference" }),

  entity("lambda", "Lambda", "private", "Infrastructure Player", ["Cloud / Hosting Provider"], 69, 66, 64, "medium", 58, 1.1, 64, 66, [1, 1], [1, 3, 2, 4, 1], [], ["Open-weight models (hosted GPU)"], ["GPU cloud", "on-demand + reserved clusters"], ["$1.5B+ Series E"], ["NVIDIA GPUs"], "Lambda is a GPU-cloud neocloud serving training and inference capacity to AI builders. Relevant as a compute-supply and pricing-leverage option, especially where buyers want NVIDIA capacity outside the big-three hyperscalers.", "E2", "Capital-intensive model with GPU-supply and demand-cycle exposure; financial disclosures limited as a private company.", { infraBand: "neocloud" }),

  entity("together-ai", "Together AI", "private", "Infrastructure Player", ["Cloud / Hosting Provider", "Open-Source Ecosystem"], 70, 68, 66, "medium", 57, 1.2, 72, 64, [2, 1], [1, 3, 3, 4, 1], [], ["Llama", "DeepSeek", "Qwen", "Mistral"], ["Together inference + fine-tuning cloud"], ["$305M Series B"], ["NVIDIA GPUs"], "Together AI is an open-model inference and fine-tuning cloud — a flagship host for Llama, DeepSeek, Qwen and Mistral. For CIOs it is the open-weight deployment route when self-hosting is impractical but closed APIs are undesirable.", "E2", "Open-model hosting margins and durable differentiation versus hyperscaler model catalogs remain the key questions.", { infraBand: "neocloud", infraBandSecondary: "inference" }),

  entity("fireworks-ai", "Fireworks AI", "private", "Infrastructure Player", ["Cloud / Hosting Provider", "Open-Source Ecosystem"], 71, 70, 67, "medium", 58, 1.3, 74, 65, [2, 2], [2, 3, 3, 4, 1], [], ["DeepSeek", "Llama", "Qwen", "Kimi", "Mistral"], ["Fireworks inference cloud", "FireAttention kernels", "managed fine-tuning"], ["~$15B valuation talks (May 2026); $4B Series C Oct 2025"], ["NVIDIA GPUs (up to B300)"], "Fireworks AI is the leading software-layer (GPU-based) inference platform, reportedly in talks at a ~$15B valuation on the back of strong ARR growth and customers like Cursor, Perplexity and Notion. Differentiates on throughput optimisation rather than custom silicon.", "E2", "Software-optimisation moat is pressured at the premium-latency end by custom-silicon players (Cerebras) and by hyperscaler model catalogs (Bedrock/Vertex/Azure).", { infraBand: "neocloud", infraBandSecondary: "inference" }),

  entity("nscale", "Nscale", "private", "Infrastructure Player", ["Cloud / Hosting Provider", "Sovereign / Regional AI"], 64, 64, 52, "medium", 54, 0.6, 60, 60, [1, 1], [1, 2, 1, 3, 1], [], ["Mistral (sovereign hosting option)"], ["UK sovereign GPU cloud"], ["$1.1B+ Series B; $2B raise in 2026"], ["NVIDIA GPUs"], "Nscale is a UK/Europe sovereign GPU-cloud neocloud, relevant where data-residency and non-US compute are procurement requirements. A bargaining-leverage and sovereignty option more than a mainstream default.", "E2", "Early-stage scale; sovereign-cloud demand is real but buildout and utilisation economics are still proving out.", { infraBand: "neocloud" }),

  // ── Pure-play investors (so the Investors filter shows actual capital, ──
  //    not just operators who also invest) ─────────────────────────────────
  entity("softbank", "SoftBank", "public", "Investor", [], 72, 64, 60, "medium", 70, 0, 58, 70, [1, 0], [1, 1, 0, 1, 0], [], [], [], ["OpenAI (~$30B in 2026 round; co-led $40B 2025 round)", "Stargate JV (with OpenAI + Oracle)"], [], "SoftBank is one of the largest single-cheque AI investors, anchoring OpenAI's mega-rounds and the Stargate data-centre JV. For CIOs it is a capital-and-distribution signal: where SoftBank concentrates, compute and model access tend to follow.", "E4", "Investment scale is well-reported, but committed-vs-funded amounts and contingencies (e.g. tranche conditions) vary by deal.", { }),

  entity("a16z", "Andreessen Horowitz", "private", "Investor", [], 70, 62, 58, "low", 72, 0, 56, 72, [0, 0], [0, 1, 0, 0, 0], [], [], [], ["OpenAI (co-lead 2026 round)", "xAI (Series E lead)", "broad AI portfolio"], [], "a16z is a marquee venture investor across the generative-AI stack, from frontier labs to application startups. Useful as a signal of which categories smart capital is concentrating in, not a procurement input.", "E4", "Portfolio influence is directional; venture backing does not imply product fitness for any specific enterprise.", { }),

  entity("sequoia", "Sequoia Capital", "private", "Investor", [], 70, 60, 57, "low", 72, 0, 55, 73, [0, 0], [0, 1, 0, 0, 0], [], [], [], ["OpenAI (participant)", "broad AI portfolio"], [], "Sequoia is a long-standing frontier-AI venture backer. Read its concentration as a category-conviction signal; it does not bear on enterprise control or deployment fitness.", "E4", "Participation amounts in mega-rounds are often undisclosed; influence is indirect.", { }),

  entity("mgx", "MGX", "private", "Investor", ["Sovereign / Regional AI"], 68, 62, 54, "medium", 64, 0, 54, 66, [1, 1], [1, 1, 0, 2, 0], [], [], [], ["OpenAI (co-lead 2026 round)", "UAE sovereign AI vehicle"], [], "MGX is the UAE state-backed AI investment vehicle, co-leading frontier-lab mega-rounds. For CIOs it signals Gulf sovereign capital shaping model access and data-centre buildout — relevant to sovereignty and jurisdiction questions.", "E3", "State-linked capital introduces jurisdiction and governance considerations that should be assessed separately from product.", { }),

  // ── Sovereign / regional specialists ───────────────────────────────────
  entity("g42", "G42 / Falcon (TII)", "private", "Sovereign / Regional AI", ["Infrastructure Player", "Model Provider"], 67, 62, 60, "medium", 58, 0.8, 64, 60, [1, 1], [1, 2, 1, 3, 1], ["Falcon (TII)"], [], ["Condor Galaxy supercomputers", "UAE sovereign compute"], ["Microsoft minority investment ($1.5B, 2024)"], ["NVIDIA + Cerebras (Condor Galaxy)"], "G42 is Abu Dhabi's sovereign-AI holding company; the TII Falcon models are the most-cited open-weights frontier line from the region. A sovereignty, compute and jurisdiction signal for Gulf and aligned-market deployments.", "E2", "Microsoft alignment came with US-aligned compute-governance commitments; geopolitical posture affects who can procure and where.", { infraBand: "cloud_compute" }),

  entity("humain", "HUMAIN", "subsidiary", "Sovereign / Regional AI", ["Infrastructure Player", "Cloud / Hosting Provider"], 63, 64, 50, "medium", 52, 0.4, 62, 56, [2, 1], [1, 3, 1, 4, 1], [], [], ["Saudi sovereign AI compute buildout"], ["PIF (Saudi sovereign wealth) backing"], ["NVIDIA GPUs"], "HUMAIN is Saudi Arabia's PIF-backed national AI champion, building sovereign compute and model capability. Early-stage but well-capitalised; a sovereignty and regional-access signal for Gulf-market and aligned deployments.", "E1", "Very early; capability and enterprise-readiness evidence outside the region is limited.", { infraBand: "cloud_compute" }),

  entity("sakana", "Sakana AI", "private", "Sovereign / Regional AI", ["Model Provider"], 60, 60, 44, "medium", 50, 0.3, 66, 50, [1, 1], [1, 1, 1, 0, 1], ["Evolutionary / merged models"], [], ["Japan domestic AI infrastructure"], ["Japanese government / strategic backing"], ["GPU supply"], "Sakana AI is Tokyo-based, building Japan's domestic frontier-model capability with a distinctive evolutionary-model research approach. A regional-sovereignty and research-diversity signal more than a current enterprise default.", "E1", "Research-stage positioning; enterprise productisation and controls evidence are early.", { }),
];

// ─────────────────────────────────────────────────────────────────────────
// DERIVED layer-winners. Computed from ENTITIES (top entities per role by
// leadership score) so the "who is winning by layer" view can never disagree
// with the tracked roster — this is the fix for the prior SoftBank-style drift
// where a hand-maintained list named entities that weren't tracked.
// ─────────────────────────────────────────────────────────────────────────

export function rolesFor(e: Entity): Role[] {
  return [e.primaryRole, ...e.secondaryRoles];
}

export const LAYER_DEFS: Array<{ title: string; role: Role; note: string; max: number }> = [
  { title: "Platform Vendors", role: "Platform Vendor", note: "Distribution, cloud control and enterprise-governance depth.", max: 5 },
  { title: "Model Providers", role: "Model Provider", note: "Quality, cadence, deployment paths and model economics.", max: 8 },
  { title: "Application Vendors", role: "Application Vendor", note: "Workflow conversion, domain fit and business-user adoption.", max: 6 },
  { title: "Infrastructure Players", role: "Infrastructure Player", note: "Hosting, scale, deployment and compute access.", max: 6 },
  { title: "Hardware", role: "Hardware Provider", note: "Accelerators, networking, custom silicon and fabrication.", max: 5 },
  { title: "Investors", role: "Investor", note: "Strategic capital, distribution rights and ecosystem influence.", max: 6 },
  { title: "Sovereign / Regional AI", role: "Sovereign / Regional AI", note: "Jurisdiction, data residency and industrial-policy alternatives.", max: 6 },
];

/** Leadership score for an entity IN a specific role (AI-market scope). */
export function roleLeadership(e: Entity, role: Role): number {
  return e.roleScores?.[role]?.leadership ?? e.leadershipScore;
}

export const WINNING_BY_LAYER: Array<{ title: string; names: string[]; note: string }> =
  LAYER_DEFS.map((def) => ({
    title: def.title,
    note: def.note,
    names: ENTITIES
      .filter((e) => rolesFor(e).includes(def.role))
      // Rank by role-specific leadership so a giant only "wins" a layer where it
      // is genuinely strong (e.g. Microsoft does NOT top Models on its 91 composite).
      .sort((a, b) => roleLeadership(b, def.role) - roleLeadership(a, def.role))
      .slice(0, def.max)
      .map((e) => e.name),
  }));
