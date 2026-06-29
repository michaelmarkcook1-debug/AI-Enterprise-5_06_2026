import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { cookies } from "next/headers";
import {
  isAdminPageAuthed,
  adminCookieValue,
  getAdminToken,
  ADMIN_COOKIE,
} from "@/lib/admin-page-auth";
import AdminAutoUnlock from "@/components/admin/AdminAutoUnlock";

export const dynamic = "force-dynamic";

export default async function AdminLayout({ children }: { children: ReactNode }) {
  const authed = await isAdminPageAuthed();
  if (!authed) {
    const token = getAdminToken();
    if (!token) {
      return (
        <div className="flex min-h-[70vh] items-center justify-center text-sm text-red-500 dark:text-red-400">
          Admin not configured — set CRON_SECRET or ADMIN_API_TOKEN in Vercel.
        </div>
      );
    }

    async function autoUnlock() {
      "use server";
      const t = getAdminToken();
      if (!t) return;
      const jar = await cookies();
      jar.set(ADMIN_COOKIE, adminCookieValue(t), {
        httpOnly: true,
        secure: process.env.NODE_ENV === "production",
        sameSite: "lax",
        maxAge: 60 * 60 * 24 * 30, // 30 days
        path: "/",
      });
      redirect("/admin");
    }

    return <AdminAutoUnlock action={autoUnlock} />;
  }
  return <>{children}</>;
}
