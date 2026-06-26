import type { Metadata } from "next";
import { redirect } from "next/navigation";
import SignInForm from "@/components/member/SignInForm";
import { getMember } from "@/lib/member/auth";

// Lean public page (no poller). Reads the session cookie only to bounce a
// signed-in visitor straight to their watchlist.
export const dynamic = "force-dynamic";

export const metadata: Metadata = {
  title: "Sign in",
  description: "Sign in to save a private watchlist and get a personalised market read.",
  alternates: { canonical: "/signin" },
  robots: { index: false, follow: true },
};

const MUTED = "text-[#15263c]/60 dark:text-[#eef3f8]/60";

export default async function SignInPage() {
  const member = await getMember();
  if (member) redirect("/watchlist");

  return (
    <main className="mx-auto max-w-md px-4 py-16">
      <p className="text-[11px] font-bold uppercase tracking-[0.24em] text-[#b08d2f] dark:text-[#d4af37]">
        Vendor Monitor
      </p>
      <h1 className="font-display mt-2 text-4xl font-semibold leading-tight tracking-tight">Sign in</h1>
      <p className={`mt-3 text-sm ${MUTED}`}>
        Passwordless — we email you a single-use link. Save the vendors, categories, use-cases and
        current stack you care about, and get a personalised &ldquo;what changed for you&rdquo; read.
        Private to you; never shown to vendors.
      </p>

      <div className="mt-6 rounded-xl border border-black/10 bg-white/60 p-5 dark:border-white/10 dark:bg-white/5">
        <SignInForm />
      </div>
    </main>
  );
}
