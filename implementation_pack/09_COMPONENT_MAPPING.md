# Current Component Mapping to Target Product

## Existing Route / Component Mapping

| Existing asset | Keep? | Target destination | Notes |
|---|---:|---|---|
| `/atlas` | Yes | Understand | Keep as AI Ecosystem Navigator |
| `/quadrant` | Yes | Understand | Keep as Leadership Matrix |
| `/query` | Yes | Query | Reframe around "what changed" |
| `/understand` | Yes | Understand | Already strong |
| `/assess` | Yes | Assess | Rebuild around 3 assessment tiers |
| `/demonstrate` | Yes | Demonstrate | Rebuild around board defence |
| WatchlistManager | Yes | Monitor | Promote to first-class route |
| ReputationTabs | Yes | Demonstrate + Understand + Monitor | Core proof/risk asset |
| VendorUptakeExplorer | Yes | Demonstrate | Board defence proof point |
| TokenPricingTable | Yes | Demonstrate + Investor Tools | Commercial case |
| VendorSharePie | Yes | Query + Investor Tools | Supporting signal |
| ExposureMapHero | Yes | Understand + Investor Tools | Dependency/exposure intelligence |
| QuadrantChart | Yes | Understand | Leadership / positioning view |
| Evidence grading E0-E5 | Yes | Everywhere | Must be preserved |
| SeedDataBadge | Yes | Everywhere | Must be preserved |

## New Components Needed

### Monitor

- `app/monitor/page.tsx`
- `components/monitor/RecommendationDrift.tsx`
- `components/monitor/AssumptionMonitor.tsx`
- `components/monitor/ReassessmentQueue.tsx`
- `components/monitor/VendorChangeFeed.tsx`

### Demonstrate

- `components/demonstrate/BoardDefenceScore.tsx`
- `components/demonstrate/CIOConfidenceScore.tsx`
- `components/demonstrate/BusinessCasePanel.tsx`
- `components/demonstrate/CostOfInactionPanel.tsx`
- `components/demonstrate/CompetitorAdoptionTracker.tsx`
- `components/demonstrate/RiskRegister.tsx`
- `components/demonstrate/AssumptionDefence.tsx`
- `components/demonstrate/BoardPackGenerator.tsx`

### Assess

- `components/assess/AssessmentTierSelector.tsx`
- `components/assess/OpportunityAssessment.tsx`
- `components/assess/StrategyAssessment.tsx`
- `components/assess/ProcurementAssessment.tsx`
- `components/assess/RecommendedStack.tsx`

### Investor Tools

- `app/investor-tools/page.tsx`
- `components/investor/InvestorDashboard.tsx`
- `components/investor/ScenarioSimulator.tsx`
- `components/investor/ExposureMap.tsx`
- `components/investor/CategoryMomentum.tsx`
- `components/investor/VendorFinancialIntelligence.tsx`
