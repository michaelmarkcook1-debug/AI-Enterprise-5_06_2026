"use client";

// Records "the visitor saw The Brief just now" by stamping a first-party cookie
// after paint. The NEXT visit reads it server-side to highlight what's new since.
// Deliberately writes AFTER render so this visit still compares against the prior
// stamp (never zeroes out its own "new since" count). No PII — just a timestamp.

import { useEffect } from "react";

const COOKIE = "ae_brief_seen";
const MAX_AGE = 60 * 60 * 24 * 120; // 120 days

export default function MarkBriefSeen() {
  useEffect(() => {
    try {
      document.cookie = `${COOKIE}=${encodeURIComponent(new Date().toISOString())}; path=/; max-age=${MAX_AGE}; samesite=lax`;
    } catch {
      // best-effort — the brief still works without the personal "new" highlight
    }
  }, []);
  return null;
}
