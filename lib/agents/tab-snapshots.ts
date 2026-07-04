// Per-tab evidence snapshots — the grounding layer for the per-tab chat.
// ─────────────────────────────────────────────────────────────────────────
// Each builder assembles a READ-ONLY snapshot of ONE surface's canonical,
// cited data (piece 3 of the AnalystGenius batch). The chat engine
// (tab-chat.ts) may cite ONLY URLs present here — its parser drops anything
// else — so what's in the snapshot is the outer bound of what the assistant
// can claim. Builders return null when a tab has nothing real to ground on
// (honest empty), and every derived/inferred figure carries its label in the
// fact text so the model can't silently launder an estimate into a fact.

import { getVendorScorecard } from "../assessment/domain-scores";
import { getCategoryComposites } from "../ranking/category-composite";
import { getBreakingNews } from "../intelligence/repository";
import { EXPOSURE_EDGES, EXPOSURE_NODES } from "../investing/exposure-map-data";
import { PEER_COMPANIES } from "../peer/peer-adoption-data";
import { LEVEL_LABELS, SIGNAL_KINDS } from "../peer/heatmap";

export interface TabCitation {
  sourceUrl: string;
  /** Short provenance label (grade / publisher / date). */
  note: string;
}

export interface TabSnapshotSection {
  label: string;
  facts: string[];
  citations: TabCitation[];
}

export interface TabEvidenceSnapshot {
  tabLabel: string;
  sections: TabSnapshotSection[];
}

export type TabKind = "vendor" | "category" | "peers" | "news" | "dependencies";

/** Every citation URL in a snapshot — the chat parser's allowlist. */
export function snapshotUrlAllowlist(s: TabEvidenceSnapshot): Set<string> {
  const set = new Set<string>();
  for (const sec of s.sections) for (const c of sec.citations) set.add(c.sourceUrl);
  return set;
}

/** Vendor profile tab: the 12-domain evidence scorecard + model quality. */
export async function buildVendorTabSnapshot(vendorId: string): Promise<TabEvidenceSnapshot | null> {
  const sc = await getVendorScorecard(vendorId).catch(() => null);
  if (!sc || !sc.hasAnyEvidence) return null;

  const sections: TabSnapshotSection[] = [];
  for (const d of sc.domains) {
    if (d.state === "scored") {
      sections.push({
        label: `Domain: ${d.domain}`,
        facts: [
          `${d.domain}: scored ${d.score.toFixed(1)}/5 (${d.bandLabel}; best evidence grade ${d.bestGrade}; ${d.evidenceCount} evidence record${d.evidenceCount === 1 ? "" : "s"}; confidence ${d.confidence}/99${d.lowConfidence ? "; LOW confidence" : ""}).`,
        ],
        citations: d.citations.slice(0, 3).map((c) => ({
          sourceUrl: c.sourceUrl,
          note: `${c.evidenceGrade}${c.capturedAt ? ` · captured ${c.capturedAt.slice(0, 10)}` : ""}`,
        })),
      });
    } else {
      sections.push({
        label: `Domain: ${d.domain}`,
        facts: [`${d.domain}: INSUFFICIENT EVIDENCE — no admissible verified evidence; no score exists.`],
        citations: [],
      });
    }
  }
  if (sc.modelQuality && sc.modelQuality.state === "scored") {
    const mq = sc.modelQuality;
    sections.push({
      label: "Model quality (benchmark-derived)",
      facts: [
        `model_quality: ${mq.score.toFixed(2)}/5 — a capability proxy from community-preference benchmarks (${mq.bestGrade}), capped at 4.0; NOT an independent audit${mq.lowConfidence ? "; limited coverage" : ""}.`,
      ],
      citations: mq.citations.slice(0, 3).map((c) => ({
        sourceUrl: c.sourceUrl,
        note: c.evidenceGrade,
      })),
    });
  }
  return { tabLabel: `Vendor assessment: ${vendorId}`, sections };
}

/** Category ranking tab: the within-category composite standing (live-gated). */
export async function buildCategoryTabSnapshot(categoryId: string): Promise<TabEvidenceSnapshot | null> {
  const composites = await getCategoryComposites().catch(() => []);
  const comp = composites.find((c) => c.category.id === categoryId);
  if (!comp || !comp.isLive) return null;

  const rankedFacts = comp.ranked.slice(0, 15).map((v) => {
    const compositeTxt = v.assessmentComposite != null ? `${v.assessmentComposite.toFixed(2)}/5` : "held";
    return `#${v.rank} ${v.vendorName} — assessment composite ${compositeTxt}; evidence coverage ${v.domainScored}/${v.domainTotal} domains${v.tier ? `; tier: ${v.tier}` : ""}.`;
  });
  const heldFacts = comp.incomplete
    .slice(0, 6)
    .map((v) => `${v.vendorName}: NOT RANKED — ${v.excludedReason ?? "insufficient evidence"}.`);

  return {
    tabLabel: `Category ranking: ${comp.category.name}`,
    sections: [
      {
        label: "Methodology",
        facts: [
          comp.methodologyNote,
          comp.lowDiscrimination
            ? "NOTE: composites sit inside the noise band — tier bands are more meaningful than exact 1–N order here."
            : "Order is statistically separable at current evidence depth.",
        ],
        citations: [],
      },
      { label: "Ranked vendors", facts: rankedFacts, citations: [] },
      ...(heldFacts.length > 0
        ? [{ label: "Held (insufficient evidence)", facts: heldFacts, citations: [] }]
        : []),
    ],
  };
}

