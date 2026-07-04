// Peer-AI heatmap derivation — pure, deterministic, zero I/O.
// Rows = the five observable AI signals; columns = the selected peers.
// Nothing here computes or adjusts a rating: it only ARRANGES the curated,
// cited signals from peer-adoption-data.ts for display.

import type { PeerCompany, PeerSignal, PeerSignalKind } from "./types";
import { PEER_COMPANIES } from "./peer-adoption-data";

export interface SignalKindMeta {
  kind: PeerSignalKind;
  label: string;
  description: string;
}

/** Display order + copy for the five signal families. */
export const SIGNAL_KINDS: SignalKindMeta[] = [
  {
    kind: "platform_integration",
    label: "AI platform integration",
    description:
      "Which AI vendors/platforms the company has publicly disclosed adopting — press releases, case studies, earnings mentions. Cells cross-link to the vendor's assessment.",
  },
  {
    kind: "product_footprint",
    label: "AI product footprint",
    description: "Shipped, publicly announced AI products and features.",
  },
  {
    kind: "talent_exposure",
    label: "AI talent exposure",
    description:
      "AI/ML workforce signals from disclosed sources and third-party benchmarks (e.g. the Evident AI Index).",
  },
  {
    kind: "patent_velocity",
    label: "AI patent / research velocity",
    description: "AI patent filings and research output, from filings and analyst trackers.",
  },
  {
    kind: "automation_intensity",
    label: "AI delivery / automation intensity",
    description:
      "How far AI penetrates day-to-day operations — always an inference from disclosed usage/efficiency stats, flagged est., never asserted.",
  },
];

/** Qualitative scale copy (levels are analyst-curated readings of the citations). */
export const LEVEL_LABELS: Record<1 | 2 | 3 | 4, string> = {
  1: "Early",
  2: "Developing",
  3: "Substantial",
  4: "Extensive",
};

export interface HeatmapCell {
  companyId: string;
  signal: PeerSignal;
}

export interface HeatmapRow {
  meta: SignalKindMeta;
  cells: HeatmapCell[]; // one per column, in column order
}

export interface PeerHeatmap {
  columns: PeerCompany[];
  rows: HeatmapRow[];
}

export function getPeerById(id: string): PeerCompany | undefined {
  return PEER_COMPANIES.find((c) => c.id === id);
}

export function signalOf(company: PeerCompany, kind: PeerSignalKind): PeerSignal | undefined {
  return company.signals.find((s) => s.kind === kind);
}

/**
 * Arrange the curated dataset into rows × columns for the selected peer ids
 * (unknown ids dropped; empty/omitted selection = the full starter set).
 * A company missing a signal kind entirely renders as not_disclosed — absence
 * of data is a fact, never a default rating.
 */
export function buildPeerHeatmap(selectedIds?: string[]): PeerHeatmap {
  const columns =
    selectedIds && selectedIds.length > 0
      ? (selectedIds.map((id) => getPeerById(id)).filter(Boolean) as PeerCompany[])
      : PEER_COMPANIES;

  const rows: HeatmapRow[] = SIGNAL_KINDS.map((meta) => ({
    meta,
    cells: columns.map((c) => ({
      companyId: c.id,
      signal:
        signalOf(c, meta.kind) ??
        ({ kind: meta.kind, status: "not_disclosed", citations: [] } as PeerSignal),
    })),
  }));

  return { columns, rows };
}
