"use client";

import { useMemo, useRef, useState } from "react";
import { Confidence, EvidenceBadge, Panel, ScoreBar, SeedDataBadge } from "@/components/intelligence-ui";
import { OwnershipLegend, VendorNameWithOwnership } from "@/components/ownership-indicator";
import {
  calculateScatterDomain,
  compatiblePrivateExposureOptions,
  createSimulationState,
  defaultPrivateExposureForUniverse,
  generateRandomShock,
} from "@/lib/investing/simulator";
import { deriveSignalAdjustedDelta } from "@/lib/market-signals/engine";
import type {
  IndirectExposure,
  InvestmentProviderProfile,
  IPOProfile,
  ScenarioPoint,
  ShockEvent,
  SimulationInput,
  SimulationPortfolio,
  SimulationResult,
} from "@/lib/investing/types";

const DISCLAIMER = "Investor Tools are for market intelligence and hypothetical scenario modelling only. They are not financial advice. Outputs are based on documented, estimated, inferred, or seed data as labelled. Future returns are not guaranteed.";
const PRIVATE_WARNING = "Private companies and IPO watchlist providers may not be directly investable by retail users.";
const PRIVATE_EXPOSURE_OPTIONS: SimulationInput["includePrivateExposure"][] = ["no", "indirect_only", "ipo_watchlist"];
const INVESTMENT_UNIVERSE_OPTIONS: SimulationInput["investmentUniverse"][] = ["public_only", "public_and_indirect", "ipo_watch", "speculative_all", "single_stock"];
const GLOBAL_RISK_CLIMATE_OPTIONS: NonNullable<SimulationInput["globalRiskClimate"]>[] = ["calm", "elevated", "tense", "crisis"];
const GLOBAL_RISK_CLIMATE_GUIDANCE: Record<NonNullable<SimulationInput["globalRiskClimate"]>, string> = {
  calm: "Benign macro / political backdrop. Slight tailwind: ~+50 bps annualised, shock penalties dampened.",
  elevated: "Today's baseline: mixed news flow, ongoing AI-regulation headlines, no acute crisis. Neutral.",
  tense: "Sustained geopolitical tension, regulatory escalation, or macro stress. ~-120 bps drag, shocks amplified ~18%.",
  crisis: "Acute global crisis (war, financial dislocation, sweeping AI restrictions). ~-280 bps drag, shocks amplified ~42%.",
};
const UNIVERSE_GUIDANCE: Record<SimulationInput["investmentUniverse"], string> = {
  public_only: "Public Only blocks private providers and IPO-watch names. Private exposure is disabled.",
  public_and_indirect: "Public + Indirect uses public instruments only, while showing documented or seed-labelled links to private AI providers.",
  ipo_watch: "IPO Watch blocks public direct holdings. It is for private/watchlist scenario analysis, not direct ownership.",
  speculative_all: "Speculative All allows public, IPO-watch, and higher-risk infrastructure exposures for scenario modelling.",
  single_stock: "Single Stock isolates exactly one public direct ticker, optionally compared with a benchmark basket or cash. IPO-watch and private names are excluded.",
};
const PRIVATE_EXPOSURE_GUIDANCE: Record<SimulationInput["investmentUniverse"], string> = {
  public_only: "Private exposure is unavailable because this universe is constrained to public direct holdings.",
  public_and_indirect: "IPO-watchlist exposure is blocked here; choose IPO Watch or Speculative All for private/watchlist scenarios.",
  ipo_watch: "Indirect-only exposure is blocked because this mode models IPO-watch providers directly as scenario items.",
  speculative_all: "All private exposure views are available, but outputs remain seed-labelled and hypothetical.",
  single_stock: "Private exposure is disabled in single-stock mode; this view focuses on one public ticker.",
};

type SimulatorPreset = {
  id: string;
  label: string;
  description: string;
  apply: (current: SimulationInput) => SimulationInput;
};

const PRESETS: SimulatorPreset[] = [
  {
    id: "conservative_growth",
    label: "Conservative growth",
    description: "Public-only, balanced risk, 15% cash, calm climate. Low surprise.",
    apply: (current) => ({
      ...current,
      riskProfile: "conservative",
      allocationStyle: "model_guided",
      investmentUniverse: "public_only",
      includePrivateExposure: "no",
      cashReservePct: 0,
      horizonYears: 5,
      globalRiskClimate: "calm",
      selectedVendorIds: [],
      manualAllocations: {},
    }),
  },
  {
    id: "balanced_ai",
    label: "Balanced AI bet",
    description: "Public + indirect exposure, balanced risk, 8% cash. Default starting point.",
    apply: (current) => ({
      ...current,
      riskProfile: "balanced",
      allocationStyle: "model_guided",
      investmentUniverse: "public_and_indirect",
      includePrivateExposure: "indirect_only",
      cashReservePct: 0,
      horizonYears: 5,
      globalRiskClimate: "elevated",
      selectedVendorIds: [],
      manualAllocations: {},
    }),
  },
  {
    id: "ipo_upside",
    label: "IPO upside",
    description: "IPO watch universe, aggressive risk, 5% cash. Wider bands, higher dispersion.",
    apply: (current) => ({
      ...current,
      riskProfile: "aggressive",
      allocationStyle: "model_guided",
      investmentUniverse: "ipo_watch",
      includePrivateExposure: "ipo_watchlist",
      cashReservePct: 0,
      horizonYears: 3,
      globalRiskClimate: "elevated",
      selectedVendorIds: [],
      manualAllocations: {},
    }),
  },
  {
    id: "speculative_all",
    label: "Speculative all",
    description: "Everything in: public + IPO + infra, speculative risk profile.",
    apply: (current) => ({
      ...current,
      riskProfile: "speculative",
      allocationStyle: "model_guided",
      investmentUniverse: "speculative_all",
      includePrivateExposure: "ipo_watchlist",
      cashReservePct: 0,
      horizonYears: 5,
      globalRiskClimate: "tense",
      selectedVendorIds: [],
      manualAllocations: {},
    }),
  },
];

const exposureColors: Record<string, string> = {
  public_platform: "#2f5d50",
  ai_infrastructure: "#0f766e",
  enterprise_workflow_ai: "#2563eb",
  data_analytics_ai: "#7c3aed",
  indirect_private_exposure: "#a16207",
  ipo_watch: "#be185d",
  private_inaccessible: "#71717a",
  cash: "#64748b",
};

type Props = {
  initialInput: SimulationInput;
  initialPortfolio: SimulationPortfolio;
  initialResult: SimulationResult;
  providers: InvestmentProviderProfile[];
  ipoWatch: IPOProfile[];
  indirectExposures: IndirectExposure[];
};

