"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OwnershipLegend, VendorNameWithOwnership, ownershipChipClassName } from "@/components/ownership-indicator";
import { ASSESSMENT_FORM_STATE_KEY, type AssessmentTier } from "@/lib/assessment/tiers";

interface Option { id: string; label?: string; name?: string }

interface Props {
  industries: { id: string; name: string }[];
  useCases: {
    id: string;
    label: string;
    /**
     * Optional taxonomy fields supplied by the v2 workflow library.
     * When the parent page passes these, the form renders collapsible
     * category sections + per-chip tooltips. When undefined (older
     * callers), it falls back to the original flat ChipGroup.
     */
    category?: string;
    subcategory?: string;
    description?: string;
  }[];
  objectives: { id: string; label: string }[];
  ecosystems: string[];
  vendors: { id: string; name: string; category: string; ownershipType: string }[];
  tier?: AssessmentTier;
}

/**
 * Per-tier step plan. Quick stays as the 4-step v1 wizard. Guided
 * inserts a Governance step between Risk and Vendors. Advanced
 * inserts both Governance and Procurement.
 */
const STEPS_BY_TIER: Record<AssessmentTier, readonly string[]> = {
  quick: ["Context", "Use case", "Risk & ecosystem", "Vendors"],
  guided: ["Context", "Use case", "Risk & ecosystem", "Governance", "Vendors"],
  advanced: ["Context", "Use case", "Risk & ecosystem", "Governance", "Procurement", "Vendors"],
};

interface PersistedFormState {
  industry: string;
  orgSize: string;
  aiMaturity: string;
  region: string;
  primaryObjectives: string[];
  selectedUseCases: string[];
  dataSensitivity: number;
  riskTolerance: number;
  autonomyAppetite: string;
  ecosystem: string[];
  deploymentPreference: string;
  budgetSensitivity: number;
  vendorIds: string[];
  // ─── Guided (v1.2) ───
  governanceStrictness?: number;
  integrationDepth?: string;
  humanReviewModel?: string;
  lockInTolerance?: string;
  dataResidency?: string;
  // ─── Advanced (v1.2) ───
  switchingCostTolerance?: number;
  sovereigntyRequirement?: string;
  rfpCycle?: string;
  stackAppetite?: string;
  concentrationRiskTolerance?: string;
  tcoHorizon?: string;
  negotiationPower?: string;
  requiredCertifications?: string[];
  outputMode?: string;
}

function loadPersisted(): Partial<PersistedFormState> | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = window.sessionStorage.getItem(ASSESSMENT_FORM_STATE_KEY);
    if (!raw) return null;
    return JSON.parse(raw) as Partial<PersistedFormState>;
  } catch {
    return null;
  }
}

function savePersisted(state: PersistedFormState): void {
  if (typeof window === "undefined") return;
  try {
    window.sessionStorage.setItem(ASSESSMENT_FORM_STATE_KEY, JSON.stringify(state));
  } catch {
    // sessionStorage may be unavailable (privacy mode) — proceed without persistence.
  }
}

