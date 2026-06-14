// Evidence Deduplication — pure clustering primitives.
// ────────────────────────────────────────────────────
// Report-only by default. The clustering logic operates on raw evidence
// identity (vendorId + domain + subfactor + canonical URL + excerpt hash)
// — NOT on classifier confidence or rationale, both of which can be
// stamped with the runner's missing-value fallback (see
// CLASSIFIER_FAILURE_REPORT.md). We never collapse rows based on a
// classifier output that might be a fallback.
//
// Two clustering passes:
//   1) EXACT — same vendor/domain/subfactor/canonical URL + same
//      excerpt hash. Safe to auto-merge in opt-in mode.
//   2) NEAR  — same vendor/domain/subfactor/canonical URL within a
//      capture window, with Jaccard token similarity ≥ threshold.
//      ALWAYS routed to human review.
//
// All clustering is deterministic and free of I/O — `dedup-runner.ts`
// adds the DB layer and CLI wiring.

import { createHash } from "node:crypto";

export interface DedupInput {
  id: string;
  vendorId: string;
  domain: string;
  subfactor: string;
  excerpt: string;
  sourceUrl: string | null;
  capturedAt: Date;
  // Classifier fields are read for tie-breaking representative choice ONLY,
  // never for clustering. The runner zeroes them out for fallback rows
  // before passing them in (see `pickRepresentative`).
  classifierConfidence: number;
  classifierRationale: string | null;
  classificationFailed?: boolean | null;
  confidenceIsFallback?: boolean | null;
  proposedGrade?: string | null;
}

export interface ExactCluster {
  key: string;
  vendorId: string;
  domain: string;
  subfactor: string;
  canonicalSourceUrl: string;
  excerptHash: string;
  members: DedupInput[];
}

export interface NearCluster {
  vendorId: string;
  domain: string;
  subfactor: string;
  canonicalSourceUrl: string;
  /** Calendar-week bucket the cluster covers (ISO date of the Monday). */
  captureWeekStart: string;
  members: DedupInput[];
  /** Highest pairwise Jaccard similarity within the cluster, 0–1. */
  maxSimilarity: number;
}

export interface DedupReport {
  totalInput: number;
  exactClusterCount: number;
  exactDuplicateRows: number;          // members that are duplicates of an exact-cluster representative
  nearClusterCount: number;
  nearDuplicateRows: number;
  /** Rows safe for auto-merge — i.e. members of exact clusters where the
   * non-representative members have NO classifier-fallback flag (so we
   * are confident the duplicate is genuine and not a re-extraction of
   * a failed-classify row that should be reclassified instead). */
  safeAutoMergeRows: number;
  humanReviewRows: number;             // every near-dup + every exact-dup with any fallback member
  exactClusters: ExactCluster[];
  nearClusters: NearCluster[];
}

// ─── URL canonicalisation ────────────────────────────────────────────────

const TRACKING_PARAM_RX = /^(utm_|gclid$|fbclid$|mc_eid$|mc_cid$|ref$|ref_src$|trk$)/i;

export function canonicalUrl(raw: string | null | undefined): string {
  if (!raw) return "";
  let s = raw.trim();
  if (!s) return "";
  // Cheap normalisation if URL constructor rejects (e.g. relative URL).
  try {
    const u = new URL(s);
    u.hostname = u.hostname.toLowerCase().replace(/^www\./, "");
    u.hash = "";
    // Drop tracking params; keep meaningful ones (e.g. id=, page=, q=).
    const keep = new URLSearchParams();
    [...u.searchParams.keys()].forEach((k) => {
      if (!TRACKING_PARAM_RX.test(k)) keep.append(k, u.searchParams.get(k) ?? "");
    });
    u.search = keep.toString() ? `?${keep.toString()}` : "";
    // Strip default ports.
    if ((u.protocol === "http:" && u.port === "80") || (u.protocol === "https:" && u.port === "443")) {
      u.port = "";
    }
    s = u.toString();
  } catch {
    s = s.toLowerCase();
  }
  // Strip trailing slash unless it's the root.
  if (s.endsWith("/") && !s.endsWith("://")) s = s.slice(0, -1);
  return s;
}

// ─── Excerpt hashing & similarity ────────────────────────────────────────

