import Link from "next/link";

export default function Methodology() {
  return (
    <div className="min-h-screen bg-white dark:bg-[#071827] text-[#15263c] dark:text-[#eef3f8]">
      <main className="mx-auto max-w-3xl px-6 py-16">
        <Link href="/dashboard" className="text-sm text-[#4c5d75] hover:underline">← Back</Link>
        <h1 className="mt-6 text-4xl font-semibold tracking-tight">Methodology</h1>
        <p className="mt-4 text-[#3f5068] dark:text-[#a7bacd]">
          The engine implements the <strong>Enterprise AI Assessment Framework v2.0</strong> as the methodology backbone, surfaced through six pillars.
        </p>

        <Section title="Six pillars (default weights)">
          <ul className="list-disc pl-6 text-sm text-[#2e3f57] dark:text-[#c2d1e0] space-y-1">
            <li>Business Fit — 15%</li>
            <li>Enterprise Control — 25%</li>
            <li>Reliability &amp; Safety — 15%</li>
            <li>Integration &amp; Operations — 15%</li>
            <li>Vendor Resilience — 15%</li>
            <li>Market Strength — 15%</li>
          </ul>
          <p className="mt-3 text-sm text-[#3f5068] dark:text-[#a7bacd]">
            Pillar weights shift dynamically by industry, data sensitivity, risk tolerance, autonomy appetite and budget sensitivity.
          </p>
        </Section>

        <Section title="Evidence grading (E0–E5)">
          <div className="mt-2 grid grid-cols-1 gap-2 text-sm">
            {[
              ["E0", "0.0", "No evidence"],
              ["E1", "0.4", "Vendor claim only"],
              ["E2", "0.6", "Public documentation"],
              ["E3", "0.75", "Public test / sandbox / API verification"],
              ["E4", "0.9", "Production customer evidence"],
              ["E5", "1.0", "Independent audit / verified benchmark"],
            ].map(([g, m, d]) => (
              <div key={g} className="grid grid-cols-12 border-b border-[#ece4d0] dark:border-[#1d3a57] py-2">
                <div className="col-span-2 font-mono">{g}</div>
                <div className="col-span-2">×{m}</div>
                <div className="col-span-8 text-[#3f5068] dark:text-[#a7bacd]">{d}</div>
              </div>
            ))}
          </div>
        </Section>

        <Section title="Final score formula">
          <pre className="rounded-lg bg-[#f6f1e3] dark:bg-[#0c2238] p-4 text-xs overflow-x-auto">{`Final Score =
  Σ(Pillar Score × Dynamic Context Weight × Evidence Confidence)
  + Strategic Fit Bonus
  + Sector Adoption Fit Bonus
  − Risk Penalties
  − Missing Evidence Penalty
  − Adoption Friction Penalty`}</pre>
        </Section>

        <Section title="Risk engine">
          <p className="text-sm text-[#3f5068] dark:text-[#a7bacd]">
            Fatal blockers exclude vendors in incompatible contexts. Severe / moderate risks apply penalties scaled by the user&apos;s risk tolerance. Industry-critical control areas with no E3+ evidence trigger severe risk (or fatal in regulated industries).
          </p>
        </Section>
      </main>
    </div>
  );
}

function Section({ title, children }: { title: string; children: React.ReactNode }) {
  return (
    <section className="mt-10">
      <h2 className="text-xl font-semibold">{title}</h2>
      <div className="mt-3">{children}</div>
    </section>
  );
}
