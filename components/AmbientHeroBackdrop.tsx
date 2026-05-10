"use client";

import Image from "next/image";
import { usePathname } from "next/navigation";
import { usePortalTheme } from "@/lib/use-theme";

/**
 * Subtle full-app backdrop that embeds the AI Enterprise hero behind every
 * page. Suppressed on `/` because the home shell renders its own foreground
 * hero. The image is heavily blurred + low-opacity so it acts as ambient
 * brand colour, never competing with content.
 *
 * Pointer-events disabled and z-index 0 so it cannot intercept clicks. The
 * page chrome (TopNav, GlobalFooter) and main content sit above it via
 * normal block-flow stacking.
 */
export default function AmbientHeroBackdrop() {
  const pathname = usePathname();
  const [theme] = usePortalTheme();

  // Skip on the home shell — it already paints a full hero.
  if (pathname === "/") return null;

  // Always render the dark homescreen hero, in both light and dark modes —
  // its cream-on-navy orbital atom gives the whole app a consistent
  // AI Enterprise brand undertone. Opacity tuned so content stays readable.
  const src = "/brand/ai-enterprise-dark.png";
  const opacity = theme === "dark" ? 0.18 : 0.08;

  return (
    <div
      aria-hidden
      className="pointer-events-none fixed inset-0 z-0 overflow-hidden"
      style={{ contain: "strict" }}
    >
      <Image
        key={src}
        src={src}
        alt=""
        fill
        priority={false}
        sizes="100vw"
        style={{
          objectFit: "cover",
          objectPosition: "center",
          filter: "blur(80px) saturate(0.9)",
          transform: "scale(1.25)",
          opacity,
        }}
      />
      {/* Soft tint so the backdrop never tips into "noisy". */}
      <div
        className="absolute inset-0"
        style={{
          background:
            theme === "dark"
              ? "linear-gradient(180deg, rgba(7,24,39,0.72) 0%, rgba(7,24,39,0.92) 100%)"
              : "linear-gradient(180deg, rgba(247,248,245,0.86) 0%, rgba(247,248,245,0.94) 100%)",
        }}
      />
    </div>
  );
}
