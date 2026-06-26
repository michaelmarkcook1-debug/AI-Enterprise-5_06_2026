import type { ReactNode } from "react";
import { redirect } from "next/navigation";
import { getMember } from "@/lib/member/auth";
import MemberNav from "@/components/member/MemberNav";
import PublicFooter from "@/components/public/PublicFooter";

// Gated member shell. Server-guarded: an unauthenticated visitor is redirected
// to /signin before any member page renders. Deliberately LEAN — a slim nav +
// the shared footer, NO TopNav freshness poller / NotLiveBanner. Reading the
// session cookie makes this dynamic (member pages are personalised anyway).
export const dynamic = "force-dynamic";

export default async function MemberLayout({ children }: { children: ReactNode }) {
  const member = await getMember();
  if (!member) redirect("/signin");

  return (
    <div className="relative z-10 flex min-h-screen flex-col">
      <MemberNav email={member.email} />
      <div className="flex-1">{children}</div>
      <PublicFooter />
    </div>
  );
}
