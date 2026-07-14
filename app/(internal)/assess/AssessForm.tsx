"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OwnershipLegend, VendorNameWithOwnership, ownershipChipClassName } from "@/components/ownership-indicator";
import { ASSESSMENT_FORM_STATE_KEY, type AssessmentTier } from "@/lib/assessment/tiers";
import { layersForTier, systemsForArchetype } from "@/lib/infrastructure";

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
    /** v1.3 — engine archetypes this workflow belongs to ([] = horizontal). */
    archetypes?: string[];
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
  // ─── v1.3 Opportunity ───
  valueAtStake?: string;
  expectedUplift?: string;
  // ─── v1.3 Strategy ───
  buildVsBuy?: string;
  dataReadiness?: number;
  changeSponsorship?: string;
  // ─── v1.3 Procurement ───
  useCaseRiskClass?: string;
  maxHallucinationTolerance?: string;
  evalEvidenceRequired?: string[];
  expectedConsumption?: string;
  acceptablePricingModels?: string[];
  costCeiling?: string;
  ipAndDataRights?: string[];
  exitRequirements?: string[];
  incumbentAnnualSpend?: string;
  renewalWindow?: string;
  qualifiedAlternatives?: number;
  // ─── v1.3 Infrastructure ───
  selectedSystemsOfRecord?: string[];
}

function loadPersisted(): Partial<PersistedFormState> | null {
  if (typeof window === "undefined") return null;
  try {
    // Try sessionStorage first (instant)
    const raw = window.sessionStorage.getItem(ASSESSMENT_FORM_STATE_KEY);
    if (raw) return JSON.parse(raw) as Partial<PersistedFormState>;
  } catch {}
  return null;
}

function savePersisted(state: PersistedFormState): void {
  if (typeof window === "undefined") return;
  // Write to sessionStorage (instant)
  try {
    window.sessionStorage.setItem(ASSESSMENT_FORM_STATE_KEY, JSON.stringify(state));
  } catch {}
  // Write-through to DB (durable, fire-and-forget)
  import("@/lib/user-state/client").then(({ saveState }) =>
    saveState("assessment_draft", state),
  ).catch(() => {});
}

/** Async loader for DB-backed draft (called once on mount). */
async function loadPersistedFromDb(): Promise<Partial<PersistedFormState> | null> {
  try {
    const { loadState } = await import("@/lib/user-state/client");
    return await loadState<Partial<PersistedFormState>>("assessment_draft");
  } catch {
    return null;
  }
}

