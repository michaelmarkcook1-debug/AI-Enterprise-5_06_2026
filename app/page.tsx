import type { Metadata } from "next";
import AIEnterpriseShell from "@/components/AIEnterpriseShell";

export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

export default function Home() {
  return <AIEnterpriseShell />;
}
