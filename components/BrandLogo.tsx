// BrandLogo — orbital atom mark + "AI Enterprise" wordmark.
// Light mode renders the teal-gold mark; dark mode swaps to the cream-on-navy
// mark. Both rely on the existing class="dark" toggling on <html> (set by
// TopNav's theme switcher) — so they switch in lockstep with everything else.

/* eslint-disable @next/next/no-img-element */

interface BrandLogoProps {
  size?: number;            // px height of the mark
  showWordmark?: boolean;   // render "AI Enterprise" beside the mark
  className?: string;
}

export default function BrandLogo({ size = 28, showWordmark = true, className }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      <img
        src="/brand/logo-mark-light.svg"
        alt=""
        width={size}
        height={size}
        className="block dark:hidden"
        aria-hidden
      />
      <img
        src="/brand/logo-mark-dark.svg"
        alt=""
        width={size}
        height={size}
        className="hidden dark:block"
        aria-hidden
      />
      {showWordmark && (
        <span className="font-semibold tracking-tight text-[#13294b] dark:text-zinc-100">
          AI Enterprise
        </span>
      )}
    </span>
  );
}
