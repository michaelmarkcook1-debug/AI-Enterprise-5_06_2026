# Claude Code Prompt 04 — Assessment Granularity Upgrade

Upgrade AI Enterprise Assessment so it feels like a real-world enterprise decision product.

## Goal

Add more granularity to:
1. the questions asked
2. the outputs returned

Do this without turning the first-run experience into a huge RFP form.

## Principle

Use progressive disclosure:

### Quick Assessment
~2 minutes
- fast triage
- minimal required inputs

### Guided Assessment
~5–8 minutes
- adaptive follow-up questions
- decision-shaping detail

### Advanced Assessment
~10–15 minutes
- procurement / technical / regulated-deployment depth

## Add missing input dimensions

1. Workflow criticality
- internal productivity
- internal decision support
- customer-facing
- regulated decision support
- autonomous workflow execution

2. Knowledge / content environment
- short documents
- long documents
- emails/chat
- code
- tabular data
- presentations
- multimodal content
- web-grounded research
- internal enterprise knowledge

3. Human review model
- always human-reviewed
- sampled review
- approval gate before action
- autonomous low-risk only
- autonomous with exception handling

4. Integration depth required
- no integrations
- read-only
- write-back required
- workflow/action execution
- full orchestration

5. Governance strictness
- basic admin controls okay
- enterprise auditability required
- policy enforcement required
- regulator-grade evidence needed
- sovereignty / restricted hosting required

6. Procurement / deployment reality
- pilot only
- departmental rollout
- enterprise-wide rollout
- production within 3 months
- long buying cycle / RFP / board scrutiny

7. Switching cost tolerance
- low concern
- moderate
- high portability requirement
- multi-vendor strategy required

8. Internal AI maturity
- no internal AI team
- light experimentation
- central platform team
- mature eval/governance function
- full AI engineering capability

## Add conditional follow-up logic

Assessment must ask adaptive follow-ups based on answers.

Examples:
- if legal/high confidentiality/document-heavy → ask about citations, privilege, access controls, DMS, human review
- if developer/API-first → ask about model routing, latency, evals, portability, tool use

## Add must-have / preference / disqualifier logic

For important dimensions allow:
- must-have
- strongly preferred
- nice-to-have
- disqualifier

Disqualifiers should not simply reduce score slightly; they should visibly block or warn.

## Output granularity must improve

Add output layers:
1. Executive summary
2. Subfactor score breakdown
3. Decision blockers
4. Evidence gaps
5. Deployment path
6. Sensitivity analysis
7. Scenario-based recommendations
8. Output modes:
   - Executive
   - Buyer
   - Technical
   - Procurement

## Deliverable

Write:
`ASSESSMENT_GRANULARITY_UPGRADE_PLAN.md`

Must include:
- new question architecture
- adaptive logic
- scoring changes
- output changes
- UX implications
- phased implementation order
