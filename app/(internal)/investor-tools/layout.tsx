import { InvestorStateProvider } from "@/components/investor-tools/InvestorStateProvider";
import { InvestorStatusBar } from "@/components/investor-tools/InvestorStatusBar";

// Wraps every /investor-tools/* route with the shared InvestorState provider.
// The provider is the single source of truth for: simulator inputs, watchlist,
// recently-viewed providers, and saved portfolios. Persistence + cross-tab
// sync are handled by `useSyncExternalStore` against localStorage.
export default function InvestorToolsLayout({ children }: { children: React.ReactNode }) {
  return (
    <InvestorStateProvider>
      <InvestorStatusBar />
      {children}
    </InvestorStateProvider>
  );
}