export default function InvestmentSimulatorClient({
  initialInput,
  initialPortfolio,
  initialResult,
  providers,
  ipoWatch,
  indirectExposures,
}: Props) {
  const [input, setInput] = useState(() => coerceClientInput(initialInput));
  const [shockEvent, setShockEvent] = useState<ShockEvent | null>(null);
  const providerById = useMemo(() => new Map(providers.map((provider) => [provider.id, provider])), [providers]);
  const state = useMemo(() => createSimulationState(input, providers, shockEvent), [input, providers, shockEvent]);
  const portfolio = state.portfolio ?? { ...initialPortfolio, holdings: state.selectedHoldings };
  const result = state.result ?? initialResult;
  const hasIntegrityError = state.errors.length > 0;
  const blockedPrivateExposureOptions = disabledPrivateExposureOptions(input.investmentUniverse);

  // Portfolio-weighted signal-overlay delta — surfaced on the chart so the user
  // can see exactly what the overlay is contributing per year. Memoised on the
  // portfolio shape so it only recomputes when allocations or the toggle change.
  const signalOverlay = useMemo(() => {
    if (!input.applySignalOverlay) return null;
    const perHolding = portfolio.holdings
      .filter((h) => h.exposureType !== "cash" && h.providerId !== "cash")
      .map((h) => {
        const d = deriveSignalAdjustedDelta(h.providerId, 0.09, 0.18);
        return {
          providerId: h.providerId,
          name: h.name ?? h.providerId,
          weightPct: h.weightPct,
          deltaPp: (d.signalAdjustedAnnualReturn - d.baseAnnualReturn) * 100,
          contributingSignalIds: d.contributingSignalIds,
          confidenceScore: d.confidenceScore,
        };
      });
    const portfolioWeight = perHolding.reduce((sum, p) => sum + p.weightPct, 0) || 1;
    const portfolioDeltaPp = perHolding.reduce((sum, p) => sum + p.deltaPp * (p.weightPct / portfolioWeight), 0);
    const positives = perHolding.filter((p) => p.deltaPp > 0).sort((a, b) => b.deltaPp - a.deltaPp).slice(0, 2);
    const negatives = perHolding.filter((p) => p.deltaPp < 0).sort((a, b) => a.deltaPp - b.deltaPp).slice(0, 2);
    const avgConfidence = Math.round(perHolding.reduce((sum, p) => sum + p.confidenceScore, 0) / Math.max(1, perHolding.length));
    return { perHolding, portfolioDeltaPp, positives, negatives, avgConfidence };
  }, [input.applySignalOverlay, portfolio.holdings]);

  function setField<K extends keyof SimulationInput>(key: K, value: SimulationInput[K]) {
    if (key === "investmentUniverse" || key === "includePrivateExposure") setShockEvent(null);
    setInput((current) => {
      const next = { ...current, [key]: value };
      if (key === "investmentUniverse") {
        const investmentUniverse = value as SimulationInput["investmentUniverse"];
        return {
          ...next,
          includePrivateExposure: defaultPrivateExposureForUniverse(investmentUniverse),
          selectedVendorIds: [],
          manualAllocations: {},
        };
      }
      if (key === "includePrivateExposure") {
        const includePrivateExposure = value as SimulationInput["includePrivateExposure"];
        if (!compatiblePrivateExposureOptions(current.investmentUniverse).includes(includePrivateExposure)) {
          return {
            ...current,
            includePrivateExposure: defaultPrivateExposureForUniverse(current.investmentUniverse),
            selectedVendorIds: [],
            manualAllocations: {},
          };
        }
      }
      if (key === "allocationStyle" && value !== "manual") return { ...next, selectedVendorIds: [], manualAllocations: {} };
      return next;
    });
  }

  function applyBoardShock() {
    setShockEvent(generateRandomShock(input.horizonYears, input.investmentUniverse, input.riskProfile, state.stateHash, providers));
  }

  function addManualVendor(providerId: string) {
    if (!providerId || input.selectedVendorIds?.includes(providerId)) return;
    setInput((current) => ({
      ...current,
      selectedVendorIds: [...(current.selectedVendorIds ?? []), providerId],
      manualAllocations: { ...(current.manualAllocations ?? {}), [providerId]: 0 },
    }));
  }

  function removeManualVendor(providerId: string) {
    setInput((current) => {
      const allocations = { ...(current.manualAllocations ?? {}) };
      delete allocations[providerId];
      return {
        ...current,
        selectedVendorIds: (current.selectedVendorIds ?? []).filter((id) => id !== providerId),
        manualAllocations: allocations,
      };
    });
  }

  function setManualAllocation(providerId: string, weightPct: number) {
    setInput((current) => ({
      ...current,
      manualAllocations: { ...(current.manualAllocations ?? {}), [providerId]: weightPct },
    }));
  }

  function applyPreset(preset: SimulatorPreset) {
    setShockEvent(null);
    setInput((current) => preset.apply(current));
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3 rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-900/70 dark:bg-amber-950/50 dark:text-amber-200">
        <SeedDataBadge label="Scenario tool" reason="Hypothetical simulator, not financial advice." />
        <span>{DISCLAIMER}</span>
      </div>

      <div className="rounded-lg border border-[#dfe4da] bg-white p-4 dark:border-zinc-800 dark:bg-[#071827]">
        <div className="mb-3 flex flex-wrap items-center justify-between gap-2">
          <div>
            <h2 className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">Quick start</h2>
            <p className="mt-0.5 text-xs text-[#697362] dark:text-zinc-400">Pick a preset to load a sensible starting configuration. The chart updates live as you tune inputs below — no &ldquo;run&rdquo; button required.</p>
          </div>
          <span className="inline-flex items-center gap-1.5 rounded-full bg-emerald-50 px-2.5 py-1 text-[11px] font-semibold text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
            <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" /> Auto-updating
          </span>
        </div>
        <div className="grid gap-2 md:grid-cols-4">
          {PRESETS.map((preset) => (
            <button
              key={preset.id}
              type="button"
              onClick={() => applyPreset(preset)}
              className="rounded-md border border-[#dfe4da] bg-[#f7f8f5] p-3 text-left transition-colors hover:border-[#2f5d50] hover:bg-[#eef2e8] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:border-emerald-400 dark:hover:bg-zinc-800"
            >
              <div className="text-sm font-semibold text-[#18201b] dark:text-zinc-100">{preset.label}</div>
              <div className="mt-1 text-[11px] leading-4 text-[#697362] dark:text-zinc-400">{preset.description}</div>
            </button>
          ))}
        </div>
      </div>

      <div className="grid gap-4 md:grid-cols-5">
        <SummaryCard label="Starting capital" value={formatCurrency(input.startingCapital)} note="Seed model" />
        <SummaryCard label="Time horizon" value={`${input.horizonYears}y`} note={input.rebalanceFrequency} />
        <SummaryCard label="Risk profile" value={title(input.riskProfile)} note={input.allocationStyle.replace(/_/g, " ")} />
        <SummaryCard label="Universe" value={input.investmentUniverse.replace(/_/g, " ")} note={input.region} />
        <SummaryCard label="Confidence" value={hasIntegrityError ? "Blocked" : `${result.confidenceScore.toFixed(0)}/100`} note="weighted evidence" />
      </div>

      <div className="rounded-lg border border-[#dfe4da] bg-white p-3 text-xs leading-5 text-[#596151] dark:border-zinc-800 dark:bg-[#071827] dark:text-zinc-400">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex flex-wrap items-center gap-2">
            <SeedDataBadge label="Live scenario" provenance="live" reason="Scenario engine recomputes deterministically from your inputs." />
            <span>Recomputes on every input change</span>
          </div>
          <span className="font-mono text-[10px] text-[#9da696] dark:text-zinc-600" title="Internal state fingerprint — used for deterministic test harness">{state.stateHash.slice(0, 10)}</span>
        </div>
        {shockEvent && <p className="mt-2 text-amber-800 dark:text-amber-300">{shockEvent.displayMessage}</p>}
      </div>

      <ConfigBanner errors={state.errors} />

      <div className="grid gap-5 xl:grid-cols-[0.72fr_1.45fr_0.83fr]">
        <Panel title="Inputs and assumptions">
          <div className="space-y-3">
            {/* ─────── ESSENTIALS — always visible ─────── */}
            <SectionHeader>Essentials</SectionHeader>
            <Field label="Starting capital" info="Capital base used to calculate holding amounts and scenario paths.">
              <div className="relative">
                <span className="pointer-events-none absolute left-3 top-1/2 -translate-y-1/2 text-sm text-[#697362] dark:text-zinc-500">$</span>
                <input
                  className="w-full rounded-md border border-[#d8ded0] bg-white px-3 py-2 pl-7 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  min={100}
                  step={500}
                  type="number"
                  value={input.startingCapital}
                  onChange={(event) => setField("startingCapital", Number(event.target.value))}
                />
              </div>
              {input.startingCapital < 100 && (
                <div className="mt-1 text-xs text-amber-700 dark:text-amber-300">
                  Minimum $100 — simulation will run as if you entered $100.
                </div>
              )}
            </Field>
            <Field label="Horizon" info="Number of years to model. Changes scenario path length, shock timing, drawdown, and x-axis scale.">
              <Segmented
                value={`${input.horizonYears}`}
                options={["1", "3", "5", "10"]}
                onChange={(value) => setField("horizonYears", Number(value) as SimulationInput["horizonYears"])}
              />
            </Field>
            <Field label="Risk profile" info="Risk appetite adjusts scenario return multipliers, shock severity, model selection, and risk radar.">
              <Select value={input.riskProfile} options={["conservative", "balanced", "aggressive", "speculative"]} onChange={(value) => setField("riskProfile", value as SimulationInput["riskProfile"])} />
            </Field>
            <Field label="Investment universe" info="Controls eligible vendors. Public Only excludes private names; IPO Watch excludes public direct holdings.">
              <Select value={input.investmentUniverse} options={INVESTMENT_UNIVERSE_OPTIONS} onChange={(value) => setField("investmentUniverse", value as SimulationInput["investmentUniverse"])} />
              <GuidanceNote>{UNIVERSE_GUIDANCE[input.investmentUniverse]}</GuidanceNote>
            </Field>

            {/* ─────── STRATEGY — collapsible, default open ─────── */}
            <CollapsibleSection title="Strategy & allocation" defaultOpen>
              <Field label="Allocation style" info="Model-guided builds the portfolio for you. Manual lets you pick vendors and weights. Single Stock isolates one ticker.">
                <Select value={input.allocationStyle} options={["model_guided", "manual", "single_stock", "thesis_based"]} onChange={(value) => setField("allocationStyle", value as SimulationInput["allocationStyle"])} />
              </Field>

              {/* Decision-tree collapse: only show Private Exposure when the
                  current universe actually offers a meaningful choice. */}
              {input.investmentUniverse !== "public_only" && input.investmentUniverse !== "single_stock" && (
                <Field label="Private exposure" info="Controls whether private providers are hidden, shown via indirect links, or displayed as IPO-watch items.">
                  <Select
                    disabledOptions={blockedPrivateExposureOptions}
                    value={input.includePrivateExposure}
                    options={PRIVATE_EXPOSURE_OPTIONS}
                    onChange={(value) => setField("includePrivateExposure", value as SimulationInput["includePrivateExposure"])}
                  />
                  <GuidanceNote>{PRIVATE_EXPOSURE_GUIDANCE[input.investmentUniverse]}</GuidanceNote>
                </Field>
              )}

              {input.allocationStyle === "single_stock" && (
                <SingleStockPicker
                  eligibleProviders={state.eligibleUniverse}
                  selectedId={(input.selectedVendorIds ?? [])[0] ?? null}
                  startingCapital={input.startingCapital}
                  onSelect={(providerId) => {
                    setInput((current) => ({
                      ...current,
                      // Force the universe to single_stock so the engine
                      // restricts to public_direct tickers and validates one-only.
                      investmentUniverse: "single_stock",
                      selectedVendorIds: [providerId],
                      manualAllocations: { [providerId]: 100 },
                    }));
                  }}
                />
              )}

              {input.allocationStyle === "manual" && (
                <ManualAllocationEditor
                  eligibleProviders={state.eligibleUniverse}
                  input={input}
                  providers={providerById}
                  validation={state.allocationValidation}
                  onAddVendor={addManualVendor}
                  onRemoveVendor={removeManualVendor}
                  onSetAllocation={setManualAllocation}
                />
              )}
            </CollapsibleSection>

            {/* ─────── MARKET CONTEXT — collapsible, default open ─────── */}
            <CollapsibleSection title="Market context" defaultOpen>
              <Field label="Global news / political climate" info="Prevailing macro / geopolitical regime. Applies a return drag, shock amplifier, and regulatory tilt to all holdings.">
                <ClimateSegmented
                  value={input.globalRiskClimate ?? "elevated"}
                  onChange={(value) => setField("globalRiskClimate", value)}
                />
                <GuidanceNote>{GLOBAL_RISK_CLIMATE_GUIDANCE[input.globalRiskClimate ?? "elevated"]}</GuidanceNote>
              </Field>
              <Field label="Market Signals overlay" info="Blends source-cited macro / regulatory / company / sector signals into each holding's expected return. Truthfulness gates prevent unsupported signals from moving centre.">
                <ToggleSwitch
                  checked={Boolean(input.applySignalOverlay)}
                  onChange={(checked) => setField("applySignalOverlay", checked)}
                  labelOn="Overlay ON"
                  labelOff="Overlay OFF"
                />
                <GuidanceNote>
                  {input.applySignalOverlay
                    ? "Active. Per-vendor delta appears in the chart annotation and the provider table."
                    : "Off — base scenario engine only. Toggle on to layer in current macro / regulatory / sector signals."}
                </GuidanceNote>
              </Field>
            </CollapsibleSection>

            {/* ─────── ADVANCED — collapsible, default closed ─────── */}
            <CollapsibleSection title="Advanced" defaultOpen={false}>
              <Field label="Region" info="Region labels the scenario context. Future live feeds will use it for eligible instruments and regulatory risk.">
                <Select value={input.region} options={["US", "Europe", "Global"]} onChange={(value) => setField("region", value as SimulationInput["region"])} />
              </Field>
              <Field label="Rebalance" info="Rebalance frequency is captured for state integrity. Seed paths currently use static annual holdings.">
                <Select value={input.rebalanceFrequency} options={["none", "quarterly", "annually"]} onChange={(value) => setField("rebalanceFrequency", value as SimulationInput["rebalanceFrequency"])} />
              </Field>
            </CollapsibleSection>

            {/* ─────── Actions ─────── */}
            <div className="grid grid-cols-2 gap-2 pt-2">
              <button className="rounded-md border border-[#cfd7c8] px-3 py-2 text-xs font-semibold hover:bg-[#eef2e8] dark:border-zinc-700 dark:hover:bg-zinc-900" onClick={() => { setInput(coerceClientInput(initialInput)); setShockEvent(null); }} type="button">
                Reset to defaults
              </button>
              <button className="rounded-md bg-[#192319] px-3 py-2 text-xs font-semibold text-white hover:bg-[#2a382c] dark:bg-zinc-100 dark:text-zinc-950 dark:hover:bg-white" onClick={applyBoardShock} type="button">
                Apply random shock
              </button>
            </div>
          </div>
        </Panel>

        <Panel title="Scenario fan chart">
          {signalOverlay && !hasIntegrityError && signalOverlay.perHolding.length === 0 && (
            <div className="mb-3 rounded-md border border-amber-200 bg-amber-50 p-3 text-xs leading-5 text-amber-900 dark:border-amber-900/60 dark:bg-amber-950/40 dark:text-amber-200">
              <span className="font-semibold">Market Signals overlay is ON, but no current signals match this portfolio&apos;s holdings.</span>{" "}
              Try a broader investment universe or check <a href="/investor-tools/signals" className="underline">/investor-tools/signals</a> for the active signal corpus.
            </div>
          )}
          {signalOverlay && !hasIntegrityError && signalOverlay.perHolding.length > 0 && (
            <div className="mb-3 rounded-md border border-emerald-200 bg-emerald-50 p-3 text-xs leading-5 text-emerald-900 dark:border-emerald-900/60 dark:bg-emerald-950/40 dark:text-emerald-200">
              <div className="flex flex-wrap items-center justify-between gap-2">
                <span className="flex items-center gap-1.5 font-semibold">
                  <span className="h-1.5 w-1.5 animate-pulse rounded-full bg-emerald-500" />
                  Market Signals overlay active
                </span>
                <span className="font-mono tabular-nums">
                  Portfolio-weighted{" "}
                  <strong className={signalOverlay.portfolioDeltaPp >= 0 ? "text-emerald-700 dark:text-emerald-300" : "text-rose-700 dark:text-rose-300"}>
                    {signalOverlay.portfolioDeltaPp >= 0 ? "+" : ""}{signalOverlay.portfolioDeltaPp.toFixed(2)} pp/yr
                  </strong>
                  {" "}· avg confidence {signalOverlay.avgConfidence}/100
                </span>
              </div>
              {(signalOverlay.positives.length > 0 || signalOverlay.negatives.length > 0) && (
                <div className="mt-1.5 text-[11px] text-emerald-800/90 dark:text-emerald-300/90">
                  {signalOverlay.positives.length > 0 && (
                    <span>
                      <span className="font-semibold">Top positive:</span>{" "}
                      {signalOverlay.positives.map((p) => `${p.name} (${p.deltaPp >= 0 ? "+" : ""}${p.deltaPp.toFixed(2)}pp)`).join(", ")}
                    </span>
                  )}
                  {signalOverlay.positives.length > 0 && signalOverlay.negatives.length > 0 && <span> · </span>}
                  {signalOverlay.negatives.length > 0 && (
                    <span>
                      <span className="font-semibold">Top drag:</span>{" "}
                      {signalOverlay.negatives.map((p) => `${p.name} (${p.deltaPp.toFixed(2)}pp)`).join(", ")}
                    </span>
                  )}
                </div>
              )}
            </div>
          )}
          {hasIntegrityError ? <IntegrityError errors={state.errors} /> : <ScenarioFanChart result={result} shockEvent={shockEvent} />}
          {hasIntegrityError ? (
            <BlockedOutputNote />
          ) : (
            <>
              <div className="mt-4 grid gap-3 md:grid-cols-4">
                <ScenarioValue label="Bull" value={result.bullValue} startingCapital={input.startingCapital} tone="text-emerald-700 dark:text-emerald-300" />
                <ScenarioValue label="Base" value={result.baseValue} startingCapital={input.startingCapital} tone="text-[#2f5d50] dark:text-emerald-300" />
                <ScenarioValue label="Bear" value={result.bearValue} startingCapital={input.startingCapital} tone="text-amber-700 dark:text-amber-300" />
                <ScenarioValue label="Stress" value={result.stressValue} startingCapital={input.startingCapital} tone="text-rose-700 dark:text-rose-300" />
              </div>
              <details className="mt-4 rounded-md border border-[#dfe4da] bg-[#f7f8f5] p-3 text-xs leading-5 text-[#596151] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                <summary className="cursor-pointer font-semibold text-[#18201b] dark:text-zinc-200">What do Bull / Base / Bear / Stress mean?</summary>
                <ul className="mt-2 space-y-1 pl-4 [&_strong]:font-semibold">
                  <li><strong className="text-emerald-700 dark:text-emerald-300">Bull</strong> &mdash; favourable AI adoption + healthy macro. Catalysts hit, valuations expand.</li>
                  <li><strong className="text-[#2f5d50] dark:text-emerald-300">Base</strong> &mdash; central path. Trend growth, no fresh shocks beyond the climate setting.</li>
                  <li><strong className="text-amber-700 dark:text-amber-300">Bear</strong> &mdash; growth disappoints, multiples compress, evidence confidence weighs.</li>
                  <li><strong className="text-rose-700 dark:text-rose-300">Stress</strong> &mdash; severe drawdown path with shock penalties amplified by the global risk climate.</li>
                </ul>
              </details>
            </>
          )}
        </Panel>

        <Panel title="Risk, confidence, thesis">
          {hasIntegrityError ? (
            <IntegrityError errors={state.errors} />
          ) : (
            <div className="space-y-4">
              <ScoreBar value={result.aiExposureScore} label="AI exposure score" />
              <ScoreBar value={result.qualityScore} label="Quality score" />
              <ScoreBar value={result.speculationScore} label="Speculation score" />
              <ScoreBar value={result.riskScore} label="Risk score" />
              <Confidence value={result.confidenceScore} />
              <InfoButton text="Confidence score is evidence-weighted and seed-labelled. It changes when selected holdings, evidence confidence, or universe composition changes." />
              <p className="rounded-md border border-[#dfe4da] bg-[#f7f8f5] p-3 text-xs leading-5 text-[#596151] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
                The current pack is tilted toward public platform and infrastructure exposure, with IPO-watch upside modelled as scenario sensitivity rather than direct ownership.
              </p>
              <p className="text-xs leading-5 text-[#6a725f] dark:text-zinc-500">{PRIVATE_WARNING}</p>
            </div>
          )}
        </Panel>
      </div>

      <div className="grid gap-5 xl:grid-cols-2">
        <Panel title="Portfolio allocation">
          {hasIntegrityError ? <IntegrityError errors={state.errors} /> : <AllocationDonut portfolio={portfolio} providers={providerById} />}
        </Panel>
        <Panel title="Risk-return scatterplot">
          {hasIntegrityError ? <IntegrityError errors={state.errors} /> : <RiskReturnScatter portfolio={portfolio} providers={providerById} stateHash={state.stateHash} />}
        </Panel>
        <Panel title="Indirect exposure network">
          <ExposureNetwork exposures={indirectExposures} providers={providerById} />
        </Panel>
        <Panel title="IPO lifecycle timeline">
          <IpoTimeline profiles={ipoWatch} providers={providerById} />
        </Panel>
        <Panel title="Drawdown and stress path">
          {hasIntegrityError ? <IntegrityError errors={state.errors} /> : <DrawdownChart path={result.stressPath} shockEvent={shockEvent} />}
        </Panel>
        <Panel title="Stacked exposure bar">
          {hasIntegrityError ? <IntegrityError errors={state.errors} /> : <StackedExposureBar portfolio={portfolio} />}
        </Panel>
        <Panel title="Confidence heatmap">
          {hasIntegrityError ? <IntegrityError errors={state.errors} /> : <ConfidenceHeatmap portfolio={portfolio} providers={providerById} />}
        </Panel>
        <Panel title="Contribution waterfall">
          {hasIntegrityError ? <IntegrityError errors={state.errors} /> : <ContributionWaterfall result={result} providers={providerById} />}
        </Panel>
      </div>

      <Panel title="Risk radar">
        {hasIntegrityError ? <IntegrityError errors={state.errors} /> : <RiskRadar result={result} portfolio={portfolio} providers={providerById} />}
      </Panel>

      <Panel title="Provider detail table">
        <div className="mb-4">
          <OwnershipLegend />
        </div>
        {hasIntegrityError ? <IntegrityError errors={state.errors} /> : <div className="overflow-x-auto">
          <table className="w-full min-w-[980px] text-left text-sm">
            <thead className="text-xs uppercase tracking-wide text-[#697362] dark:text-zinc-500">
              <tr>
                <th className="py-2 pr-4">Provider</th>
                <th className="py-2 pr-4">Exposure</th>
                <th className="py-2 pr-4">Investability</th>
                <th className="py-2 pr-4">Weight</th>
                <th className="py-2 pr-4">Attractiveness</th>
                <th className="py-2 pr-4">Risk</th>
                {input.applySignalOverlay && <th className="py-2 pr-4">Signal Δ</th>}
                <th className="py-2 pr-4">Evidence</th>
                <th className="py-2">Main risk</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#e7ebe2] dark:divide-zinc-800">
              {portfolio.holdings.map((holding) => {
                const provider = providerById.get(holding.providerId)!;
                const signalRow = signalOverlay?.perHolding.find((p) => p.providerId === holding.providerId);
                return (
                  <tr key={holding.providerId}>
                    <td className="py-3 pr-4 font-medium">
                      <VendorNameWithOwnership name={provider.name} ownershipType={provider.publicStatus === "public" ? "public" : provider.publicStatus === "private" ? "private" : "subsidiary"} />
                      {provider.ticker && <span className="ml-2 text-xs text-[#697362] dark:text-zinc-500">{provider.ticker}</span>}
                    </td>
                    <td className="py-3 pr-4 text-xs">{label(provider.exposureType)}</td>
                    <td className="py-3 pr-4 text-xs">{label(provider.investabilityStatus)}</td>
                    <td className="py-3 pr-4 tabular-nums">{holding.weightPct.toFixed(1)}%</td>
                    <td className="py-3 pr-4">{provider.investmentAttractivenessScore}/100</td>
                    <td className="py-3 pr-4">{provider.valuationRiskScore}/100</td>
                    {input.applySignalOverlay && (
                      <td className="py-3 pr-4 tabular-nums text-xs">
                        {signalRow ? (
                          <span className={signalRow.deltaPp > 0.05 ? "font-semibold text-emerald-700 dark:text-emerald-300" : signalRow.deltaPp < -0.05 ? "font-semibold text-rose-700 dark:text-rose-300" : "text-[#697362] dark:text-zinc-500"} title={`${signalRow.contributingSignalIds.length} contributing signals · confidence ${signalRow.confidenceScore}/100`}>
                            {signalRow.deltaPp >= 0 ? "+" : ""}{signalRow.deltaPp.toFixed(2)}pp
                          </span>
                        ) : (
                          <span className="text-[#697362] dark:text-zinc-500">—</span>
                        )}
                      </td>
                    )}
                    <td className="py-3 pr-4"><EvidenceBadge grade={provider.evidenceGrade} /></td>
                    <td className="py-3 text-xs leading-5 text-[#596151] dark:text-zinc-400">{provider.mainRisk}</td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>}
      </Panel>
    </div>
  );
}

function SummaryCard({ label, value, note }: { label: string; value: string; note: string }) {
  return (
    <div className="rounded-lg border border-[#dfe4da] bg-white p-4 dark:border-zinc-800 dark:bg-[#071827]">
      <div className="text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">{label}</div>
      <div className="mt-2 text-xl font-semibold text-[#121812] dark:text-zinc-50">{value}</div>
      <div className="mt-1 text-xs text-[#6a725f] dark:text-zinc-500">{note}</div>
    </div>
  );
}

function coerceClientInput(input: SimulationInput): SimulationInput {
  if (compatiblePrivateExposureOptions(input.investmentUniverse).includes(input.includePrivateExposure)) {
    return input;
  }

  return {
    ...input,
    includePrivateExposure: defaultPrivateExposureForUniverse(input.investmentUniverse),
    selectedVendorIds: [],
    manualAllocations: {},
  };
}

function disabledPrivateExposureOptions(investmentUniverse: SimulationInput["investmentUniverse"]) {
  const compatible = new Set(compatiblePrivateExposureOptions(investmentUniverse));
  return PRIVATE_EXPOSURE_OPTIONS.reduce<Record<string, string>>((blocked, option) => {
    if (compatible.has(option)) return blocked;
    return {
      ...blocked,
      [option]: `${label(option)} is blocked by the ${label(investmentUniverse)} universe.`,
    };
  }, {});
}

function Field({ label: labelText, info, children }: { label: string; info?: string; children: React.ReactNode }) {
  return (
    <label className="block">
      <span className="flex items-center gap-1 text-xs font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">
        {labelText}
        {info && <InfoButton text={info} />}
      </span>
      <div className="mt-1.5">{children}</div>
    </label>
  );
}

function GuidanceNote({ children }: { children: React.ReactNode }) {
  return (
    <div className="mt-2 rounded-md border border-[#dfe4da] bg-[#f7f8f5] px-3 py-2 text-xs leading-5 text-[#596151] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      {children}
    </div>
  );
}

function InfoButton({ text }: { text: string }) {
  return (
    <span
      aria-label={text}
      className="inline-flex h-4 w-4 items-center justify-center rounded-full border border-[#cfd7c8] text-[10px] font-bold normal-case tracking-normal text-[#596151] dark:border-zinc-700 dark:text-zinc-300"
      title={text}
    >
      i
    </span>
  );
}

function BlockedOutputNote() {
  return (
    <div className="mt-4 rounded-md border border-[#dfe4da] bg-[#f7f8f5] px-3 py-2 text-xs leading-5 text-[#596151] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400">
      Scenario values are blocked until the current input combination is valid.
    </div>
  );
}

/**
 * Quiet placeholder for chart panels when the input combo is invalid.
 * Replaces the previous per-panel IntegrityError spam — the actionable
 * error list is rendered ONCE at the top of the page in <ConfigBanner>.
 */
function IntegrityError(_: { errors: string[] }) {
  return (
    <div className="flex h-32 items-center justify-center rounded-md border border-dashed border-[#dfe4da] text-xs text-[#697362] dark:border-zinc-700 dark:text-zinc-500">
      Awaiting valid configuration — see the panel above the chart for what to fix.
    </div>
  );
}

/**
 * Single, prominent error banner shown above the chart layout when the input
 * combination is invalid. Lists every error once with a one-line "what to do".
 */
function ConfigBanner({ errors }: { errors: string[] }) {
  if (errors.length === 0) return null;
  return (
    <div className="rounded-lg border border-rose-200 bg-rose-50 p-4 text-sm leading-6 text-rose-900 dark:border-rose-900/70 dark:bg-rose-950/40 dark:text-rose-200">
      <div className="font-semibold">Simulation can&apos;t run yet — fix the {errors.length === 1 ? "issue" : `${errors.length} issues`} below:</div>
      <ul className="mt-2 list-disc pl-5 text-xs">
        {errors.map((error, i) => <li key={i}>{error}</li>)}
      </ul>
    </div>
  );
}

/**
 * Single-stock picker. Used when allocationStyle === "single_stock" — exposes
 * a clear list of public-direct tickers, click-to-select, with the selected
 * ticker showing 100% allocation against the current starting capital.
 */
function SingleStockPicker({
  eligibleProviders,
  selectedId,
  startingCapital,
  onSelect,
}: {
  eligibleProviders: InvestmentProviderProfile[];
  selectedId: string | null;
  startingCapital: number;
  onSelect: (providerId: string) => void;
}) {
  const tickers = eligibleProviders.filter((p) => p.investabilityStatus === "public_direct" && p.ticker);
  const chosen = tickers.find((p) => p.id === selectedId);
  return (
    <div className="rounded-lg border border-[#dfe4da] p-3 dark:border-zinc-800">
      <div className="text-[10px] font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">Single ticker</div>
      <div className="mt-2 max-h-56 overflow-y-auto pr-1">
        <div className="grid gap-1.5">
          {tickers.map((p) => {
            const isSelected = p.id === selectedId;
            return (
              <button
                key={p.id}
                type="button"
                onClick={() => onSelect(p.id)}
                className={`flex items-center justify-between rounded-md border px-3 py-2 text-left text-xs transition-colors ${
                  isSelected
                    ? "border-[#192319] bg-[#192319] text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950"
                    : "border-[#dfe4da] bg-white hover:bg-[#eef2e8] dark:border-zinc-800 dark:bg-zinc-900 dark:hover:bg-zinc-800"
                }`}
              >
                <span>
                  <span className="font-semibold">{p.name}</span>
                  <span className={`ml-2 font-mono text-[10px] ${isSelected ? "opacity-80" : "text-[#697362] dark:text-zinc-500"}`}>{p.ticker}</span>
                </span>
                <span className={`text-[10px] uppercase tracking-wide ${isSelected ? "opacity-90" : "text-[#697362] dark:text-zinc-500"}`}>
                  {p.exposureClass.replace(/_/g, " ")}
                </span>
              </button>
            );
          })}
        </div>
      </div>
      {chosen ? (
        <div className="mt-3 rounded-md bg-emerald-50 px-3 py-2 text-xs text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
          <div className="flex items-center justify-between">
            <span>100% to <strong>{chosen.name}</strong> ({chosen.ticker})</span>
            <span className="font-mono tabular-nums">{formatCurrency(startingCapital)}</span>
          </div>
          <div className="mt-1 text-[11px] opacity-80">{chosen.mainRisk}</div>
        </div>
      ) : (
        <div className="mt-3 text-xs leading-5 text-[#697362] dark:text-zinc-500">
          Pick one ticker to model 100% allocation. Single-stock mode is a focused thesis on one name — no diversification.
        </div>
      )}
    </div>
  );
}

function ManualAllocationEditor({
  eligibleProviders,
  input,
  providers,
  validation,
  onAddVendor,
  onRemoveVendor,
  onSetAllocation,
}: {
  eligibleProviders: InvestmentProviderProfile[];
  input: SimulationInput;
  providers: Map<string, InvestmentProviderProfile>;
  validation: { isValid: boolean; totalAllocationPct: number; errors: string[]; warnings: string[] };
  onAddVendor: (providerId: string) => void;
  onRemoveVendor: (providerId: string) => void;
  onSetAllocation: (providerId: string, weightPct: number) => void;
}) {
  const selectedIds = input.selectedVendorIds ?? [];
  const unselected = eligibleProviders.filter((provider) => !selectedIds.includes(provider.id));
  const remainingPct = Math.round((100 - validation.totalAllocationPct) * 10) / 10;
  const allocationMessage = validation.isValid
    ? "Simulation can run."
    : selectedIds.length === 0
      ? "Add at least one eligible vendor, then assign allocation weights."
      : remainingPct > 0
        ? `${remainingPct.toFixed(1)}% still needs to be allocated.`
        : remainingPct < 0
          ? `Allocation is ${Math.abs(remainingPct).toFixed(1)}% over the limit.`
          : "Review the validation messages below.";

  return (
    <div className="rounded-lg border border-[#dfe4da] p-3 dark:border-zinc-800">
      <Field label="Vendor selection" info="Manual vendor selection is filtered by investment universe. It affects eligibility, holdings, charts, and validation.">
        <div className="grid grid-cols-[1fr_auto] gap-2">
          <select
            className="rounded-md border border-[#d8ded0] bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
            defaultValue=""
            onChange={(event) => {
              onAddVendor(event.target.value);
              event.currentTarget.value = "";
            }}
          >
            <option value="">Add eligible vendor...</option>
            {unselected.map((provider) => (
              <option key={provider.id} value={provider.id}>
                {provider.name} {provider.ticker ? `(${provider.ticker})` : "(private/watchlist)"}
              </option>
            ))}
          </select>
          <InfoButton text="Eligible vendors are recalculated whenever the investment universe changes." />
        </div>
      </Field>
      <div className="mt-3 space-y-2">
        {selectedIds.map((providerId) => {
          const provider = providers.get(providerId);
          if (!provider) return null;
          const allocation = input.manualAllocations?.[providerId] ?? 0;
          return (
            <div key={providerId} className="rounded-md border border-[#edf0ea] p-2 text-xs dark:border-zinc-800">
              <div className="flex items-start justify-between gap-2">
                <div>
                  <div className="font-semibold">{provider.name} {provider.ticker ? `(${provider.ticker})` : "(private/watchlist)"}</div>
                  <div className="mt-1 text-[#66705f] dark:text-zinc-500">{label(provider.exposureType)} | {label(provider.investabilityStatus)} | confidence {provider.evidenceConfidence}/100</div>
                </div>
                <button type="button" className="rounded border border-[#d8ded0] px-2 py-1 dark:border-zinc-700" onClick={() => onRemoveVendor(providerId)}>
                  Remove
                </button>
              </div>
              <Field label="Allocation %" info="Allocation weight controls amount, contribution, risk, donut, scatter, fan chart, drawdown, and confidence heatmap.">
                <input
                  className="mt-1 w-full rounded-md border border-[#d8ded0] bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900"
                  min={0}
                  max={100}
                  step={0.5}
                  type="number"
                  value={allocation}
                  onChange={(event) => onSetAllocation(providerId, Number(event.target.value))}
                />
              </Field>
              <div className="mt-1 text-[#66705f] dark:text-zinc-500">Amount {formatCurrency((input.startingCapital * allocation) / 100)}</div>
              {!provider.ticker && <div className="mt-1 text-amber-700 dark:text-amber-300">Not directly investable unless IPO/access event occurs.</div>}
            </div>
          );
        })}
        {selectedIds.length === 0 && <div className="text-xs leading-5 text-[#66705f] dark:text-zinc-500">Select an eligible vendor for the current universe. In manual mode, vendor allocations plus cash reserve must equal 100%.</div>}
      </div>
      <div className={`mt-3 rounded-md px-3 py-2 text-xs ${validation.isValid ? "bg-emerald-50 text-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" : "bg-rose-50 text-rose-800 dark:bg-rose-950/40 dark:text-rose-300"}`}>
        Total allocation including cash: {validation.totalAllocationPct.toFixed(1)}%. {allocationMessage}
      </div>
      {validation.errors.map((error) => <div key={error} className="mt-2 text-xs leading-5 text-rose-700 dark:text-rose-300">{error}</div>)}
      {validation.warnings.map((warning) => <div key={warning} className="mt-2 text-xs text-amber-700 dark:text-amber-300">{warning}</div>)}
    </div>
  );
}

function Select({
  value,
  options,
  disabledOptions = {},
  onChange,
}: {
  value: string;
  options: string[];
  disabledOptions?: Record<string, string>;
  onChange: (value: string) => void;
}) {
  return (
    <select className="w-full rounded-md border border-[#d8ded0] bg-white px-3 py-2 text-sm dark:border-zinc-700 dark:bg-zinc-900" value={value} onChange={(event) => onChange(event.target.value)}>
      {options.map((option) => {
        const disabledReason = disabledOptions[option];
        return (
          <option key={option} value={option} disabled={Boolean(disabledReason)} title={disabledReason}>
            {label(option)}{disabledReason ? " (blocked)" : ""}
          </option>
        );
      })}
    </select>
  );
}

function Segmented({ value, options, onChange }: { value: string; options: string[]; onChange: (value: string) => void }) {
  return (
    <div className="grid grid-cols-4 gap-1">
      {options.map((option) => (
        <button key={option} className={`rounded-md border px-2 py-1.5 text-xs font-semibold ${value === option ? "border-[#192319] bg-[#192319] text-white dark:border-zinc-100 dark:bg-zinc-100 dark:text-zinc-950" : "border-[#d8ded0] text-[#4d574b] dark:border-zinc-700 dark:text-zinc-400"}`} onClick={() => onChange(option)} type="button">
          {option}y
        </button>
      ))}
    </div>
  );
}

/**
 * Section header for the always-visible Essentials block. Subtle uppercase
 * label so the eye reads "this is the start" without competing with field
 * labels.
 */
function SectionHeader({ children }: { children: React.ReactNode }) {
  return (
    <h3 className="mt-1 mb-1 text-[10px] font-semibold uppercase tracking-[0.18em] text-[#697362] dark:text-zinc-500">
      {children}
    </h3>
  );
}

/**
 * Native <details>/<summary> section with consistent styling. State persists
 * per-section via the `open` attribute — no React state needed.
 */
function CollapsibleSection({
  title,
  defaultOpen,
  children,
}: {
  title: string;
  defaultOpen: boolean;
  children: React.ReactNode;
}) {
  return (
    <details className="group rounded-md border border-[#dfe4da] bg-[#f7f8f5] px-3 py-2 dark:border-zinc-800 dark:bg-zinc-900/40" open={defaultOpen}>
      <summary className="flex cursor-pointer list-none items-center justify-between text-[10px] font-semibold uppercase tracking-[0.18em] text-[#697362] hover:text-[#18201b] dark:text-zinc-400 dark:hover:text-zinc-100">
        {title}
        <span className="text-[10px] transition-transform group-open:rotate-180" aria-hidden>▾</span>
      </summary>
      <div className="mt-3 space-y-3">{children}</div>
    </details>
  );
}

/**
 * Climate selector — 4 horizontal segments with tone (green→red as risk
 * climbs). Faster + more visual than the underlying <select>.
 */
function ClimateSegmented({
  value,
  onChange,
}: {
  value: NonNullable<SimulationInput["globalRiskClimate"]>;
  onChange: (value: SimulationInput["globalRiskClimate"]) => void;
}) {
  const options: { value: NonNullable<SimulationInput["globalRiskClimate"]>; label: string; tone: string }[] = [
    { value: "calm", label: "Calm", tone: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300" },
    { value: "elevated", label: "Elevated", tone: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/40 dark:text-sky-300" },
    { value: "tense", label: "Tense", tone: "border-amber-300 bg-amber-50 text-amber-800 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300" },
    { value: "crisis", label: "Crisis", tone: "border-rose-300 bg-rose-50 text-rose-800 dark:border-rose-800 dark:bg-rose-950/40 dark:text-rose-300" },
  ];
  return (
    <div className="grid grid-cols-4 gap-1">
      {options.map((opt) => {
        const active = value === opt.value;
        return (
          <button
            key={opt.value}
            type="button"
            onClick={() => onChange(opt.value)}
            aria-pressed={active}
            className={`rounded-md border px-2 py-1.5 text-[11px] font-semibold transition-colors ${
              active ? opt.tone + " ring-2 ring-current ring-offset-0" : "border-[#dfe4da] bg-white text-[#697362] hover:border-[#cfd7c8] dark:border-zinc-800 dark:bg-zinc-900 dark:text-zinc-400"
            }`}
          >
            {opt.label}
          </button>
        );
      })}
    </div>
  );
}

/**
 * On/off pill toggle — clearer than a checkbox for binary feature flags.
 */
function ToggleSwitch({
  checked,
  onChange,
  labelOn,
  labelOff,
}: {
  checked: boolean;
  onChange: (checked: boolean) => void;
  labelOn: string;
  labelOff: string;
}) {
  return (
    <button
      type="button"
      role="switch"
      aria-checked={checked}
      onClick={() => onChange(!checked)}
      className={`flex w-full items-center justify-between rounded-md border px-3 py-2 text-xs font-semibold transition-colors ${
        checked
          ? "border-emerald-300 bg-emerald-50 text-emerald-900 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-200"
          : "border-[#d8ded0] bg-white text-[#4d574b] hover:bg-[#f7f8f5] dark:border-zinc-700 dark:bg-zinc-900 dark:text-zinc-400 dark:hover:bg-zinc-800"
      }`}
    >
      <span>{checked ? labelOn : labelOff}</span>
      <span className={`relative inline-flex h-5 w-9 shrink-0 items-center rounded-full transition-colors ${checked ? "bg-emerald-500" : "bg-zinc-300 dark:bg-zinc-700"}`}>
        <span className={`inline-block h-3.5 w-3.5 transform rounded-full bg-white transition-transform ${checked ? "translate-x-5" : "translate-x-1"}`} />
      </span>
    </button>
  );
}

function ScenarioValue({
  label: labelText,
  value,
  startingCapital,
  tone,
}: {
  label: string;
  value: number;
  startingCapital: number;
  tone: string;
}) {
  const movement = formatMovementPercent(value, startingCapital);
  return (
    <div className="rounded-md border border-[#e1e6dc] p-3 dark:border-zinc-800">
      <div className="text-xs text-[#697362] dark:text-zinc-500">{labelText}</div>
      <div className={`mt-1 text-lg font-semibold tabular-nums ${tone}`}>{formatCurrency(value)}</div>
      <div className={`mt-1 text-xs font-semibold tabular-nums ${movement.isNegative ? "text-rose-700 dark:text-rose-300" : "text-emerald-700 dark:text-emerald-300"}`}>
        {movement.label} vs start
      </div>
    </div>
  );
}

function ScenarioFanChart({ result, shockEvent }: { result: SimulationResult; shockEvent?: ShockEvent | null }) {
  const paths = useMemo(() => [
    { name: "Bull", key: "bull" as const, data: result.bullPath, color: "#059669" },
    { name: "Base", key: "base" as const, data: result.basePath, color: "#2f5d50" },
    { name: "Bear", key: "bear" as const, data: result.bearPath, color: "#b45309" },
    { name: "Stress", key: "stress" as const, data: result.stressPath, color: "#be123c" },
  ], [result.bullPath, result.basePath, result.bearPath, result.stressPath]);
  const svgRef = useRef<SVGSVGElement | null>(null);
  const [hover, setHover] = useState<{ year: number; xPct: number } | null>(null);
  const w = 720;
  const h = 320;
  const padLeft = 56;
  const padRight = 24;
  const padTop = 36;
  const padBottom = 44;
  const innerW = w - padLeft - padRight;
  const innerH = h - padTop - padBottom;
  const allValues = paths
    .flatMap((path) => path.data.map((point) => point.value))
    .filter((value) => Number.isFinite(value));
  // Guard against empty paths / all-NaN inputs (briefly possible during state
  // hydration or when universe filters block all holdings). Without this the
  // y-axis tick generator can produce duplicate NaN React keys.
  const rawMax = allValues.length > 0 ? Math.max(...allValues) : 1;
  const rawMin = allValues.length > 0 ? Math.min(...allValues) : 0;
  const max = Number.isFinite(rawMax) ? rawMax : 1;
  const min = Number.isFinite(rawMin) ? rawMin : 0;
  const maxYear = Math.max(0.5, result.basePath[result.basePath.length - 1]?.year ?? 1);
  // All coordinate math is wrapped in finite-guards. Even though the simulator
  // engine clamps growth factors, chart inputs can briefly be empty / NaN
  // during state hydration; never let NaN reach an SVG attribute.
  const safeFinite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
  const xFor = (year: number) => safeFinite(padLeft + (year / maxYear) * innerW, padLeft);
  const yFor = (value: number) => safeFinite(padTop + innerH - ((value - min) / Math.max(1, max - min)) * innerH, padTop + innerH);
  const linePoints = (data: ScenarioPoint[]) =>
    data
      .filter((point) => Number.isFinite(point.year) && Number.isFinite(point.value))
      .map((point) => `${xFor(point.year).toFixed(2)},${yFor(point.value).toFixed(2)}`)
      .join(" ");
  const shockX = shockEvent ? xFor(shockEvent.shockYear) : null;

  // X-axis ticks scaled to the horizon. <=1y → quarters; <=3y → years;
  // >3y → years, with half-year ticks for finer granularity.
  const xTicks = useMemo(() => {
    if (maxYear <= 1) return [0, 0.25, 0.5, 0.75, 1].filter((tick) => tick <= maxYear).map((tick) => ({ year: tick, label: formatTickLabel(tick) }));
    if (maxYear <= 3) {
      const ticks: { year: number; label: string }[] = [];
      for (let i = 0; i <= maxYear * 2; i += 1) ticks.push({ year: i / 2, label: formatTickLabel(i / 2) });
      return ticks;
    }
    const ticks: { year: number; label: string }[] = [];
    for (let i = 0; i <= maxYear; i += 1) ticks.push({ year: i, label: formatTickLabel(i) });
    return ticks;
  }, [maxYear]);

  // Y-axis ticks. Guarded so a zero range (single-value path) or the brief
  // empty-data window during hydration cannot emit NaN values that would
  // collide as duplicate React keys.
  const yTicks = useMemo(() => {
    const stepCount = 4;
    const safeRange = max - min === 0 ? 1 : max - min;
    const step = safeRange / stepCount;
    return Array.from({ length: stepCount + 1 }, (_, i) => {
      const value = min + step * i;
      return Number.isFinite(value) ? value : min;
    });
  }, [min, max]);

  function nearestPointPerScenario(year: number) {
    return paths.map((path) => {
      let nearest = path.data[0];
      let bestDelta = Math.abs((nearest?.year ?? 0) - year);
      for (const point of path.data) {
        const delta = Math.abs(point.year - year);
        if (delta < bestDelta) { nearest = point; bestDelta = delta; }
      }
      return { name: path.name, key: path.key, color: path.color, point: nearest! };
    });
  }

  function handleMove(event: React.MouseEvent<SVGSVGElement>) {
    const svg = svgRef.current;
    if (!svg) return;
    const rect = svg.getBoundingClientRect();
    const xPx = event.clientX - rect.left;
    const xRatio = (xPx / rect.width - padLeft / w) / (innerW / w);
    const clamped = Math.max(0, Math.min(1, xRatio));
    setHover({ year: clamped * maxYear, xPct: clamped });
  }

  const hoverNear = hover ? nearestPointPerScenario(hover.year) : null;
  const hoverX = hover ? xFor(hover.year) : 0;

  return (
    <div className="relative">
      <svg
        ref={svgRef}
        className="h-[320px] w-full"
        viewBox={`0 0 ${w} ${h}`}
        role="img"
        aria-label="Scenario fan chart with hover tooltip"
        onMouseMove={handleMove}
        onMouseLeave={() => setHover(null)}
      >
        <rect width={w} height={h} rx="10" fill="currentColor" className="text-[#f7f8f5] dark:text-zinc-950" />
        {/* Y gridlines + labels */}
        {yTicks.map((value, idx) => (
          <g key={`y-${idx}`}>
            <line x1={padLeft} x2={w - padRight} y1={yFor(value)} y2={yFor(value)} stroke="#dfe4da" strokeDasharray="4 4" className="dark:stroke-zinc-800" />
            <text x={padLeft - 8} y={yFor(value) + 4} textAnchor="end" fill="#697362" fontSize="10" className="tabular-nums">{formatCompactCurrency(value)}</text>
          </g>
        ))}
        {/* X tick labels */}
        {xTicks.map((tick, idx) => (
          <g key={`x-${idx}`}>
            <line x1={xFor(tick.year)} x2={xFor(tick.year)} y1={padTop + innerH} y2={padTop + innerH + 4} stroke="#aab4a2" />
            <text x={xFor(tick.year)} y={padTop + innerH + 18} textAnchor="middle" fill="#697362" fontSize="10">{tick.label}</text>
          </g>
        ))}
        {/* Shock marker */}
        {shockX !== null && (
          <g>
            <line x1={shockX} x2={shockX} y1={padTop} y2={padTop + innerH} stroke="#b45309" strokeWidth="2" strokeDasharray="5 4" />
            <text x={shockX + 6} y={padTop + 10} fill="#b45309" fontSize="11" fontWeight="700">Shock Y{shockEvent?.shockYear} Q{shockEvent?.shockQuarter}</text>
          </g>
        )}
        {/* Scenario lines */}
        {paths.map((path) => <polyline key={path.name} points={linePoints(path.data)} fill="none" stroke={path.color} strokeWidth="2.5" />)}
        {/* Inline legend (top-left) */}
        {paths.map((path, index) => (
          <g key={path.name}>
            <rect x={padLeft + index * 88} y={6} width="10" height="10" fill={path.color} rx="2" />
            <text x={padLeft + index * 88 + 16} y={15} fill={path.color} fontSize="11" fontWeight="700">{path.name}</text>
          </g>
        ))}
        {/* Hover crosshair + dots */}
        {hoverNear && (
          <g>
            <line x1={hoverX} x2={hoverX} y1={padTop} y2={padTop + innerH} stroke="#94a194" strokeWidth="1" strokeDasharray="3 3" />
            {hoverNear.map((item) => (
              <circle key={item.key} cx={hoverX} cy={yFor(item.point.value)} r={4} fill={item.color} stroke="white" strokeWidth="1.5" />
            ))}
          </g>
        )}
        <text x={w - padRight} y={h - 10} textAnchor="end" fill="#697362" fontSize="10">Hypothetical seed paths · hover for detail</text>
      </svg>
      {hoverNear && hover && (
        <div
          className="pointer-events-none absolute z-20 -translate-y-2 rounded-md border border-[#dfe4da] bg-white px-2.5 py-2 text-[11px] shadow-md dark:border-zinc-700 dark:bg-zinc-900"
          style={{
            left: `${hover.xPct * (innerW / w) * 100 + (padLeft / w) * 100}%`,
            top: 30,
            transform: hover.xPct > 0.65 ? "translate(-105%, 0)" : "translate(8px, 0)",
            minWidth: 160,
          }}
        >
          <div className="mb-1 font-semibold text-[#18201b] dark:text-zinc-100">{formatYearMonthLabel(hover.year)}</div>
          <div className="space-y-0.5">
            {hoverNear.map((item) => (
              <div key={item.key} className="flex items-center justify-between gap-3">
                <span className="flex items-center gap-1.5">
                  <span className="h-2 w-2 rounded-sm" style={{ background: item.color }} />
                  <span className="text-[#4d574b] dark:text-zinc-300">{item.name}</span>
                </span>
                <span className="font-mono tabular-nums text-[#18201b] dark:text-zinc-50">{formatCurrency(item.point.value)}</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function formatTickLabel(year: number) {
  if (year === 0) return "Start";
  if (Number.isInteger(year)) return `${year}y`;
  if (Math.abs(year - 0.25) < 0.01) return "3m";
  if (Math.abs(year - 0.5) < 0.01) return "6m";
  if (Math.abs(year - 0.75) < 0.01) return "9m";
  return `${year.toFixed(1)}y`;
}

function formatYearMonthLabel(yearFraction: number) {
  if (yearFraction <= 0.001) return "Start (Month 0)";
  const totalMonths = Math.round(yearFraction * 12);
  const years = Math.floor(totalMonths / 12);
  const months = totalMonths % 12;
  if (years === 0) return `Month ${months}`;
  if (months === 0) return `Year ${years}`;
  return `Year ${years}, Month ${months}`;
}

function formatCompactCurrency(value: number) {
  if (Math.abs(value) >= 1_000_000) return `$${(value / 1_000_000).toFixed(1)}M`;
  if (Math.abs(value) >= 1_000) return `$${(value / 1_000).toFixed(1)}k`;
  return `$${value.toFixed(0)}`;
}

function AllocationDonut({ portfolio, providers }: { portfolio: SimulationPortfolio; providers: Map<string, InvestmentProviderProfile> }) {
  const total = portfolio.holdings.reduce((sum, holding) => sum + holding.weightPct, 0);
  const circumference = 2 * Math.PI * 90;
  const segments = portfolio.holdings.reduce<{ holding: SimulationPortfolio["holdings"][number]; dash: number; offset: number }[]>((items, holding) => {
    const previousOffset = items.reduce((sum, item) => sum + item.dash, 0);
    return [...items, { holding, dash: (holding.weightPct / total) * circumference, offset: previousOffset }];
  }, []);
  return (
    <div className="grid gap-5 md:grid-cols-[260px_1fr] md:items-center">
      <svg className="h-64 w-64" viewBox="0 0 260 260" role="img" aria-label="Portfolio allocation donut">
        {segments.map(({ holding, dash, offset: segmentOffset }) => {
          const radius = 90;
          return (
            <circle
              key={holding.providerId}
              cx="130"
              cy="130"
              r={radius}
              fill="transparent"
              stroke={exposureColors[holding.exposureType]}
              strokeDasharray={`${dash} ${circumference - dash}`}
              strokeDashoffset={-segmentOffset}
              strokeWidth="30"
              transform="rotate(-90 130 130)"
            />
          );
        })}
        <circle cx="130" cy="130" r="60" fill="white" className="dark:fill-[#071827]" />
        <text x="130" y="124" textAnchor="middle" fontSize="22" fontWeight="700" fill="currentColor">{portfolio.holdings.length}</text>
        <text x="130" y="145" textAnchor="middle" fontSize="11" fill="#697362">holdings</text>
      </svg>
      <div className="space-y-1.5">
        <div className="mb-1 flex items-center justify-between text-[10px] font-semibold uppercase tracking-wide text-[#697362] dark:text-zinc-500">
          <span>Holding</span>
          <span className="flex gap-3"><span>Weight</span><span className="w-20 text-right">Amount</span></span>
        </div>
        {portfolio.holdings.map((holding) => {
          const provider = providers.get(holding.providerId)!;
          return (
            <div key={holding.providerId} className="flex items-center justify-between gap-3 text-xs">
              <span className="flex min-w-0 items-center gap-2">
                <span className="h-2.5 w-2.5 shrink-0 rounded-full" style={{ background: exposureColors[holding.exposureType] }} />
                <span className="truncate">{provider.name}</span>
              </span>
              <span className="flex shrink-0 gap-3">
                <span className="font-mono tabular-nums text-[#697362] dark:text-zinc-500">{holding.weightPct.toFixed(1)}%</span>
                <span className="w-20 text-right font-mono tabular-nums text-[#18201b] dark:text-zinc-100">{formatCurrency(holding.amount)}</span>
              </span>
            </div>
          );
        })}
        <div className="mt-2 flex items-center justify-between border-t border-[#dfe4da] pt-2 text-xs font-semibold dark:border-zinc-800">
          <span>Total</span>
          <span className="font-mono tabular-nums">{formatCurrency(portfolio.holdings.reduce((sum, h) => sum + h.amount, 0))}</span>
        </div>
      </div>
    </div>
  );
}

function RiskReturnScatter({ portfolio, providers, stateHash }: { portfolio: SimulationPortfolio; providers: Map<string, InvestmentProviderProfile>; stateHash: string }) {
  const w = 600;
  const h = 300;
  const pad = 34;
  const points = portfolio.holdings.map((holding) => {
    const provider = providers.get(holding.providerId)!;
    return {
      provider,
      holding,
      x: (provider.valuationRiskScore + provider.liquidityRiskScore + provider.capexRiskScore) / 3,
      y: provider.investmentAttractivenessScore,
    };
  });
  const xDomain = calculateScatterDomain(points, "x");
  const yDomain = calculateScatterDomain(points, "y");
  const scale = (value: number, domain: { min: number; max: number }) => (value - domain.min) / Math.max(1, domain.max - domain.min);
  return (
    <svg className="h-[300px] w-full" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Risk return scatterplot">
      <rect width={w} height={h} rx="10" fill="currentColor" className="text-[#f7f8f5] dark:text-zinc-950" />
      <line x1={pad} x2={w - pad} y1={h - pad} y2={h - pad} stroke="#aab4a2" />
      <line x1={pad} x2={pad} y1={pad} y2={h - pad} stroke="#aab4a2" />
      {points.map((point, index) => {
        const jitter = ((index % 5) - 2) * 3;
        const x = pad + scale(point.x, xDomain) * (w - pad * 2) + jitter;
        const y = h - pad - scale(point.y, yDomain) * (h - pad * 2) - jitter;
        return (
          <g key={point.holding.providerId}>
            <title>{`${point.provider.name}\nTrue risk ${point.x.toFixed(1)}\nTrue attractiveness ${point.y.toFixed(1)}\nState ${stateHash}`}</title>
            <circle cx={x} cy={y} r={Math.max(6, point.holding.weightPct * 0.9)} fill={exposureColors[point.provider.exposureType]} opacity="0.82" />
            <text x={x + 10} y={y + 4} fontSize="11" fill="currentColor">{point.provider.ticker ?? point.provider.name}</text>
          </g>
        );
      })}
      <text x={pad} y={22} fontSize="11" fill="#697362">Attractiveness</text>
      <text x={w - 92} y={h - 10} fontSize="11" fill="#697362">Risk score</text>
      {(xDomain.expanded || yDomain.expanded) && <text x={pad} y={h - 10} fontSize="11" fill="#b45309">Scatter plot has insufficient spread. Displaying expanded axis for readability.</text>}
    </svg>
  );
}

function ExposureNetwork({ exposures, providers }: { exposures: IndirectExposure[]; providers: Map<string, InvestmentProviderProfile> }) {
  const publicNodes = Array.from(new Set(exposures.map((edge) => edge.publicTicker)));
  const privateNodes = Array.from(new Set(exposures.map((edge) => edge.privateProviderId)));
  const tickerNames = new Map(Array.from(providers.values()).map((provider) => [provider.ticker, provider.name]));
  const providerNames = new Map(Array.from(providers.values()).map((provider) => [provider.id, provider.name]));
  const publicX = (index: number) => 70 + (index / Math.max(1, publicNodes.length - 1)) * 540;
  const privateX = (index: number) => 80 + (index / Math.max(1, privateNodes.length - 1)) * 520;
  return (
    <svg className="h-[320px] w-full" viewBox="0 0 680 320" role="img" aria-label="Indirect exposure network graph">
      <rect width="680" height="320" rx="10" fill="currentColor" className="text-[#f7f8f5] dark:text-zinc-950" />
      {exposures.map((edge, index) => {
        const x1 = publicX(Math.max(0, publicNodes.indexOf(edge.publicTicker)));
        const x2 = privateX(Math.max(0, privateNodes.indexOf(edge.privateProviderId)));
        const y1 = 82;
        const y2 = 230;
        return <line key={`${edge.publicTicker}-${edge.privateProviderId}-${index}`} x1={x1} y1={y1} x2={x2} y2={y2} stroke="#9aa78f" strokeOpacity={edge.confidence} strokeWidth={1 + edge.exposureStrength * 4} />;
      })}
      {publicNodes.map((ticker, index) => (
        <Node key={ticker} x={publicX(index)} y={82} label={tickerNames.get(ticker) ?? ticker} color="#2f5d50" />
      ))}
      {privateNodes.map((id, index) => (
        <Node key={id} x={privateX(index)} y={230} label={providerNames.get(id) ?? id.replace(/_/g, " ")} color={id.includes("infrastructure") ? "#0f766e" : "#be185d"} />
      ))}
      <text x="24" y="28" fontSize="12" fontWeight="700" fill="#697362">Indirect exposure is not the same as owning the private company</text>
    </svg>
  );
}

function Node({ x, y, label: nodeLabel, color }: { x: number; y: number; label: string; color: string }) {
  return (
    <g>
      <circle cx={x} cy={y} r="24" fill={color} />
      <text x={x} y={y + 42} textAnchor="middle" fontSize="11" fill="currentColor" className="capitalize">{nodeLabel}</text>
    </g>
  );
}

function IpoTimeline({ profiles, providers }: { profiles: IPOProfile[]; providers: Map<string, InvestmentProviderProfile> }) {
  const stages = ["Rumour", "Confidential filing", "S-1", "Pricing", "Listing", "First earnings", "Lock-up expiry"];
  const stageIndex: Record<string, number> = { R0: 0, R1: 0, R2: 0, R3: 1, R4: 1, R5: 2 };
  return (
    <div className="space-y-4">
      {profiles.slice(0, 6).map((profile) => {
        const provider = providers.get(profile.providerId);
        const current = stageIndex[profile.rumourStage] ?? 0;
        return (
          <div key={profile.providerId}>
            <div className="mb-2 flex items-center justify-between gap-3 text-sm">
              <span className="font-semibold">{provider?.name ?? profile.providerId}</span>
              <span className="text-xs text-[#697362] dark:text-zinc-500">{profile.rumourStage} | {label(profile.postIpoForecast)}</span>
            </div>
            <div className="grid grid-cols-7 gap-1">
              {stages.map((stage, index) => (
                <div key={stage} className={`h-2 rounded-full ${index <= current ? "bg-[#2f5d50] dark:bg-emerald-400" : "bg-[#e1e6dc] dark:bg-zinc-800"}`} title={stage} />
              ))}
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DrawdownChart({ path, shockEvent }: { path: ScenarioPoint[]; shockEvent?: ShockEvent | null }) {
  const points = path.reduce<{ year: number; drawdown: number; peak: number }[]>((items, point) => {
    const peak = Math.max(items[items.length - 1]?.peak ?? path[0]?.value ?? 0, point.value);
    return [...items, { year: point.year, drawdown: peak === 0 ? 0 : ((point.value - peak) / peak) * 100, peak }];
  }, []);
  const w = 600;
  const h = 220;
  const pad = 36;
  const drawdownValues = points.map((point) => point.drawdown).filter((value) => Number.isFinite(value));
  const min = Math.min(-1, ...drawdownValues);
  const safeMin = Number.isFinite(min) && min !== 0 ? min : -1;
  const maxYear = Math.max(0.5, points[points.length - 1]?.year ?? 1);
  const safeFinite = (value: number, fallback: number) => (Number.isFinite(value) ? value : fallback);
  const xFor = (year: number) => safeFinite(pad + (year / maxYear) * (w - pad * 2), pad);
  const yFor = (drawdown: number) => safeFinite(pad + (drawdown / safeMin) * (h - pad * 2), h - pad);
  const line = points
    .filter((point) => Number.isFinite(point.year) && Number.isFinite(point.drawdown))
    .map((point) => `${xFor(point.year).toFixed(2)},${yFor(point.drawdown).toFixed(2)}`)
    .join(" ");
  const shockX = shockEvent ? xFor(shockEvent.shockYear) : null;
  const xTicks: number[] = maxYear <= 1 ? [0, 0.25, 0.5, 0.75, 1].filter((t) => t <= maxYear)
    : maxYear <= 3 ? Array.from({ length: Math.round(maxYear * 2) + 1 }, (_, i) => i / 2)
    : Array.from({ length: Math.round(maxYear) + 1 }, (_, i) => i);
  return (
    <svg className="h-[220px] w-full" viewBox={`0 0 ${w} ${h}`} role="img" aria-label="Drawdown chart">
      <rect width={w} height={h} rx="10" fill="currentColor" className="text-[#f7f8f5] dark:text-zinc-950" />
      <line x1={pad} x2={w - pad} y1={pad} y2={pad} stroke="#aab4a2" />
      {shockX !== null && <line x1={shockX} x2={shockX} y1={pad} y2={h - pad} stroke="#b45309" strokeWidth="2" strokeDasharray="4 4" />}
      {xTicks.map((tick, idx) => (
        <g key={`dx-${idx}`}>
          <line x1={xFor(tick)} x2={xFor(tick)} y1={h - pad} y2={h - pad + 4} stroke="#aab4a2" />
          <text x={xFor(tick)} y={h - pad + 16} textAnchor="middle" fontSize="10" fill="#697362">{formatTickLabel(tick)}</text>
        </g>
      ))}
      <text x={pad} y={pad - 6} fontSize="10" fill="#697362">0%</text>
      <text x={pad} y={h - pad - 6} fontSize="10" fill="#be123c">{`${min.toFixed(0)}%`}</text>
      <polyline points={line} fill="none" stroke="#be123c" strokeWidth="2.5" />
      <text x={w - pad} y={pad - 6} textAnchor="end" fontSize="10" fill="#697362">Stress drawdown path</text>
    </svg>
  );
}

function StackedExposureBar({ portfolio }: { portfolio: SimulationPortfolio }) {
  const totals = new Map<string, number>();
  portfolio.holdings.forEach((holding) => totals.set(holding.exposureType, (totals.get(holding.exposureType) ?? 0) + holding.weightPct));
  return (
    <div>
      <div className="flex h-10 overflow-hidden rounded-md border border-[#dfe4da] dark:border-zinc-800">
        {Array.from(totals).map(([type, value]) => (
          <div key={type} className="h-full" style={{ width: `${value}%`, background: exposureColors[type] }} title={`${label(type)} ${value.toFixed(1)}%`} />
        ))}
      </div>
      <div className="mt-4 grid gap-2 md:grid-cols-2">
        {Array.from(totals).map(([type, value]) => (
          <div key={type} className="flex items-center justify-between text-sm">
            <span className="flex items-center gap-2"><span className="h-2.5 w-2.5 rounded-full" style={{ background: exposureColors[type] }} />{label(type)}</span>
            <span className="font-mono">{value.toFixed(1)}%</span>
          </div>
        ))}
      </div>
    </div>
  );
}

function ConfidenceHeatmap({ portfolio, providers }: { portfolio: SimulationPortfolio; providers: Map<string, InvestmentProviderProfile> }) {
  const cols = ["financial", "AI exposure", "momentum", "IPO data", "valuation", "risk", "indirect"];
  return (
    <div className="overflow-x-auto">
      <div className="min-w-[620px]">
        <div className="grid grid-cols-[120px_repeat(7,1fr)] gap-1 text-[11px] text-[#697362] dark:text-zinc-500">
          <span />
          {cols.map((col) => <span key={col}>{col}</span>)}
        </div>
        {portfolio.holdings.slice(0, 8).map((holding) => {
          const provider = providers.get(holding.providerId)!;
          const values = [
            provider.evidenceConfidence,
            provider.aiRevenueExposureScore,
            provider.shortTermCatalystScore,
            provider.ipoReadinessScore || 35,
            100 - provider.valuationRiskScore,
            100 - provider.liquidityRiskScore,
            provider.investabilityStatus === "public_direct" ? 70 : 45,
          ];
          return (
            <div key={holding.providerId} className="mt-1 grid grid-cols-[120px_repeat(7,1fr)] gap-1 text-xs">
              <span className="truncate pr-2">{provider.name}</span>
              {values.map((value, index) => <span key={cols[index]} className="rounded px-1 py-1 text-center text-[11px]" style={{ background: heatColor(value), color: value > 62 ? "#102016" : "#2a1709" }}>{Math.round(value)}</span>)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

function ContributionWaterfall({ result, providers }: { result: SimulationResult; providers: Map<string, InvestmentProviderProfile> }) {
  const rows = [...result.contributionByHolding].sort((a, b) => b.contribution - a.contribution).slice(0, 8);
  const max = Math.max(1, ...rows.map((row) => Math.abs(row.contribution)));
  return (
    <div className="space-y-3">
      {rows.map((row) => {
        const provider = providers.get(row.providerId)!;
        return (
          <div key={row.providerId}>
            <div className="mb-1 flex justify-between text-xs">
              <span>{provider.name}</span>
              <span className="font-mono">{row.contribution.toFixed(2)} pts</span>
            </div>
            <div className="h-2 rounded-full bg-[#e8ede2] dark:bg-zinc-800">
              <div className={`h-full rounded-full ${row.contribution >= 0 ? "bg-[#2f5d50] dark:bg-emerald-400" : "bg-rose-600"}`} style={{ width: `${Math.max(2, (Math.abs(row.contribution) / max) * 100)}%` }} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function RiskRadar({ result, portfolio, providers }: { result: SimulationResult; portfolio: SimulationPortfolio; providers: Map<string, InvestmentProviderProfile> }) {
  const topHolding = Math.max(...portfolio.holdings.map((holding) => holding.weightPct));
  const axes = [
    ["valuation", avg(portfolio, providers, "valuationRiskScore")],
    ["liquidity", avg(portfolio, providers, "liquidityRiskScore")],
    ["capex", avg(portfolio, providers, "capexRiskScore")],
    ["regulation", avg(portfolio, providers, "regulatoryRiskScore")],
    ["concentration", topHolding],
    ["IPO", avg(portfolio, providers, "ipoReadinessScore")],
    ["infrastructure", avg(portfolio, providers, "infrastructureDependencyScore")],
    ["evidence gap", 100 - result.confidenceScore],
  ];
  const cx = 240;
  const cy = 170;
  const r = 120;
  const points = axes.map(([, value], index) => {
    const angle = -Math.PI / 2 + (index / axes.length) * Math.PI * 2;
    const radius = (Number(value) / 100) * r;
    return `${cx + Math.cos(angle) * radius},${cy + Math.sin(angle) * radius}`;
  }).join(" ");
  return (
    <svg className="h-[340px] w-full" viewBox="0 0 560 340" role="img" aria-label="Risk radar">
      <rect width="560" height="340" rx="10" fill="currentColor" className="text-[#f7f8f5] dark:text-zinc-950" />
      {[0.25, 0.5, 0.75, 1].map((scale) => <circle key={scale} cx={cx} cy={cy} r={r * scale} fill="none" stroke="#dfe4da" />)}
      {axes.map(([name], index) => {
        const angle = -Math.PI / 2 + (index / axes.length) * Math.PI * 2;
        return (
          <g key={name}>
            <line x1={cx} y1={cy} x2={cx + Math.cos(angle) * r} y2={cy + Math.sin(angle) * r} stroke="#dfe4da" />
            <text x={cx + Math.cos(angle) * (r + 32)} y={cy + Math.sin(angle) * (r + 22)} textAnchor="middle" fontSize="11" fill="#697362">{name}</text>
          </g>
        );
      })}
      <polygon points={points} fill="#2f5d50" fillOpacity="0.25" stroke="#2f5d50" strokeWidth="3" />
    </svg>
  );
}

function avg(portfolio: SimulationPortfolio, providers: Map<string, InvestmentProviderProfile>, key: keyof InvestmentProviderProfile) {
  return portfolio.holdings.reduce((sum, holding) => {
    const value = Number(providers.get(holding.providerId)?.[key] ?? 0);
    return sum + (holding.weightPct / 100) * value;
  }, 0);
}

function heatColor(value: number) {
  if (value >= 75) return "#bbf7d0";
  if (value >= 58) return "#fef3c7";
  return "#fecdd3";
}

function title(value: string) {
  return value.charAt(0).toUpperCase() + value.slice(1).replace(/_/g, " ");
}

function label(value: string) {
  return value.replace(/_/g, " ");
}

function formatCurrency(value: number) {
  return new Intl.NumberFormat("en-US", { currency: "USD", maximumFractionDigits: 0, style: "currency" }).format(value);
}

function formatMovementPercent(value: number, startingCapital: number) {
  const baseline = Math.max(1, startingCapital);
  const movementPct = ((value - baseline) / baseline) * 100;
  return {
    isNegative: movementPct < 0,
    label: `${movementPct >= 0 ? "+" : ""}${movementPct.toFixed(1)}%`,
  };
}
