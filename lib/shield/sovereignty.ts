// lib/sovereignty.ts — The Sovereignty Lens. Derived entirely from the Shield's
// own verified marks (lib/shield-data.ts) — never a second, diverging dataset.
// ─────────────────────────────────────────────────────────────────────────────
// Two evidence classes, kept visually and semantically distinct:
//   • "vendor's own document" — the residency/retention marks already fetched
//     and cited in the Shield (same receipt, reused here).
//   • "public record" — the vendor's country of incorporation / parent company
//     HQ. This is uncontested public-record fact (state of incorporation,
//     headquarters address) for named, well-documented companies — not a
//     modelled estimate or a vendor claim, so it carries no vendor citation.
//     Where the Shield ALREADY fetched a parent-company fact (the ⚠ Chinese-
//     parent flags on Alibaba/Z.ai/Moonshot, or DeepSeek's own PRC-storage
//     admission), that fetched fact is the one shown — not a re-derived one.

import { SHIELD, type MarkState } from "./data";

export type SovereigntyFlag = "hard-stop" | "consideration" | "none";

export interface JurisdictionInfo {
  slug: string;
  hqJurisdiction: string; // country / bloc of incorporation or HQ
  flag: SovereigntyFlag;
  flagNote: string; // why — grounded in the Shield's own fetched facts where one exists
}

// HQ / parent jurisdiction — public record for named, well-documented
// companies. The flag and its note are grounded in the Shield's own fetched
// marks (see lib/shield-data.ts) wherever the Shield already established one;
// nothing here contradicts or duplicates a Shield citation.
const JURISDICTIONS: Record<string, JurisdictionInfo> = {
  "openai-api": { slug: "openai-api", hqJurisdiction: "United States", flag: "none", flagNote: "US-incorporated; no foreign-jurisdiction flag." },
  "anthropic-api": { slug: "anthropic-api", hqJurisdiction: "United States", flag: "none", flagNote: "US-incorporated; no foreign-jurisdiction flag." },
  "google-gemini": { slug: "google-gemini", hqJurisdiction: "United States", flag: "none", flagNote: "US-incorporated (Alphabet Inc.); no foreign-jurisdiction flag." },
  "mistral-la-plateforme": { slug: "mistral-la-plateforme", hqJurisdiction: "France / EU", flag: "none", flagNote: "EU-incorporated; own terms default your data to EU hosting." },
  "meta-llama": { slug: "meta-llama", hqJurisdiction: "United States (self-hosted — you choose)", flag: "none", flagNote: "US-incorporated licensor, but structurally irrelevant: self-hosted weights mean YOU control the jurisdiction, not Meta." },
  deepseek: { slug: "deepseek", hqJurisdiction: "China", flag: "hard-stop", flagNote: "DeepSeek's own privacy policy: “we directly collect, process and store your Personal Data in People's Republic of China” — no residency choice offered." },
  cohere: { slug: "cohere", hqJurisdiction: "Canada", flag: "none", flagNote: "Canada-incorporated; offers VPC/on-prem/any-cloud deployment — no foreign-jurisdiction flag." },
  "xai-grok": { slug: "xai-grok", hqJurisdiction: "United States", flag: "none", flagNote: "US-incorporated; no foreign-jurisdiction flag (though residency itself is unverified — see Shield)." },
  "ai21-jamba": { slug: "ai21-jamba", hqJurisdiction: "Israel", flag: "none", flagNote: "Israel-incorporated; own terms list Israel among disclosed hosting regions — no adversarial-jurisdiction flag." },
  "ibm-granite": { slug: "ibm-granite", hqJurisdiction: "United States", flag: "none", flagNote: "US-incorporated; no foreign-jurisdiction flag." },
  "alibaba-qwen": { slug: "alibaba-qwen", hqJurisdiction: "China (hosting stated as Singapore)", flag: "consideration", flagNote: "⚠ Chinese-parented (Alibaba Group) — a sovereignty consideration under PRC law even though the international product's documented hosting is Singapore, not mainland China." },
  "zai-glm": { slug: "zai-glm", hqJurisdiction: "China (hosting stated as Singapore)", flag: "consideration", flagNote: "⚠ Chinese-parented (Zhipu, Beijing) — the Singapore-registered entity's parent is subject to PRC law even though stated hosting is Singapore." },
  "moonshot-kimi": { slug: "moonshot-kimi", hqJurisdiction: "China (hosting stated as Singapore)", flag: "consideration", flagNote: "⚠ Chinese-parented (Moonshot AI, Beijing) — the same Singapore-hosting-vs-PRC-parent gap as Alibaba and Z.ai." },
  reka: { slug: "reka", hqJurisdiction: "United States", flag: "none", flagNote: "Reka's own terms: “controlled and offered by Reka from its facilities in the United States” — no foreign-jurisdiction flag." },
};

export interface SovereigntyRow {
  slug: string;
  vendor: string;
  hqJurisdiction: string;
  flag: SovereigntyFlag;
  flagNote: string;
  residency: { state: MarkState; note: string; source?: { name: string; url: string } };
  retention: { state: MarkState; note: string; source?: { name: string; url: string } };
}

const FLAG_ORDER: Record<SovereigntyFlag, number> = { "hard-stop": 0, consideration: 1, none: 2 };

/** One row per Shield vendor, grouped by flag severity (hard-stop → consideration → none),
 *  ties alphabetical. Pure projection of SHIELD + JURISDICTIONS — no new claims. */
export function sovereigntyRows(): SovereigntyRow[] {
  return SHIELD.map((v) => {
    const j = JURISDICTIONS[v.slug];
    return {
      slug: v.slug,
      vendor: v.vendor,
      hqJurisdiction: j?.hqJurisdiction ?? "Not established",
      flag: j?.flag ?? "none",
      flagNote: j?.flagNote ?? "No jurisdiction fact established yet.",
      residency: v.marks.residency,
      retention: v.marks.retention,
    };
  }).sort((a, b) => FLAG_ORDER[a.flag] - FLAG_ORDER[b.flag] || a.vendor.localeCompare(b.vendor));
}
