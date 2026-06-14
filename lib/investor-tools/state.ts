// InvestorState — single shared model for the Investor Tools surface.
//
// Persistence: serialised to `localStorage` under STORAGE_KEY. The provider
// also subscribes to the cross-tab `storage` event so a change in one browser
// tab/window propagates to others within the same origin.
//
// Versioning: STATE_VERSION is bumped whenever the shape changes; older
// payloads are discarded rather than half-rehydrated to keep the contract
// honest (no silent data drift between releases).
//
// What lives here:
//   - simulatorInput          — last simulator inputs (universe, allocations, etc.)
//   - watchlist               — provider IDs the user has explicitly tracked
//   - recentlyViewedProviderIds — capped FIFO of /provider/[slug] visits
//   - focusProviderId         — the provider the user most recently focused on
//
// What is NOT stored:
//   - any computed scores (always recomputed from seed/manifest)
//   - any LLM output (server-side ingestion responsibility)
//   - any auth/PII (the surface is single-tenant local-first today)

import type { SimulationInput } from "../investing/types";

export const STATE_VERSION = 2;
export const STORAGE_KEY = "ai-enterpise.investor.v2";
const MAX_RECENT = 12;

export interface InvestorState {
  version: number;
  simulatorInput: Partial<SimulationInput>;
  watchlist: string[];
  recentlyViewedProviderIds: string[];
  focusProviderId: string | null;
  // Free-form named saved portfolios so users can A/B configurations without
  // overwriting their working set. id = stable nanoid; name = user label.
  savedPortfolios: { id: string; name: string; input: Partial<SimulationInput>; savedAt: string }[];
  lastUpdatedAt: string;
}

export const EMPTY_STATE: InvestorState = {
  version: STATE_VERSION,
  simulatorInput: {},
  watchlist: [],
  recentlyViewedProviderIds: [],
  focusProviderId: null,
  savedPortfolios: [],
  lastUpdatedAt: new Date(0).toISOString(),
};

// ─── Pure mutators ────────────────────────────────────────────────────────
// Every mutator returns a NEW state and bumps lastUpdatedAt — never mutates in place.

export function addToWatchlist(state: InvestorState, providerId: string): InvestorState {
  if (state.watchlist.includes(providerId)) return state;
  return {
    ...state,
    watchlist: [...state.watchlist, providerId],
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function removeFromWatchlist(state: InvestorState, providerId: string): InvestorState {
  if (!state.watchlist.includes(providerId)) return state;
  return {
    ...state,
    watchlist: state.watchlist.filter((id) => id !== providerId),
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function recordProviderView(state: InvestorState, providerId: string): InvestorState {
  const filtered = state.recentlyViewedProviderIds.filter((id) => id !== providerId);
  return {
    ...state,
    recentlyViewedProviderIds: [providerId, ...filtered].slice(0, MAX_RECENT),
    focusProviderId: providerId,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function setSimulatorInput(state: InvestorState, input: Partial<SimulationInput>): InvestorState {
  return {
    ...state,
    simulatorInput: input,
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function patchSimulatorInput(state: InvestorState, patch: Partial<SimulationInput>): InvestorState {
  return setSimulatorInput(state, { ...state.simulatorInput, ...patch });
}

export function savePortfolio(state: InvestorState, name: string): InvestorState {
  const id = `port_${Date.now().toString(36)}`;
  return {
    ...state,
    savedPortfolios: [
      { id, name, input: state.simulatorInput, savedAt: new Date().toISOString() },
      ...state.savedPortfolios,
    ].slice(0, 20),
    lastUpdatedAt: new Date().toISOString(),
  };
}

export function loadPortfolio(state: InvestorState, id: string): InvestorState {
  const found = state.savedPortfolios.find((p) => p.id === id);
  if (!found) return state;
  return setSimulatorInput(state, found.input);
}

export function deletePortfolio(state: InvestorState, id: string): InvestorState {
  return {
    ...state,
    savedPortfolios: state.savedPortfolios.filter((p) => p.id !== id),
    lastUpdatedAt: new Date().toISOString(),
  };
}

// ─── Storage I/O ──────────────────────────────────────────────────────────

export function readState(): InvestorState {
  if (typeof window === "undefined") return EMPTY_STATE;
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY);
    if (!raw) return EMPTY_STATE;
    const parsed = JSON.parse(raw) as InvestorState;
    if (!parsed || parsed.version !== STATE_VERSION) return EMPTY_STATE;
    // Defensive: ensure required arrays exist (older partial payloads).
    return {
      ...EMPTY_STATE,
      ...parsed,
      watchlist: Array.isArray(parsed.watchlist) ? parsed.watchlist : [],
      recentlyViewedProviderIds: Array.isArray(parsed.recentlyViewedProviderIds) ? parsed.recentlyViewedProviderIds : [],
      savedPortfolios: Array.isArray(parsed.savedPortfolios) ? parsed.savedPortfolios : [],
    };
  } catch {
    return EMPTY_STATE;
  }
}

export function writeState(state: InvestorState): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Quota exceeded or storage unavailable — fail silently; the in-memory
    // copy is still correct for this session.
  }
}

export function clearState(): void {
  if (typeof window === "undefined") return;
  try {
    window.localStorage.removeItem(STORAGE_KEY);
  } catch { /* ignore */ }
}
