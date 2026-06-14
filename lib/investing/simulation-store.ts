import { DEFAULT_RISK_SHOCK } from "./seed";
import { getSeedPortfolio, simulatePortfolio } from "./simulator";
import type { RiskShock, SimulationInput, SimulationPortfolio, SimulationResult } from "./types";

export interface SavedInvestmentSimulation {
  id: string;
  portfolio: SimulationPortfolio;
  result: SimulationResult;
  input: Partial<SimulationInput>;
  shock: RiskShock;
  createdAt: string;
  dataStatus: "seed";
}

type SimulationStore = Map<string, SavedInvestmentSimulation>;

function getStore(): SimulationStore {
  const globalStore = globalThis as typeof globalThis & { __aiEnterpiseInvestmentSimulations?: SimulationStore };
  if (!globalStore.__aiEnterpiseInvestmentSimulations) {
    globalStore.__aiEnterpiseInvestmentSimulations = new Map();
  }
  return globalStore.__aiEnterpiseInvestmentSimulations;
}

export function saveInvestmentSimulation(input: Partial<SimulationInput> = {}, shock: Partial<RiskShock> = {}) {
  const portfolio = getSeedPortfolio(input);
  const normalisedShock = { ...DEFAULT_RISK_SHOCK, ...shock };
  const result = simulatePortfolio(portfolio, undefined, normalisedShock);
  const id = `seed_sim_${Date.now()}_${Math.random().toString(36).slice(2, 8)}`;
  const saved: SavedInvestmentSimulation = {
    id,
    portfolio: { ...portfolio, id },
    result: { ...result, portfolioId: id },
    input,
    shock: normalisedShock,
    createdAt: new Date().toISOString(),
    dataStatus: "seed",
  };

  getStore().set(id, saved);
  return saved;
}

export function getInvestmentSimulation(id: string) {
  return getStore().get(id) ?? null;
}

export function listInvestmentSimulations() {
  return Array.from(getStore().values()).sort((a, b) => b.createdAt.localeCompare(a.createdAt));
}
