import InvestingDashboardPage from "@/app/(internal)/investing/page";
import { adminPageGuard } from "@/components/admin/AdminPageGuard";

export const dynamic = "force-dynamic";

export default async function GuardedInvestingDashboardPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;
  return <InvestingDashboardPage />;
}
