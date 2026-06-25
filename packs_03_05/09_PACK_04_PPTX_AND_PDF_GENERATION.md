# Pack 04 — PDF and PPTX Generation

## Objective

Add export implementation path.

## MVP Export

Start with:

- Markdown
- HTML printable page
- JSON

This is safer and easier to test.

## PDF Options

Use one of:

- browser print CSS
- server-rendered HTML to PDF
- external PDF service
- Playwright PDF generation if available

PDF requirements:

- page numbers
- header/footer
- evidence appendix
- methodology appendix
- confidentiality label
- timestamp
- generated-by label

## PPTX Options

Use a library such as:

- pptxgenjs

PPTX template:

1. Title slide
2. Executive summary
3. Recommendation
4. Business case
5. Stack architecture
6. Vendor rationale
7. Risks
8. Competitor benchmark
9. Strategic sustainability
10. Assumptions
11. KPI plan
12. Evidence appendix

## Export Data Contract

Create a common export payload:

```ts
export interface BoardPackPayload {
  title: string;
  generatedAt: string;
  organisation?: string;
  recommendation: string;
  cioConfidenceScore: number;
  boardDefenceScore: number;
  executiveSummary: string[];
  vendors: ExportVendor[];
  risks: ExportRisk[];
  assumptions: ExportAssumption[];
  kpis: ExportKpi[];
  evidence: ExportEvidence[];
  methodology: string[];
}
```

## Acceptance Criteria

- Export payload contract exists.
- Markdown export works first.
- HTML print export works.
- PDF/PPTX roadmap documented if not fully implemented.
- Export includes citations/evidence appendix.
