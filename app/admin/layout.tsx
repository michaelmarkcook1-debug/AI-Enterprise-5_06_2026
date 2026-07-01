import type { ReactNode } from "react";
import { isAdminPageAuthed } from "@/lib/admin-page-auth";
import AdminUnlockForm from "@/components/admin/AdminUnlockForm";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const authed = await isAdminPageAuthed();
  if (!authed) return <AdminUnlockForm />;
  return <>{children}</>;
}
