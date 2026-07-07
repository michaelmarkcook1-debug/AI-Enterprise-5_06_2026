// Procurement-pack PDF rendering. Every string/number here comes straight off
// ProcurementPackData (lib/export/procurement-pack.ts) — this file only lays
// it out, it never computes a score, band, or flag itself. Deterministic: no
// Date.now()/Math.random(), creationDate/modificationDate are pinned to the
// pack's own generatedAt so regenerating from identical data produces
// byte-identical output.

import { Document, Page, View, Text, StyleSheet, renderToBuffer } from "@react-pdf/renderer";
import type { ProcurementPackData, PackVendorRow, PackDomainRow, PackCitation } from "./procurement-pack";
import type { EvidenceGrade } from "../types";

const INK = "#13294b";
const MUTED = "#5e6b7e";
const GOLD = "#b08d2f";
const AMBER = "#92620a";
const RULE = "#d9d2bd";

const styles = StyleSheet.create({
  page: { padding: 40, fontSize: 9.5, fontFamily: "Helvetica", color: INK, lineHeight: 1.4 },
  kicker: { fontSize: 8, letterSpacing: 1.5, color: GOLD, fontFamily: "Helvetica-Bold" },
  h1: { fontSize: 22, fontFamily: "Helvetica-Bold", marginTop: 6, marginBottom: 10 },
  h2: { fontSize: 13, fontFamily: "Helvetica-Bold", marginBottom: 6 },
  h3: { fontSize: 11, fontFamily: "Helvetica-Bold", marginBottom: 3 },
  muted: { color: MUTED },
  small: { fontSize: 8.5 },
  rule: { borderBottomWidth: 1, borderBottomColor: RULE, marginVertical: 10 },
  row: { flexDirection: "row", justifyContent: "space-between" },
  metaBlock: { marginTop: 18, borderTopWidth: 1, borderTopColor: RULE, paddingTop: 10 },
  metaLine: { flexDirection: "row", marginBottom: 3 },
  metaLabel: { width: 110, color: MUTED },
  metaValue: { flex: 1 },
  summaryHeaderRow: { flexDirection: "row", borderBottomWidth: 1, borderBottomColor: INK, paddingBottom: 4, marginBottom: 4 },
  summaryRow: { flexDirection: "row", borderBottomWidth: 0.5, borderBottomColor: RULE, paddingVertical: 4 },
  colRank: { width: 24 },
  colVendor: { flex: 1 },
  colNum: { width: 64, textAlign: "right" },
  domainBlock: { marginBottom: 9, paddingBottom: 8, borderBottomWidth: 0.5, borderBottomColor: RULE },
  domainHeaderRow: { flexDirection: "row", justifyContent: "space-between", alignItems: "flex-start" },
  domainName: { fontFamily: "Helvetica-Bold", fontSize: 10 },
  scoreNum: { fontFamily: "Helvetica-Bold", fontSize: 12 },
  badge: { fontSize: 7.5, paddingHorizontal: 4, paddingVertical: 2, borderRadius: 2, fontFamily: "Helvetica-Bold" },
  badgeInsufficient: { backgroundColor: "#f6f1e3", color: MUTED },
  badgeLowConf: { backgroundColor: "#fdecc8", color: AMBER },
  citationLine: { fontSize: 8, color: MUTED, marginTop: 1.5 },
  footer: { position: "absolute", bottom: 24, left: 40, right: 40, fontSize: 7.5, color: MUTED, borderTopWidth: 0.5, borderTopColor: RULE, paddingTop: 4, flexDirection: "row", justifyContent: "space-between" },
});

function fmtDate(iso: string | null): string {
  if (!iso) return "—";
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString("en-GB", { day: "2-digit", month: "short", year: "numeric" });
}

/** Mirrors components/intelligence-ui.tsx's EvidenceBadge label mapping exactly. */
function gradeLabel(grade: EvidenceGrade): string {
  const label = grade === "E5" || grade === "E4" ? "verified" : grade === "E3" ? "tested" : grade === "E2" ? "documented" : "inferred";
  return `${grade} ${label}`;
}

function Footer({ pack }: { pack: ProcurementPackData }) {
  return (
    <View style={styles.footer} fixed>
      <Text>{pack.title} — procurement pack</Text>
      <Text render={({ pageNumber, totalPages }) => `Page ${pageNumber} of ${totalPages}`} />
    </View>
  );
}