export default function AssessForm({ industries, useCases, objectives, ecosystems, vendors, tier = "quick" }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from sessionStorage on mount so a user switching tiers keeps answers.
  const initial = useRef<Partial<PersistedFormState> | null>(null);
  if (initial.current === null && typeof window !== "undefined") {
    initial.current = loadPersisted() ?? {};
  }
  const seed = initial.current ?? {};

  const [industry, setIndustry] = useState(seed.industry ?? industries[0]?.id ?? "");
  const [orgSize, setOrgSize] = useState(seed.orgSize ?? "enterprise");
  const [aiMaturity, setAiMaturity] = useState(seed.aiMaturity ?? "piloting");
  const [region, setRegion] = useState(seed.region ?? "uk");
  const [primaryObjectives, setPrimaryObjectives] = useState<string[]>(seed.primaryObjectives ?? ["productivity"]);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>(seed.selectedUseCases ?? []);
  const [dataSensitivity, setDataSensitivity] = useState(seed.dataSensitivity ?? 3);
  const [riskTolerance, setRiskTolerance] = useState(seed.riskTolerance ?? 3);
  const [autonomyAppetite, setAutonomyAppetite] = useState(seed.autonomyAppetite ?? "human_in_loop");
  const [ecosystem, setEcosystem] = useState<string[]>(seed.ecosystem ?? []);
  const [deploymentPreference, setDeploymentPreference] = useState(seed.deploymentPreference ?? "saas");
  const [budgetSensitivity, setBudgetSensitivity] = useState(seed.budgetSensitivity ?? 3);
  const [vendorIds, setVendorIds] = useState<string[]>(seed.vendorIds ?? []);

  // ─── v1.2 Guided state ────────────────────────────────────────
  const [governanceStrictness, setGovernanceStrictness] = useState<number>(seed.governanceStrictness ?? 3);
  const [integrationDepth, setIntegrationDepth] = useState<string>(seed.integrationDepth ?? "moderate");
  const [humanReviewModel, setHumanReviewModel] = useState<string>(seed.humanReviewModel ?? "sampling");
  const [lockInTolerance, setLockInTolerance] = useState<string>(seed.lockInTolerance ?? "cautious");
  const [dataResidency, setDataResidency] = useState<string>(seed.dataResidency ?? "no_constraint");

  // ─── v1.2 Advanced state ──────────────────────────────────────
  const [switchingCostTolerance, setSwitchingCostTolerance] = useState<number>(seed.switchingCostTolerance ?? 3);
  const [sovereigntyRequirement, setSovereigntyRequirement] = useState<string>(seed.sovereigntyRequirement ?? "none");
  const [rfpCycle, setRfpCycle] = useState<string>(seed.rfpCycle ?? "structured");
  const [stackAppetite, setStackAppetite] = useState<string>(seed.stackAppetite ?? "two_to_three");
  const [concentrationRiskTolerance, setConcentrationRiskTolerance] = useState<string>(seed.concentrationRiskTolerance ?? "balanced");
  const [tcoHorizon, setTcoHorizon] = useState<string>(seed.tcoHorizon ?? "3_year");
  const [negotiationPower, setNegotiationPower] = useState<string>(seed.negotiationPower ?? "medium");
  const [requiredCertifications, setRequiredCertifications] = useState<string[]>(seed.requiredCertifications ?? []);
  const [outputMode, setOutputMode] = useState<string>(seed.outputMode ?? "buyer");

  // Persist whenever any input changes so a tier switch never loses state.
  useEffect(() => {
    savePersisted({
      industry, orgSize, aiMaturity, region,
      primaryObjectives, selectedUseCases,
      dataSensitivity, riskTolerance, autonomyAppetite,
      ecosystem, deploymentPreference, budgetSensitivity,
      vendorIds,
      // Guided
      governanceStrictness, integrationDepth, humanReviewModel,
      lockInTolerance, dataResidency,
      // Advanced
      switchingCostTolerance, sovereigntyRequirement, rfpCycle,
      stackAppetite, concentrationRiskTolerance, tcoHorizon,
      negotiationPower, requiredCertifications, outputMode,
    });
  }, [
    industry, orgSize, aiMaturity, region,
    primaryObjectives, selectedUseCases,
    dataSensitivity, riskTolerance, autonomyAppetite,
    ecosystem, deploymentPreference, budgetSensitivity,
    vendorIds,
    governanceStrictness, integrationDepth, humanReviewModel,
    lockInTolerance, dataResidency,
    switchingCostTolerance, sovereigntyRequirement, rfpCycle,
    stackAppetite, concentrationRiskTolerance, tcoHorizon,
    negotiationPower, requiredCertifications, outputMode,
  ]);

  // The active step plan for the user's chosen tier.
  const STEPS = STEPS_BY_TIER[tier];

  function toggle(arr: string[], setter: (v: string[]) => void, id: string) {
    setter(arr.includes(id) ? arr.filter((x) => x !== id) : [...arr, id]);
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const res = await fetch("/api/assessment/score", {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          industry,
          region,
          orgSize,
          aiMaturity,
          primaryObjectives,
          useCases: selectedUseCases.length > 0 ? selectedUseCases : ["knowledge_assistant"],
          dataSensitivity,
          riskTolerance,
          autonomyAppetite,
          ecosystem,
          deploymentPreference,
          budgetSensitivity,
          vendorIds,
          // v1.2 — Guided fields (only when tier offers them)
          ...(tier !== "quick" ? {
            governanceStrictness,
            integrationDepth,
            humanReviewModel,
            lockInTolerance,
            dataResidency,
          } : {}),
          // v1.2 — Advanced fields (only on advanced tier)
          ...(tier === "advanced" ? {
            switchingCostTolerance,
            sovereigntyRequirement,
            rfpCycle,
            stackAppetite,
            concentrationRiskTolerance,
            tcoHorizon,
            negotiationPower,
            requiredCertifications,
            outputMode,
          } : {}),
        }),
      });
      if (!res.ok) {
        const body = await res.json().catch(() => ({}));
        throw new Error(body.error ?? `HTTP ${res.status}`);
      }
      const data = await res.json();
      sessionStorage.setItem(`assessment_${data.runId}`, JSON.stringify(data));
      router.push(`/results/${encodeURIComponent(data.runId)}`);
    } catch (e) {
      setError((e as Error).message);
      setSubmitting(false);
    }
  }

  const canAdvance = (() => {
    const name = STEPS[step];
    if (name === "Context") return Boolean(industry && orgSize);
    if (name === "Use case") return primaryObjectives.length > 0 && selectedUseCases.length > 0;
    if (name === "Risk & ecosystem") return Boolean(autonomyAppetite && deploymentPreference);
    if (name === "Governance") return Boolean(integrationDepth && humanReviewModel && lockInTolerance);
    if (name === "Procurement") return Boolean(sovereigntyRequirement && rfpCycle && stackAppetite);
    return true;
  })();

  return (
    <div className="text-zinc-900">
      <main className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-zinc-500">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${i <= step ? "bg-zinc-900 dark:bg-white" : "bg-zinc-300 dark:bg-zinc-700"}`} />
                <span className={i === step ? "font-medium text-zinc-900 dark:text-white" : ""}>{s}</span>
                {i < STEPS.length - 1 && <span className="text-zinc-300 dark:text-zinc-700">→</span>}
              </div>
            ))}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{STEPS[step]}</h1>
        </div>

        <div className="rounded-lg border border-[#dfe4da] bg-white p-8">
          {STEPS[step] === "Context" && (
            <div className="space-y-6">
              <Field label="Industry archetype">
                <Select value={industry} onChange={setIndustry} options={industries.map((i) => ({ value: i.id, label: i.name }))} />
              </Field>
              <Field label="Organisation size">
                <Select value={orgSize} onChange={setOrgSize} options={[
                  { value: "smb", label: "Small / mid-market (< 1,000 employees)" },
                  { value: "mid_market", label: "Mid-market (1k–5k)" },
                  { value: "enterprise", label: "Enterprise (5k–50k)" },
                  { value: "global_enterprise", label: "Global enterprise (50k+)" },
                ]} />
              </Field>
              <Field label="AI maturity (optional)">
                <Select value={aiMaturity} onChange={setAiMaturity} options={[
                  { value: "exploring", label: "Exploring" },
                  { value: "piloting", label: "Piloting" },
                  { value: "scaling", label: "Scaling" },
                  { value: "operating", label: "Operating at scale" },
                ]} />
              </Field>
              <Field label="Primary region">
                <Select value={region} onChange={setRegion} options={[
                  { value: "uk", label: "United Kingdom" }, { value: "eu", label: "European Union" },
                  { value: "us", label: "United States" }, { value: "apac", label: "Asia-Pacific" },
                  { value: "global", label: "Global" },
                ]} />
              </Field>
            </div>
          )}

          {STEPS[step] === "Use case" && (
            <div className="space-y-6">
              <Field label="Primary objectives">
                <ChipGroup options={objectives.map((o) => ({ id: o.id, label: o.label }))}
                  selected={primaryObjectives}
                  onToggle={(id) => toggle(primaryObjectives, setPrimaryObjectives, id)} />
              </Field>
              <Field label="Use cases">
                <WorkflowPicker
                  workflows={useCases}
                  selected={selectedUseCases}
                  onToggle={(id) => toggle(selectedUseCases, setSelectedUseCases, id)}
                />
              </Field>
            </div>
          )}

          {STEPS[step] === "Risk & ecosystem" && (
            <div className="space-y-6">
              <Slider label="Data sensitivity" value={dataSensitivity} onChange={setDataSensitivity} hint="1 = public, 5 = highly regulated" />
              <Slider label="Risk tolerance" value={riskTolerance} onChange={setRiskTolerance} hint="1 = zero tolerance, 5 = high tolerance" />
              <Slider label="Budget sensitivity" value={budgetSensitivity} onChange={setBudgetSensitivity} hint="1 = budget no constraint, 5 = highly constrained" />
              <Field label="Autonomy appetite">
                <Select value={autonomyAppetite} onChange={setAutonomyAppetite} options={[
                  { value: "advisory_only", label: "Advisory only" },
                  { value: "human_in_loop", label: "Human-in-the-loop" },
                  { value: "supervised_agent", label: "Supervised agent" },
                  { value: "autonomous", label: "Autonomous" },
                ]} />
              </Field>
              <Field label="Deployment preference">
                <Select value={deploymentPreference} onChange={setDeploymentPreference} options={[
                  { value: "saas", label: "SaaS / multi-tenant" },
                  { value: "vpc", label: "VPC / dedicated tenant" },
                  { value: "on_prem", label: "On-premises" },
                  { value: "sovereign", label: "Sovereign cloud" },
                  { value: "hybrid", label: "Hybrid" },
                ]} />
              </Field>
              <Field label="Existing ecosystem">
                <ChipGroup options={ecosystems.map((e) => ({ id: e, label: e.replace(/_/g, " ") }))}
                  selected={ecosystem}
                  onToggle={(id) => toggle(ecosystem, setEcosystem, id)} />
              </Field>
            </div>
          )}

          {STEPS[step] === "Vendors" && (
            <div className="space-y-4">
              <p className="text-sm text-zinc-600">
                Select vendors to compare, or leave empty to score the full universe.
              </p>
              <OwnershipLegend />
              <VendorChipGroup
                vendors={vendors}
                selected={vendorIds}
                onToggle={(id) => toggle(vendorIds, setVendorIds, id)}
              />
            </div>
          )}

          {/* v1.2 — Governance step (Guided + Advanced) */}
          {STEPS[step] === "Governance" && (
            <div className="space-y-6">
              <Slider
                label="Governance strictness"
                value={governanceStrictness}
                onChange={setGovernanceStrictness}
                hint="1 = light-touch, 5 = SOX-strict end-to-end controls"
              />
              <Field label="Integration depth">
                <Select
                  value={integrationDepth}
                  onChange={setIntegrationDepth}
                  options={[
                    { value: "shallow", label: "Shallow — point integration, sandbox" },
                    { value: "moderate", label: "Moderate — connects to 1–2 systems" },
                    { value: "deep", label: "Deep — touches several systems of record" },
                    { value: "core_system", label: "Core system — replaces / extends ERP / CRM / EHR" },
                  ]}
                />
              </Field>
              <Field label="Human-review model">
                <Select
                  value={humanReviewModel}
                  onChange={setHumanReviewModel}
                  options={[
                    { value: "no_review", label: "No review — outputs flow direct to user / system" },
                    { value: "sampling", label: "Sampling — periodic spot-check by humans" },
                    { value: "approval_gate", label: "Approval gate — every output reviewed before action" },
                    { value: "dual_approval", label: "Dual approval — two humans must sign off" },
                  ]}
                />
              </Field>
              <Field label="Lock-in tolerance">
                <Select
                  value={lockInTolerance}
                  onChange={setLockInTolerance}
                  options={[
                    { value: "averse", label: "Averse — prefer portable / multi-cloud architectures" },
                    { value: "cautious", label: "Cautious — limit unique vendor dependencies" },
                    { value: "comfortable", label: "Comfortable — single stack is fine if best-of-breed" },
                    { value: "indifferent", label: "Indifferent — let the technology decide" },
                  ]}
                />
              </Field>
              <Field label="Data residency">
                <Select
                  value={dataResidency}
                  onChange={setDataResidency}
                  options={[
                    { value: "no_constraint", label: "No residency constraint" },
                    { value: "us_only", label: "US only" },
                    { value: "eu_only", label: "EU only" },
                    { value: "uk_only", label: "UK only" },
                    { value: "apac_only", label: "APAC only" },
                    { value: "sovereign_required", label: "Sovereign — must match selected region" },
                  ]}
                />
              </Field>
              <p className="text-[11px] text-zinc-500">
                These five inputs adjust pillar weights and apply vendor-by-vendor penalties.
                Sovereignty + missing certifications can escalate to exclusion on Advanced.
              </p>
            </div>
          )}

          {/* v1.2 — Procurement step (Advanced only) */}
          {STEPS[step] === "Procurement" && (
            <div className="space-y-6">
              <Slider
                label="Switching-cost tolerance"
                value={switchingCostTolerance}
                onChange={setSwitchingCostTolerance}
                hint="1 = will accept high re-platforming cost · 5 = zero appetite"
              />
              <Field label="Sovereignty requirement">
                <Select
                  value={sovereigntyRequirement}
                  onChange={setSovereigntyRequirement}
                  options={[
                    { value: "none", label: "None" },
                    { value: "soft", label: "Soft — prefer in-region, 6-pt penalty otherwise" },
                    { value: "hard", label: "Hard — exclude non-domiciled vendors" },
                  ]}
                />
              </Field>
              <Field label="RFP / procurement cycle">
                <Select
                  value={rfpCycle}
                  onChange={setRfpCycle}
                  options={[
                    { value: "informal", label: "Informal — buyer's choice" },
                    { value: "structured", label: "Structured — internal review" },
                    { value: "formal_rfp", label: "Formal RFP — multi-vendor comparison" },
                    { value: "public_procurement", label: "Public procurement — government / EU rules" },
                  ]}
                />
              </Field>
              <Field label="Stack appetite">
                <Select
                  value={stackAppetite}
                  onChange={setStackAppetite}
                  options={[
                    { value: "single_vendor", label: "Single vendor — one generalist" },
                    { value: "two_to_three", label: "Two to three — balanced" },
                    { value: "best_of_breed", label: "Best-of-breed — multiple specialists" },
                  ]}
                />
              </Field>
              <Field label="Concentration-risk tolerance">
                <Select
                  value={concentrationRiskTolerance}
                  onChange={setConcentrationRiskTolerance}
                  options={[
                    { value: "avoid_concentration", label: "Avoid concentration — diversify cloud + vendor" },
                    { value: "balanced", label: "Balanced" },
                    { value: "accept_concentration", label: "Accept concentration — single dominant vendor OK" },
                  ]}
                />
              </Field>
              <Field label="TCO horizon">
                <Select
                  value={tcoHorizon}
                  onChange={setTcoHorizon}
                  options={[
                    { value: "1_year", label: "1 year" },
                    { value: "3_year", label: "3 years" },
                    { value: "5_year", label: "5 years" },
                    { value: "10_year", label: "10 years — strategic horizon" },
                  ]}
                />
              </Field>
              <Field label="Negotiation power">
                <Select
                  value={negotiationPower}
                  onChange={setNegotiationPower}
                  options={[
                    { value: "low", label: "Low — vendor sets the terms" },
                    { value: "medium", label: "Medium — equal leverage" },
                    { value: "high", label: "High — buyer drives the contract" },
                  ]}
                />
              </Field>
              <Field label="Required certifications">
                <ChipGroup
                  options={[
                    { id: "soc2_type2", label: "SOC 2 Type II" },
                    { id: "iso_27001", label: "ISO 27001" },
                    { id: "iso_42001", label: "ISO 42001 (AI)" },
                    { id: "hipaa", label: "HIPAA" },
                    { id: "fedramp_moderate", label: "FedRAMP Moderate" },
                    { id: "fedramp_high", label: "FedRAMP High" },
                    { id: "pci_dss", label: "PCI-DSS" },
                    { id: "gdpr_eu_dpa", label: "GDPR / EU DPA" },
                    { id: "eu_ai_act_high_risk", label: "EU AI Act high-risk" },
                    { id: "uk_gov_g_cloud", label: "UK Gov G-Cloud" },
                  ]}
                  selected={requiredCertifications}
                  onToggle={(id) => toggle(requiredCertifications, setRequiredCertifications, id)}
                />
              </Field>
              <Field label="Output mode">
                <Select
                  value={outputMode}
                  onChange={setOutputMode}
                  options={[
                    { value: "executive", label: "Executive summary" },
                    { value: "buyer", label: "Buyer detail" },
                    { value: "technical", label: "Technical breakdown" },
                    { value: "procurement", label: "Procurement-pack format" },
                  ]}
                />
              </Field>
              <p className="text-[11px] text-zinc-500">
                These inputs feed the procurement-grade overlay in scoring engine v1.2.
                Hard sovereignty + missing required certifications can exclude vendors;
                lock-in / concentration preferences tilt vendor-resilience weight.
              </p>
            </div>
          )}

          {error && <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Error: {error}</div>}

          <div className="mt-8 flex items-center justify-between">
            <button
              disabled={step === 0 || submitting}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="rounded-full px-5 py-2 text-sm font-medium text-zinc-700 disabled:opacity-40"
            >Back</button>
            {step < STEPS.length - 1 ? (
              <button
                disabled={!canAdvance}
                onClick={() => setStep((s) => s + 1)}
                className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >Continue</button>
            ) : (
              <button
                disabled={submitting}
                onClick={submit}
                className="rounded-full bg-zinc-900 px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >{submitting ? "Scoring…" : "Run assessment"}</button>
            )}
          </div>
        </div>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <div className="mb-2 text-sm font-medium">{label}</div>
      {children}
    </label>
  );
}