export default function AssessForm({ industries, useCases, objectives, vendors, tier = "quick" }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  // Hydrate from sessionStorage on mount so a user switching tiers keeps answers.
  // If sessionStorage is empty, fire a one-time DB fetch to recover the draft.
  const initial = useRef<Partial<PersistedFormState> | null>(null);
  if (initial.current === null && typeof window !== "undefined") {
    initial.current = loadPersisted() ?? {};
  }
  const seed = initial.current ?? {};
  const [dbLoaded, setDbLoaded] = useState(false);

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

  // ─── v1.3 Opportunity (Quick) ─────────────────────────────────
  const [valueAtStake, setValueAtStake] = useState<string>(seed.valueAtStake ?? "");
  const [expectedUplift, setExpectedUplift] = useState<string>(seed.expectedUplift ?? "");

  // ─── v1.3 Strategy (Guided) ───────────────────────────────────
  const [buildVsBuy, setBuildVsBuy] = useState<string>(seed.buildVsBuy ?? "undecided");
  const [dataReadiness, setDataReadiness] = useState<number>(seed.dataReadiness ?? 3);
  const [changeSponsorship, setChangeSponsorship] = useState<string>(seed.changeSponsorship ?? "mid_level");

  // ─── v1.3 Procurement (Advanced) ──────────────────────────────
  const [useCaseRiskClass, setUseCaseRiskClass] = useState<string>(seed.useCaseRiskClass ?? "limited");
  const [maxHallucinationTolerance, setMaxHallucinationTolerance] = useState<string>(seed.maxHallucinationTolerance ?? "moderate");
  const [evalEvidenceRequired, setEvalEvidenceRequired] = useState<string[]>(seed.evalEvidenceRequired ?? []);
  const [expectedConsumption, setExpectedConsumption] = useState<string>(seed.expectedConsumption ?? "department");
  const [acceptablePricingModels, setAcceptablePricingModels] = useState<string[]>(seed.acceptablePricingModels ?? []);
  const [costCeiling, setCostCeiling] = useState<string>(seed.costCeiling ?? "");
  const [ipAndDataRights, setIpAndDataRights] = useState<string[]>(seed.ipAndDataRights ?? []);
  const [exitRequirements, setExitRequirements] = useState<string[]>(seed.exitRequirements ?? []);
  const [incumbentAnnualSpend, setIncumbentAnnualSpend] = useState<string>(seed.incumbentAnnualSpend ?? "");
  const [renewalWindow, setRenewalWindow] = useState<string>(seed.renewalWindow ?? "no_incumbent");
  const [qualifiedAlternatives, setQualifiedAlternatives] = useState<number>(seed.qualifiedAlternatives ?? 2);

  // ─── v1.3 Infrastructure ──────────────────────────────────────
  const [selectedSystemsOfRecord, setSelectedSystemsOfRecord] = useState<string[]>(seed.selectedSystemsOfRecord ?? []);

  // One-time DB hydration when sessionStorage was empty (new device / cleared cache).
  useEffect(() => {
    if (dbLoaded || Object.keys(seed).length > 1) return; // Already have local data
    loadPersistedFromDb().then((db) => {
      if (db && Object.keys(db).length > 0) {
        // Backfill fields from DB — only if current field still has the default value
        if (db.industry && industry === (industries[0]?.id ?? "")) setIndustry(db.industry);
        if (db.orgSize) setOrgSize(db.orgSize);
        if (db.region) setRegion(db.region);
        if (db.primaryObjectives?.length) setPrimaryObjectives(db.primaryObjectives);
        if (db.selectedUseCases?.length) setSelectedUseCases(db.selectedUseCases);
        if (db.dataSensitivity) setDataSensitivity(db.dataSensitivity);
        if (db.riskTolerance) setRiskTolerance(db.riskTolerance);
        if (db.autonomyAppetite) setAutonomyAppetite(db.autonomyAppetite);
        if (db.ecosystem?.length) setEcosystem(db.ecosystem);
        if (db.deploymentPreference) setDeploymentPreference(db.deploymentPreference);
        if (db.budgetSensitivity) setBudgetSensitivity(db.budgetSensitivity);
      }
      setDbLoaded(true);
    });
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

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
      // v1.3
      valueAtStake, expectedUplift,
      buildVsBuy, dataReadiness, changeSponsorship,
      useCaseRiskClass, maxHallucinationTolerance, evalEvidenceRequired,
      expectedConsumption, acceptablePricingModels, costCeiling,
      ipAndDataRights, exitRequirements,
      incumbentAnnualSpend, renewalWindow, qualifiedAlternatives,
      selectedSystemsOfRecord,
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
    valueAtStake, expectedUplift,
    buildVsBuy, dataReadiness, changeSponsorship,
    useCaseRiskClass, maxHallucinationTolerance, evalEvidenceRequired,
    expectedConsumption, acceptablePricingModels, costCeiling,
    ipAndDataRights, exitRequirements,
    incumbentAnnualSpend, renewalWindow, qualifiedAlternatives,
    selectedSystemsOfRecord,
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
          // v1.3 — Opportunity value block + infra (all tiers; omit empties)
          ...(valueAtStake ? { valueAtStake } : {}),
          ...(expectedUplift ? { expectedUplift } : {}),
          ...(selectedSystemsOfRecord.length > 0 ? { selectedSystemsOfRecord } : {}),
          // v1.2 — Guided fields (only when tier offers them)
          ...(tier !== "quick" ? {
            governanceStrictness,
            integrationDepth,
            humanReviewModel,
            lockInTolerance,
            dataResidency,
            // v1.3 — Strategy readiness
            buildVsBuy,
            dataReadiness,
            changeSponsorship,
          } : {}),
          // v1.2 + v1.3 — Advanced fields (only on advanced tier)
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
            useCaseRiskClass,
            maxHallucinationTolerance,
            evalEvidenceRequired,
            expectedConsumption,
            acceptablePricingModels,
            exitRequirements,
            ipAndDataRights,
            renewalWindow,
            qualifiedAlternatives,
            ...(costCeiling ? { costCeiling } : {}),
            ...(incumbentAnnualSpend ? { incumbentAnnualSpend } : {}),
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
    <div className="text-[#123d2c]">
      <main className="mx-auto max-w-3xl">
        <div className="mb-8">
          <div className="flex items-center gap-2 text-sm text-[#4c5d75]">
            {STEPS.map((s, i) => (
              <div key={s} className="flex items-center gap-2">
                <span className={`inline-block h-2 w-2 rounded-full ${i <= step ? "bg-[#0d1f17] dark:bg-white" : "bg-[#d6c9a8] dark:bg-[#1c3d5c]"}`} />
                <span className={i === step ? "font-medium text-[#123d2c] dark:text-white" : ""}>{s}</span>
                {i < STEPS.length - 1 && <span className="text-[#c2d1e0] dark:text-[#64798f]">→</span>}
              </div>
            ))}
          </div>
          <h1 className="mt-4 text-3xl font-semibold tracking-tight">{STEPS[step]}</h1>
        </div>

        <div className="rounded-lg border border-[#e6dcc3] bg-white p-8">
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
              <Field label={`Use cases — tailored to ${industries.find((i) => i.id === industry)?.name ?? "your industry"}`}>
                <WorkflowPicker
                  workflows={useCases}
                  industry={industry}
                  selected={selectedUseCases}
                  onToggle={(id) => toggle(selectedUseCases, setSelectedUseCases, id)}
                />
              </Field>

              {/* v1.3 — Value & ROI block. Turns the Opportunity tier from a
                  vendor-fit list into a value-ranked opportunity view. */}
              <div className="rounded-lg border border-[#e3d9c0] bg-[#faf7ef] p-4">
                <div className="mb-1 text-sm font-semibold text-[#123d2c]">Value at stake (optional)</div>
                <p className="mb-3 text-xs text-[#4c5d75]">Range-based, so it informs prioritisation without false precision.</p>
                <div className="grid gap-4 sm:grid-cols-2">
                  <Field label="Annual value the use case is worth">
                    <Select value={valueAtStake} onChange={setValueAtStake} options={[
                      { value: "", label: "— not sure —" },
                      { value: "lt_250k", label: "< £250k" },
                      { value: "250k_1m", label: "£250k – £1M" },
                      { value: "1m_5m", label: "£1M – £5M" },
                      { value: "5m_25m", label: "£5M – £25M" },
                      { value: "gt_25m", label: "> £25M" },
                    ]} />
                  </Field>
                  <Field label="Realistic target uplift on the objective">
                    <Select value={expectedUplift} onChange={setExpectedUplift} options={[
                      { value: "", label: "— not sure —" },
                      { value: "lt_10", label: "< 10%" },
                      { value: "10_25", label: "10 – 25%" },
                      { value: "25_50", label: "25 – 50%" },
                      { value: "gt_50", label: "> 50%" },
                    ]} />
                  </Field>
                </div>
              </div>
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
              <Field label="Existing infrastructure & ecosystem">
                <InfraPicker
                  tier={tier}
                  industry={industry}
                  industryName={industries.find((i) => i.id === industry)?.name ?? "your industry"}
                  ecosystem={ecosystem}
                  onToggleItem={(id) => toggle(ecosystem, setEcosystem, id)}
                  sors={selectedSystemsOfRecord}
                  onToggleSor={(id) => toggle(selectedSystemsOfRecord, setSelectedSystemsOfRecord, id)}
                />
              </Field>
            </div>
          )}

          {STEPS[step] === "Vendors" && (
            <div className="space-y-4">
              <p className="text-sm text-[#3f5068]">
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
              {/* v1.3 — Strategy readiness: the top predictors of pilot success. */}
              <Field label="Build vs buy posture">
                <Select value={buildVsBuy} onChange={setBuildVsBuy} options={[
                  { value: "undecided", label: "Undecided — help me decide" },
                  { value: "buy_saas", label: "Buy SaaS — turnkey product" },
                  { value: "buy_configure", label: "Buy + configure on a platform" },
                  { value: "build_on_platform", label: "Build on a platform / framework" },
                  { value: "build_from_scratch", label: "Build from scratch" },
                ]} />
              </Field>
              <Slider
                label="Data readiness"
                value={dataReadiness}
                onChange={setDataReadiness}
                hint="1 = no usable data · 5 = clean, governed, labelled. Weak data is the #1 cause of pilot failure."
              />
              <Field label="Change sponsorship">
                <Select value={changeSponsorship} onChange={setChangeSponsorship} options={[
                  { value: "none", label: "None — no named sponsor" },
                  { value: "mid_level", label: "Mid-level — a manager is driving it" },
                  { value: "exec", label: "Executive — a named exec owns it" },
                  { value: "board", label: "Board-level mandate" },
                ]} />
              </Field>
              <p className="text-[11px] text-[#4c5d75]">
                These inputs adjust pillar weights and apply vendor-by-vendor penalties. Build posture
                shifts weight to integration + resilience; weak data readiness and sponsorship raise
                adoption friction. Sovereignty + missing certifications can escalate to exclusion on Advanced.
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
              {/* v1.3 — EU AI Act risk + model-quality bar */}
              <Field label="EU AI Act — use-case risk class">
                <Select value={useCaseRiskClass} onChange={setUseCaseRiskClass} options={[
                  { value: "minimal", label: "Minimal risk" },
                  { value: "limited", label: "Limited risk (transparency duties)" },
                  { value: "high_risk", label: "High-risk (Annex III) — FRIA + oversight" },
                  { value: "prohibited_adjacent", label: "Prohibited-adjacent — extreme caution" },
                ]} />
              </Field>
              <Field label="Max hallucination tolerance">
                <Select value={maxHallucinationTolerance} onChange={setMaxHallucinationTolerance} options={[
                  { value: "zero", label: "Zero — needs E4+ reliability evidence" },
                  { value: "low", label: "Low — needs strong reliability" },
                  { value: "moderate", label: "Moderate" },
                  { value: "best_effort", label: "Best-effort" },
                ]} />
              </Field>
              <Field label="Required evaluation evidence">
                <ChipGroup
                  options={[
                    { id: "independent_eval", label: "Independent eval / benchmark" },
                    { id: "red_team_report", label: "Red-team report" },
                    { id: "model_card", label: "Model card" },
                    { id: "safety_eval", label: "Safety eval" },
                  ]}
                  selected={evalEvidenceRequired}
                  onToggle={(id) => toggle(evalEvidenceRequired, setEvalEvidenceRequired, id)}
                />
              </Field>

              {/* v1.3 — Cost & consumption model (makes the TCO horizon usable) */}
              <Field label="Expected consumption scale">
                <Select value={expectedConsumption} onChange={setExpectedConsumption} options={[
                  { value: "pilot", label: "Pilot (< 10 users / low volume)" },
                  { value: "department", label: "Department" },
                  { value: "business_unit", label: "Business unit" },
                  { value: "enterprise_wide", label: "Enterprise-wide" },
                ]} />
              </Field>
              <Field label="Acceptable pricing models">
                <ChipGroup
                  options={[
                    { id: "per_seat", label: "Per seat" },
                    { id: "per_token", label: "Per token / consumption" },
                    { id: "committed_use", label: "Committed use" },
                    { id: "flat_platform", label: "Flat platform" },
                    { id: "outcome_based", label: "Outcome-based" },
                  ]}
                  selected={acceptablePricingModels}
                  onToggle={(id) => toggle(acceptablePricingModels, setAcceptablePricingModels, id)}
                />
              </Field>
              <Field label="Hard annual cost ceiling (optional)">
                <Select value={costCeiling} onChange={setCostCeiling} options={[
                  { value: "", label: "— no ceiling set —" },
                  { value: "lt_100k", label: "< £100k" },
                  { value: "100k_500k", label: "£100k – £500k" },
                  { value: "500k_2m", label: "£500k – £2M" },
                  { value: "2m_10m", label: "£2M – £10M" },
                  { value: "gt_10m", label: "> £10M" },
                ]} />
              </Field>

              {/* v1.3 — IP & exit */}
              <Field label="Required IP / data rights">
                <ChipGroup
                  options={[
                    { id: "no_training_on_data", label: "No training on our data" },
                    { id: "output_ip_owned", label: "Output IP owned by us" },
                    { id: "ip_indemnification", label: "IP indemnification" },
                    { id: "audit_rights", label: "Audit rights" },
                  ]}
                  selected={ipAndDataRights}
                  onToggle={(id) => toggle(ipAndDataRights, setIpAndDataRights, id)}
                />
              </Field>
              <Field label="Exit / reversibility requirements">
                <ChipGroup
                  options={[
                    { id: "contractual_offramp", label: "Contractual off-ramp" },
                    { id: "open_format_export", label: "Open-format data export" },
                    { id: "model_config_portability", label: "Model + config portability" },
                    { id: "parallel_run", label: "Parallel-run support" },
                  ]}
                  selected={exitRequirements}
                  onToggle={(id) => toggle(exitRequirements, setExitRequirements, id)}
                />
              </Field>

              {/* v1.3 — Fact-derived negotiation leverage (replaces the slider) */}
              <div className="rounded-lg border border-[#e3d9c0] bg-[#faf7ef] p-4">
                <div className="mb-1 text-sm font-semibold text-[#123d2c]">Negotiation leverage — from facts</div>
                <p className="mb-3 text-xs text-[#4c5d75]">Derived from objective facts rather than a self-rating.</p>
                <div className="grid gap-4 sm:grid-cols-3">
                  <Field label="Incumbent annual spend">
                    <Select value={incumbentAnnualSpend} onChange={setIncumbentAnnualSpend} options={[
                      { value: "", label: "— n/a —" },
                      { value: "none", label: "No incumbent" },
                      { value: "lt_250k", label: "< £250k" },
                      { value: "250k_1m", label: "£250k – £1M" },
                      { value: "1m_5m", label: "£1M – £5M" },
                      { value: "gt_5m", label: "> £5M" },
                    ]} />
                  </Field>
                  <Field label="Renewal window">
                    <Select value={renewalWindow} onChange={setRenewalWindow} options={[
                      { value: "no_incumbent", label: "No incumbent / greenfield" },
                      { value: "lt_3mo", label: "< 3 months" },
                      { value: "3_6mo", label: "3 – 6 months" },
                      { value: "6_12mo", label: "6 – 12 months" },
                      { value: "gt_12mo", label: "> 12 months" },
                    ]} />
                  </Field>
                  <Field label="Qualified alternatives">
                    <Select value={String(qualifiedAlternatives)} onChange={(v) => setQualifiedAlternatives(Number(v))} options={[
                      { value: "0", label: "0" }, { value: "1", label: "1" }, { value: "2", label: "2" },
                      { value: "3", label: "3" }, { value: "4", label: "4" }, { value: "5", label: "5+" },
                    ]} />
                  </Field>
                </div>
              </div>

              <p className="text-[11px] text-[#4c5d75]">
                These inputs feed the procurement-grade overlay in scoring engine v1.3, matched against
                structured vendor data (certifications, regions, deployment models, systems-of-record).
                Hard sovereignty + missing required certifications can exclude vendors; a zero-hallucination
                bar caps the deployment band for vendors without strong reliability evidence.
              </p>
            </div>
          )}

          {error && <div className="mt-6 rounded-lg bg-red-50 px-4 py-3 text-sm text-red-700">Error: {error}</div>}

          <div className="mt-8 flex items-center justify-between">
            <button
              disabled={step === 0 || submitting}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="rounded-full px-5 py-2 text-sm font-medium text-[#2e3f57] disabled:opacity-40"
            >Back</button>
            {step < STEPS.length - 1 ? (
              <button
                disabled={!canAdvance}
                onClick={() => setStep((s) => s + 1)}
                className="rounded-full bg-[#0d1f17] px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
              >Continue</button>
            ) : (
              <button
                disabled={submitting}
                onClick={submit}
                className="rounded-full bg-[#0d1f17] px-6 py-2.5 text-sm font-medium text-white disabled:opacity-40"
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
  // and inherit the parent's text-[#123d2c], producing invisible dark-on-dark.
  return (
    <select
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-[#d6c9a8] bg-white px-3 py-2 text-sm text-[#123d2c]"
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
              ? "border-[#0b2519] bg-[#0d1f17] text-white"
              : "border-[#d6c9a8] text-[#2e3f57] hover:bg-[#ece3cb]"}`}
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
  workflows: allWorkflows,
  industry,
  selected,
  onToggle,
}: {
  workflows: Props["useCases"];
  industry: string;
  selected: string[];
  onToggle: (id: string) => void;
}) {
  const [query, setQuery] = useState("");

  // v1.3 — tailor to the selected industry: keep horizontal workflows (no
  // archetypes) plus industry-specific ones whose archetypes include the
  // chosen industry. A financial buyer no longer sees factory-floor workflows.
  const workflows = allWorkflows.filter(
    (w) => !(w.archetypes && w.archetypes.length > 0) || w.archetypes.includes(industry),
  );

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
        className="w-full rounded-md border border-[#e3d9c0] bg-white px-3 py-2 text-sm placeholder:text-[#6b7d93] focus:border-emerald-500 focus:outline-none focus:ring-1 focus:ring-emerald-500 dark:border-[#2a4a6b] dark:bg-[#0d1f17] dark:text-[#eef3f8]"
        aria-label="Filter workflows"
      />

      {/* Category accordions */}
      {grouped.size === 0 ? (
        <p className="text-sm italic text-[#4c5d75]">No workflows match &ldquo;{query}&rdquo;.</p>
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
                className="rounded-lg border border-[#e3d9c0] bg-white dark:border-[#223a2e] dark:bg-[#0d1f17]"
              >
                <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[#20314a] marker:text-[#6b7d93] dark:text-[#eef3f8]">
                  <span className="inline-flex items-center gap-2">
                    <span>{cat}</span>
                    <span className="rounded-full bg-[#ece3cb] px-1.5 py-0.5 text-[10px] font-medium text-[#3f5068] dark:bg-[#143049] dark:text-[#c2d1e0]">
                      {rows.length}
                    </span>
                    {selCount > 0 && (
                      <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                        {selCount} selected
                      </span>
                    )}
                  </span>
                </summary>
                <div className="border-t border-[#ece4d0] px-3 py-2 dark:border-[#223a2e]">
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
                              ? "bg-[#0d1f17] text-white dark:bg-white dark:text-[#123d2c]"
                              : "bg-[#ece3cb] text-[#2e3f57] hover:bg-[#e3d9c0] dark:bg-[#143049] dark:text-[#c2d1e0] dark:hover:bg-[#1c3d5c]"
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

/**
 * InfraPicker — v1.3 layered, tier-aware, industry-gated infrastructure
 * selector. Replaces the flat ecosystem ChipGroup. Layers are progressively
 * disclosed (Quick shows the high-level layers; Advanced surfaces the
 * gateway / observability / governance rails). The systems-of-record section
 * is tailored to the selected industry archetype.
 */
function InfraPicker({
  tier,
  industry,
  industryName,
  ecosystem,
  onToggleItem,
  sors,
  onToggleSor,
}: {
  tier: AssessmentTier;
  industry: string;
  industryName: string;
  ecosystem: string[];
  onToggleItem: (id: string) => void;
  sors: string[];
  onToggleSor: (id: string) => void;
}) {
  const layers = layersForTier(tier);
  const systems = systemsForArchetype(industry);
  const ecoSet = new Set(ecosystem);
  const sorSet = new Set(sors);

  const chip = (on: boolean) =>
    `rounded-full px-3 py-1 text-xs transition-colors ${
      on
        ? "bg-[#0d1f17] text-white dark:bg-white dark:text-[#123d2c]"
        : "bg-[#ece3cb] text-[#2e3f57] hover:bg-[#e3d9c0] dark:bg-[#143049] dark:text-[#c2d1e0] dark:hover:bg-[#1c3d5c]"
    }`;

  return (
    <div className="space-y-1.5">
      <p className="text-[11px] text-[#4c5d75]">
        Select what you already run, by layer. Vendors native to your stack score higher on
        integration fit; heavy single-vendor concentration surfaces a lock-in caution.
      </p>
      {layers.map((layer, i) => {
        const selCount = layer.items.filter((it) => ecoSet.has(it.id)).length;
        return (
          <details key={layer.id} open={i < 2 || selCount > 0} className="rounded-lg border border-[#e3d9c0] bg-white dark:border-[#223a2e] dark:bg-[#0d1f17]">
            <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[#20314a] marker:text-[#6b7d93] dark:text-[#eef3f8]">
              <span className="inline-flex flex-wrap items-center gap-2">
                <span>{layer.label}</span>
                {selCount > 0 && (
                  <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">
                    {selCount} selected
                  </span>
                )}
                <span className="text-[11px] font-normal text-[#6b7d93]">{layer.hint}</span>
              </span>
            </summary>
            <div className="flex flex-wrap gap-1.5 border-t border-[#ece4d0] px-3 py-2 dark:border-[#223a2e]">
              {layer.items.map((it) => (
                <button key={it.id} type="button" onClick={() => onToggleItem(it.id)} aria-pressed={ecoSet.has(it.id)} className={chip(ecoSet.has(it.id))}>
                  {it.label}{it.open && <span className="ml-1 opacity-60">· open</span>}
                </button>
              ))}
            </div>
          </details>
        );
      })}

      {systems.length > 0 && (
        <details open className="rounded-lg border border-sky-300 bg-sky-50 dark:border-sky-800 dark:bg-sky-950/30">
          <summary className="cursor-pointer select-none px-3 py-2 text-sm font-semibold text-[#123d2c] marker:text-sky-500 dark:text-[#eef3f8]">
            <span className="inline-flex flex-wrap items-center gap-2">
              <span>Systems of record — {industryName}</span>
              <span className="rounded-full bg-sky-500 px-1.5 py-0.5 text-[9px] font-bold uppercase leading-none text-white">industry</span>
              {sorSet.size > 0 && (
                <span className="rounded-full bg-emerald-100 px-1.5 py-0.5 text-[10px] font-medium text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300">{sorSet.size} selected</span>
              )}
            </span>
          </summary>
          <div className="flex flex-wrap gap-1.5 border-t border-sky-200 px-3 py-2 dark:border-sky-900">
            {systems.map((s) => (
              <button key={s.id} type="button" onClick={() => onToggleSor(s.id)} aria-pressed={sorSet.has(s.id)} title={`${s.category}${s.standard ? ` · ${s.standard}` : ""}`} className={chip(sorSet.has(s.id))}>
                {s.label}{s.standard && <span className="ml-1 opacity-60">· {s.standard}</span>}
              </button>
            ))}
          </div>
        </details>
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
      <div className="mt-1 text-xs text-[#4c5d75]">{hint}</div>
    </div>
  );
}
