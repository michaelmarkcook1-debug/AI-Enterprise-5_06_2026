import type { Metadata } from "next";
import { redirect } from "next/navigation";

export const metadata: Metadata = {
  title: "Evolution — AI Enterprise",
  description: "AI Enterprise ontology evolution: Q.U.A.D spine, entity categories, ecosystem navigator, stack assessments, and robust entity universe.",
};

export const dynamic = "force-dynamic";

export default function EvolutionPage() {
  redirect("/atlas");
}
