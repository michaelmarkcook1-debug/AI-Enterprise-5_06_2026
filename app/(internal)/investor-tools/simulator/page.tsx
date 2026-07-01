import InvestmentSimulatorPage from "@/app/(internal)/investing/simulator/page";
import { adminPageGuard } from "@/components/admin/AdminPageGuard";

export const dynamic = "force-dynamic";

export default async function GuardedInvestmentSimulatorPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;
  return <InvestmentSimulatorPage />;
}
