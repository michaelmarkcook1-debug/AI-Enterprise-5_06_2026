import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { isAdminPageAuthed } from "@/lib/admin-page-auth";

// Gate every /admin/* page. If no cookie yet, redirect to auto-unlock which
// sets the cookie from CRON_SECRET (or ADMIN_API_TOKEN) and comes straight back.
export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const authed = await isAdminPageAuthed();
  if (!authed) redirect("/admin/auto-unlock?return=/admin");
  return <>{children}</>;
}
