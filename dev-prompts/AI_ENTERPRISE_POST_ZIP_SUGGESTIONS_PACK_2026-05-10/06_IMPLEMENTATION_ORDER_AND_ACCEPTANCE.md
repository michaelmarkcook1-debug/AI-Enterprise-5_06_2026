# Claude Code Prompt 06 — Implementation Order and Acceptance Criteria

This file tells Claude Code what to do first.

## Implementation order

1. Add Perplexity as platform-only vendor
2. Update hero hierarchy so Assessment is clearly first-class
3. Write the assessment granularity upgrade plan
4. Write the multi-vendor stack output plan
5. Only after planning, begin implementation in phases:
   - adaptive questions
   - must-have/disqualifier logic
   - subfactor output breakdown
   - blockers / evidence gaps
   - stack recommendation layer
   - output modes

## Acceptance criteria

Perplexity:
- present in ProductScope/platform modules
- absent from Investor Tools
- tests prove scope boundaries

Hero hierarchy:
- Assessment visible in hero copy and hero actions
- Investor Tools not hero-prominent
- nav still contains Investor Tools

Assessment granularity:
- plan document exists
- progressive disclosure preserved
- adaptive questioning defined
- new input dimensions defined
- output layers defined

Multi-vendor stack:
- plan document exists
- singular provider output is no longer treated as universal default
- role categories defined
- stack logic defined
- blocker/integration analysis included

## Coaching note

Do not try to implement all of this in one pass.
Plan first, then phase it.

The product gets much stronger by:
- asking better questions
- returning more realistic recommendations
- showing decision-grade blockers and evidence gaps

not by adding more charts.
