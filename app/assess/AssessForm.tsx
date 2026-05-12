"use client";

import { useRouter } from "next/navigation";
import { useEffect, useRef, useState } from "react";
import { OwnershipLegend, VendorNameWithOwnership, ownershipChipClassName } from "@/components/ownership-indicator";
import { ASSESSMENT_FORM_STATE_KEY, type AssessmentTier } from "@/lib/assessment/tiers";

interface Option { id: string; label?: string; name?: string }

interface Props {
  industries: { id: string; name: string }[];
  useCases: { id: string; label: string }[];
  objectives: { id: string; label: string }[];
  ecosystems: string[];
  vendors: { id: string; name: string; category: string; ownershipType: string }[];
  tier?: AssessmentTier;
}

const STEPS = ["Context", "Use case", "Risk & ecosystem", "Vendors"] as const;

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

  // Persist whenever any input changes so a tier switch never loses state.
  useEffect(() => {
    savePersisted({
      industry, orgSize, aiMaturity, region,
      primaryObjectives, selectedUseCases,
      dataSensitivity, riskTolerance, autonomyAppetite,
      ecosystem, deploymentPreference, budgetSensitivity,
      vendorIds,
    });
  }, [
    industry, orgSize, aiMaturity, region,
    primaryObjectives, selectedUseCases,
    dataSensitivity, riskTolerance, autonomyAppetite,
    ecosystem, deploymentPreference, budgetSensitivity,
    vendorIds,
  ]);

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
    if (step === 0) return Boolean(industry && orgSize);
    if (step === 1) return primaryObjectives.length > 0 && selectedUseCases.length > 0;
    if (step === 2) return Boolean(autonomyAppetite && deploymentPreference);
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
          {step === 0 && (
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

          {step === 1 && (
            <div className="space-y-6">
              <Field label="Primary objectives">
                <ChipGroup options={objectives.map((o) => ({ id: o.id, label: o.label }))}
                  selected={primaryObjectives}
                  onToggle={(id) => toggle(primaryObjectives, setPrimaryObjectives, id)} />
              </Field>
              <Field label="Use cases">
                <ChipGroup options={useCases.map((u) => ({ id: u.id, label: u.label }))}
                  selected={selectedUseCases}
                  onToggle={(id) => toggle(selectedUseCases, setSelectedUseCases, id)} />
              </Field>
            </div>
          )}

          {step === 2 && (
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

          {step === 3 && (
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

          {tier === "guided" && step === STEPS.length - 1 && (
            <div className="mt-8 rounded-lg border border-sky-200 bg-sky-50 px-4 py-3 text-sm text-sky-900 dark:border-sky-900/60 dark:bg-sky-950/30 dark:text-sky-200">
              <div className="font-semibold">Guided depth (Phase 1B)</div>
              <p className="mt-1 text-xs">
                Guided adds adaptive follow-ups, governance strictness, integration depth, and human-review model.
                These inputs ship in Phase 1B per ASSESSMENT_GRANULARITY_UPGRADE_PLAN.md — your current answers are
                preserved and will be re-used when Phase 1B lands.
              </p>
            </div>
          )}

          {tier === "advanced" && step === STEPS.length - 1 && (
            <div className="mt-8 rounded-lg border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/30 dark:text-amber-200">
              <div className="font-semibold">Advanced depth (Phase 1B)</div>
              <p className="mt-1 text-xs">
                Advanced adds procurement-grade inputs (switching cost, sovereignty, RFP cycle), the four output
                modes (Executive · Buyer · Technical · Procurement), and stack-based recommendations per
                ASSESSMENT_MULTI_VENDOR_STACK_OUTPUT_PLAN.md. Your current answers are preserved and will be
                re-used when Phase 1B lands.
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
