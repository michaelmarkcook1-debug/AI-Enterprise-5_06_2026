// Per-tab data-source descriptors for the left-hand "Data sources" rail.
// ──────────────────────────────────────────────────────────────────────
// Each tab is backed by a different mix of live connectors, vendor evidence,
// and modelled/seed estimates. The rail makes that provenance explicit so a
// user knows what each surface is built on. Static descriptors (no network) —
// the authoritative connector list lives in lib/connectors/registry.ts and is
// surfaced live on /admin/data-sources.

import type { EvidenceGrade } from "@/lib/types";

export type SourceKind = "live" | "seed" | "mixed";

export interface DataSource {
  name: string;
  kind: SourceKind;
  /** Default evidence grade this source produces (E0 inferred → E5 verified). */
  grade?: EvidenceGrade;
  /** Short provenance note (e.g. "official filing", "developer signal"). */
  note?: string;
}

export interface DataSourceGroup {
  label: string;
  sources: DataSource[];
}

export type TabKey =
  | "query" | "understand" | "assess" | "demonstrate"
  | "monitor" | "news" | "market" | "investor";

export const TAB_DATA_SOURCES: Record<TabKey, DataSourceGroup[]> = {
  query: [
    { label: "Live signals", sources: [
      { name: "GitHub REST API", kind: "live", grade: "E3", note: "developer momentum" },
      { name: "GDELT", kind: "live", grade: "E2", note: "news / events" },
      { name: "SEC EDGAR", kind: "live", grade: "E5", note: "official filings" },
    ]},
    { label: "Modelled", sources: [
      { name: "Vendor scores & pillars", kind: "seed", note: "directional model" },
      { name: "Category share & momentum", kind: "seed", note: "estimated" },
    ]},
  ],
  understand: [
    { label: "Capability evidence", sources: [
      { name: "Vendor official docs", kind: "mixed", grade: "E4", note: "LLM-extracted" },
      { name: "Evidence proposals", kind: "mixed", note: "review-gated" },
    ]},
    { label: "Programmatic", sources: [
      { name: "SEC EDGAR", kind: "live", grade: "E5" },
      { name: "GitHub REST API", kind: "live", grade: "E3" },
    ]},
    { label: "Modelled", sources: [
      { name: "Strategic scores", kind: "seed", note: "directional" },
    ]},
  ],
  assess: [
    { label: "Vendor evidence", sources: [
      { name: "Evidence records (E0–E5)", kind: "mixed", note: "graded" },
      { name: "Vendor official docs", kind: "mixed", grade: "E4" },
    ]},
    { label: "Modelled", sources: [
      { name: "Pillar scores", kind: "seed", note: "directional" },
      { name: "Industry profiles", kind: "seed", note: "weights & blockers" },
    ]},
  ],
  demonstrate: [
    { label: "Live", sources: [
      { name: "GitHub REST API", kind: "live", grade: "E3", note: "reputation signal" },
    ]},
    { label: "Evidence", sources: [
      { name: "Vendor official docs", kind: "mixed", grade: "E4" },
      { name: "News & events", kind: "mixed", grade: "E2" },
    ]},
    { label: "Modelled", sources: [
      { name: "Board-defence & business case", kind: "seed", note: "scaffold" },
      { name: "Reputation (customer/employee)", kind: "seed" },
    ]},
  ],
  monitor: [
    { label: "Signals", sources: [
      { name: "GDELT / news", kind: "live", grade: "E2", note: "drift signals" },
    ]},
    { label: "Modelled", sources: [
      { name: "Decision register", kind: "seed", note: "tracked decisions" },
      { name: "Risk & assumptions", kind: "seed" },
    ]},
  ],
  news: [
    { label: "News sources", sources: [
      { name: "GDELT", kind: "live", grade: "E2", note: "global events" },
      { name: "Vendor press releases", kind: "mixed", note: "discovery pipeline" },
      { name: "SEC 8-K", kind: "live", grade: "E5", note: "material events" },
    ]},
    { label: "Enrichment", sources: [
      { name: "Competitive-intel monitor", kind: "live", note: "web-search grounded" },
    ]},
  ],
  market: [
    { label: "Market data", sources: [
      { name: "Alpha Vantage", kind: "live", grade: "E4", note: "exchange data" },
      { name: "Yahoo Finance", kind: "live", grade: "E3" },
    ]},
    { label: "Modelled", sources: [
      { name: "Share estimates", kind: "seed", note: "directional" },
    ]},
  ],
  investor: [
    { label: "Filings & macro", sources: [
      { name: "SEC EDGAR", kind: "live", grade: "E5", note: "filings" },
      { name: "FRED (Federal Reserve)", kind: "live", grade: "E5", note: "macro" },
      { name: "BLS", kind: "live", grade: "E5" },
      { name: "BEA", kind: "live", grade: "E5" },
      { name: "US Treasury Fiscal Data", kind: "live", grade: "E5" },
    ]},
    { label: "Market data", sources: [
      { name: "Alpha Vantage", kind: "live", grade: "E4" },
      { name: "Yahoo Finance", kind: "live", grade: "E3" },
    ]},
    { label: "Regulatory", sources: [
      { name: "Congress.gov", kind: "live", grade: "E5" },
      { name: "Federal Register", kind: "live", grade: "E5" },
    ]},
    { label: "Signals", sources: [
      { name: "GDELT", kind: "live", grade: "E2" },
      { name: "IPO watch", kind: "seed", note: "modelled" },
    ]},
  ],
};

export function dataSourcesForTab(tab: TabKey): DataSourceGroup[] {
  return TAB_DATA_SOURCES[tab] ?? [];
}
