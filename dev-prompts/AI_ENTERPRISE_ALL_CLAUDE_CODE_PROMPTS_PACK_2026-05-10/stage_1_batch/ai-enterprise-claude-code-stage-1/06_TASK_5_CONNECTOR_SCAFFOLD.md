# Claude Code Prompt 06 — Task 5: Free/Official Data Connector Scaffold

Build the connector scaffold for AI Enterprise.

Do not attempt to fully implement every connector in one pass. Build truthful connector status and minimal safe fetching where possible.

## Connector interface

Create:

```text
lib/connectors/types.ts
```

Interface:

```ts
export interface DataConnector {
  id: string;
  name: string;
  category: ConnectorCategory;
  requiresApiKey: boolean;
  configured(): boolean;
  healthCheck(): Promise<ConnectorHealth>;
  fetch(params: unknown): Promise<SourceSnapshot[]>;
  normalise(snapshot: SourceSnapshot): Promise<EvidenceSource[]>;
}
```

Types:
- ConnectorCategory
- ConnectorHealth
- SourceSnapshot
- ConnectorRun
- ConnectorStatus

## Connector files

Create or scaffold:

```text
lib/connectors/sec.ts
lib/connectors/fred.ts
lib/connectors/bls.ts
lib/connectors/bea.ts
lib/connectors/eia.ts
lib/connectors/fiscalData.ts
lib/connectors/alphaVantage.ts
lib/connectors/gdelt.ts
lib/connectors/github.ts
lib/connectors/congress.ts
lib/connectors/federalRegister.ts
lib/connectors/vendorDocs.ts
lib/evidence/normalise.ts
lib/evidence/freshness.ts
lib/evidence/confidence.ts
```

## Required behaviour

If connector needs an API key and it is missing:
```json
{
  "status": "not_configured",
  "message": "API key required"
}
```

Do not fake successful connections.

If fetch is not implemented:
```json
{
  "status": "not_implemented",
  "message": "Connector scaffold exists but fetch is not implemented."
}
```

## Priority connectors

1. SEC EDGAR / data.sec.gov
   - no API key
   - uses SEC_USER_AGENT
   - filings, company facts, S-1

2. FRED
   - FRED_API_KEY
   - macro regime

3. Alpha Vantage
   - ALPHA_VANTAGE_API_KEY
   - prices/fundamentals/news sentiment

4. GDELT
   - no key for core APIs
   - news/event signal

5. GitHub
   - optional GITHUB_TOKEN
   - developer/community signals

6. Vendor Docs
   - public docs fetcher
   - commercial model inventory and capabilities

## API routes

Add:

```text
GET /api/data-sources/status
POST /api/data-sources/refresh
GET /api/data-sources/[connectorId]
```

## Data Sources page

Create one of:

```text
/data-sources
/admin/data-sources
```

Show:
- connector name
- category
- configured
- status
- last run
- last success
- last error
- records fetched
- freshness
- requires API key

## Tests

Add tests:
- missing key shows not_configured
- no connector fakes success
- SEC connector has compliant User-Agent requirement
- normalise returns EvidenceSource shape
- status API renders connector statuses

## Acceptance criteria

- connector status page exists
- connectors truthfully report configured/not configured
- no fake live data
- tests pass
