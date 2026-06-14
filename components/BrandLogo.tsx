// BrandLogo — orbital atom mark + "AI Enterprise" wordmark.
// Default behaviour follows the html.dark theme toggle. `onDark` forces the
// dark-surface treatment regardless of theme — used by the TopNav masthead,
// which is brand navy in BOTH light and dark modes.

/* eslint-disable @next/next/no-img-element */

interface BrandLogoProps {
  size?: number;            // px height of the mark
  showWordmark?: boolean;   // render "AI Enterprise" beside the mark
  className?: string;
  onDark?: boolean;         // force cream-on-navy treatment (theme-independent)
}

export default function BrandLogo({ size = 28, showWordmark = true, className, onDark = false }: BrandLogoProps) {
  return (
    <span className={`inline-flex items-center gap-2.5 ${className ?? ""}`}>
      {onDark ? (
        <img src="/brand/logo-mark-dark.svg" alt="" width={size} height={size} className="block" aria-hidden />
      ) : (
        <>
          <img src="/brand/logo-mark-light.svg" alt="" width={size} height={size} className="block dark:hidden" aria-hidden />
          <img src="/brand/logo-mark-dark.svg" alt="" width={size} height={size} className="hidden dark:block" aria-hidden />
        </>
      )}
      {showWordmark && (
        <span className={`font-semibold tracking-tight ${onDark ? "text-[#f6f1e3]" : "text-[#13294b] dark:text-[#eef3f8]"}`}>
          AI Enterprise
        </span>
      )}
    </span>
  );
}
