# Claude Code Run Order for Packs 03–05

## Run 1 — Product Review

Use:

- `01_PRODUCT_REVIEW_WALKTHROUGH.md`

Output:

- product review table
- priority issues
- recommended MVP scope

## Run 2 — Pack 03 Evidence Foundation

Use:

- `02_PACK_03_MASTER_PROMPT.md`
- `03_PACK_03_EVIDENCE_MODEL.md`
- `04_PACK_03_SOURCE_REGISTRY_AND_CONNECTORS.md`

Output:

- evidence types
- source registry
- connector health improvements

## Run 3 — Pack 03 Publishability

Use:

- `05_PACK_03_CLAIM_TRACEABILITY_AND_PUBLISHABILITY.md`
- `06_PACK_03_SCORING_AND_METHOD.md`

Output:

- publishability rules
- score methodology hardening
- source conflict handling

## Run 4 — Pack 04 Exports MVP

Use:

- `07_PACK_04_MASTER_EXPORTS.md`
- `08_PACK_04_BOARD_PACK_STRUCTURE.md`

Output:

- export centre
- board pack structure
- markdown/html export

## Run 5 — Pack 04 PDF/PPTX Path

Use:

- `09_PACK_04_PPTX_AND_PDF_GENERATION.md`

Output:

- PDF/PPTX plan or initial implementation
- export payload contract

## Run 6 — Pack 05 Commercial Product

Use:

- `10_PACK_05_MASTER_COMMERCIALISATION.md`
- `11_PACK_05_ROLES_WORKSPACES_AND_AUDIT.md`
- `12_PACK_05_ENTERPRISE_READINESS.md`

Output:

- plan/role model
- workspace model
- audit event model
- enterprise readiness checklist

## After Every Run

Run:

```bash
npm run build
npm run lint
npm test
```

Then commit:

```bash
git add .
git commit -m "..."
git push
```

Do not proceed to next run if major routes are broken.
