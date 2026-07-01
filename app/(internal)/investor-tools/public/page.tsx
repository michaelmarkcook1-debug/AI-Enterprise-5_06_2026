import PublicAiStocksPage from "@/app/(internal)/investing/public/page";
import { adminPageGuard } from "@/components/admin/AdminPageGuard";

export const dynamic = "force-dynamic";

export default async function GuardedPublicAiStocksPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;
  return <PublicAiStocksPage />;
}
