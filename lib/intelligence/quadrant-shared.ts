// Quadrant types + pure helpers shared between server and client code.
// ────────────────────────────────────────────────────────────────────
// This file MUST stay import-free of any server-only modules
// (Prisma, lib/prisma, repository) so the client `QuadrantChart`
// component can import from it without dragging Node-only modules
// (dns, fs, net, tls) into the browser bundle.

import type { Vendor } from "./types";

export type QuadrantId = "leaders" | "established" | "challengers" | "watchlist";

export interface QuadrantPoint {
  vendor: Vendor;
  now: { score: number; momentum: number };
  prev: { score: number; momentum: number } | null;
  delta: { score: number; momentum: number } | null;
  crossedQuadrant: boolean;
}

export interface QuadrantData {
  generatedAt: string;
  windowDays: number;
  scoreCut: number;
  momentumCut: number;
  points: QuadrantPoint[];
}

export function quadrantOf(score: number, momentum: number, scoreCut: number, momentumCut: number): QuadrantId {
  if (score >= scoreCut && momentum >= momentumCut) return "leaders";
  if (score >= scoreCut && momentum < momentumCut) return "established";
  if (score < scoreCut && momentum >= momentumCut) return "challengers";
  return "watchlist";
}

export const QUADRANT_LABELS: Record<QuadrantId, string> = {
  leaders: "Leaders",
  established: "Established",
  challengers: "Challengers",
  watchlist: "Watch list",
};
