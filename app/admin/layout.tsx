import type { ReactNode } from "react";
import { isAdminPageAuthed } from "@/lib/admin-page-auth";
import AdminUnlock from "@/components/admin/AdminUnlock";

// Gate every /admin/* page. Reading the cookie makes this dynamic (admin pages
// are already force-dynamic). Unauthorized visitors get the unlock form instead
// of admin content.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const authed = await isAdminPageAuthed();
  if (!authed) return <AdminUnlock />;
  return <>{children}</>;
}
