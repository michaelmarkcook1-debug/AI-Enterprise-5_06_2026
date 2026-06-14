// Live-data wrapper around the deterministic Investment Simulator.
// ─────────────────────────────────────────────────────────────────
// The pure simulator in ./simulator.ts is unit-tested and must stay
// deterministic. This module wraps it so a route can:
//   1. Run the standard scenario math.
//   2. Enrich every holding with live data (Yahoo quote, classified
//      news, AI Atlas position, uptake share, reputation).
//   3. Compute a per-holding news-tilt (see ./news-tilt.ts) and apply
//      it to each scenario path so the chart actually reflects the
//      news climate the user sees in the context panel.
//   4. Return BOTH the original SimulationResult AND a new
//      `liveAdjusted` payload — the UI decides which to render.
//
// The adjustment is opt-in via the `applyNewsOverlay` flag on the
// SimulationInput / SimulationPortfolio. When false, `liveAdjusted` is
// null and the page renders the standard result exactly as before.

import { simulatePortfolio } from "./simulator";
import {
  enrichInvestmentProviders,
  type EnrichedInvestmentProvider,
} from "./live-data";
import {
  computeNewsTilt,
  newsTiltWithRationale,
  type NewsTiltResult,
} from "./news-tilt";
import { DEFAULT_RISK_SHOCK, INVESTMENT_PROVIDERS } from "./seed";
import type {
  InvestmentProviderProfile,
  RiskShock,
  ScenarioPoint,
  SimulationPortfolio,
  SimulationResult,
} from "./types";

export interface HoldingLiveContext {
  providerId: string;
  providerName: string;
  enriched: EnrichedInvestmentProvider;
  tilt: NewsTiltResult;
  rationale: string;
}

export interface LiveAdjustedScenario {
  /** Compounded multiplier applied to terminal value: (1 + tilt)^horizonYears */
  multiplier: number;
  /** Original last-period chart value before adjustment. */
  originalTerminalValue: number;
  /** Adjusted last-period value after the multiplier is applied. */
  adjustedTerminalValue: number;
  /** Full chart with each point uniformly scaled by (1 + tilt × t/horizon). */
  adjustedPath: ScenarioPoint[];
}

export interface LiveAdjustedResult {
  /** The original deterministic scenario result the wrapper started from. */
  baseResult: SimulationResult;
  /** Per-holding news + atlas + uptake context the UI panel renders. */
  holdings: HoldingLiveContext[];
  /** Weighted average annual tilt across the portfolio. */
  portfolioAnnualTilt: number;
  /** Adjusted scenario paths + terminal values, keyed by scenario name. */
  scenarios: {
    bull: LiveAdjustedScenario;
    base: LiveAdjustedScenario;
    bear: LiveAdjustedScenario;
    stress: LiveAdjustedScenario;
  };
  /** Plain-English summary of how news moved the portfolio. */
  summary: string;
}

/**
 * Linearly ramp the tilt across the horizon so the chart's slope
 * reflects the news effect rather than just the terminal value. At t=0
 * we apply 0 tilt (today), at t=horizon we apply the full compound
 * multiplier. Avoids a misleading visual "kink".
 */
function applyTiltToPath(path: ScenarioPoint[], annualTilt: number, horizonYears: number): ScenarioPoint[] {
  if (annualTilt === 0 || path.length === 0) return path.map((p) => ({ ...p }));
  return path.map((point, i) => {
    const t = path.length > 1 ? i / (path.length - 1) : 0;
    const localExp = horizonYears * t;
    const multiplier = Math.pow(1 + annualTilt, localExp);
    return { ...point, value: point.value * multiplier };
  });
}

function lastValue(path: ScenarioPoint[]): number {
  return path.length > 0 ? path[path.length - 1].value : 0;
}

/**
 * Run the simulator, enrich each holding with live data, and (when the
 * portfolio opts in via `applyNewsOverlay`) compute a news-weighted
 * tilt that's reflected in the scenario chart values.
 */
export async function simulatePortfolioLive(
  portfolio: SimulationPortfolio,
  providers: InvestmentProviderProfile[] = INVESTMENT_PROVIDERS,
  shock: RiskShock = DEFAULT_RISK_SHOCK,
): Promise<{ base: SimulationResult; live: LiveAdjustedResult | null }> {
  // Always compute the baseline scenario result so callers without
  // overlay opt-in get the standard, fully-tested math.
  const base = simulatePortfolio(portfolio, providers, shock);

  const overlayOn = portfolio.applyNewsOverlay === true;
  if (!overlayOn) {
    return { base, live: null };
  }

  // Enrich every holding's provider. enrichInvestmentProviders fetches
  // shared lookups (vendors, news, atlas, pillars, momentum) ONCE and
  // reuses them across all providers.
  const providerById = new Map(providers.map((p) => [p.id, p]));
  const holdingProviders = portfolio.holdings
    .map((h) => providerById.get(h.providerId))
    .filter((p): p is InvestmentProviderProfile => Boolean(p));

  // skipQuotes here is intentional — the simulator path doesn't need
  // Yahoo prices for tilt math; the Public AI Stocks page handles quote
  // display. Skipping the per-provider fan-out keeps simulator runs
  // fast and avoids Yahoo rate-limit risk during repeated re-simulates.
  const enriched = await enrichInvestmentProviders(holdingProviders, { skipQuotes: true });
  const enrichedById = new Map(enriched.map((e) => [e.provider.id, e]));

  // Compute per-holding tilt and the portfolio-weighted average.
  const horizonYears = portfolio.horizonYears;
  const holdings: HoldingLiveContext[] = [];
  let weightedTilt = 0;
  for (const holding of portfolio.holdings) {
    const e = enrichedById.get(holding.providerId);
    if (!e) continue;
    const tilt = computeNewsTilt(e.news);
    const { rationale } = newsTiltWithRationale(e.news);
    weightedTilt += (holding.weightPct / 100) * tilt.tilt;
    holdings.push({
      providerId: holding.providerId,
      providerName: e.provider.name,
      enriched: e,
      tilt,
      rationale,
    });
  }

  const portfolioAnnualTilt = Math.round(weightedTilt * 10000) / 10000;

  function adjustScenario(path: ScenarioPoint[]): LiveAdjustedScenario {
    const adjustedPath = applyTiltToPath(path, portfolioAnnualTilt, horizonYears);
    const originalTerminalValue = lastValue(path);
    const adjustedTerminalValue = lastValue(adjustedPath);
    const multiplier = Math.pow(1 + portfolioAnnualTilt, horizonYears);
    return { multiplier, originalTerminalValue, adjustedTerminalValue, adjustedPath };
  }

  const tiltPct = (portfolioAnnualTilt * 100).toFixed(2);
  const dir = portfolioAnnualTilt > 0.0005 ? "lift" : portfolioAnnualTilt < -0.0005 ? "drag" : "no net move";
  const summary = `News overlay: ${dir} of ${tiltPct}pp annualised across the portfolio. ${holdings.length} holdings carry classified news; weighting matches the configured allocation.`;

  return {
    base,
    live: {
      baseResult: base,
      holdings,
      portfolioAnnualTilt,
      scenarios: {
        bull: adjustScenario(base.bullPath),
        base: adjustScenario(base.basePath),
        bear: adjustScenario(base.bearPath),
        stress: adjustScenario(base.stressPath),
      },
      summary,
    },
  };
}
