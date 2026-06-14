# Claude Code Prompt 03 — Task 2: /capabilities Data Flow Audit

Do not implement fixes yet unless they are tiny and safe.

Audit the `/capabilities` page and write a report.

## Tasks

1. Locate:
   - `/capabilities` route
   - all components it uses
   - all API routes it calls
   - all repositories/data files it imports

2. Determine whether `/capabilities` uses:
   - seed JSON
   - database records
   - live connectors
   - static in-memory arrays
   - API routes
   - generated calculations

3. For every displayed capability, identify whether it has:
   - vendorId
   - productScopeId(s)
   - capabilityName
   - capabilityCategory
   - capabilityStatus
   - maturityScore
   - evidenceGrade
   - confidenceScore
   - dataStatus
   - sourceIds
   - sourceUrls
   - sourceNames
   - sourceDate
   - lastVerifiedAt
   - freshnessStatus
   - uncertaintyNote
   - calculationTrace
   - formulaVersion
   - truthRecordIds

4. Identify:
   - unsupported claims
   - seed scores
   - stale dates
   - missing source fields
   - missing ProductScope mapping
   - missing TruthRecord mapping
   - manually assigned scores
   - calculations with no provenance
   - UI labels that imply verified data when it is seed/static

5. Check whether hosted third-party model/platform capabilities are separated from first-party capabilities.

6. Write:

```text
AUDIT_REPORT_CAPABILITIES.md
```

Report sections:
- data sources used
- route/component map
- seed/static data found
- unsupported claims
- missing metadata
- missing ProductScope links
- missing TruthRecord links
- calculation gaps
- UI honesty issues
- recommended fixes
- priority order

## Acceptance criteria

- Audit report exists.
- Report is specific, file-based, and honest.
- No invented observations.
- No claim of live data if only seed data exists.
