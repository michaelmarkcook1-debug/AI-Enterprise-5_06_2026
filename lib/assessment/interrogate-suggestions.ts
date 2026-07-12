// Illustrative answer-SHAPES for the Interrogate context form (Surface 1).
// ─────────────────────────────────────────────────────────────────────────────
// FACTUAL-DATA rule: these are examples of the SHAPE of an answer a buyer might
// give — never a market fact, statistic, ranking, or claim about any vendor. They
// scaffold the field; the user always types their own (the combobox's first row is
// "type your own"). Deliberately generic across categories so no example implies a
// vendor is used/recommended. Keyed to InterrogatePanel's ContextForm fields.

export const INTERROGATE_SUGGESTIONS: Record<string, string[]> = {
  incumbents: [
    "Standardised on Azure; ServiceNow for ITSM",
    "AWS-native across the estate",
    "Google Cloud primary",
    "Multi-cloud, no single standard",
    "Mostly on-prem / private cloud",
    "Greenfield — no incumbent to displace",
  ],
  renewalTiming: [
    "Key contract renews within 3 months",
    "Renews within the next year",
    "Just signed — locked in for now",
    "Month-to-month, no lock-in",
    "New purchase — nothing to renew",
  ],
  region: [
    "EU-only — data can't leave the region",
    "US-only",
    "UK + EU",
    "Global, no residency constraint",
    "Data must stay in-country / on-prem",
  ],
  regulatory: [
    "SOC 2 non-negotiable",
    "HIPAA / PHI in scope",
    "GDPR + EU data residency",
    "FedRAMP required",
    "PCI-DSS in scope",
    "No hard regulatory bar",
  ],
  riskAppetite: [
    "Regulated, low tolerance",
    "Balanced — pragmatic",
    "Fast-mover, higher tolerance",
    "Board-sensitive / reputational risk matters most",
  ],
  inHouseSkills: [
    "Small platform team, no ML engineers",
    "Strong in-house data / ML team",
    "Mostly business users, little engineering",
    "Delivered via a systems integrator",
  ],
  timeline: [
    "Live within a quarter",
    "Live within two quarters",
    "This fiscal year",
    "Exploratory — no fixed date",
  ],
};
