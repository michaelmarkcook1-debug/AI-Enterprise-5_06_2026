# Claude Code Prompt 04 — Vendor Scope Gap Repair: Writer

Writer is the largest blocked vendor cohort.

## Task

1. Inspect existing ProductScope coverage for `vendor_writer`.
2. Determine whether blocked rows are caused by:
   - missing ProductScope entries
   - overly broad product names
   - weak category/domain mapping
   - weak linkage heuristics
3. Add or improve ProductScope entries for Writer using official/source-backed products only.
4. Do NOT invent product names or capabilities.
5. Include fields:
   - vendorId
   - vendorName
   - productName
   - productCategory
   - productDescription
   - measurementScope
   - includedInModules
   - sourceStatus
   - sourceName
   - sourceUrl
   - evidenceGrade
   - confidenceScore
   - uncertaintyNotes
   - lastVerified

6. After changes, re-run:
```bash
npx tsx scripts/product-linkage-review.ts --vendor=vendor_writer --batch=20
```

7. Report:
   - what was missing
   - what was added or changed
   - whether `no_match` dropped
   - whether `ok` / `ok_uncertain` increased
   - what remains ambiguous

8. Write:
   `WRITER_PRODUCT_SCOPE_GAP_REPORT.md`

## Acceptance criteria

- Only source-backed Writer products are added/improved.
- Linkage coverage improves or the remaining reason is explicitly explained.
- No public UI changes.
