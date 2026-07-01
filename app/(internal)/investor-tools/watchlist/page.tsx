import InvestmentWatchlistPage from "@/app/(internal)/investing/watchlist/page";
import { adminPageGuard } from "@/components/admin/AdminPageGuard";

export const dynamic = "force-dynamic";

export default async function GuardedInvestmentWatchlistPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;
  return <InvestmentWatchlistPage />;
}
