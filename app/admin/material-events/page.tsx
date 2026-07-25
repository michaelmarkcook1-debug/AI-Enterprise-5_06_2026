// Admin — material corporate events (acquisitions, investments, ownership moves).
// ───────────────────────────────────────────────────────────────────────────
// News correctly cannot move a score by itself, so a deal announcement would
// otherwise scroll past with every other headline. An acquisition or a funding
// round can change who owns a tracked vendor, redraw a dependency edge, or
// introduce a parent/investor we don't cover at all — those need a human to look.
//
// Every row here is a PATTERN MATCH on the headline, shown with the phrase that
// triggered it and the figure exactly as the source wrote it. Nothing is
// asserted about the deal: not that it closed, not who acquired whom, not what
// it is worth. The citation is the evidence; the operator decides.
// Admin-gated per-page.
import Link from "next/link";
import { adminPageGuard } from "@/components/admin/AdminPageGuard";
import { listNewsItems } from "@/lib/intelligence/repository";
import { flagCorporateEvents, type CorporateEventKind } from "@/lib/intelligence/corporate-events";

export const dynamic = "force-dynamic";

const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";
const WINDOW_DAYS = 45;

const KIND_STYLE: Record<CorporateEventKind, { label: string; cls: string }> = {
  acquisition: { label: "Acquisition", cls: "border-[#b08d2f]/50 bg-[#b08d2f]/15 text-[#8a6d1f] dark:text-[#e8c95c]" },
  investment: { label: "Investment", cls: "border-[#3f9d76]/50 bg-[#3f9d76]/15 text-[#1f6f4f] dark:text-[#7fd3ac]" },
};

function fmt(iso: string): string {
  const t = Date.parse(iso);
  return Number.isNaN(t) ? iso : new Date(t).toLocaleDateString("en-GB", { dateStyle: "medium" });
}

export default async function MaterialEventsPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;

  const all = await listNewsItems().catch(() => []);
  const cutoff = Date.now() - WINDOW_DAYS * 86_400_000;
  // Real, citable items only — the same bar the public feed applies.
  const recent = all.filter((n) => {
    const t = Date.parse(n.publishedAt);
    return !Number.isNaN(t) && t >= cutoff && n.sourceKind === "real" && (n.sourceUrl ?? "").startsWith("http");
  });
  const flagged = flagCorporateEvents(recent);

  const acquisitions = flagged.filter((f) => f.signal.kind === "acquisition").length;
  const investments = flagged.filter((f) => f.signal.kind === "investment").length;

  return (
    <main className="mx-auto max-w-4xl px-4 py-10 text-[#123d2c] dark:text-[#eef3f8]">
      <h1 className="text-2xl font-semibold tracking-tight">Material events — acquisitions &amp; investments</h1>
      <p className={`mt-2 max-w-2xl text-sm ${MUTED}`}>
        Deal-shaped headlines from the last {WINDOW_DAYS} days. Each row is a <strong>pattern match on the
        headline</strong>, not a verified transaction: we show the phrase that triggered it and any figure exactly
        as the source wrote it. Nothing here has moved a score, and nothing will until evidence is reviewed —
        this exists so an ownership change or a new backer doesn&apos;t scroll past unseen.
      </p>

      {flagged.length > 0 && (
        <p className={`mt-3 text-sm ${MUTED}`}>
          <strong>{flagged.length}</strong> flagged · {acquisitions} acquisition{acquisitions === 1 ? "" : "s"} ·{" "}
          {investments} investment{investments === 1 ? "" : "s"}
          {" · "}
          <Link href="/admin/market-edge" className="underline underline-offset-2">
            untracked entities →
          </Link>
        </p>
      )}

      {flagged.length === 0 ? (
        <p className={`mt-6 text-sm ${MUTED}`}>
          No deal-shaped headlines in the last {WINDOW_DAYS} days. {recent.length} cited items scanned.
        </p>
      ) : (
        <ul className="mt-6 space-y-3">
          {flagged.map(({ item, signal }) => (
            <li key={item.id} className="rounded-xl border border-black/10 p-4 dark:border-white/10">
              <div className="flex flex-wrap items-center gap-2">
                <span className={`rounded-full border px-2 py-0.5 text-xs font-semibold ${KIND_STYLE[signal.kind].cls}`}>
                  {KIND_STYLE[signal.kind].label}
                </span>
                {signal.amountText && (
                  <span className="rounded border border-black/10 px-1.5 py-0.5 font-mono text-xs dark:border-white/15">
                    {signal.amountText}
                    <span className={`ml-1 font-sans ${MUTED}`}>as written</span>
                  </span>
                )}
                <span className={`text-xs tabular-nums ${MUTED}`}>{fmt(item.publishedAt)}</span>
              </div>

              <p className="mt-2 text-sm font-medium">{item.title}</p>

              <p className={`mt-1 text-xs ${MUTED}`}>
                matched on <span className="font-mono">&ldquo;{signal.matchedPhrase}&rdquo;</span>
                {item.vendors.length > 0 && <> · tagged: {item.vendors.map((v) => v.replace(/^vendor_/, "")).join(", ")}</>}
              </p>

              <p className={`mt-2 text-xs ${MUTED}`}>{signal.reviewPrompt}</p>

              {item.sourceUrl && (
                <a
                  href={item.sourceUrl}
                  target="_blank"
                  rel="noopener noreferrer"
                  className="mt-2 inline-block text-xs underline underline-offset-2"
                >
                  {item.sourceName || "source"} ↗
                </a>
              )}
            </li>
          ))}
        </ul>
      )}
    </main>
  );
}
