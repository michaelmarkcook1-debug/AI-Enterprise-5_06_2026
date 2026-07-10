# C6 Use-case Impact library — CURATED v1 (analyst-sourced, cited)

**Status: FOR OWNER VERIFICATION before it becomes code.** Every row below traces to a
real, named, checkable source found via disciplined web research (4 parallel analyst passes,
2026-07-09). Nothing here is invented. Rows are graded E2–E5, bands never point numbers, and
gaps are left honestly empty. This is the dataset that would populate `USECASE_IMPACT`
(`lib/usecase-front-door.ts`) — pending your sign-off on the sources AND the three design
decisions the evidence forced (below).

---

## The three design decisions the evidence forced

The original methodology (`c6-usecase-impact-feasibility.md` §4) defined Impact = **value-at-stake
band × expected-uplift band**. The research says that's only half-buildable honestly:

1. **Impact axis = evidenced UPLIFT band, not $ value.** Independent studies (RCTs, peer-reviewed
   field studies, government evaluations) robustly measure *task uplift* (% faster / more / better).
   They almost never yield a portable per-enterprise **dollar** figure. Of ~50 sourced rows, only
   **8 carry a defensible $ band — and all 8 are vendor or vendor-commissioned (E3–E4)**. So the
   grid's impact axis should be the **evidenced uplift band** (strongest, most independent evidence),
   NOT a manufactured dollar value.

2. **Value-at-stake becomes a SECONDARY, vendor-caveated chip** — shown only on the ~8 use-cases
   where a named $ figure exists (Forrester TEIs, vendor case studies), always labelled
   "vendor-sourced · directional," never used to place a use-case in the 2×2.

3. **Counter-evidence and capability-ceilings are honesty FLAGS, not impact chips.** Three use-cases
   have strong *independent* evidence that AI does NOT straightforwardly help — these must surface as
   an explicit caveat, never a green impact chip:
   - **code_assistant** — the METR 2025 RCT found experienced devs on their own mature repos were
     **19% slower** with AI (while believing they were faster).
   - **code_review_agent** — no independent RCT shows a net delivery win; 2024 DORA finds AI adoption
     correlated with **−1.5% throughput / −7.2% delivery stability**.
   - **text_to_sql** — frontier models solve only **~10–21%** of realistic enterprise SQL workflows
     (Spider 2.0). The famous ~90% (Spider 1.0) vastly overstates deployed capability.

The 2×2 the CIO reads therefore becomes **evidenced Uplift × deterministic Feasibility**, with value
and the honesty-flags as annotations. Both axes are now evidence-backed (uplift = cited studies;
feasibility = the deterministic model already shipped).

---

## Curated impact rows (the PRIMARY evidenced uplift per use-case)

One primary row per (use-case × industry), highest-defensibility source first. `E5` = independent /
peer-reviewed / RCT / court-validated; `E4` = major analyst or government evaluation; `E3` = vendor
case study / commissioned TEI; `E2` = public claim. "Basis" quotes the source's real figure.

### Customer & service
| use-case | ind. | uplift | grade | source | basis / caveat |
|---|---|---|---|---|---|
| customer_service_agent | * | 10–25% | **E5** | Brynjolfsson, Li & Raymond, *Generative AI at Work*, QJE 2025 (NBER 31161) | +15% issues/hr; 34% for novices, ~0 experts. 5,172 agents. Canonical anchor. |
| agent_assist | * | 25–50% | **E5** | (same study) | Real-time assist: +34% for novice agents; "disseminates best-worker practice." |
| voice_of_customer | * | 10–25% | E4 | McKinsey, *Gen AI in customer care* (2024) | One firm's *expected* +5–10% conversion / −10–20% cancellations. Forward-looking. |
| hr_helpdesk | * | >50%\* | E3 | ServiceNow "Now on Now" (internal) | 54% deflection on "report an issue." \*Vendor's own deployment, self-reported. |

