import IpoWatchPage from "@/app/(internal)/investing/ipo-watch/page";
import { adminPageGuard } from "@/components/admin/AdminPageGuard";

export const dynamic = "force-dynamic";

export default async function GuardedIpoWatchPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;
  return <IpoWatchPage />;
}
