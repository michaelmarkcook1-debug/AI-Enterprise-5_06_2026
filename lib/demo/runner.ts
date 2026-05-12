// Demo source-first runner.
// ─────────────────────────
// Reads:
//   - getDataProvenance() — global live/seed signal
//   - hasDatabase() — DB availability gate
//   - listConnectorHealth() — per-connector status (no URLs, no keys)
//   - Counts of EvidenceRecord (analyst_verified) per domain (when DB exists)
//
// Returns a DemoSummary suitable for `/api/demo/status` and a future
// admin/demo dashboard. NEVER includes connector URLs in output (they
// can contain keys for connectors that bake them into the URL).

import { hasDatabase, getPrisma } from "../prisma";
import { getDataProvenance } from "../intelligence/provenance";
import { listConnectorHealth } from "../connectors/registry";
import {
  isDemoSourceFirst,
  assessModuleStatus,
  explainStatus,
  summariseCounts,
  type DemoSummary,
  type DemoModuleAssessment,
} from "./source-first";

export async function buildDemoSummary(): Promise<DemoSummary> {
  const mode: "on" | "off" = isDemoSourceFirst() ? "on" : "off";
  const generatedAt = new Date().toISOString();

  // 1. Global provenance — already abstracts "DB connected + verified
  //    evidence exists" into seed|live. Source of truth for the
  //    overall demo banner.
  const provenance = await getDataProvenance();

  // 2. Per-module assessments. Each module declares its own live-signal
  //    rule. Counts come from existing tables; no new schema.
  const modules: DemoModuleAssessment[] = [];

  let verifiedEvidenceCount = 0;
  let approvedProposalCount = 0;
  let pendingProposalCount = 0;
  if (hasDatabase()) {
    try {
      const c = getPrisma();
      [verifiedEvidenceCount, approvedProposalCount, pendingProposalCount] = await Promise.all([
        c.evidenceRecord.count({ where: { reviewStatus: "analyst_verified" } }),
        c.evidenceProposal.count({ where: { status: "approved" } }),
        c.evidenceProposal.count({ where: { status: "pending" } }),
      ]);
    } catch {
      // DB query failed — treat as seed-only. Fall through.
    }
  }

  // Connector health (already returns per-connector status; never includes URLs/keys)
  const connectors = listConnectorHealth();
  const liveConnectorCount = connectors.filter((c) => c.status === "ok").length;
  const totalConnectors = connectors.length;

  // Assessment module — runs on seed inputs that flow through the scoring engine.
  // It IS shippable in seed mode (operator can complete the form) but the
  // ScoringResult evidence references depend on analyst-verified rows.
  modules.push(assessmentModule({ verifiedEvidenceCount }));

  // Capabilities — already gated by capabilityRenderState() per cell. Live
  // when verified evidence rows exist; seed otherwise. The module itself is
  // safe to show — every cell carries its own status.
  modules.push(capabilitiesModule({ verifiedEvidenceCount, pendingProposalCount }));

  // Vendor Intelligence — vendor profile pages. Live elements: any
  // evidence row attached to the vendor. Seed: financial / valuation metrics.
  modules.push(vendorIntelligenceModule({ verifiedEvidenceCount }));

  // Commercial Models — model-inventory repository reads from typed seed
  // module + can be supplemented by vendorDocs ingestion.
  modules.push(commercialModelsModule({ approvedProposalCount }));

  // Market Tracker — reads connector signals (FRED / BEA / EIA / GDELT).
  modules.push(marketTrackerModule({ connectors }));

  // News Intelligence — GDELT free + connector signals.
  modules.push(newsIntelligenceModule({ connectors }));

  // Briefings — composite of every other module. Reflects the worst.
  modules.push(briefingsModule({ verifiedEvidenceCount, liveConnectorCount, totalConnectors }));

  // Watchlists — operator-curated; doesn't depend on a single signal.
  modules.push(watchlistsModule());

  // Investor Tools — IPO Watch + Simulator are model-based seed by design
  // (warning text says model_estimate_not_fact). Public-AI-Stocks depends on
  // Alpha Vantage. Marked Seed fallback or Mixed honestly.
  modules.push(investorToolsModule({ connectors }));

  // Data Sources — meta-page. Live iff any connector is reporting ok.
  modules.push(dataSourcesModule({ liveConnectorCount, totalConnectors }));

  const counts = summariseCounts(modules);

  return {
    mode,
    generatedAt,
    globalProvenance: provenance.source,
    modules,
    counts,
    connectors: connectors.map((c) => ({
      id: c.id,
      label: c.label,
      status: c.status,
      configured: c.configured,
      lastFetchOk: c.lastFetchOk,
      lastFetchAt: c.lastFetchAt,
      recordCount: c.lastFetchRecordCount,
      // NO sourceUrl / apiDocsUrl with keys — homepageUrl is fine, no secret
    })),
  };
}

