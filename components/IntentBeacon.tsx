"use client";

import { useEffect } from "react";
import { usePathname } from "next/navigation";

// Anonymous buyer-intent beacon. Fires one event per public page view. Sends
// NO identity — the server computes a salted, non-reversible session hash. Honors
// Do-Not-Track and never tracks admin/api paths.

interface BeaconPayload {
  eventType: string;
  targetId?: string;
  targetType?: string;
  path?: string;
  referrer?: string;
}

/** Exported for a regression test — the /shared exclusion must never
 *  silently regress, since re-including it would leak a raw share token
 *  (a bearer credential) into the unhashed intent_events table. */
export function classify(pathname: string): BeaconPayload | null {
  const parts = pathname.split("/").filter(Boolean);
  const head = parts[0];
  // Home — the most important public view — is a page_view in its own right.
  if (!head) return { eventType: "page_view" };
  // Never instrument admin tooling or API routes. "shared" is excluded too —
  // that path embeds a raw, still-valid share token (a bearer credential); the
  // token is sha256-hashed at rest specifically so a DB read can't reconstruct
  // a usable link, and logging the full path here would defeat that by
  // writing the raw token into an unrelated, unhashed analytics table.
  if (head === "admin" || head === "api" || head === "shared") return null;

  const slug = parts[1];
  if (head === "vendors" && slug) return { eventType: "vendor_viewed", targetType: "vendor", targetId: slug };
  if (head === "category" && slug) return { eventType: "category_browsed", targetType: "category", targetId: slug };
  if (head === "compare" && slug) return { eventType: "comparison_run", targetType: "comparison", targetId: slug };
  if (head === "insights" && slug) return { eventType: "article_read", targetType: "article", targetId: slug };
  return { eventType: "page_view" };
}

function doNotTrack(): boolean {
  if (typeof navigator === "undefined") return false;
  const dnt =
    navigator.doNotTrack ||
    (window as unknown as { doNotTrack?: string }).doNotTrack ||
    (navigator as unknown as { msDoNotTrack?: string }).msDoNotTrack;
  return dnt === "1" || dnt === "yes";
}

export default function IntentBeacon() {
  const pathname = usePathname();

  useEffect(() => {
    if (doNotTrack()) return;
    const base = classify(pathname);
    if (!base) return;

    const payload: BeaconPayload = {
      ...base,
      path: pathname,
      referrer: typeof document !== "undefined" ? document.referrer || undefined : undefined,
    };

    try {
      const body = JSON.stringify(payload);
      // sendBeacon survives the page unloading on fast navigations; fall back to
      // fetch keepalive where it isn't available.
      if (typeof navigator !== "undefined" && navigator.sendBeacon) {
        navigator.sendBeacon("/api/intent", new Blob([body], { type: "application/json" }));
      } else {
        void fetch("/api/intent", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body,
          keepalive: true,
        }).catch(() => {});
      }
    } catch {
      // Never let instrumentation break the page.
    }
  }, [pathname]);

  return null;
}
