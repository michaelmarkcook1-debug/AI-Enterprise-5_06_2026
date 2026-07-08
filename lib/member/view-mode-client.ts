// Client-safe view-mode constants — deliberately split out of view-mode.ts.
// That file also exports resolveHomeViewMode/shouldShowViewToggle, which pull
// in getMember() -> lib/prisma.ts -> @prisma/adapter-pg -> pg -> Node builtins
// (tls, node:module). Any client component importing so much as a constant
// from that file drags the WHOLE module graph into the browser bundle and
// breaks the build. Client components (AppNav, ViewModeToggle) must import
// from HERE, never from view-mode.ts directly.

export const VIEW_MODE_COOKIE = "ae_view_mode";
export type HomeViewMode = "visitor" | "buyer";
