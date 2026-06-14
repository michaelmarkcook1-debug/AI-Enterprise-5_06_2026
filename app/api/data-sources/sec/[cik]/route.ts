// Admin-gated SEC EDGAR verification route.
//   GET /api/data-sources/sec/0000789019                    → submissions
//   GET /api/data-sources/sec/0000789019?resource=facts     → XBRL company facts
//
// Returns the raw EDGAR JSON plus a NormalisedEvidenceSource envelope so
// the operator can confirm the connector + the Truth-Engine normaliser
// agree on the shape.

import { isAdminRequest, unauthorized } from "@/lib/admin-auth";
import { secConnector } from "@/lib/connectors/sec";
import { normaliseFetchResult } from "@/lib/evidence/normalise";

export const runtime = "nodejs";
export const dynamic = "force-dynamic";

export async function GET(
  request: Request,
  ctx: { params: Promise<{ cik: string }> },
) {
  if (!isAdminRequest(request)) return unauthorized();
  const { cik } = await ctx.params;
  const url = new URL(request.url);
  const resource = url.searchParams.get("resource") === "facts" ? "facts" : "submissions";
  try {
    const result = await secConnector.fetch({ cik, resource });
    const evidence = result.ok ? normaliseFetchResult(secConnector.health(), result) : null;
    // Trim the SEC payload — submissions return 30k+ filings; keep the
    // header metadata + first 25 recent filings for verification.
    const trimmed = result.records.map((r) => {
      if (r.resource === "submissions") {
        const raw = r.raw as Record<string, unknown>;
        const filings = (raw.filings as Record<string, unknown> | undefined)?.recent as Record<string, unknown[]> | undefined;
        return {
          cik: r.cik,
          resource: r.resource,
          name: raw.name,
          ticker: raw.tickers,
          sic: raw.sic,
          sicDescription: raw.sicDescription,
          fiscalYearEnd: raw.fiscalYearEnd,
          recentFilingsPreview: filings
            ? Array.from({ length: Math.min(25, (filings.accessionNumber as unknown[] | undefined)?.length ?? 0) }, (_, i) => ({
                accessionNumber: filings.accessionNumber?.[i],
                form: filings.form?.[i],
                filingDate: filings.filingDate?.[i],
                primaryDocument: filings.primaryDocument?.[i],
              }))
            : [],
        };
      }
      // facts payload: list the available concept namespaces + a count
      const raw = r.raw as Record<string, unknown>;
      const facts = raw.facts as Record<string, Record<string, unknown>> | undefined;
      return {
        cik: r.cik,
        resource: r.resource,
        entityName: raw.entityName,
        namespaces: facts ? Object.keys(facts) : [],
        usGaapConceptCount: facts?.["us-gaap"] ? Object.keys(facts["us-gaap"]).length : 0,
      };
    });
    return Response.json({
      ok: result.ok,
      status: result.status,
      error: result.error,
      sourceUrl: result.sourceUrl,
      evidence,
      records: trimmed,
    });
  } catch (err) {
    console.error("[api/data-sources/sec/:cik] failed", err);
    return Response.json({ error: (err as Error).message }, { status: 500 });
  }
}