function CoverPage({ pack }: { pack: ProcurementPackData }) {
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.kicker}>PROCUREMENT PACK</Text>
      <Text style={styles.h1}>{pack.title}</Text>
      {pack.categoryName && <Text style={styles.muted}>{pack.categoryName}</Text>}

      <View style={styles.metaBlock}>
        <View style={styles.metaLine}>
          <Text style={styles.metaLabel}>Vendors covered</Text>
          <Text style={styles.metaValue}>{pack.vendors.length}</Text>
        </View>
        <View style={styles.metaLine}>
          <Text style={styles.metaLabel}>Weighting used</Text>
          <Text style={styles.metaValue}>
            {pack.weightingLabel}
            {pack.weightingIsDefault ? " (same as framework default)" : " — differs from framework default; see each vendor page"}
          </Text>
        </View>
        <View style={styles.metaLine}>
          <Text style={styles.metaLabel}>Evidence as of</Text>
          <Text style={styles.metaValue}>{fmtDate(pack.asOfDate)}</Text>
        </View>
        <View style={styles.metaLine}>
          <Text style={styles.metaLabel}>Generated</Text>
          <Text style={styles.metaValue}>{fmtDate(pack.generatedAt)}</Text>
        </View>
      </View>

      <View style={styles.metaBlock}>
        <Text style={[styles.small, styles.muted]}>
          Every score in this pack is read directly from reviewed, source-backed evidence — never estimated or
          inferred to fill a gap. A domain with no reviewed evidence prints &quot;insufficient evidence,&quot; never a
          blank or a guessed number. Weighting changes only the composite ranking; it never changes a domain&apos;s
          underlying score.
        </Text>
      </View>
    </Page>
  );
}

function SummaryPage({ pack }: { pack: ProcurementPackData }) {
  const ranked = [...pack.vendors].sort((a, b) => b.composite - a.composite);
  return (
    <Page size="A4" style={styles.page}>
      <Text style={styles.kicker}>SUMMARY</Text>
      <Text style={styles.h2}>Composite ranking</Text>
      <Text style={[styles.small, styles.muted, { marginBottom: 10 }]}>
        Weighted 0–5 composite under &quot;{pack.weightingLabel}&quot;, coverage-discounted. Full per-domain detail on
        each vendor&apos;s page.
      </Text>

      <View style={styles.summaryHeaderRow}>
        <Text style={[styles.colRank, styles.small, { fontFamily: "Helvetica-Bold" }]}>#</Text>
        <Text style={[styles.colVendor, styles.small, { fontFamily: "Helvetica-Bold" }]}>Vendor</Text>
        <Text style={[styles.colNum, styles.small, { fontFamily: "Helvetica-Bold" }]}>Composite /5</Text>
        <Text style={[styles.colNum, styles.small, { fontFamily: "Helvetica-Bold" }]}>Coverage</Text>
        <Text style={[styles.colNum, styles.small, { fontFamily: "Helvetica-Bold" }]}>Confidence</Text>
      </View>
      {ranked.map((v, i) => (
        <View key={v.vendorId} style={styles.summaryRow}>
          <Text style={styles.colRank}>{i + 1}</Text>
          <Text style={styles.colVendor}>{v.vendorName}{v.note ? `  —  ${v.note}` : ""}</Text>
          <Text style={styles.colNum}>{v.composite.toFixed(2)}</Text>
          <Text style={styles.colNum}>{Math.round(v.coverage * 100)}%</Text>
          <Text style={styles.colNum}>{v.confidence}%</Text>
        </View>
      ))}

      <View style={styles.metaBlock}>
        <Text style={[styles.small, styles.muted]}>{pack.methodologyNote}</Text>
      </View>
    </Page>
  );
}

function Citation({ c }: { c: PackCitation }) {
  return (
    <View style={styles.citationLine} wrap={false}>
      <Text>
        {gradeLabel(c.evidenceGrade)} · {c.sourceUrl} · {fmtDate(c.capturedAt)}
      </Text>
    </View>
  );
}