export function normaliseExcerpt(text: string): string {
  return text
    .normalize("NFKC")
    .toLowerCase()
    // Collapse runs of any non-alphanumeric (incl. Unicode punctuation) to a space.
    .replace(/[^a-z0-9]+/g, " ")
    .trim()
    .replace(/\s+/g, " ");
}

export function excerptHash(text: string): string {
  return createHash("sha256").update(normaliseExcerpt(text), "utf8").digest("hex");
}

/** Token-bigram Jaccard similarity (0–1). Robust against minor wording
 * changes; cheap; deterministic. */
export function jaccardSimilarity(a: string, b: string): number {
  const ta = bigrams(normaliseExcerpt(a));
  const tb = bigrams(normaliseExcerpt(b));
  if (ta.size === 0 || tb.size === 0) return 0;
  let inter = 0;
  for (const t of ta) if (tb.has(t)) inter += 1;
  const uni = ta.size + tb.size - inter;
  return uni === 0 ? 0 : inter / uni;
}

function bigrams(s: string): Set<string> {
  const tokens = s.split(" ").filter(Boolean);
  if (tokens.length === 0) return new Set();
  if (tokens.length === 1) return new Set(tokens);
  const out = new Set<string>();
  for (let i = 0; i < tokens.length - 1; i += 1) {
    out.add(`${tokens[i]} ${tokens[i + 1]}`);
  }
  return out;
}

// ─── Capture-window bucketing ────────────────────────────────────────────

/** ISO date of the Monday of the week containing `d`. Used as the near-
 * duplicate capture window. UTC throughout — no DST surprises. */
export function captureWeekStart(d: Date): string {
  const day = new Date(Date.UTC(d.getUTCFullYear(), d.getUTCMonth(), d.getUTCDate()));
  const dow = day.getUTCDay(); // 0 = Sun
  const offset = dow === 0 ? -6 : 1 - dow; // shift to Monday
  day.setUTCDate(day.getUTCDate() + offset);
  return day.toISOString().slice(0, 10);
}

// ─── Public clustering API ───────────────────────────────────────────────

export interface DedupOptions {
  /** Jaccard similarity cut-off for the near-duplicate pass. Default 0.85. */
  nearSimilarityThreshold?: number;
}

export const DEFAULT_NEAR_SIMILARITY = 0.85;

export function clusterExact(inputs: DedupInput[]): ExactCluster[] {
  const groups = new Map<string, DedupInput[]>();
  for (const p of inputs) {
    const url = canonicalUrl(p.sourceUrl);
    const hash = excerptHash(p.excerpt);
    const key = `${p.vendorId}|${p.domain}|${p.subfactor}|${url}|${hash}`;
    if (!groups.has(key)) groups.set(key, []);
    groups.get(key)!.push(p);
  }
  const clusters: ExactCluster[] = [];
  for (const [key, members] of groups) {
    if (members.length < 2) continue;
    const [vendorId, domain, subfactor, canonicalSourceUrl, hash] = key.split("|");
    clusters.push({ key, vendorId, domain, subfactor, canonicalSourceUrl, excerptHash: hash, members });
  }
  return clusters;
}

