import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SignInForm from "@/components/member/SignInForm";
import { getMember } from "@/lib/member/auth";
import { parseTrackItem, safeReturnTo, trackItemLabel } from "@/lib/member/track";

// Lean public page (no poller). Reads the session cookie only to bounce a
// signed-in visitor straight back to where they came from.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to save a private watchlist and get a personalised market read.",
  alternates: { canonical: "/signin" },
  robots: { index: false, follow: true },
};

const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

export default async function SignInPage({
  searchParams,
}: {
  searchParams: Promise<{ track?: string; returnTo?: string }>;
}) {
  const sp = await searchParams;
  const track = parseTrackItem(sp.track) ? String(sp.track) : undefined;
  const returnTo = typeof sp.returnTo === "string" ? safeReturnTo(sp.returnTo) : undefined;

  const member = await getMember();
  if (member) redirect(returnTo ?? "/watchlist");

  const trackLabel = track ? trackItemLabel(track) : null;

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#b08d2f] dark:text-[#d4af37]">
        Vendor Monitor
      </p>
      <h1 className="font-display mt-2 text-4xl font-semibold leading-tight tracking-tight">
        {trackLabel ? `Sign in to track ${trackLabel}` : "Sign in"}
      </h1>
      <p className={`mt-3 text-sm ${MUTED}`}>
        {trackLabel
          ? `Passwordless — we email you a single-use link. ${trackLabel} will be added to your private watchlist and you'll land right back here.`
          : "Passwordless — we email you a single-use link. Save the vendors, categories, use-cases and current stack you care about, and get a personalised “what changed for you” read. Private to you; never shown to vendors."}
      </p>

      <div className="mt-6 rounded-xl border border-black/10 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
        <SignInForm track={track} returnTo={returnTo} />
      </div>
    </main>
  );
}
