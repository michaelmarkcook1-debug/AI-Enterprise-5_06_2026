// Top-level "Exposure map" tab.
//
// Re-exports the existing investor-tools exposure-map page (which itself
// reuses the canonical implementation under /app/investing/exposure-map)
// so all three routes render the same surface without duplication.

import ExposureMapPage from "@/app/investing/exposure-map/page";

export const dynamic = "force-dynamic";
export default ExposureMapPage;
