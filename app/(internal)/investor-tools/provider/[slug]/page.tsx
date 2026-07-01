import ProviderInvestmentPage from "@/app/(internal)/investing/provider/[slug]/page";
import { adminPageGuard } from "@/components/admin/AdminPageGuard";

export const dynamic = "force-dynamic";

export default async function GuardedProviderInvestmentPage(props: Parameters<typeof ProviderInvestmentPage>[0]) {
  const locked = await adminPageGuard();
  if (locked) return locked;
  return <ProviderInvestmentPage {...props} />;
}