export function clusterNear(
  inputs: DedupInput[],
  options: DedupOptions = {},
): NearCluster[] {
  const threshold = options.nearSimilarityThreshold ?? DEFAULT_NEAR_SIMILARITY;
  // Bucket by (vendor, domain, subfactor, canonical URL, week) so we only
  // run pairwise similarity on plausible candidates.
  const buckets = new Map<string, DedupInput[]>();
  for (const p of inputs) {
    const url = canonicalUrl(p.sourceUrl);
    const week = captureWeekStart(p.capturedAt);
    const key = `${p.vendorId}|${p.domain}|${p.subfactor}|${url}|${week}`;
    if (!buckets.has(key)) buckets.set(key, []);
    buckets.get(key)!.push(p);
  }
  // Set of IDs already absorbed into an exact cluster — exclude them so
  // we don't double-count a row in both the exact and near reports.
  const exactDupIds = new Set<string>();
  for (const c of clusterExact(inputs)) {
    for (const m of c.members) exactDupIds.add(m.id);
  }

  const clusters: NearCluster[] = [];
  for (const [bkey, members] of buckets) {
    const candidates = members.filter((m) => !exactDupIds.has(m.id));
    if (candidates.length < 2) continue;
    // Greedy single-link clustering: union pairs whose similarity ≥ threshold.
    const parent = new Map<string, string>();
    candidates.forEach((c) => parent.set(c.id, c.id));
    const find = (x: string): string => {
      while (parent.get(x) !== x) {
        const p = parent.get(x)!;
        parent.set(x, parent.get(p)!);
        x = parent.get(x)!;
      }
      return x;
    };
    const union = (a: string, b: string) => {
      const ra = find(a), rb = find(b);
      if (ra !== rb) parent.set(ra, rb);
    };
    let maxSim = 0;
    for (let i = 0; i < candidates.length; i += 1) {
      for (let j = i + 1; j < candidates.length; j += 1) {
        const sim = jaccardSimilarity(candidates[i].excerpt, candidates[j].excerpt);
        if (sim >= threshold) {
          union(candidates[i].id, candidates[j].id);
          if (sim > maxSim) maxSim = sim;
        }
      }
    }
    const groups = new Map<string, DedupInput[]>();
    for (const c of candidates) {
      const r = find(c.id);
      if (!groups.has(r)) groups.set(r, []);
      groups.get(r)!.push(c);
    }
    const [vendorId, domain, subfactor, canonicalSourceUrl, week] = bkey.split("|");
    for (const [, group] of groups) {
      if (group.length < 2) continue;
      clusters.push({
        vendorId,
        domain,
        subfactor,
        canonicalSourceUrl,
        captureWeekStart: week,
        members: group,
        maxSimilarity: Math.max(maxSim, threshold),
      });
    }
  }
  return clusters;
}

/** Choose the row to keep when collapsing an exact cluster.
 *
 * Selection priority (each level breaks ties by going to the next):
 *   1. NOT classification-failed AND NOT confidence-fallback
 *   2. Highest classifierConfidence (only among non-fallback rows;
 *      ignored when all members are fallback — see safe-merge gate).
 *   3. Earliest capturedAt (deterministic tie-break).
 *
 * Returns null when every member is a classifier fallback — in that case
 * the cluster is unsafe to auto-merge and the caller routes to human
 * review until one of the rows has been re-classified. */
export function pickRepresentative(cluster: ExactCluster): DedupInput | null {
  const real = cluster.members.filter(
    (m) => !m.classificationFailed && !m.confidenceIsFallback,
  );
  const pool = real.length > 0 ? real : null;
  if (!pool) return null;
  const sorted = [...pool].sort((a, b) => {
    if (b.classifierConfidence !== a.classifierConfidence)
      return b.classifierConfidence - a.classifierConfidence;
    return a.capturedAt.getTime() - b.capturedAt.getTime();
  });
  return sorted[0];
}

/** Build the report from already-clustered inputs. Pure. */
export function buildDedupReport(
  inputs: DedupInput[],
  options: DedupOptions = {},
): DedupReport {
  const exact = clusterExact(inputs);
  const near = clusterNear(inputs, options);

  let exactDupRows = 0;
  let safeAutoMergeRows = 0;
  let humanReviewRows = 0;

  for (const c of exact) {
    const dups = c.members.length - 1; // duplicates excluding the representative
    exactDupRows += dups;
    const rep = pickRepresentative(c);
    if (rep === null) {
      humanReviewRows += dups;
    } else {
      // Only count "safe" if EVERY non-rep member has a real classifier
      // output too. Otherwise we can't tell whether the duplicate is
      // genuinely identical or just looks similar because both are
      // fallback rows pointing to the extractor's hand-written rationale.
      const allReal = c.members.every(
        (m) => !m.classificationFailed && !m.confidenceIsFallback,
      );
      if (allReal) safeAutoMergeRows += dups;
      else humanReviewRows += dups;
    }
  }

  let nearDupRows = 0;
  for (const c of near) {
    nearDupRows += c.members.length - 1; // size minus rep we'd suggest
    humanReviewRows += c.members.length - 1; // near-dups ALWAYS go to human review
  }

  return {
    totalInput: inputs.length,
    exactClusterCount: exact.length,
    exactDuplicateRows: exactDupRows,
    nearClusterCount: near.length,
    nearDuplicateRows: nearDupRows,
    safeAutoMergeRows,
    humanReviewRows,
    exactClusters: exact,
    nearClusters: near,
  };
}
