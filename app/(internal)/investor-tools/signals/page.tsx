import {
  deriveCurrentRegime,
  listMarketTalk,
  listRegulatoryEvents,
  listSignals,
  scoreSignal,
} from "@/lib/market-signals/engine";
import MarketSignalsClient from "./MarketSignalsClient";

export const dynamic = "force-dynamic";

export default function MarketSignalsPage() {
  const signals = listSignals();
  const regulatoryEvents = listRegulatoryEvents();
  const marketTalk = listMarketTalk();
  const regime = deriveCurrentRegime();
  const scored = signals.map((sig) => ({ signal: sig, score: scoreSignal(sig, { regime, relevance: 65 }) }));

  return (
    <MarketSignalsClient
      signals={signals}
      scored={scored}
      regime={regime}
      regulatoryEvents={regulatoryEvents}
      marketTalk={marketTalk}
    />
  );
}
