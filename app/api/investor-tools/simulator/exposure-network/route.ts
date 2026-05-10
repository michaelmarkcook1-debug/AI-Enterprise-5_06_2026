import { getInvestmentProvider, listIndirectExposureScores } from "@/lib/investing/intelligence";

export const dynamic = "force-dynamic";

const VENDOR_COLOURS: Record<string, string> = {
  MSFT: "#2563eb",
  AMZN: "#d97706",
  GOOGL: "#16a34a",
  NVDA: "#0f766e",
  ORCL: "#dc2626",
  ASML: "#7c3aed",
};

export async function GET() {
  const edges = listIndirectExposureScores().map((edge) => {
    const lineColor = VENDOR_COLOURS[edge.publicTicker] ?? "#2f5d50";
    const lineWidth = 1 + edge.exposureStrength * 7;
    const opacity = 0.25 + edge.confidence * 0.7;
    const lineStyle = edge.confidence >= 0.65 ? "solid" : edge.confidence >= 0.45 ? "dashed" : "dotted";

    return {
      ...edge,
      sourceVendorId: edge.publicTicker,
      sourceVendorName: getInvestmentProvider(edge.publicTicker.toLowerCase())?.name ?? edge.publicTicker,
      targetVendorId: edge.privateProviderId,
      targetVendorName: getInvestmentProvider(edge.privateProviderId)?.name ?? edge.privateProviderId,
      evidenceStatus: edge.confidence >= 0.65 ? "documented" : edge.confidence >= 0.45 ? "estimated" : "inferred",
      lineColor,
      lineStyle,
      lineWidth,
      opacity,
      warning: "Indirect exposure is not direct ownership.",
    };
  });

  return Response.json({
    edges,
    legend: {
      colour: "public/top vendor",
      thickness: "exposure strength",
      opacity: "evidence confidence",
      solid: "documented or stronger evidence",
      dashed: "estimated/inferred evidence",
      dotted: "low-confidence evidence",
    },
    dataStatus: "seed",
  });
}
