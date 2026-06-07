// Live macro-economic signal fetcher.
// ────────────────────────────────────
// Fetches real FRED + GDELT data to replace seed market signals.
// FRED API key is available in env. GDELT is free, no key.
// Falls back gracefully to seed data on any error.

import { fredConnector } from "../connectors/fred";
import { gdeltConnector } from "../connectors/gdelt";

export interface LiveMacroSignal {
  source: "fred" | "gdelt";
  label: string;
  value: number | string;
  date: string;
  fetchedAt: string;
  confidence: number;
}

/**
 * Fetch key macro indicators from FRED.
 * Series: VIX (VIXCLS), AI interest (proxy via NASDAQ: NASDAQCOM),
 * US GDP (GDP), Unemployment (UNRATE).
 */
export async function fetchFredSignals(): Promise<LiveMacroSignal[]> {
  const fetchedAt = new Date().toISOString();
  const signals: LiveMacroSignal[] = [];

  const series = [
    { id: "VIXCLS", label: "VIX — Market Fear Index" },
    { id: "NASDAQCOM", label: "NASDAQ Composite" },
    { id: "UNRATE", label: "US Unemployment Rate" },
    { id: "CPIAUCSL", label: "US CPI (Inflation)" },
  ];

  for (const s of series) {
    try {
      const result = await fredConnector.fetch({
        seriesId: s.id,
      });
      if (result.ok && result.records.length > 0) {
        const record = result.records[0];
        // FredRecord has .observations[]; take the last one as the most recent
        const obs = record.observations;
        const latest = obs.length > 0 ? obs[obs.length - 1] : null;
        if (latest) {
          signals.push({
            source: "fred",
            label: s.label,
            value: latest.value ?? "—",
            date: latest.date,
            fetchedAt,
            confidence: 90,
          });
        }
      }
    } catch {
      // Skip this series on error
    }
  }

  return signals;
}

/**
 * Fetch AI-related news volume from GDELT.
 * Uses the GDELT DOC API to count articles mentioning "artificial intelligence"
 * in the last 24 hours — a proxy for media attention intensity.
 */
export async function fetchGdeltAiVolume(): Promise<LiveMacroSignal | null> {
  try {
    const result = await gdeltConnector.fetch({
      query: "artificial intelligence enterprise",
      mode: "ArtList",
      maxRecords: 1,
    });
    if (result.ok) {
      return {
        source: "gdelt",
        label: "AI Media Attention (GDELT article volume)",
        value: result.recordCount,
        date: new Date().toISOString().slice(0, 10),
        fetchedAt: new Date().toISOString(),
        confidence: 70,
      };
    }
  } catch {
    // GDELT unavailable
  }
  return null;
}

/**
 * Fetch all live macro signals. Returns whatever succeeds.
 */
export async function fetchAllMacroSignals(): Promise<LiveMacroSignal[]> {
  const [fred, gdelt] = await Promise.all([
    fetchFredSignals().catch(() => [] as LiveMacroSignal[]),
    fetchGdeltAiVolume().catch(() => null),
  ]);

  const all = [...fred];
  if (gdelt) all.push(gdelt);
  return all;
}
