"use client";

import Link from "next/link";
import { usePortalTheme } from "@/lib/use-theme";
import styles from "./AIEnterpriseShell.module.css";

/**
 * AI Enterprise homepage — orbital command surface.
 *
 * Mirrors the AnalystGenius reference layout:
 *   - Top nav: brand mark + theme pill toggle
 *   - Centered hero: eyebrow + serif wordmark + subtitle + tagline + body + dual CTA
 *   - Animated background: two counter-rotating sets of elliptical orbital
 *     rings with planet dots
 *   - Footer pill row + URL signature
 *
 * Reduced-motion is respected — animations disable when the user has
 * `prefers-reduced-motion: reduce`.
 */
export default function AIEnterpriseShell() {
  const [theme, setTheme] = usePortalTheme();
  const next = theme === "dark" ? "light" : "dark";

  return (
    <div className={styles.root} data-theme={theme} suppressHydrationWarning>
      {/* Hero background image — Möbius-band globe/chart artwork */}
      <div className={styles.bgWash} aria-hidden>
        <img
          src="/brand/ai-enterprise-light-hero.png"
          alt=""
          aria-hidden
          className={styles.heroImage}
        />
      </div>

      {/* Top brand — AnalystGenius parent brand */}
      <Link href="/query" className={styles.brand} aria-label="AnalystGenius — AI Enterprise">
        <BrandMark />
        <span className={styles.brandWord}>
          <span className={styles.brandWordMute}>Analyst</span>
          <span className={styles.brandWordAccent}>Genius</span>
        </span>
      </Link>

      {/* Theme toggle (pill with gold dot) */}
      <button
        type="button"
        className={styles.themeToggle}
        onClick={() => setTheme(next)}
        aria-label={`Switch to ${next} mode`}
        aria-pressed={theme === "dark"}
        title={`Switch to ${next} mode`}
      >
        <span className={styles.toggleDot} aria-hidden />
        {theme === "dark" ? "Light" : "Dark"}
      </button>

      {/* Hero content */}
      <main className={styles.content}>
        <p className={styles.eyebrow}>CIO Decision Intelligence Platform</p>
        <h1 className={styles.wordmark}>
          <span className={styles.wordmarkMute}>AI </span>
          <span className={styles.wordmarkAccent}>Enterprise</span>
        </h1>
        <p className={styles.subtitle}>Query · Understand · Assess · Demonstrate · Monitor</p>
        <div className={styles.divider} aria-hidden />
        <p className={styles.tagline}>
          <em>Discover</em> · <em>Evaluate</em> · <em>Defend</em> · <em>Monitor</em>
        </p>
        <p className={styles.lede}>
          Evidence-graded AI market intelligence for CIOs — assess your AI platform fit, defend the decision to the board, and monitor whether it holds.
        </p>
        <div className={styles.ctaRow}>
          <span className={styles.ctaWrap}>
            <span className={`${styles.pulseRing} ${styles.pulseRingDelay0}`} aria-hidden />
            <span className={`${styles.pulseRing} ${styles.pulseRingDelay1}`} aria-hidden />
            <Link href="/query" className={styles.ctaPrimaryStrong}>
              <span className={styles.ctaDotStrong} aria-hidden />
              Enter platform
              <span className={styles.ctaArrow} aria-hidden>→</span>
            </Link>
          </span>
          <span className={styles.ctaWrap}>
            <Link href="/assess" className={styles.ctaPrimary}>
              <span className={styles.ctaDot} aria-hidden />
              Start Assessment
              <span className={styles.ctaArrow} aria-hidden>→</span>
            </Link>
          </span>
        </div>
        <p className={styles.foot}>
          Source-cited · Truthfulness gated · Evidence E0–E5 · Board-ready · AnalystGenius methodology
        </p>
      </main>

      <span className={styles.urlSig}>ai-enterprise.app</span>
    </div>
  );
}

/* ───────────────────────── helpers ───────────────────────── */

