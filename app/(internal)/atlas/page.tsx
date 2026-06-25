import type { Metadata } from "next";
import AIAtlasClient from "@/components/atlas/AIAtlasClient";

export const metadata: Metadata = {
  title: "AI Atlas — AI Enterprise",
  description: "Interactive AI ecosystem map showing vendor platforms, model providers, infrastructure, hardware, dependencies and CIO buying implications.",
};

export default function AtlasPage() {
  return <AIAtlasClient />;
}
