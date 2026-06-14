/**
 * SEC EDGAR connector.
 *
 * No API key required, but SEC requires a compliant User-Agent that
 * identifies who you are AND contains a contact email. Set
 * SEC_USER_AGENT="AI Enterprise contact@example.com".
 *
 * Use cases: 10-K, 10-Q, 8-K, S-1 filings; XBRL company facts; CIK lookup.
 * Rate limit: 10 req/sec. Polite back-off recommended.
 *
 * Output shape note: SEC returns JSON natively (no string-encoded
 * numbers like EIA). `companyFacts` returns the XBRL tree with
 * `units.USD[].val` as actual numbers.
 */

import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";

const HOME = "https://www.sec.gov/edgar";
const DOCS = "https://www.sec.gov/edgar/sec-api-documentation";
const SUBMISSIONS = (cik: string) => `https://data.sec.gov/submissions/CIK${cik.padStart(10, "0")}.json`;
const COMPANY_FACTS = (cik: string) => `https://data.sec.gov/api/xbrl/companyfacts/CIK${cik.padStart(10, "0")}.json`;

export const SEC_NOT_CONFIGURED_MESSAGE =
  "SEC_USER_AGENT is required and must contain a contact email (e.g. \"AI Enterprise contact@example.com\")";

export function isSecUserAgentValid(ua: string | undefined): ua is string {
  if (!ua) return false;
  // Must contain an email (at-sign with text either side) AND be at least
  // 8 chars to discourage placeholder values like "x@y".
  return /\S+@\S+\.\S+/.test(ua) && ua.length >= 8;
}

export interface SecQuery {
  cik: string;
  /** "submissions" returns recent filings; "facts" returns XBRL company facts. */
  resource?: "submissions" | "facts";
}

interface SecRecord {
  cik: string;
  resource: "submissions" | "facts";
  raw: unknown;
}

export const secConnector: Connector<SecQuery, SecRecord> = {
  health(): ConnectorHealth {
    const ua = process.env.SEC_USER_AGENT;
    const ok = isSecUserAgentValid(ua);
    const last = getLastFetch("sec");
    return {
      id: "sec",
      label: "SEC EDGAR",
      group: "filings",
      tier: "official_government",
      requiresKey: false,
      envVars: ["SEC_USER_AGENT"],
      configured: ok,
      status: ok ? "ok" : "not_configured",
      message: ok ? undefined : SEC_NOT_CONFIGURED_MESSAGE,
      homepageUrl: HOME,
      apiDocsUrl: DOCS,
      rateLimitNotes: "10 req/sec. Polite back-off recommended. SEC may block requests without a contact-bearing User-Agent.",
      defaultEvidenceGrade: "E5",
      defaultConfidenceFloor: 92,
      description: "Filings (10-K, 10-Q, 8-K, S-1) + XBRL company facts. Authoritative for valuation, segment reporting, IPO timing.",
      lastFetchAt: last?.at,
      lastFetchOk: last?.ok,
      lastFetchError: last?.error,
      lastFetchRecordCount: last?.recordCount,
    };
  },

  async fetch(query?: SecQuery): Promise<FetchResult<SecRecord>> {
    const fetchedAt = new Date().toISOString();
    const ua = process.env.SEC_USER_AGENT;
    if (!isSecUserAgentValid(ua)) {
      return { ok: false, status: "not_configured", records: [], recordCount: 0, fetchedAt, error: SEC_NOT_CONFIGURED_MESSAGE };
    }
    if (!query?.cik) {
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: "cik required" };
    }
    const resource = query.resource ?? "submissions";
    const url = resource === "facts" ? COMPANY_FACTS(query.cik) : SUBMISSIONS(query.cik);
    try {
      const res = await fetch(url, { headers: { "User-Agent": ua, Accept: "application/json" } });
      if (!res.ok) {
        const error = `HTTP ${res.status} ${res.statusText}`;
        recordLastFetch("sec", { ok: false, error });
        return { ok: false, status: res.status === 429 ? "rate_limited" : "error", records: [], recordCount: 0, fetchedAt, error, sourceUrl: url };
      }
      const raw = await res.json();
      const records: SecRecord[] = [{ cik: query.cik, resource, raw }];
      recordLastFetch("sec", { ok: true, recordCount: records.length });
      return { ok: true, status: "ok", records, recordCount: records.length, fetchedAt, sourceUrl: url };
    } catch (e) {
      const error = e instanceof Error ? e.message : String(e);
      recordLastFetch("sec", { ok: false, error });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error };
    }
  },
};
