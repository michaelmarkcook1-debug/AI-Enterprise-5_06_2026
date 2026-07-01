import type { ReactElement } from "react";
import { isAdminPageAuthed } from "@/lib/admin-page-auth";
import AdminUnlockForm from "@/components/admin/AdminUnlockForm";

/**
 * Server-side gate for admin PAGES. Call as the FIRST statement of every
 * admin page's async server component, BEFORE any data fetching:
 *
 *   export default async function Page() {
 *     const locked = await adminPageGuard();
 *     if (locked) return locked;
 *     // ...data fetches only run for an authenticated admin...
 *   }
 *
 * WHY THIS MUST LIVE IN THE PAGE, NOT ONLY THE LAYOUT:
 * In the Next.js App Router a `layout.tsx` auth check does NOT prevent a
 * sibling `page.tsx` from executing and data-fetching — the page renders into
 * the RSC flight payload regardless of what the layout returns, so its
 * server-side queries run and their results are streamed to the client even
 * when the layout only displays the unlock form. That is an information
 * disclosure leak. Guarding inside the page short-circuits before any query
 * runs, so an unauthenticated request fetches nothing and leaks nothing.
 */
export async function adminPageGuard(): Promise<ReactElement | null> {
  const authed = await isAdminPageAuthed();
  return authed ? null : <AdminUnlockForm />;
}
