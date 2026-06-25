import type { ReactNode } from "react";
import { isAdminPageAuthed } from "@/lib/admin-page-auth";
import AdminUnlock from "@/components/admin/AdminUnlock";
import TopNav from "@/components/TopNav";
import GlobalFooter from "@/components/GlobalFooter";
import NotLiveBanner from "@/components/NotLiveBanner";
import AmbientHeroBackdrop from "@/components/AmbientHeroBackdrop";

// HEAVY internal shell — the old CIO dashboard, now back-office.
// ─────────────────────────────────────────────────────────────
// This is where the dashboard's live-polling chrome (TopNav freshness fetch,
// the seed-data NotLiveBanner, ingestion pollers on child pages) is quarantined
// so it never touches the public surface. The whole group sits BEHIND the
// existing admin cookie gate: an unauthenticated visitor gets the unlock form
// (same as /admin), not dashboard content. Reading the cookie makes this
// dynamic, which the internal pages already are.
export const dynamic = "force-dynamic";

export default async function InternalLayout({ children }: { children: ReactNode }) {
  const authed = await isAdminPageAuthed();
  if (!authed) return <AdminUnlock />;

  return (
    <>
      <AmbientHeroBackdrop />
      <div className="relative z-10 flex min-h-screen flex-col">
        <TopNav />
        <NotLiveBanner />
        <div className="flex-1">{children}</div>
        <GlobalFooter />
      </div>
    </>
  );
}
