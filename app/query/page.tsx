// Retired 10 Jun 2026 — classic Query superseded by the role-aware Query
// (formerly /query-v2). Route preserved so old links don't 404.
import { redirect } from "next/navigation";

export default function RetiredClassicQueryPage() {
  redirect("/query-v2");
}
