# Pack 04 Master Prompt — Board Pack PDF/PPTX Exports

## Objective

Build export capabilities that make AI Enterprise board-ready.

Demonstrate should not only show a decision defence on screen. It should generate evidence-backed outputs a CIO can take into meetings.

## Required Export Types

1. Executive Summary
2. Board Defence Pack
3. Procurement Report
4. Risk Committee Pack
5. Investor Memo
6. Evidence Appendix
7. Methodology Appendix

## Output Formats

MVP:

- Markdown
- JSON
- HTML print view

V1:

- PDF

V2:

- PowerPoint/PPTX

## Export Principle

Every exported claim must include:

- source/evidence reference
- confidence
- freshness
- evidence grade
- methodology reference where relevant

## Required Export Routes

Suggested:

```text
app/exports/page.tsx
app/api/exports/board-pack/route.ts
app/api/exports/procurement-report/route.ts
app/api/exports/risk-review/route.ts
```

## Required Components

```text
components/exports/ExportCenter.tsx
components/exports/ExportTemplateSelector.tsx
components/exports/ExportPreview.tsx
components/exports/CitationAppendix.tsx
components/exports/MethodologyAppendix.tsx
components/exports/EvidenceAppendix.tsx
lib/exports/templates.ts
lib/exports/render-markdown.ts
lib/exports/render-html.ts
lib/exports/export-data.ts
```

## Acceptance Criteria

- User can generate at least Markdown/HTML export.
- Export includes executive summary.
- Export includes evidence appendix.
- Export includes methodology appendix.
- Export includes assumptions appendix.
- Export clearly labels estimated/seed data.
