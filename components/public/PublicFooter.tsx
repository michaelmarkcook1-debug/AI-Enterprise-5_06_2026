import Link from "next/link";
import SubscribeForm from "@/components/SubscribeForm";

// Lean public footer. Server component (no client state) — email capture +
// quiet wayfinding. The single back-office link is deliberately understated;
// it lands on the admin gate, not on dashboard content.
//
// Prompt 3's "everything" index for power users who want feature-first access
// now that top nav is collapsed to four jobs — every stable route with a
// single canonical URL lives here (compare/pricing are deliberately excluded:
// compare has no single canonical link, pricing is already flag-gated in the
// top nav and would need the same threading here for no real benefit).
export default function PublicFooter() {
  return (
    <footer className="mt-16 border-t border-[#e3d9c0] px-6 py-10 dark:border-[#1d3a57]">
      <div className="mx-auto flex max-w-6xl flex-col gap-8 sm:flex-row sm:items-start sm:justify-between">
        <div className="max-w-sm">
          <p className="text-sm font-semibold text-[#15263c] dark:text-[#eef3f8]">Get the market read</p>
          <p className="mt-1 text-xs text-[#4c5d75] dark:text-[#8fa5bb]">
            Evidence-based moves in the enterprise-AI market — who&apos;s rising, who&apos;s exposed,
            and who relies on whom. Double opt-in, no spam.
          </p>
          <SubscribeForm source="footer" className="mt-3 max-w-sm" />
        </div>
        <nav className="grid grid-cols-3 gap-x-8 gap-y-2 text-xs sm:text-right">
          <div className="flex flex-col gap-2">
            <Link href="/use-cases" className="text-[#4c5d75] hover:underline dark:text-[#8fa5bb]">Start here</Link>
            <Link href="/vendors" className="text-[#4c5d75] hover:underline dark:text-[#8fa5bb]">Rankings</Link>
            <Link href="/models" className="text-[#4c5d75] hover:underline dark:text-[#8fa5bb]">Model inventory</Link>
            <Link href="/dependencies" className="text-[#4c5d75] hover:underline dark:text-[#8fa5bb]">Dependency graph</Link>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/interrogate" className="text-[#4c5d75] hover:underline dark:text-[#8fa5bb]">Interrogate</Link>
            <Link href="/peers" className="text-[#4c5d75] hover:underline dark:text-[#8fa5bb]">Peer AI</Link>
            <Link href="/insights" className="text-[#4c5d75] hover:underline dark:text-[#8fa5bb]">Insights</Link>
            <Link href="/legislation" className="text-[#4c5d75] hover:underline dark:text-[#8fa5bb]">Legislation</Link>
          </div>
          <div className="flex flex-col gap-2">
            <Link href="/subscribe" className="text-[#4c5d75] hover:underline dark:text-[#8fa5bb]">Subscribe</Link>
            <Link href="/admin" className="text-[#4c5d75]/70 hover:underline dark:text-[#8fa5bb]/70">Back office</Link>
          </div>
        </nav>
      </div>
      <p className="mx-auto mt-8 max-w-6xl text-xs text-[#4c5d75]/80 dark:text-[#8fa5bb]/80">
        AI Enterprise · Independent enterprise-AI market intelligence · Scores are directional and
        confidence-labelled; every edge in the dependency graph carries its own public source.
      </p>
    </footer>
  );
}
