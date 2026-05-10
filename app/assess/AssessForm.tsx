"use client";

import { useRouter } from "next/navigation";
import { useState } from "react";
import { OwnershipLegend, VendorNameWithOwnership, ownershipChipClassName } from "@/components/ownership-indicator";

interface Option { id: string; label?: string; name?: string }

interface Props {
  industries: { id: string; name: string }[];
  useCases: { id: string; label: string }[];
  objectives: { id: string; label: string }[];
  ecosystems: string[];
  vendors: { id: string; name: string; category: string; ownershipType: string }[];
}

const STEPS = ["Context", "Use case", "Risk & ecosystem", "Vendors"] as const;

export default function AssessForm({ industries, useCases, objectives, ecosystems, vendors }: Props) {
  const router = useRouter();
  const [step, setStep] = useState(0);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [industry, setIndustry] = useState(industries[0]?.id ?? "");
  const [orgSize, setOrgSize] = useState("enterprise");
  const [aiMaturity, setAiMaturity] = useState("piloting");
  const [region, setRegion] = useState("uk");
  const [primaryObjectives, setPrimaryObjectives] = useState<string[]>(["productivity"]);
  const [selectedUseCases, setSelectedUseCases] = useState<string[]>([]);
  const [dataSensitivity, setDataSensitivity] = useState(3);
  const [riskTolerance, setRiskTolerance] = useState(3);
  const [autonomyAppetite, setAutonomyAppetite] = useState("human_in_loop");
  const [ecosystem, setEcosystem] = useState<string[]>([]);
  const [deploymentPreference, setDeploymentPreference] = useState("saas");
  const [budgetSensitivity, setBudgetSensitivity] = useState(3);
  const [vendorIds, setVendorIds] = useState<string[]>([]);

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
              <p className="text-sm text-zinc-600 dark:text-zinc-400">
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

          {error && <div className="mt-6 rounded-lg bg-red-50 dark:bg-red-950/40 px-4 py-3 text-sm text-red-700 dark:text-red-300">Error: {error}</div>}

          <div className="mt-8 flex items-center justify-between">
            <button
              disabled={step === 0 || submitting}
              onClick={() => setStep((s) => Math.max(0, s - 1))}
              className="rounded-full px-5 py-2 text-sm font-medium text-zinc-700 dark:text-zinc-300 disabled:opacity-40"
            >Back</button>
            {step < STEPS.length - 1 ? (
              <button
                disabled={!canAdvance}
                onClick={() => setStep((s) => s + 1)}
                className="rounded-full bg-zinc-900 dark:bg-white px-6 py-2.5 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-40"
              >Continue</button>
            ) : (
              <button
                disabled={submitting}
                onClick={submit}
                className="rounded-full bg-zinc-900 dark:bg-white px-6 py-2.5 text-sm font-medium text-white dark:text-zinc-900 disabled:opacity-40"
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
  return (
    <select value={value} onChange={(e) => onChange(e.target.value)}
      className="w-full rounded-lg border border-zinc-300 dark:border-zinc-700 bg-white dark:bg-[#071827] px-3 py-2 text-sm">
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
              ? "border-zinc-900 dark:border-white bg-zinc-900 dark:bg-white text-white dark:text-zinc-900"
              : "border-zinc-300 dark:border-zinc-700 hover:bg-zinc-100 dark:hover:bg-zinc-800"}`}
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
