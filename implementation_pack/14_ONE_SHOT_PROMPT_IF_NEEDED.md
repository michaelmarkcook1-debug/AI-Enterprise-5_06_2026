# One-Shot Prompt for Claude Code

Use this only if you want Claude Code to attempt the whole transformation in one pass.

---

You are working on the existing AI Enterprise Next.js app.

Re-architect the product into a CIO Decision Intelligence Platform with the following top-level workflow:

- Query
- Understand
- Assess
- Demonstrate
- Monitor
- Investor Tools

Do not rebuild from scratch. Preserve existing data repositories, provenance logic, evidence grading, UI primitives, Atlas, Quadrant, Query, Understand, Assess, Demonstrate, Reputation, Uptake, Pricing, Watchlists and Admin capabilities.

Make the first implementation safe and incremental.

Required:

1. `/` redirects to `/query`.
2. Top navigation shows Query, Understand, Assess, Demonstrate, Monitor, Investor Tools.
3. Atlas is removed from top nav but preserved as an Understand subview / linked card.
4. Leadership Matrix is removed from top nav but preserved as an Understand subview / linked card.
5. Create `/monitor` page using existing watchlists, news, risk alerts, vendor momentum and provenance.
6. Create or expose `/investor-tools` page using existing rankings, market share, momentum, exposure and scenario foundations.
7. Reframe Query as "what changed in the AI market?"
8. Reframe Understand as "what is this vendor and where does it fit?"
9. Reframe Assess around three tiers: Opportunity, Strategy, Procurement.
10. Reframe Demonstrate around the CIO Board Defence Framework:
    - Why invest?
    - Why now?
    - Why this architecture?
    - Why these vendors?
    - What are competitors doing?
    - What is market sentiment?
    - What could go wrong?
    - How are risks mitigated?
    - How will success be measured?
    - Will this decision age well?
    - What assumptions must remain true?
11. Preserve seed/estimated/live labels.
12. Preserve confidence and evidence grades.
13. Keep the premium dark navy / teal / gold design language.
14. Run build/lint/tests and report exact pass/fail status.

Do not claim data is live where it is seed or estimated.
Do not remove existing working functionality.
Do not hide methodology.
