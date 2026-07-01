import {
  deriveCurrentRegime,
  listMarketTalk,
  listRegulatoryEvents,
  listSignals,
  scoreSignal,
} from "@/lib/market-signals/engine";
import MarketSignalsClient from "./MarketSignalsClient";
import { adminPageGuard } from "@/components/admin/AdminPageGuard";

export const dynamic = "force-dynamic";

export default async function MarketSignalsPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;
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