function Select({ value, onChange, options }: { value: string; onChange: (v: string) => void; options: { value: string; label: string }[] }) {
  // Form card is always bg-white (regardless of theme), so the select must
  // stay light too — dark: variants here would clash with the white surround
  // and inherit the parent's text-zinc-900, producing invisible dark-on-dark.
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-zinc-300 bg-white px-3 py-2 text-sm text-zinc-900"
    >
      {options.map((o) => <option key={o.value} value={o.value}>{o.label}</option>)}
    </select>
  );
}

function ChipGroup({ options, selected, onToggle }: { options: Option[]; selected: string[]; onToggle: (id: string) => void }) {
  return (
    <div className="flex flex-wrap gap-2">
      {options.map((o) => {
        const on = selected.includes(o.id);
        return (
          <button
            key={o.id}
            type="button"
            onClick={() => onToggle(o.id)}
            className={`rounded-full border px-3 py-1.5 text-xs ${on
              ? "border-zinc-900 bg-zinc-900 text-white"
              : "border-zinc-300 text-zinc-700 hover:bg-zinc-100"}`}
          >{o.label ?? o.name}</button>
        );
      })}
    </div>
  );
}

function VendorChipGroup({
  vendors,
  selected,
  onToggle,
}: {
  vendors: { id: string; name: string; category: string; ownershipType: string }[];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {vendors.map((vendor) => {
        const on = selected.includes(vendor.id);
        return (
          <button
            key={vendor.id}
            type="button"
            onClick={() => onToggle(vendor.id)}
            className={`rounded-full border px-3 py-1.5 text-xs ${ownershipChipClassName(vendor.ownershipType, on)}`}
          >
            <VendorNameWithOwnership name={vendor.name} ownershipType={vendor.ownershipType} />
            <span className="ml-1 opacity-70">- {vendor.category}</span>
          </button>
        );
      })}
    </div>
  );
}

