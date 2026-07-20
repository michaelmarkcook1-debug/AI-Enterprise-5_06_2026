"use client";

// Bridges Wave-3 Interrogate's context-adjusted weak domains (computed inside
// InterrogatePanel, nested in the vendor page's "assessment" tab) to Wave-4
// Prep Kit (rendered in VendorPageShell's separate verdictExtras slot). The two
// panels arrive at VendorPageShell as independent, already-rendered ReactNode
// props with no shared component instance — this Context is the one wire
// between them, provided once per vendor-page client tree by VendorPageShell.
//
// Vendor-scope only, and only from a REAL context-adjusted run (never a
// stubbed/insufficient-context result) — see InterrogatePanel's `run()`. No
// Provider mounted ⇒ the default no-op value applies (e.g. category pages,
// which have no Prep Kit panel to feed).

import { createContext, useContext, useState, type ReactNode } from "react";
import type { DomainId } from "@/lib/types";

interface WeakDomainsContextValue {
  weakDomains: DomainId[];
  setWeakDomains: (domains: DomainId[]) => void;
}

const WeakDomainsContext = createContext<WeakDomainsContextValue>({
  weakDomains: [],
  setWeakDomains: () => {},
});

export function WeakDomainsProvider({ children }: { children: ReactNode }) {
  const [weakDomains, setWeakDomains] = useState<DomainId[]>([]);
  return (
    <WeakDomainsContext.Provider value={{ weakDomains, setWeakDomains }}>{children}</WeakDomainsContext.Provider>
  );
}

export function useWeakDomains(): WeakDomainsContextValue {
  return useContext(WeakDomainsContext);
}
