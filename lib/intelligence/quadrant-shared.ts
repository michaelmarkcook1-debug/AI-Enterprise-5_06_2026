// Quadrant types + pure helpers shared between server and client code.
// ────────────────────────────────────────────────────────────────────
// This file MUST stay import-free of any server-only modules
// (Prisma, lib/prisma, repository) so the client `QuadrantChart`
// component can import from it without dragging Node-only modules
// (dns, fs, net, tls) into the browser bundle.

import type { Vendor } from "./types";

export type QuadrantId = "leaders" | "challengers" | "visionaries" | "niche";

export interface QuadrantPoint {
  vendor: Vendor;
  /**
   * Position on the Magic-Quadrant axes. `vision` and `execute` are
   * the Gartner-style scalars computed by vendor-health.ts. `score`
   * and `momentum` are kept around as raw inputs for tooltips.
   */
  now: { execute: number; vision: number; score: number; momentum: number };
  prev: { execute: number; vision: number; score: number; momentum: number } | null;
  delta: { execute: number; vision: number; score: number; momentum: number } | null;
  /** True iff the vendor appears in the dashboard "Who's losing" list. */
  isLosing: boolean;
  crossedQuadrant: boolean;
  /** Component breakdown surfaced in the hover detail. */
  components: {
    execute: { confidence: number; reliability: number; breadth: number; riskDrag: number };
    vision: { momentum: number; product: number; useCases: number; shareDrag: number };
  };
}

export interface QuadrantData {
  generatedAt: string;
  windowDays: number;
  /** Vertical cut — execute threshold above which a vendor is in the top row. */
  executeCut: number;
  /** Horizontal cut — vision threshold right of which a vendor is in the right column. */
  visionCut: number;
  points: QuadrantPoint[];
}

export function quadrantOf(execute: number, vision: number, executeCut: number, visionCut: number): QuadrantId {
  if (execute >= executeCut && vision >= visionCut) return "leaders";
  if (execute >= executeCut && vision < visionCut)  return "challengers";
  if (execute <  executeCut && vision >= visionCut) return "visionaries";
  return "niche";
}

export const QUADRANT_LABELS: Record<QuadrantId, string> = {
  leaders: "Leaders",
  challengers: "Challengers",
  visionaries: "Visionaries",
  niche: "Niche players",
};
