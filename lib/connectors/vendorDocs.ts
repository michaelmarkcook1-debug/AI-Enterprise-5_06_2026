/**
 * vendorDocs — public vendor documentation fetcher.
 *
 * Wraps the existing sourcing pipeline (lib/sourcing/manifest.ts +
 * lib/sourcing/runner.ts) so it presents the same Connector interface as the
 * macro / regulatory / market-data adapters. This is what feeds:
 *
 *   - Commercial LLM model inventory (lib/model-inventory)
 *   - /capabilities source-backed metadata
 *   - Vendor profile evidence
 *
 * No API key required for the fetch step itself, but the LLM extractor
 * downstream requires `ANTHROPIC_API_KEY`. The connector reports
 * not_configured when ANTHROPIC_API_KEY is unset because there's no point
 * fetching pages that can't then be extracted into proposals.
 *
 * The actual fetch + extract + persist work happens via runSourcing() — this
 * adapter just lets the connector roster + admin status page see vendor docs
 * as a first-class data source.
 */

import type { Connector, ConnectorHealth, FetchResult } from "./types";
import { getLastFetch, recordLastFetch } from "./types";
import { SOURCE_MANIFEST, manifestForVendor } from "../sourcing/manifest";

const HOME = "https://www.aienterpise.app/admin/ingestion";
const DOCS = "https://github.com/anthropics/claude-code"; // internal pipeline docs link

export const VENDOR_DOCS_NOT_CONFIGURED_MESSAGE =
  "ANTHROPIC_API_KEY is required (must start with sk-ant-) — the LLM extractor cannot run without it";

export function isAnthropicKeyValid(key: string | undefined): boolean {
  return Boolean(key && key.startsWith("sk-ant-") && key.length > 20);
}

export interface VendorDocsQuery {
  vendorId?: string;
}

interface VendorDocsRecord {
  vendorId: string;
  manifestUrls: { url: string; category: string; label: string }[];
  totalSources: number;
}

export const vendorDocsConnector: Connector<VendorDocsQuery, VendorDocsRecord> = {
  health(): ConnectorHealth {
    const llmConfigured = isAnthropicKeyValid(process.env.ANTHROPIC_API_KEY);
    const last = getLastFetch("vendorDocs");
    return {
      id: "vendorDocs",
      label: "Vendor official docs (LLM-extracted)",
      group: "vendor_docs",
      tier: "official",
      requiresKey: true,
      envVars: ["ANTHROPIC_API_KEY"],
      configured: llmConfigured,
      status: llmConfigured ? "ok" : "not_configured",
      message: llmConfigured ? undefined : VENDOR_DOCS_NOT_CONFIGURED_MESSAGE,
      homepageUrl: HOME,
      apiDocsUrl: DOCS,
      rateLimitNotes: "Per-source rate limit determined by each vendor's robots / WAF policy. Polite back-off + URL-repair agent on 4xx.",
      defaultEvidenceGrade: "E2",
      defaultConfidenceFloor: 70,
      description: "Fetches public vendor docs / trust pages / model catalogues / status pages, extracts structured evidence proposals via the LLM extractor, surfaces them at /admin/evidence for approval. Source list lives in lib/sourcing/manifest.ts.",
      lastFetchAt: last?.at,
      lastFetchOk: last?.ok,
      lastFetchError: last?.error,
      lastFetchRecordCount: last?.recordCount,
    };
  },

  /**
   * Returns the manifest entries scoped to the queried vendor (or all vendors
   * when no query is provided). The actual fetch + LLM extract + DB persist
   * is delegated to `runSourcing()` in lib/sourcing/runner.ts — this adapter
   * deliberately doesn't duplicate that pipeline. The intent is that callers
   * of `connectors/vendorDocs.fetch()` are asking "what would we ingest?",
   * not "go ingest now"; the latter still goes through `npm run ingest` or
   * POST /api/admin/sourcing/run.
   */
  async fetch(query?: VendorDocsQuery): Promise<FetchResult<VendorDocsRecord>> {
    const fetchedAt = new Date().toISOString();
    // Honest gate: if the LLM extractor can't run, we don't pretend the
    // pipeline is ready. The fetch step itself doesn't need the key, but
    // returning ok=true here would falsely imply vendorDocs is producing
    // evidence proposals.
    if (!isAnthropicKeyValid(process.env.ANTHROPIC_API_KEY)) {
      return {
        ok: false,
        status: "not_configured",
        records: [],
        recordCount: 0,
        fetchedAt,
        error: VENDOR_DOCS_NOT_CONFIGURED_MESSAGE,
      };
    }
    const entries = query?.vendorId ? manifestForVendor(query.vendorId) : SOURCE_MANIFEST;

    if (entries.length === 0) {
      const message = query?.vendorId ? `No manifest entries for vendor ${query.vendorId}` : "Manifest is empty";
      recordLastFetch("vendorDocs", { ok: false, error: message });
      return { ok: false, status: "error", records: [], recordCount: 0, fetchedAt, error: message };
    }

    // Group by vendor for the response shape.
    const byVendor = new Map<string, VendorDocsRecord["manifestUrls"]>();
    for (const e of entries) {
      const list = byVendor.get(e.vendorId) ?? [];
      list.push({ url: e.url, category: String(e.category), label: e.label });
      byVendor.set(e.vendorId, list);
    }

    const records: VendorDocsRecord[] = Array.from(byVendor.entries()).map(([vendorId, urls]) => ({
      vendorId,
      manifestUrls: urls,
      totalSources: urls.length,
    }));

    recordLastFetch("vendorDocs", { ok: true, recordCount: records.length });
    return { ok: true, status: "ok", records, recordCount: records.length, fetchedAt };
  },
};