/**
 * WorkflowPicker — replaces the flat ChipGroup for use cases.
 *
 * Behaviour:
 *   - When the workflow list is small (≤12), renders as a flat
 *     ChipGroup so the Quick tier doesn't suffer extra friction.
 *   - When larger, renders one collapsible <details> per category.
 *     Selected counts surface in the summary header so users can scan
 *     which categories they've engaged.
 *   - A search input filters across label + description + category.
 *     A category is auto-expanded when it contains a match.
 *   - Each chip shows a native <title> tooltip when description is set.
 *   - Active selections always render in a sticky strip above the
 *     picker so the user never loses sight of what's chosen when
 *     drilling into deep categories.
 */
function WorkflowPicker({
  workflows,
  selected,
  onToggle,
}: {
  workflows: Props["useCases"];
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  const selectedSet = new Set(selected);
  const selectedRows = workflows.filter((w) => selectedSet.has(w.id));

  // Fall back to a flat ChipGroup when the list is short — preserves
  // the Quick-tier UX while the Guided/Advanced tiers benefit from
  // collapsible categories.
  const SMALL_LIST_CUTOFF = 12;
  if (workflows.length <= SMALL_LIST_CUTOFF) {
    return (
      <ChipGroup
        options={workflows.map((w) => ({ id: w.id, label: w.label }))}
        selected={selected}
        onToggle={onToggle}
      />
    );
  }

  const q = query.trim().toLowerCase();
  const matches = (w: Props["useCases"][number]): boolean => {
    if (q.length === 0) return true;
    return (
      w.label.toLowerCase().includes(q)
      || (w.category?.toLowerCase().includes(q) ?? false)
      || (w.subcategory?.toLowerCase().includes(q) ?? false)
      || (w.description?.toLowerCase().includes(q) ?? false)
    );
  };

  // Group by category, preserving insertion order from the upstream
  // workflow taxonomy.
  const grouped = new Map<string, typeof workflows>();
  for (const w of workflows) {
    if (!matches(w)) continue;
    const key = w.category ?? "Other";
    const bucket = grouped.get(key) ?? [];
    bucket.push(w);
    grouped.set(key, bucket);
  }

  const categoryHasSelection = (rows: typeof workflows): boolean =>
    rows.some((r) => selectedSet.has(r.id));

  return (
    <div className="space-y-3">
      {/* Selection strip — always visible. */}
      {selectedRows.length > 0 && (
        <div className="flex flex-wrap gap-1.5 rounded-lg border border-emerald-200 bg-emerald-50/70 px-2 py-2 dark:border-emerald-900/60 dark:bg-emerald-950/30">
          {selectedRows.map((w) => (
            <button
              key={w.id}
              type="button"
              onClick={() => onToggle(w.id)}
              title={w.description}
              className="rounded-full bg-emerald-700 px-2 py-0.5 text-xs font-medium text-white hover:bg-emerald-800 dark:bg-emerald-500 dark:text-emerald-950 dark:hover:bg-emerald-400"
            >
              {w.label} <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}

      {/* Search */}
      <input
        type="text"
        placeholder={`Search ${workflows.length} workflows by name, category, or description…`}
        value={query}
        onChange={(e) => setQuery(e.target.value)}
        className="w-full rounded-md border border-zinc-200 bg-white px-3 py-2 text-sm placeholder:text-zinc-400 focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-100"
        aria-label="Filter workflows"
      />

      {/* Category accordions */}
      {grouped.size === 0 ? (
        <p className="text-sm italic text-zinc-500">No workflows match &ldquo;{query}&rdquo;.</p>
      ) : (
        <div className="space-y-1.5">
          {Array.from(grouped.entries()).map(([cat, rows]) => {
            const hasMatch = q.length > 0;
            const hasSelection = categoryHasSelection(rows);
            const open = hasMatch || hasSelection;
            const selCount = rows.filter((r) => selectedSet.has(r.id)).length;
            return (
              <details
                key={cat}
                open={open}
                className="rounded-lg border border-zinc-200 bg-white dark:border-zinc-800 dark:bg-zinc-900"
              >
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-zinc-800 marker:text-zinc-400 dark:text-zinc-100">
                  <span className="inline-flex items-center gap-2">
                    <span>{cat}</span>
                    <span className="rounded-full bg-zinc-100 px-1.5 py-0.5 text-[10px] font-medium text-zinc-600 dark:bg-zinc-800 dark:text-zinc-300">
                      {rows.length}
                    </span>
                    {selCount > 0 && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                        {selCount} selected
                      </span>
                    )}
                  </span>
                </summary>
                <div className="border-t border-zinc-100 px-3 py-2 dark:border-zinc-800">
                  <div className="flex flex-wrap gap-1.5">
                    {rows.map((w) => {
                      const isSel = selectedSet.has(w.id);
                      return (
                        <button
                          key={w.id}
                          type="button"
                          onClick={() => onToggle(w.id)}
                          aria-pressed={isSel}
                          title={w.description}
                          className={`rounded-full px-3 py-1 text-xs transition-colors ${
                            isSel
                              ? "bg-zinc-900 text-white dark:bg-white dark:text-zinc-900"
                              : "bg-zinc-100 text-zinc-700 hover:bg-zinc-200 dark:bg-zinc-800 dark:text-zinc-300 dark:hover:bg-zinc-700"
                          }`}
                        >
                          {w.label}
                          {w.subcategory && (
                            <span className="ml-1 opacity-60">· {w.subcategory}</span>
                          )}
                        </button>
                      );
                    })}
                  </div>
                </div>
              </details>
            );
          })}
        </div>
      )}
    </div>
  );
}

function Slider({ label, value, onChange, hint }: { label: string; value: number; onChange: (v: 1 | 2 | 3 | 4 | 5) => void; hint: string }) {
  return (
    <div>
      <div className="mb-1 flex items-center justify-between">
        <span className="text-sm font-medium">{label}</span>
        <span className="font-mono text-sm">{value}</span>
      </div>
      <input
        type="range"
        min={1}
        max={5}
        value={value}
        onChange={(e) => onChange(Number(e.target.value) as 1 | 2 | 3 | 4 | 5)}
        className="w-full"
      />
      <div className="mt-1 text-xs text-zinc-500">{hint}</div>
    </div>
  );
}