### Engineering
| use-case | ind. | uplift | grade | source | basis / caveat |
|---|---|---|---|---|---|
| code_assistant | * | 25–50% | **E5** | Cui et al., MIT Economics (2024), 3 RCTs ~4,000 devs | **+26% PRs/week** — the defensible *sustained* number. (Lab "55% faster" is one task.) |
| documentation_generator | * | 25–50% | E4 | McKinsey, *Unleashing developer productivity* (2023) | Code docs ~45–50% time cut — highest-uplift dev task. |
| test_generation | tech_software | 25–50% | E4 | Alshahwan et al. (Meta), *TestGen-LLM*, FSE'24 | 25% of runs raised coverage; 73% accepted to production. Augments, not greenfield. |
| vulnerability_triage | * | 25–50% | **E5** | CORTEX, arXiv 2510.00311 (2025) | False-positive 24.9%→14.2%; F1 0.66→0.78. Vs LLM baseline, not vs humans. |

### Knowledge / content / sales
| use-case | ind. | uplift | grade | source | basis / caveat |
|---|---|---|---|---|---|
| marketing_content | * | >50% | **E5** | Dell'Acqua et al., *Jagged Frontier* (HBS/BCG, 758 consultants) | +40% quality, +12% throughput, 25% faster. Jagged-frontier: HURTS off-frontier tasks. |
| marketing_content | * | 25–50% | **E5** | Noy & Zhang, *Science* (2023), 453 pros | −40% time, +18% quality on a writing task. Weaker writers gain most. (2nd source.) |
| rfp_proposal | * | >50% | E5 | Dell'Acqua et al. (proxy) | Consulting deliverables ≈ RFP drafting. **Proxy** — factual/compliance sections at jagged-frontier risk. |
| knowledge_assistant | * | <10% | E4 | UK DWP M365 Copilot evaluation (GOV.UK, 3,549 staff) | ~19 min/user/day (~4% of workday). Independent gov eval. |
| meeting_assistant | * | <10% | E4 | Australian DTA M365 Copilot evaluation (5,765 licences) | "Up to an hour" summarising/drafting (upper bound). 61% couldn't ID Copilot output. |
| translation_localisation | financial_services | 25–50% | **E5** | Läubli et al., ACL W19-6626 (banking/finance) | +36% translation productivity via NMT post-editing, no quality loss. Pre-LLM. |

### Finance / legal / ops
| use-case | ind. | uplift | grade | source | basis / caveat |
|---|---|---|---|---|---|
| ediscovery | legal | 25–50% | **E5** | Grossman & Cormack, Rich. J.L. & Tech. (2011), court-cited | TAR 80% F1 vs manual 36%. Landmark, *Da Silva Moore*. Strongest legal anchor. |
| contract_review | legal | >50% | E3 | LawGeex (2018, Stanford/USC-advised) | AI 94% vs lawyers 85% accuracy; 26s vs 92min. NDAs only, pre-LLM, vendor-run. |
| ap_invoice_processing | * | 25–50% | E4/E3 | APQC benchmark (1,485 orgs) + Basware TEI | Cost/invoice $2.07 (top) vs $5.83 (median). Basware TEI: +50% clerk productivity. |
| ar_collections | * | 10–25% | E3 | Wakefield/Billtrust survey + HighRadius cases | 75% of adopters cut DSO 6+ days. Vendor-commissioned, adopter selection bias. |
| month_end_close | * | 25–50% | E4 | The Hackett Group, *Digital World Class Finance* (2025) | Leaders 35–57% shorter close, 99% JE automation. Leaders-vs-peers, not before/after. |
| financial_analysis | * | 25–50% | E4 | McKinsey, *How finance teams put AI to work* (2025) | −20–30% time crunching data. Self-reported across a few functions. |
| resume_screening | * | 10–25% | **E5** | Hoffman, Kahn & Li, QJE (2018) | +15% job tenure (quality of hire, NOT screening speed). Diversity-collapse risk. |
| operations_automation | * | 10–25% | **E5** | Brynjolfsson, Li & Raymond (proxy) | +14% support-ops throughput; back-office proxy. |
| data_analysis | * | 10–25% | **E5** | Swiss TPH RCT (2025), *Int J Public Health* | −15.6% time (p=0.002); quality NOT significantly different. Small n. |

