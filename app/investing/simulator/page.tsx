import { PageFrame } from "@/components/app-shell";
import { getDefaultSimulationInput, getSeedPortfolio, listIndirectExposures, listInvestmentProviders, listIpoWatch, simulatePortfolio } from "@/lib/investing/simulator";
import InvestmentSimulatorClient from "./InvestmentSimulatorClient";

export const dynamic = "force-dynamic";

export default function InvestmentSimulatorPage() {
  const input = getDefaultSimulationInput();
  const portfolio = getSeedPortfolio(input);

  return (
    <PageFrame
      title="Investment Simulator"
      kicker="AI Enterpise investment scenario modelling"
      description="Hypothetical AI-provider portfolio modelling for public, indirect, and IPO-watch exposure. Outputs are seed-based, confidence-weighted, and not financial advice."
    >
      <InvestmentSimulatorClient
        initialInput={input}
        initialPortfolio={portfolio}
        initialResult={simulatePortfolio(portfolio)}
        providers={listInvestmentProviders()}
        ipoWatch={listIpoWatch()}
        indirectExposures={listIndirectExposures()}
      />
    </PageFrame>
  );
}
