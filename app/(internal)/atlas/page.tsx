import type { Metadata } from "next";
import { adminPageGuard } from "@/components/admin/AdminPageGuard";
import AIAtlasClient from "@/components/atlas/AIAtlasClient";

export const metadata: Metadata = {
  title: "AI Atlas — AI Enterprise",
  description: "Interactive AI ecosystem map showing vendor platforms, model providers, infrastructure, hardware, dependencies and CIO buying implications.",
};

export default async function AtlasPage() {
  const locked = await adminPageGuard();
  if (locked) return locked;
  return <AIAtlasClient />;
}
