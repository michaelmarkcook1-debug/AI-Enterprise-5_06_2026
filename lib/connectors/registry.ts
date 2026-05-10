/**
 * Connector registry — single source of truth for all data-source adapters.
 * Routes + admin page iterate this list; nothing is registered ad-hoc elsewhere.
 */

import type { Connector } from "./types";
import { secConnector } from "./sec";
import { fredConnector } from "./fred";
import { blsConnector } from "./bls";
import { beaConnector } from "./bea";
import { eiaConnector } from "./eia";
import { fiscalDataConnector } from "./fiscalData";
import { alphaVantageConnector } from "./alphaVantage";
import { gdeltConnector } from "./gdelt";
import { githubConnector } from "./github";
import { congressConnector } from "./congress";
import { federalRegisterConnector } from "./federalRegister";

// Loose typing here is deliberate — connectors take different query shapes.
// The registry only needs the common health()/fetch() surface for listing.
export const CONNECTORS: Record<string, Connector<unknown, unknown>> = {
  sec: secConnector as unknown as Connector<unknown, unknown>,
  fred: fredConnector as unknown as Connector<unknown, unknown>,
  bls: blsConnector as unknown as Connector<unknown, unknown>,
  bea: beaConnector as unknown as Connector<unknown, unknown>,
  eia: eiaConnector as unknown as Connector<unknown, unknown>,
  fiscalData: fiscalDataConnector as unknown as Connector<unknown, unknown>,
  alphaVantage: alphaVantageConnector as unknown as Connector<unknown, unknown>,
  gdelt: gdeltConnector as unknown as Connector<unknown, unknown>,
  github: githubConnector as unknown as Connector<unknown, unknown>,
  congress: congressConnector as unknown as Connector<unknown, unknown>,
  federalRegister: federalRegisterConnector as unknown as Connector<unknown, unknown>,
};

export function listConnectorHealth() {
  return Object.values(CONNECTORS).map((c) => c.health());
}

export function getConnector(id: string) {
  return CONNECTORS[id];
}

export function dashboardSummary() {
  const all = listConnectorHealth();
  return {
    total: all.length,
    configured: all.filter((c) => c.configured).length,
    notConfigured: all.filter((c) => c.status === "not_configured").length,
    okStatus: all.filter((c) => c.status === "ok").length,
    errorStatus: all.filter((c) => c.status === "error").length,
    rateLimited: all.filter((c) => c.status === "rate_limited").length,
    requiresKeyMissing: all.filter((c) => c.requiresKey && !c.configured).length,
  };
}