function BrandMark() {
  return (
    <svg
      viewBox="0 0 32 32"
      width={26}
      height={26}
      aria-hidden
      className={styles.brandMark}
    >
      <circle cx="16" cy="16" r="13" fill="none" stroke="currentColor" strokeWidth="1.4" opacity="0.55" />
      <ellipse cx="16" cy="16" rx="13" ry="5" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.7" />
      <ellipse cx="16" cy="16" rx="5" ry="13" fill="none" stroke="currentColor" strokeWidth="1.1" opacity="0.7" />
      <circle cx="16" cy="16" r="2.2" fill="currentColor" />
    </svg>
  );
}

/**
 * Two concentric ring systems counter-rotating. Each ring carries small
 * "planet" dots distributed around its perimeter. The whole composition is
 * absolutely positioned and centred behind the hero text.
 */
function OrbitalRings() {
  // Layer A — clockwise group
  const ringsA = [
    { rx: 380, ry: 96, planets: 5 },
    { rx: 470, ry: 132, planets: 6 },
    { rx: 560, ry: 168, planets: 7 },
  ];
  // Layer B — counter-clockwise group, slightly different inclination
  const ringsB = [
    { rx: 320, ry: 78, planets: 4, tilt: -12 },
    { rx: 410, ry: 110, planets: 5, tilt: -12 },
    { rx: 510, ry: 150, planets: 6, tilt: -12 },
    { rx: 620, ry: 190, planets: 7, tilt: -12 },
  ];

  return (
    <svg
      className={styles.orbits}
      viewBox="-700 -300 1400 600"
      preserveAspectRatio="xMidYMid meet"
      aria-hidden
    >
      {/* Faint radial glow at centre */}
      <defs>
        <radialGradient id="glow" cx="50%" cy="50%" r="40%">
          <stop offset="0%" stopColor="var(--ring-glow)" stopOpacity="0.45" />
          <stop offset="60%" stopColor="var(--ring-glow)" stopOpacity="0.05" />
          <stop offset="100%" stopColor="var(--ring-glow)" stopOpacity="0" />
        </radialGradient>
      </defs>
      <ellipse cx="0" cy="0" rx="320" ry="170" fill="url(#glow)" />

      {/* Layer A — rotates clockwise */}
      <g className={styles.layerA}>
        {ringsA.map((ring, i) => (
          <Ring key={`a${i}`} rx={ring.rx} ry={ring.ry} planets={ring.planets} />
        ))}
      </g>

      {/* Layer B — rotates counter-clockwise */}
      <g className={styles.layerB} transform={`rotate(${ringsB[0].tilt})`}>
        {ringsB.map((ring, i) => (
          <Ring key={`b${i}`} rx={ring.rx} ry={ring.ry} planets={ring.planets} />
        ))}
      </g>
    </svg>
  );
}

function Ring({ rx, ry, planets }: { rx: number; ry: number; planets: number }) {
  // Distribute planet dots around the ellipse using parametric form.
  // Coordinates rounded to 4 decimal places so server and client V8
  // produce identical attribute strings during hydration. Without this
  // rounding, Math.sin / Math.cos can differ in the last bit between
  // Node and the browser → "hydration mismatch" warnings.
  const round = (n: number) => Math.round(n * 10000) / 10000;
  const dots = Array.from({ length: planets }, (_, i) => {
    const angle = (i / planets) * Math.PI * 2 + (rx % 2 === 0 ? 0 : 0.4);
    return { x: round(rx * Math.cos(angle)), y: round(ry * Math.sin(angle)), r: 1.6 + (i % 3) * 0.5 };
  });
  return (
    <g>
      <ellipse cx="0" cy="0" rx={rx} ry={ry} fill="none" stroke="var(--ring-stroke)" strokeWidth="0.8" />
      {dots.map((d, i) => (
        <circle key={i} cx={d.x} cy={d.y} r={d.r} fill="var(--ring-planet)" />
      ))}
    </g>
  );
}
