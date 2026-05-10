"use client";

// InvestorStateProvider — single shared state surface for every Investor Tools
// tab. Persists to localStorage; subscribes to cross-tab `storage` events so a
// change in one window/tab fans out to the others without a full refresh.
//
// Design notes:
//   - useSyncExternalStore avoids hydration races (same value SSR/CSR).
//   - The store is a small in-memory object + a notifier set; mutators write
//     to localStorage AND invoke notifiers, which lets the storage-event hook
//     reconcile without infinite loops.

import { createContext, useCallback, useContext, useMemo, useSyncExternalStore } from "react";
import {
  EMPTY_STATE,
  STORAGE_KEY,
  type InvestorState,
  addToWatchlist as addToWatchlistFn,
  patchSimulatorInput as patchSimulatorInputFn,
  readState,
  recordProviderView as recordProviderViewFn,
  removeFromWatchlist as removeFromWatchlistFn,
  setSimulatorInput as setSimulatorInputFn,
  savePortfolio as savePortfolioFn,
  loadPortfolio as loadPortfolioFn,
  deletePortfolio as deletePortfolioFn,
  writeState,
} from "@/lib/investor-tools/state";
import type { SimulationInput } from "@/lib/investing/types";

type Listener = () => void;

class InvestorStore {
  private current: InvestorState = EMPTY_STATE;
  private listeners = new Set<Listener>();
  private hydrated = false;

  hydrate() {
    if (this.hydrated || typeof window === "undefined") return;
    this.current = readState();
    this.hydrated = true;
    if (typeof window !== "undefined") {
      window.addEventListener("storage", this.handleStorage);
    }
    this.notify();
  }

  teardown() {
    if (typeof window !== "undefined") {
      window.removeEventListener("storage", this.handleStorage);
    }
  }

  private handleStorage = (event: StorageEvent) => {
    if (event.key !== STORAGE_KEY) return;
    // Another tab/window wrote — re-read so all subscribers reconcile.
    this.current = readState();
    this.notify();
  };

  get(): InvestorState {
    return this.current;
  }

  set(next: InvestorState): void {
    this.current = next;
    writeState(next);
    this.notify();
  }

  subscribe = (listener: Listener): (() => void) => {
    this.listeners.add(listener);
    return () => { this.listeners.delete(listener); };
  };

  private notify() {
    for (const l of this.listeners) l();
  }
}

// Single store per browser tab.
const store = new InvestorStore();

interface ContextValue {
  state: InvestorState;
  hydrated: boolean;
  addToWatchlist: (providerId: string) => void;
  removeFromWatchlist: (providerId: string) => void;
  toggleWatchlist: (providerId: string) => void;
  isOnWatchlist: (providerId: string) => boolean;
  recordProviderView: (providerId: string) => void;
  setSimulatorInput: (input: Partial<SimulationInput>) => void;
  patchSimulatorInput: (patch: Partial<SimulationInput>) => void;
  savePortfolio: (name: string) => void;
  loadPortfolio: (id: string) => void;
  deletePortfolio: (id: string) => void;
}

const InvestorStateContext = createContext<ContextValue | null>(null);

export function InvestorStateProvider({ children }: { children: React.ReactNode }) {
  // SSR snapshot returns EMPTY_STATE so the server-rendered HTML is stable.
  const state = useSyncExternalStore(
    store.subscribe,
    () => {
      // Lazy-hydrate on first client read so we don't write during SSR.
      if (!store["hydrated"]) store.hydrate();
      return store.get();
    },
    () => EMPTY_STATE,
  );

  const value = useMemo<ContextValue>(() => ({
    state,
    hydrated: state !== EMPTY_STATE || state.lastUpdatedAt !== EMPTY_STATE.lastUpdatedAt,
    addToWatchlist: (id) => store.set(addToWatchlistFn(store.get(), id)),
    removeFromWatchlist: (id) => store.set(removeFromWatchlistFn(store.get(), id)),
    toggleWatchlist: (id) => {
      const current = store.get();
      store.set(current.watchlist.includes(id)
        ? removeFromWatchlistFn(current, id)
        : addToWatchlistFn(current, id));
    },
    isOnWatchlist: (id) => store.get().watchlist.includes(id),
    recordProviderView: (id) => store.set(recordProviderViewFn(store.get(), id)),
    setSimulatorInput: (input) => store.set(setSimulatorInputFn(store.get(), input)),
    patchSimulatorInput: (patch) => store.set(patchSimulatorInputFn(store.get(), patch)),
    savePortfolio: (name) => store.set(savePortfolioFn(store.get(), name)),
    loadPortfolio: (id) => store.set(loadPortfolioFn(store.get(), id)),
    deletePortfolio: (id) => store.set(deletePortfolioFn(store.get(), id)),
  }), [state]);

  return <InvestorStateContext.Provider value={value}>{children}</InvestorStateContext.Provider>;
}

export function useInvestorState(): ContextValue {
  const value = useContext(InvestorStateContext);
  if (!value) {
    throw new Error("useInvestorState must be used inside <InvestorStateProvider>. Wrap your route or layout with it.");
  }
  return value;
}

// Lightweight read-only hook for components that just need to subscribe
// without mutators (avoids re-creating the mutator object on every render).
export function useInvestorSnapshot(): InvestorState {
  return useInvestorState().state;
}

export function useWatchlistMembership(providerId: string | undefined): { isOn: boolean; toggle: () => void } {
  const ctx = useInvestorState();
  return {
    isOn: providerId ? ctx.isOnWatchlist(providerId) : false,
    toggle: useCallback(() => providerId && ctx.toggleWatchlist(providerId), [ctx, providerId]),
  };
}