function DomainBlock({ d }: { d: PackDomainRow }) {
  if (d.state === "insufficient_evidence") {
    return (
      <View style={styles.domainBlock} wrap={false}>
        <View style={styles.domainHeaderRow}>
          <Text style={styles.domainName}>{d.label}</Text>
          <Text style={[styles.badge, styles.badgeInsufficient]}>Insufficient evidence</Text>
        </View>
        <Text style={[styles.small, styles.muted, { marginTop: 2 }]}>
          Weight in this pack: {d.weightPct}% (framework default: {d.defaultWeightPct}%). No reviewed evidence — this
          domain contributes zero to the composite while still counting toward coverage.
        </Text>
      </View>
    );
  }
  return (
    <View style={styles.domainBlock}>
      <View style={styles.domainHeaderRow}>
        <View>
          <Text style={styles.domainName}>{d.label}</Text>
          <Text style={[styles.small, styles.muted]}>{d.bandText}</Text>
        </View>
        <View style={{ alignItems: "flex-end" }}>
          <Text style={styles.scoreNum}>{d.score!.toFixed(1)}/5</Text>
          {d.lowConfidence && <Text style={[styles.badge, styles.badgeLowConf]}>Low confidence</Text>}
        </View>
      </View>
      <Text style={[styles.small, { marginTop: 2 }]}>
        Weight in this pack: {d.weightPct}% (framework default: {d.defaultWeightPct}%) · Confidence {d.confidence}% ·{" "}
        {d.evidenceCount} reviewed {d.evidenceCount === 1 ? "source" : "sources"}
      </Text>
      {d.citations.length > 0 ? (
        d.citations.map((c) => <Citation key={c.sourceUrl} c={c} />)
      ) : (
        <Text style={[styles.citationLine, { fontStyle: "italic" }]}>reviewed — source on file</Text>
      )}
    </View>
  );
}

function VendorPage({ pack, vendor }: { pack: ProcurementPackData; vendor: PackVendorRow }) {
  return (
    <Page size="A4" style={styles.page} wrap>
      <Text style={styles.kicker}>VENDOR</Text>
      <View style={styles.row}>
        <Text style={styles.h2}>{vendor.vendorName}</Text>
        <Text style={{ fontFamily: "Helvetica-Bold", fontSize: 13 }}>{vendor.composite.toFixed(2)}/5</Text>
      </View>
      {vendor.note && <Text style={[styles.small, styles.muted, { marginBottom: 4 }]}>Note: {vendor.note}</Text>}
      <Text style={styles.small}>
        Coverage {Math.round(vendor.coverage * 100)}% ({vendor.scoredCount}/{vendor.domainTotal} domains evidenced) ·
        Confidence {vendor.confidence}% · {vendor.totalEvidenceRows} reviewed, source-backed evidence{" "}
        {vendor.totalEvidenceRows === 1 ? "record" : "records"}
      </Text>
      <Text style={[styles.small, styles.muted, { marginTop: 2, marginBottom: 10 }]}>
        Weighting used: {pack.weightingLabel}
        {pack.weightingIsDefault ? " (same as framework default — see per-domain weight below)" : ""}. Weighting
        changes only the composite score above; it never changes the 0–5 domain scores below.
      </Text>

      <View style={styles.rule} />

      {vendor.domains.map((d) => (
        <DomainBlock key={d.domain} d={d} />
      ))}

      <Footer pack={pack} />
    </Page>
  );
}

function ProcurementPackDocument({ pack }: { pack: ProcurementPackData }) {
  const genDate = new Date(pack.generatedAt);
  return (
    <Document
      title={`${pack.title} — procurement pack`}
      creator="AI Enterprise"
      producer="AI Enterprise"
      creationDate={genDate}
      modificationDate={genDate}
    >
      <CoverPage pack={pack} />
      <SummaryPage pack={pack} />
      {pack.vendors.map((v) => (
        <VendorPage key={v.vendorId} pack={pack} vendor={v} />
      ))}
    </Document>
  );
}

/** Deterministic given identical pack data — no wall-clock or RNG use anywhere
 *  in this module; PDF metadata (creation/mod date) is pinned to pack.generatedAt. */
export async function renderProcurementPackPdf(pack: ProcurementPackData): Promise<Buffer> {
  return renderToBuffer(<ProcurementPackDocument pack={pack} />);
}
