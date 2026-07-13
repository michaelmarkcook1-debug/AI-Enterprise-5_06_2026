"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  JOURNEY_TOTAL_STEPS,
  JOURNEY_STEP_LABEL,
  JOURNEY_STEP_RESUME_HREF,
  readJourneyStepClient,
} from "@/lib/member/journey-client";

// Unobtrusive progress affordance (Prompt 4): "your decision · step N of 5".
// Reads client-side only (post-hydration) — a cold, stone-cold-first visitor
// never sees this at all (step 0, nothing rendered); it only ever appears for
// someone who has genuinely taken at least one real step on the path. Fixed
// bottom-left so it never collides with the Ask AI launcher (bottom-right).
export default function JourneyBadge() {
  const [step, setStep] = useState(0);

  useEffect(() => {
    setStep(readJourneyStepClient());
  }, []);

  if (step < 1) return null;

  return (
    <Link
      href={JOURNEY_STEP_RESUME_HREF[step] ?? "/use-cases"}
      className="fixed bottom-5 left-5 z-40 inline-flex items-center gap-2 rounded-full border border-[#d4af37]/60 bg-[#0a1f38] px-3 py-2 text-xs font-semibold text-[#f6f1e3] shadow-lg transition-colors hover:bg-[#13294b]"
    >
      <span className="h-2 w-2 shrink-0 rounded-full bg-[#d4af37]" aria-hidden />
      Your decision · step {step} of {JOURNEY_TOTAL_STEPS}
      <span className="text-xs font-normal text-[#c8d7e9]">({JOURNEY_STEP_LABEL[step]}) →</span>
    </Link>
  );
}
