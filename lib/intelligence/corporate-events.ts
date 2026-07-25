// Material corporate events — acquisitions, investments, ownership moves.
// ───────────────────────────────────────────────────────────────────────────
// WHY: an acquisition or a funding round is not just another headline. It can
// change who owns a tracked vendor, redraw a dependency edge, or introduce an
// investor/parent we don't cover at all. Those need a HUMAN to look, even though
// (correctly) nothing in this codebase lets news move a score by itself.
//
// WHAT THIS IS: a conservative PATTERN DETECTOR over the headline. It reports
// "this headline matches an acquisition pattern, here is the phrase that
// matched, here is the figure as written" — and nothing more. It does not
// resolve who acquired whom, does not normalise or convert any amount, does not
// assert the deal is real or closed, and never touches a score. The operator
// reads the citation and decides.
//
// FALSE POSITIVES ARE THE RISK: "raises concerns", "customer acquisition",
// "talent acquisition" are not deals. Each pattern therefore carries an explicit
// exclusion list, and an excluded phrase suppresses the match rather than
// downgrading it.

export type CorporateEventKind = "acquisition" | "investment";

export interface CorporateEventSignal {
  kind: CorporateEventKind;
  /** The exact phrase that triggered the match — shown so the operator can judge. */
  matchedPhrase: string;
  /** Money figure exactly as written in the source. NEVER parsed or converted. */
  amountText: string | null;
  /** Why an operator should look — the review action, not a claim about the deal. */
  reviewPrompt: string;
}

interface Pattern {
  kind: CorporateEventKind;
  re: RegExp;
  /** If any of these match, the headline is NOT the event (suppress, don't downgrade). */
  exclude: RegExp[];
  reviewPrompt: string;
}

const PATTERNS: Pattern[] = [
  {
    kind: "acquisition",
    re: /\b(acquires?|acquired|acquiring|to acquire|acquisition of|buys|bought|takeover of|merges with|merger with)\b/i,
    exclude: [
      // Not deals: growth/HR/marketing jargon that reuses the same words.
      /\b(customer|user|talent|data|land|subscriber|client)\s+acquisition\b/i,
      /\bacquisition\s+(cost|strategy|channel|funnel|marketing)\b/i,
      /\bacquires?\s+(customers?|users?|talent|skills|knowledge)\b/i,
    ],
    reviewPrompt:
      "Ownership may have changed. Check whether a tracked vendor's parent, roster entry or dependency edge needs updating.",
  },
  {
    kind: "investment",
    re: /\b(raises?|raised|funding round|series\s+[a-m]\b|seed round|invests?\s+(?:\$|in\b)|investment in|takes? a stake|stake in|valuation of|valued at|backs?\s+\w+\s+with)\b/i,
    exclude: [
      // "raises" is heavily overloaded in headline English.
      /\braises?\s+(concerns?|questions?|doubts?|eyebrows|alarm|fears?|the bar|hopes?|awareness|issues?)\b/i,
      /\braises?\s+prices?\b/i,
    ],
    reviewPrompt:
      "New capital or a new backer may be involved. Check whether the investor/parent is tracked, and whether the capital layer of the dependency graph needs an edge.",
  },
];

/** Money as written — "$165B-$175B", "$205 Billion", "30 billion". Verbatim only. */
const AMOUNT_RE =
  /(\$\s?\d[\d,.]*\s?(?:[-–—]\s?\$?\d[\d,.]*\s?)?(?:billion|bn|million|m|b|trillion|t)?)|(\b\d[\d,.]*\s?(?:billion|million|trillion)\b)/i;

function firstMatch(text: string, re: RegExp): string | null {
  const m = text.match(re);
  return m ? m[0].trim() : null;
}

/**
 * Detect a material corporate event in a headline. Returns null when nothing
 * matches — which is the common case and the safe default.
 *
 * Only the TITLE is scanned by default: summaries are LLM-written and can
 * paraphrase a deal that the source never claimed, so matching on them would
 * manufacture events. Pass `summary` explicitly only where it is source text.
 */
export function detectCorporateEvent(title: string, summary?: string): CorporateEventSignal | null {
  const text = `${title ?? ""}`.trim();
  if (!text) return null;

  for (const p of PATTERNS) {
    if (p.exclude.some((ex) => ex.test(text))) continue;
    const matchedPhrase = firstMatch(text, p.re);
    if (!matchedPhrase) continue;
    // Amount may appear in the title or, if supplied, the source summary.
    const amountText = firstMatch(text, AMOUNT_RE) ?? (summary ? firstMatch(summary, AMOUNT_RE) : null);
    return { kind: p.kind, matchedPhrase, amountText, reviewPrompt: p.reviewPrompt };
  }
  return null;
}

export interface FlaggedEvent<T> {
  item: T;
  signal: CorporateEventSignal;
}

/** Scan a feed, newest-first order preserved. Pure. */
export function flagCorporateEvents<T extends { title: string; summary?: string }>(
  items: readonly T[],
): FlaggedEvent<T>[] {
  const out: FlaggedEvent<T>[] = [];
  for (const item of items) {
    const signal = detectCorporateEvent(item.title);
    if (signal) out.push({ item, signal });
  }
  return out;
}