// ─── Per-module assessors ────────────────────────────────────────────────

type ConnectorList = ReturnType<typeof listConnectorHealth>;

function assessmentModule(args: { verifiedEvidenceCount: number }): DemoModuleAssessment {
  const live = args.verifiedEvidenceCount;
  const seed = live === 0 ? 1 : 0; // single seed-engine flag
  const status = assessModuleStatus({ liveSignalCount: live, seedSignalCount: seed });
  const moduleLabel = "Assessment";
  return {
    id: "assessment",
    label: moduleLabel,
    route: "/assessment",
    safeToShow: true,
    status,
    liveSignalCount: live,
    seedSignalCount: seed,
    reason: explainStatus({ status, liveSignalCount: live, seedSignalCount: seed, moduleLabel }),
    caveat: "Form is fully usable in any mode; vendor scoring carries the per-row evidence grade.",
  };
}

function capabilitiesModule(args: { verifiedEvidenceCount: number; pendingProposalCount: number }): DemoModuleAssessment {
  const live = args.verifiedEvidenceCount;
  const seed = args.pendingProposalCount; // pending proposals + seed cells
  const status = assessModuleStatus({ liveSignalCount: live, seedSignalCount: seed });
  const moduleLabel = "Capabilities";
  return {
    id: "capabilities",
    label: moduleLabel,
    route: "/capabilities",
    safeToShow: true,
    status,
    liveSignalCount: live,
    seedSignalCount: seed,
    reason: explainStatus({ status, liveSignalCount: live, seedSignalCount: seed, moduleLabel }),
    caveat:
      "Each cell carries its own dataStatus badge (verified / documented / seed / disputed / etc.). Module is safe to show even in seed mode.",
  };
}

function vendorIntelligenceModule(args: { verifiedEvidenceCount: number }): DemoModuleAssessment {
  const live = args.verifiedEvidenceCount;
  const seed = 1;
  const status = assessModuleStatus({ liveSignalCount: live, seedSignalCount: seed });
  return {
    id: "vendor_intelligence",
    label: "Vendor Intelligence",
    route: "/vendors",
    safeToShow: true,
    status,
    liveSignalCount: live,
    seedSignalCount: seed,
    reason: explainStatus({ status, liveSignalCount: live, seedSignalCount: seed, moduleLabel: "Vendor Intelligence" }),
    caveat: "Financial / valuation metrics remain seed until SEC ingestion writes verified rows.",
  };
}

function commercialModelsModule(args: { approvedProposalCount: number }): DemoModuleAssessment {
  const live = args.approvedProposalCount > 0 ? args.approvedProposalCount : 0;
  const seed = 1; // baseline seed inventory always present
  const status = assessModuleStatus({ liveSignalCount: live, seedSignalCount: seed });
  return {
    id: "commercial_models",
    label: "Commercial Models",
    route: "/admin/data-sources",
    safeToShow: true,
    status,
    liveSignalCount: live,
    seedSignalCount: seed,
    reason: explainStatus({ status, liveSignalCount: live, seedSignalCount: seed, moduleLabel: "Commercial Models" }),
    caveat: "First-party vs hosted_third_party tagging governed per-model.",
  };
}