/** Peer-AI benchmark tab: the curated, cited peer-adoption dataset. */
export function buildPeersTabSnapshot(peerIds?: string[]): TabEvidenceSnapshot | null {
  const companies =
    peerIds && peerIds.length > 0
      ? PEER_COMPANIES.filter((c) => peerIds.includes(c.id))
      : PEER_COMPANIES;
  if (companies.length === 0) return null;

  const kindLabel = new Map(SIGNAL_KINDS.map((k) => [k.kind, k.label]));
  const sections: TabSnapshotSection[] = companies.map((c) => {
    const facts: string[] = [];
    const citations: TabCitation[] = [];
    for (const s of c.signals) {
      const label = kindLabel.get(s.kind) ?? s.kind;
      if (s.status === "not_disclosed" || !s.level) {
        facts.push(`${label}: NOT DISCLOSED — no observable public evidence; this is never a low rating.`);
        continue;
      }
      const levelWord = LEVEL_LABELS[s.level];
      const estFlag = s.status === "inferred" ? " [est. — inferred, not asserted]" : "";
      facts.push(`${label}: ${levelWord} (analyst-curated qualitative reading)${estFlag}. ${s.summary ?? ""}`.trim());
      if (s.status === "inferred" && s.inferenceNote) facts.push(`  ↳ ${s.inferenceNote}`);
      for (const cite of s.citations) {
        citations.push({ sourceUrl: cite.url, note: `${cite.publisher}${cite.publishedAt ? ` · ${cite.publishedAt}` : ""}` });
      }
    }
    return { label: c.name, facts, citations };
  });

  return { tabLabel: "Peer AI benchmark (observable, cited signals only)", sections };
}

/** Market-news tab: verified breaking items only (real-gated by construction). */
export async function buildNewsTabSnapshot(): Promise<TabEvidenceSnapshot | null> {
  const news = await getBreakingNews({ days: 14, limit: 8 }).catch(() => null);
  if (!news || news.items.length === 0) return null;

  const facts = news.items.map((n) => {
    const age = Math.max(0, Math.floor((Date.now() - Date.parse(n.publishedAt)) / 86_400_000));
    return `${n.title} — ${n.primaryVendorName ?? "market"} · ${n.sourceName} · ${age === 0 ? "today" : `${age}d ago`} · importance: ${n.importance} (impact is a directional estimate, not a measured fact).`;
  });
  return {
    tabLabel: "Market today: verified breaking news (last 14 days)",
    sections: [
      {
        label: news.usedFallback ? "Most recent verified items (window fallback — feed stale)" : "Breaking (verified)",
        facts,
        citations: news.items
          .filter((n) => typeof n.sourceUrl === "string" && n.sourceUrl.startsWith("http"))
          .map((n) => ({ sourceUrl: n.sourceUrl as string, note: n.sourceName })),
      },
    ],
  };
}

/** Dependency-graph tab: the curated cited edges (+ the derivation caveat). */
export function buildDependenciesTabSnapshot(): TabEvidenceSnapshot | null {
  const label = new Map(EXPOSURE_NODES.map((n) => [n.id, n.label]));
  const edges = EXPOSURE_EDGES.slice(0, 48);
  if (edges.length === 0) return null;

  const facts = edges.map((e) => {
    const from = label.get(e.sourceId) ?? e.sourceId;
    const to = label.get(e.targetId) ?? e.targetId;
    return `${from} → ${to} (${e.relationshipType}, confidence: ${e.confidence}${e.estimatedValue ? `, rough size ${e.estimatedValue} — an estimate` : ""}): ${e.summary}`;
  });
  const citations: TabCitation[] = [];
  const seen = new Set<string>();
  for (const e of edges) {
    for (const u of e.sourceUrls) {
      if (seen.has(u)) continue;
      seen.add(u);
      citations.push({ sourceUrl: u, note: `${label.get(e.sourceId) ?? e.sourceId} → ${label.get(e.targetId) ?? e.targetId}` });
    }
  }
  return {
    tabLabel: "Dependency graph: who relies on whom (source-cited edges)",
    sections: [
      { label: "Cited relationships", facts, citations },
      {
        label: "Caveats",
        facts: [
          "Encroachment edges shown on this tab are a DERIVED analytical signal, not a stated fact.",
          "Coverage is partial: absence of an edge is under-coverage, never evidence of no relationship.",
        ],
        citations: [],
      },
    ],
  };
}

/** Serialise a snapshot into the prompt block the chat engine feeds the model. */
export function renderSnapshotForPrompt(s: TabEvidenceSnapshot): string {
  const lines: string[] = [`TAB: ${s.tabLabel}`];
  for (const sec of s.sections) {
    lines.push(`\n## ${sec.label}`);
    for (const f of sec.facts) lines.push(`- ${f}`);
    if (sec.citations.length > 0) {
      lines.push(`  Citations:`);
      for (const c of sec.citations) lines.push(`  * ${c.sourceUrl} (${c.note})`);
    }
  }
  return lines.join("\n");
}
