// Retired 10 Jun 2026 — product decision: composite scoring for
// multi-category vendors must not render as a rank or quadrant.
// The route is preserved only so old links don't 404; it sends
// visitors to Understand, where category-scoped scoring lives.
import { redirect } from "next/navigation";

export default function RetiredQuadrantPage() {
  redirect("/understand");
}