function marketTrackerModule(args: { connectors: ConnectorList }): DemoModuleAssessment {
  const tracked = ["fred", "bea", "eia", "fiscalData", "bls"] as const;
  const live = args.connectors.filter((c) => tracked.includes(c.id as (typeof tracked)[number]) && c.status === "ok").length;
  const seed = tracked.length - live;
  const status = assessModuleStatus({ liveSignalCount: live, seedSignalCount: seed });
  return {
    id: "market_tracker",
    label: "Market Tracker",
    route: "/market",
    safeToShow: true,
    status,
    liveSignalCount: live,
    seedSignalCount: seed,
    reason: explainStatus({ status, liveSignalCount: live, seedSignalCount: seed, moduleLabel: "Market Tracker" }),
  };
}

function newsIntelligenceModule(args: { connectors: ConnectorList }): DemoModuleAssessment {
  const tracked = ["gdelt", "federalRegister"] as const;
  const live = args.connectors.filter((c) => tracked.includes(c.id as (typeof tracked)[number]) && c.status === "ok").length;
  const seed = tracked.length - live;
  const status = assessModuleStatus({ liveSignalCount: live, seedSignalCount: seed });
  return {
    id: "news_intelligence",
    label: "News Intelligence",
    route: "/news",
    safeToShow: true,
    status,
    liveSignalCount: live,
    seedSignalCount: seed,
    reason: explainStatus({ status, liveSignalCount: live, seedSignalCount: seed, moduleLabel: "News Intelligence" }),
  };
}

function briefingsModule(args: {
  verifiedEvidenceCount: number;
  liveConnectorCount: number;
  totalConnectors: number;
}): DemoModuleAssessment {
  const live = args.verifiedEvidenceCount + args.liveConnectorCount;
  const seed = Math.max(0, args.totalConnectors - args.liveConnectorCount);
  const status = assessModuleStatus({ liveSignalCount: live, seedSignalCount: seed });
  return {
    id: "briefings",
    label: "Briefings",
    route: "/briefings",
    safeToShow: true,
    status,
    liveSignalCount: live,
    seedSignalCount: seed,
    reason: explainStatus({ status, liveSignalCount: live, seedSignalCount: seed, moduleLabel: "Briefings" }),
    caveat: "Briefings compose every other module; status reflects the worst-source caveat in the briefing body.",
  };
}

function watchlistsModule(): DemoModuleAssessment {
  // Operator-curated; doesn't depend on a connector.
  return {
    id: "watchlists",
    label: "Watchlists",
    route: "/watchlists",
    safeToShow: true,
    status: "live",
    liveSignalCount: 1,
    seedSignalCount: 0,
    reason: "Operator-curated lists. Independent of data-source health.",
  };
}

function investorToolsModule(args: { connectors: ConnectorList }): DemoModuleAssessment {
  // IPO Watch + Simulator are model_estimate_not_fact by design (the
  // warning text is explicit). Public AI Stocks depends on Alpha Vantage.
  // This module is intentionally Mixed — DO NOT label as Live.
  const av = args.connectors.find((c) => c.id === "alphaVantage");
  const live = av?.status === "ok" ? 1 : 0;
  const seed = 1; // IPO forecasts seed-only by design
  const status = assessModuleStatus({ liveSignalCount: live, seedSignalCount: seed, forceMixed: live > 0 });
  return {
    id: "investor_tools",
    label: "Investor Tools",
    route: "/investor-tools",
    safeToShow: true,
    status,
    liveSignalCount: live,
    seedSignalCount: seed,
    reason: explainStatus({ status, liveSignalCount: live, seedSignalCount: seed, moduleLabel: "Investor Tools" }),
    caveat:
      "IPO timing and post-IPO bands are MODELLED — labelled `model_estimate_not_fact`. Public AI Stocks goes live only when Alpha Vantage is configured.",
  };
}

function dataSourcesModule(args: { liveConnectorCount: number; totalConnectors: number }): DemoModuleAssessment {
  const live = args.liveConnectorCount;
  const seed = args.totalConnectors - args.liveConnectorCount;
  const status = assessModuleStatus({ liveSignalCount: live, seedSignalCount: seed });
  return {
    id: "data_sources",
    label: "Data Sources",
    route: "/admin/data-sources",
    safeToShow: true,
    status,
    liveSignalCount: live,
    seedSignalCount: seed,
    reason: explainStatus({ status, liveSignalCount: live, seedSignalCount: seed, moduleLabel: "Data Sources" }),
  };
}