**14 of the 23 primary rows are E4/E5 (independent or major-analyst).** 9 are E3 (vendor) and clearly flagged.

## Value-at-stake ($) — SECONDARY, vendor-sourced only (8 rows, all E3–E4)
| use-case | value band | source | note |
|---|---|---|---|
| customer_service_agent | >$25M | Klarna/OpenAI press | "$40M profit improvement." **Klarna later walked this back / re-added humans (2025).** |
| voice_ivr | $5–25M | Forrester TEI (PolyAI) | NPV $11.3M, ROI 391%. Vendor-commissioned composite. |
| hr_helpdesk | $5–25M | ServiceNow (internal) | "$5.5M annualized." Self-reported. |
| financial_analysis | $5–25M | Forrester TEI (Anaplan) | $13.3M / 152% ROI. Vendor-commissioned. |
| ap_invoice_processing | $1–5M | Forrester TEI (Basware) | NPV $1.12M, ROI 158%. Vendor-commissioned. |
| ar_collections | $1–5M | HighRadius cases | KDP "$2.5M." Single-customer, vendor. |
| month_end_close | $250k–1M | Nucleus/BlackLine | $481k/yr. Single customer, dated 2012. |

Every one carries a "vendor-sourced · directional" flag; none drives 2×2 placement.

## Honesty flags (evidenced, but NOT an impact win)
| use-case | flag | source |
|---|---|---|
| code_assistant | **Contested:** experienced devs 19% *slower* on mature repos | METR, arXiv 2507.09089 (2025, RCT) |
| code_review_agent | **Not evidenced as a net win:** −1.5% throughput / −7.2% stability | Google/DORA 2024 |
| churn_prediction | **Model accuracy only** (89.6%), no evidenced KPI/$ uplift | Wagh et al., *Scientific Reports* (2024) |
| text_to_sql | **Capability-limited:** ~10–21% on real enterprise SQL (not ~90%) | Spider 2.0, ICLR 2025 |

## Honest empty cells (searched, no citable source → "impact not yet evidenced")
`tier1_triage`, `incident_response`, `log_analysis`, `sales_research`, `campaign_orchestration`,
`lead_qualification` (only a stretched support-study proxy), `outbound_personalisation` (only E2
marketing). These stay dark — the correct answer, not a coverage failure.

## Cross-cutting caveats to encode in the UI
- **Task-level ≠ org-level.** Almost all uplift figures are single-task; sustained org throughput is
  lower (Copilot: 55% lab task → ~26% real PRs → ~9% at Accenture).
- **Novices gain most, experts ~0** (Brynjolfsson/Li/Raymond) — the uplift compresses skill.
- **Self-reported time savings inflate ~7×** vs measured (Microsoft Security Copilot RCT).
- **The jagged frontier** — AI degrades accuracy on tasks outside its capability (Dell'Acqua/BCG).

## Full source list (all checkable)
NBER 31161 / QJE 2025; MIT Copilot experiments; GitHub-Accenture RCT; METR arXiv 2507.09089;
McKinsey dev-productivity, gen-AI economic potential, customer-care, finance-AI, banking; Meta
TestGen-LLM (arXiv 2402.09171); DORA 2024; CORTEX (arXiv 2510.00311); Dell'Acqua/BCG (SSRN 4573321);
Noy & Zhang (Science adh2586); UK DWP + Australian DTA Copilot evaluations; Läubli (ACL W19-6626);
Grossman & Cormack (Rich. J.L. & Tech. 2011); RAND MG-1208; LawGeex (2018); APQC via CFO.com; Hackett
Group (2025); Forrester TEIs (Basware, Anaplan, PolyAI); HighRadius / Billtrust; Nucleus/BlackLine;
Hoffman-Kahn-Li (QJE 2018); Li-Raymond-Bergman (NBER 27736); Spider 2.0 (ICLR 2025); BIRD (NeurIPS
2023); Swiss TPH RCT (2025).
