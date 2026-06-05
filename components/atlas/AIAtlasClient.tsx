"use client";

import { useMemo, useState } from "react";
import Link from "next/link";

const LAYERS = [
  "All",
  "Platform Vendors",
  "Model Providers",
  "Application Vendors",
  "Infrastructure",
  "Investors",
  "Hardware",
  "Cloud / Hosting",
  "Sovereign AI",
  "Dependencies",
] as const;

type Layer = (typeof LAYERS)[number];
type EntityTone = "platform" | "model" | "application" | "hardware" | "infrastructure" | "investor";
type RelationshipTone = "investment" | "hardware" | "dependency" | "hosting";

interface AtlasEntity {
  name: string;
  role: string;
  categories: string[];
  leadership: number;
  reach: number;
  risk: "Low" | "Medium" | "High";
  confidence: "Low" | "Medium" | "High";
  x: number;
  y: number;
  tone: EntityTone;
  cio: string;
  buying: string[];
}

const ENTITIES: Record<string, AtlasEntity> = {
  microsoft: {
    name: "Microsoft",
    role: "Platform Vendor",
    categories: ["Application Vendor", "Investor", "Infrastructure Player", "Model Provider", "Cloud / Hosting"],
    leadership: 94,
    reach: 96,
    risk: "High",
    confidence: "High",
    x: 48,
    y: 27,
    tone: "platform",
    cio: "Microsoft is best understood as the enterprise AI distribution and governance layer. Its power comes from Azure, Copilot, GitHub, identity/security, OpenAI exposure and enterprise productivity reach.",
    buying: [
      "Platform: Azure AI Foundry, Fabric, Entra, Purview",
      "Applications: Microsoft 365 Copilot, GitHub Copilot, Security Copilot",
      "Models: Phi + hosted OpenAI / Mistral / Llama exposure",
      "Infrastructure: Azure data centres + NVIDIA dependency",
      "Risk: OpenAI dependency, GPU concentration, lock-in",
    ],
  },
  openai: {
    name: "OpenAI",
    role: "Model Provider",
    categories: ["Application Vendor"],
    leadership: 92,
    reach: 91,
    risk: "Medium",
    confidence: "High",
    x: 34,
    y: 20,
    tone: "model",
    cio: "OpenAI is the flagship model/application provider, but its enterprise scale is deeply tied to Microsoft distribution, NVIDIA compute and broader hosting capacity.",
    buying: [
      "Models: GPT family, o-series, multimodal models",
      "Applications: ChatGPT, Deep Research, agents",
      "Distribution: Azure OpenAI + direct API",
      "Infrastructure: Microsoft, Oracle, NVIDIA",
      "Risk: cost governance and infrastructure concentration",
    ],
  },
  anthropic: {
    name: "Anthropic",
    role: "Model Provider",
    categories: ["Application Vendor"],
    leadership: 90,
    reach: 84,
    risk: "Medium",
    confidence: "High",
    x: 65,
    y: 20,
    tone: "model",
    cio: "Anthropic is a high-trust frontier model provider with enterprise and coding strength, but its route to scale remains cloud-dependent through AWS and Google.",
    buying: [
      "Models: Claude Opus, Sonnet, Haiku",
      "Distribution: API, cloud marketplaces",
      "Infrastructure: AWS, Google, NVIDIA",
      "Strength: controlled reasoning, coding, safety perception",
      "Risk: narrower application/platform surface",
    ],
  },
  nvidia: {
    name: "NVIDIA",
    role: "Hardware Provider",
    categories: ["Infrastructure Player", "Investor"],
    leadership: 96,
    reach: 98,
    risk: "High",
    confidence: "High",
    x: 50,
    y: 76,
    tone: "hardware",
    cio: "NVIDIA is the hidden concentration point of the AI economy. Most frontier model and infrastructure strategies inherit NVIDIA supply, cost and ecosystem exposure.",
    buying: [
      "Hardware: H100, H200, Blackwell",
      "Software: CUDA",
      "Infrastructure leverage: GPU clouds, hyperscalers",
      "Investor/partner influence across ecosystem",
      "Risk: supply chain concentration",
    ],
  },
  aws: {
    name: "AWS",
    role: "Platform Vendor",
    categories: ["Cloud / Hosting", "Investor", "Infrastructure Player"],
    leadership: 86,
    reach: 88,
    risk: "Medium",
    confidence: "High",
    x: 75,
    y: 43,
    tone: "platform",
    cio: "AWS is a deployment surface and AI marketplace. It matters because it hosts and distributes model choice rather than relying on a single owned frontier model.",
    buying: [
      "Platform: Bedrock, SageMaker",
      "Investment: Anthropic exposure",
      "Infrastructure: AWS cloud, Trainium",
      "Model access: Anthropic, Meta, Mistral and others",
      "Risk: platform complexity and vendor sprawl",
    ],
  },
  google: {
    name: "Google",
    role: "Platform Vendor",
    categories: ["Model Provider", "Hardware Provider", "Cloud / Hosting"],
    leadership: 88,
    reach: 87,
    risk: "Medium",
    confidence: "High",
    x: 24,
    y: 48,
    tone: "platform",
    cio: "Google combines Gemini, Vertex AI, Google Cloud, TPU and data assets. Its question is enterprise execution and buyer mindshare relative to Microsoft and AWS.",
    buying: [
      "Models: Gemini, Imagen, Veo",
      "Platform: Vertex AI, Google Cloud",
      "Hardware: TPU",
      "Distribution: Workspace, Android, Cloud",
      "Risk: enterprise consistency",
    ],
  },
  mistral: {
    name: "Mistral AI",
    role: "Model Provider",
    categories: ["Sovereign AI", "Open-Source Ecosystem"],
    leadership: 78,
    reach: 69,
    risk: "Medium",
    confidence: "Medium",
    x: 20,
    y: 69,
    tone: "model",
    cio: "Mistral gives European optionality, open model pressure and cost competition.",
    buying: [
      "Models: Large, Medium, Small, Codestral, Magistral",
      "Sovereign value: EU-aligned AI option",
      "Distribution: cloud partners",
      "Risk: scale versus US hyperscaler-backed providers",
    ],
  },
  meta: {
    name: "Meta",
    role: "Model Provider",
    categories: ["Open-Source Ecosystem", "Application Vendor"],
    leadership: 82,
    reach: 82,
    risk: "Medium",
    confidence: "High",
    x: 79,
    y: 65,
    tone: "model",
    cio: "Meta matters because Llama broadens open-weight deployment and platform optionality.",
    buying: [
      "Models: Llama family",
      "Distribution: open ecosystem + cloud hosts",
      "Applications: Meta AI surfaces",
      "Infrastructure: NVIDIA-heavy",
      "Risk: enterprise support model",
    ],
  },
  oracle: {
    name: "Oracle",
    role: "Infrastructure Player",
    categories: ["Cloud / Hosting"],
    leadership: 72,
    reach: 68,
    risk: "Medium",
    confidence: "Medium",
    x: 57,
    y: 61,
    tone: "infrastructure",
    cio: "Oracle is increasingly relevant as AI infrastructure and enterprise cloud capacity.",
    buying: [
      "Cloud hosting",
      "OpenAI infrastructure exposure",
      "Enterprise data estate",
      "Risk: hyperscaler competition",
    ],
  },
  coreweave: {
    name: "CoreWeave",
    role: "Infrastructure Player",
    categories: ["Cloud / Hosting"],
    leadership: 73,
    reach: 74,
    risk: "High",
    confidence: "Medium",
    x: 40,
    y: 67,
    tone: "infrastructure",
    cio: "CoreWeave represents specialist GPU cloud capacity and NVIDIA exposure.",
    buying: [
      "GPU cloud",
      "NVIDIA concentration",
      "Model training/inference capacity",
      "Risk: supply concentration",
    ],
  },
  tsmc: {
    name: "TSMC",
    role: "Hardware Provider",
    categories: ["Infrastructure Player"],
    leadership: 91,
    reach: 89,
    risk: "High",
    confidence: "High",
    x: 65,
    y: 82,
    tone: "hardware",
    cio: "TSMC is the semiconductor manufacturing dependency behind much of advanced AI hardware.",
    buying: [
      "Chip manufacturing",
      "NVIDIA/AMD/custom silicon exposure",
      "Geopolitical risk concentration",
    ],
  },
  deepseek: {
    name: "DeepSeek",
    role: "Model Provider",
    categories: ["Sovereign AI"],
    leadership: 77,
    reach: 64,
    risk: "High",
    confidence: "Medium",
    x: 30,
    y: 82,
    tone: "model",
    cio: "DeepSeek is a strategic sovereign and cost-pressure model provider with geopolitical and governance caveats.",
    buying: [
      "Models: R1, V3",
      "Sovereign AI dynamics",
      "Cost pressure on Western frontier models",
      "Risk: policy and trust",
    ],
  },
};

const RELATIONSHIPS: Array<[string, string, RelationshipTone]> = [
  ["microsoft", "openai", "investment"],
  ["microsoft", "nvidia", "hardware"],
  ["microsoft", "aws", "dependency"],
  ["microsoft", "mistral", "hosting"],
  ["microsoft", "meta", "hosting"],
  ["openai", "nvidia", "hardware"],
  ["openai", "oracle", "dependency"],
  ["anthropic", "aws", "investment"],
  ["anthropic", "google", "dependency"],
  ["aws", "nvidia", "hardware"],
  ["google", "nvidia", "hardware"],
  ["nvidia", "tsmc", "hardware"],
  ["coreweave", "nvidia", "hardware"],
  ["mistral", "google", "hosting"],
  ["meta", "aws", "hosting"],
  ["deepseek", "nvidia", "hardware"],
];

const SIDE_NAV = [
  { href: "/atlas", label: "AI Atlas" },
  { href: "/query", label: "Query" },
  { href: "/understand", label: "Understand" },
  { href: "/assess", label: "Assess" },
  { href: "/demonstrate", label: "Demonstrate" },
  { href: "/quadrant", label: "Leadership Matrix" },
];

const TONE_STYLES: Record<EntityTone, { border: string; shadow: string; text: string }> = {
  platform: { border: "#39d9c8", shadow: "0 0 24px rgba(57,217,200,0.24)", text: "text-emerald-100" },
  model: { border: "#86a6ff", shadow: "0 0 24px rgba(134,166,255,0.22)", text: "text-sky-100" },
  application: { border: "#b58cff", shadow: "0 0 24px rgba(181,140,255,0.22)", text: "text-violet-100" },
  hardware: { border: "#d9b662", shadow: "0 0 24px rgba(217,182,98,0.24)", text: "text-amber-100" },
  infrastructure: { border: "#75b8ff", shadow: "0 0 24px rgba(117,184,255,0.22)", text: "text-blue-100" },
  investor: { border: "#ffb77a", shadow: "0 0 24px rgba(255,183,122,0.2)", text: "text-orange-100" },
};

const RELATIONSHIP_STROKES: Record<RelationshipTone, { color: string; width: number; opacity: number }> = {
  investment: { color: "#d9b662", width: 2.2, opacity: 0.78 },
  hardware: { color: "#ff8b75", width: 1.9, opacity: 0.74 },
  dependency: { color: "#39d9c8", width: 1.6, opacity: 0.5 },
  hosting: { color: "#2f7684", width: 1.4, opacity: 0.58 },
};

function layerMatches(entity: AtlasEntity, activeLayer: Layer) {
  if (activeLayer === "All" || activeLayer === "Dependencies") return true;
  if (activeLayer === "Platform Vendors") return entity.role === "Platform Vendor" || entity.categories.includes("Platform Vendor");
  if (activeLayer === "Model Providers") return entity.role === "Model Provider" || entity.categories.includes("Model Provider");
  if (activeLayer === "Application Vendors") return entity.role === "Application Vendor" || entity.categories.includes("Application Vendor");
  if (activeLayer === "Infrastructure") return entity.role === "Infrastructure Player" || entity.categories.includes("Infrastructure Player");
  if (activeLayer === "Investors") return entity.role === "Investor" || entity.categories.includes("Investor");
  if (activeLayer === "Hardware") return entity.role === "Hardware Provider" || entity.categories.includes("Hardware Provider");
  if (activeLayer === "Cloud / Hosting") return entity.role === "Cloud / Hosting" || entity.categories.includes("Cloud / Hosting");
  if (activeLayer === "Sovereign AI") return entity.role === "Sovereign AI" || entity.categories.includes("Sovereign AI");
  return true;
}

function riskTone(risk: AtlasEntity["risk"]) {
  if (risk === "High") return "text-rose-300";
  if (risk === "Medium") return "text-[#d9b662]";
  return "text-emerald-300";
}

function evidenceTone(confidence: AtlasEntity["confidence"]) {
  if (confidence === "High") return "border-emerald-400/30 bg-emerald-400/10 text-emerald-200";
  if (confidence === "Medium") return "border-[#d9b662]/30 bg-[#d9b662]/10 text-[#ffe29a]";
  return "border-rose-400/30 bg-rose-400/10 text-rose-200";
}

function CategoryBars({ entity }: { entity: AtlasEntity }) {
  const bars = [
    ["Platform", entity.role === "Platform Vendor" ? 90 : 35],
    ["Model", entity.role === "Model Provider" ? 88 : entity.categories.includes("Model Provider") ? 62 : 20],
    ["Hardware", entity.role === "Hardware Provider" ? 94 : entity.categories.includes("Hardware Provider") ? 60 : 28],
    ["Investor", entity.categories.includes("Investor") ? 72 : 18],
  ] as const;

  return (
    <div>
      {bars.map(([label, value]) => (
        <div key={label}>
          <div className="mb-1 text-xs font-medium text-[#8aa4b8]">{label}</div>
          <div className="mb-3 h-2.5 overflow-hidden rounded-full bg-[#13263c]">
            <div className="h-full rounded-full bg-[#39d9c8]" style={{ width: `${value}%` }} />
          </div>
        </div>
      ))}
    </div>
  );
}

function DependencyHeat({ selectedId }: { selectedId: string }) {
  const rows = RELATIONSHIPS
    .filter(([a, b]) => a === selectedId || b === selectedId)
    .map(([a, b, relationship]) => {
      const otherId = a === selectedId ? b : a;
      return { entity: ENTITIES[otherId], relationship };
    })
    .filter((row) => row.entity)
    .slice(0, 5);

  if (rows.length === 0) {
    return <div className="rounded-lg border border-[#18364d] bg-[#081624] p-3 text-sm text-[#8aa4b8]">No direct dependency shown.</div>;
  }

  return (
    <div className="grid gap-2">
      {rows.map((row) => (
        <div key={`${row.entity.name}-${row.relationship}`} className="flex items-center justify-between gap-3 rounded-lg border border-[#18364d] bg-[#081624] p-3">
          <span className="text-sm text-[#eff8ff]">{row.entity.name}</span>
          <span className="text-xs font-semibold uppercase tracking-[0.14em] text-[#d9b662]">{row.relationship}</span>
        </div>
      ))}
    </div>
  );
}

function AtlasMap({
  activeLayer,
  selectedId,
  onSelect,
}: {
  activeLayer: Layer;
  selectedId: string;
  onSelect: (id: string) => void;
}) {
  const visibleIds = useMemo(() => {
    return new Set(Object.entries(ENTITIES).filter(([, entity]) => layerMatches(entity, activeLayer)).map(([id]) => id));
  }, [activeLayer]);

  const visibleRelationships = RELATIONSHIPS.filter(([a, b]) => visibleIds.has(a) && visibleIds.has(b));

  return (
    <section className="overflow-hidden rounded-lg border border-[#1a3953] bg-[linear-gradient(180deg,rgba(11,23,39,0.87),rgba(6,16,28,0.8))] p-3 shadow-2xl shadow-black/30">
      <div className="mb-3 flex items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold text-[#eff8ff]">AI Economy Network</h2>
          <p className="mt-1 text-xs text-[#8aa4b8]">
            {activeLayer === "All" ? "All layers visible" : `${activeLayer} layer active`}
          </p>
        </div>
        <span className="rounded border border-[#244a63] px-2 py-1 font-mono text-xs text-[#8aa4b8]">{visibleIds.size} entities</span>
      </div>

      <div className="relative h-[430px] overflow-hidden rounded-lg border border-[#17344d] bg-[radial-gradient(circle_at_50%_50%,#122943_0,#07111e_55%,#030812_100%)] sm:h-[650px]">
        <svg viewBox="0 0 1000 650" className="absolute inset-0 z-10 h-full w-full" role="img" aria-label="AI Enterprise Atlas relationship map">
          <defs>
            <pattern id="functional-atlas-grid" width="32" height="32" patternUnits="userSpaceOnUse">
              <path d="M 32 0 L 0 0 0 32" fill="none" stroke="rgba(138,164,184,0.1)" strokeWidth="1" />
            </pattern>
          </defs>
          <rect width="1000" height="650" fill="url(#functional-atlas-grid)" opacity="0.8" />
          <circle cx="500" cy="325" r="145" fill="none" stroke="rgba(57,217,200,0.16)" strokeDasharray="4 10" />
          <circle cx="500" cy="325" r="250" fill="none" stroke="rgba(217,182,98,0.12)" strokeDasharray="3 12" />
          {visibleRelationships.map(([a, b, relationship]) => {
            const source = ENTITIES[a];
            const target = ENTITIES[b];
            const stroke = RELATIONSHIP_STROKES[relationship];
            return (
              <line
                key={`${a}-${b}-${relationship}`}
                x1={source.x * 10}
                y1={source.y * 6.5}
                x2={target.x * 10}
                y2={target.y * 6.5}
                stroke={stroke.color}
                strokeWidth={stroke.width}
                strokeOpacity={selectedId === a || selectedId === b ? 0.95 : stroke.opacity}
              />
            );
          })}
        </svg>

        <div className="absolute left-1/2 top-1/2 z-20 flex h-28 w-28 -translate-x-1/2 -translate-y-1/2 items-center justify-center rounded-full border border-[#39d9c8] bg-[radial-gradient(circle,#173d48,#0c1f33)] text-center text-sm font-extrabold leading-5 text-[#eff8ff] shadow-[0_0_60px_rgba(57,217,200,0.4)]">
          Enterprise<br />AI
        </div>

        {Object.entries(ENTITIES).filter(([id]) => visibleIds.has(id)).map(([id, entity]) => {
          const selected = id === selectedId;
          const tone = TONE_STYLES[entity.tone];
          return (
            <button
              key={id}
              type="button"
              onClick={() => onSelect(id)}
              className={`absolute z-20 -translate-x-1/2 -translate-y-1/2 rounded-full border bg-[#0e2236] px-3 py-2 text-center text-xs font-semibold text-[#eff8ff] transition hover:border-white hover:shadow-[0_0_34px_rgba(255,255,255,0.35)] sm:text-sm ${selected ? "border-white" : ""}`}
              style={{
                left: `${entity.x}%`,
                top: `${entity.y}%`,
                borderColor: selected ? "#ffffff" : tone.border,
                boxShadow: selected ? "0 0 34px rgba(255,255,255,0.36)" : tone.shadow,
              }}
              aria-pressed={selected}
            >
              <span className={tone.text}>{entity.name}</span>
              <span className="block text-[10px] font-normal text-[#8aa4b8] sm:text-[11px]">{entity.role}</span>
            </button>
          );
        })}
      </div>
    </section>
  );
}

export default function AIAtlasClient() {
  const [selectedId, setSelectedId] = useState("microsoft");
  const [activeLayer, setActiveLayer] = useState<Layer>("All");
  const [searchTerm, setSearchTerm] = useState("");
  const selected = ENTITIES[selectedId] ?? ENTITIES.microsoft;

  function handleSearch(value: string) {
    setSearchTerm(value);
    const query = value.toLowerCase().trim();
    if (!query) return;
    const match = Object.entries(ENTITIES).find(([, entity]) => entity.name.toLowerCase().includes(query));
    if (match) setSelectedId(match[0]);
  }

  function handleExport() {
    const payload = JSON.stringify({ selected: selected.name, layer: activeLayer, entity: selected }, null, 2);
    const url = URL.createObjectURL(new Blob([payload], { type: "application/json" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = `ai-atlas-${selectedId}.json`;
    anchor.click();
    URL.revokeObjectURL(url);
  }

  function handleFullscreen() {
    document.documentElement.requestFullscreen?.().catch(() => {});
  }

  return (
    <main className="min-h-screen bg-[radial-gradient(circle_at_65%_0,#173d62,#050b14_44%,#02050a)] text-[#eff8ff]">
      <div className="mx-auto grid max-w-[1660px] gap-4 px-4 py-5 lg:grid-cols-[250px_minmax(0,1fr)]">
        <aside className="rounded-lg border border-[#1a3953] bg-[#06101b]/90 p-4 lg:sticky lg:top-20 lg:h-[calc(100vh-6rem)]">
          <Link href="/atlas" className="mb-6 flex items-center gap-3">
            <span className="h-9 w-9 rounded-full bg-[radial-gradient(circle,#fff,#39d9c8_33%,#0b5b66)] shadow-[0_0_30px_rgba(57,217,200,0.54)]" />
            <span>
              <span className="block font-semibold text-[#eff8ff]">AI Enterprise</span>
              <span className="block text-xs text-[#8aa4b8]">Atlas-first OS</span>
            </span>
          </Link>
          <nav className="space-y-1 text-sm" aria-label="Atlas navigation">
            {SIDE_NAV.map((item) => (
              <Link
                key={item.href}
                href={item.href}
                aria-current={item.href === "/atlas" ? "page" : undefined}
                className={`block rounded-md border px-3 py-2.5 transition ${
                  item.href === "/atlas"
                    ? "border-[#2e6475] bg-[linear-gradient(90deg,#123649,#0a1827)] text-white"
                    : "border-transparent text-[#8aa4b8] hover:border-[#2e6475] hover:bg-[#0a1827] hover:text-white"
                }`}
              >
                {item.label}
              </Link>
            ))}
          </nav>
          <div className="mt-6 rounded-lg border border-[#1a3953] bg-[#0b1829] p-4">
            <h2 className="text-sm font-semibold text-[#eff8ff]">Atlas-first direction</h2>
            <p className="mt-2 text-xs leading-5 text-[#8aa4b8]">
              Enter through the AI economy map. Rankings and Q.U.A.D become analytical layers, not the whole product.
            </p>
          </div>
        </aside>

        <div className="min-w-0 space-y-4">
          <header className="flex flex-col justify-between gap-4 lg:flex-row lg:items-start">
            <div>
              <h1 className="text-4xl font-semibold tracking-tight text-[#eff8ff] md:text-5xl">AI Atlas™</h1>
              <p className="mt-2 max-w-3xl text-sm leading-6 text-[#8aa4b8]">
                The AI economy, mapped by role, relationship, dependency and market influence.
              </p>
            </div>
            <div className="flex flex-col gap-2 sm:flex-row">
              <input
                value={searchTerm}
                onChange={(event) => handleSearch(event.target.value)}
                placeholder="Search AI economy..."
                className="h-10 min-w-0 rounded-lg border border-[#244a63] bg-[#0d1d30] px-3 text-sm text-white outline-none placeholder:text-[#8aa4b8] focus:border-[#39d9c8] sm:w-64"
                aria-label="Search AI economy"
              />
              <button type="button" onClick={handleFullscreen} className="h-10 rounded-lg border border-[#244a63] bg-[#0d1d30] px-3 text-xs font-semibold text-white hover:border-[#39d9c8]">
                Fullscreen
              </button>
              <button type="button" onClick={handleExport} className="h-10 rounded-lg border border-[#244a63] bg-[#0d1d30] px-3 text-xs font-semibold text-white hover:border-[#39d9c8]">
                Export
              </button>
            </div>
          </header>

          <section className="flex flex-col justify-between gap-4 rounded-lg border border-[#1a3953] bg-[linear-gradient(180deg,rgba(11,23,39,0.87),rgba(6,16,28,0.8))] p-4 shadow-2xl shadow-black/30 lg:flex-row lg:items-center">
            <div>
              <div className="flex flex-wrap gap-2">
                <span className="rounded-full border border-[#2d665d] bg-[#0d332f] px-2.5 py-1 text-xs font-semibold text-[#bffff5]">Live-style mockup</span>
                <span className="rounded-full border border-[#6d5d2c] bg-[#2c2510] px-2.5 py-1 text-xs font-semibold text-[#ffe29a]">Evidence-labelled</span>
              </div>
              <h2 className="mt-3 text-2xl font-semibold tracking-tight text-[#eff8ff]">What are you really buying?</h2>
              <p className="mt-1 max-w-3xl text-sm leading-6 text-[#8aa4b8]">
                Select an entity to expose its models, platforms, applications, investors, hardware and dependency chain.
              </p>
            </div>
            <div className="text-left lg:text-right">
              <div className="font-mono text-4xl font-semibold text-[#39d9c8]">{selected.reach}</div>
              <div className="text-sm text-[#8aa4b8]">ecosystem influence</div>
            </div>
          </section>

          <section className="flex flex-wrap gap-2" aria-label="Atlas layers">
            {LAYERS.map((layer) => {
              const active = layer === activeLayer;
              return (
                <button
                  key={layer}
                  type="button"
                  onClick={() => setActiveLayer(layer)}
                  className={`rounded-full border px-3 py-1.5 text-xs font-semibold transition ${
                    active
                      ? "border-[#39d9c8] bg-[#123c47] text-white"
                      : "border-[#244a63] bg-[#0d1d30] text-[#8aa4b8] hover:border-[#39d9c8] hover:text-white"
                  }`}
                >
                  {layer}
                </button>
              );
            })}
          </section>

          <section className="grid gap-4 xl:grid-cols-[minmax(0,1fr)_360px]">
            <AtlasMap activeLayer={activeLayer} selectedId={selectedId} onSelect={setSelectedId} />
            <aside className="rounded-lg border border-[#1a3953] bg-[linear-gradient(180deg,rgba(11,23,39,0.87),rgba(6,16,28,0.8))] p-4 shadow-2xl shadow-black/30">
              <div className="flex items-center gap-3">
                <span className="grid h-11 w-11 place-items-center rounded-full border border-[#39d9c8] bg-[#133948] font-bold text-[#eff8ff]">{selected.name[0]}</span>
                <div>
                  <h2 className="text-xl font-semibold text-[#eff8ff]">{selected.name}</h2>
                  <p className="text-sm text-[#8aa4b8]">{selected.role}</p>
                </div>
              </div>

              <div className="mt-4 flex flex-wrap gap-2">
                {[selected.role, ...selected.categories].map((category) => (
                  <span key={category} className="rounded-full border border-[#2b5169] px-2 py-1 text-xs text-[#c7d8e4]">{category}</span>
                ))}
              </div>

              <div className="mt-4 grid grid-cols-2 gap-3">
                <div className="rounded-lg border border-[#18364d] bg-[#081624] p-3">
                  <span className="block text-xs text-[#8aa4b8]">Leadership</span>
                  <b className="text-xl text-[#eff8ff]">{selected.leadership}</b>
                </div>
                <div className="rounded-lg border border-[#18364d] bg-[#081624] p-3">
                  <span className="block text-xs text-[#8aa4b8]">Reach</span>
                  <b className="text-xl text-[#eff8ff]">{selected.reach}</b>
                </div>
                <div className="rounded-lg border border-[#18364d] bg-[#081624] p-3">
                  <span className="block text-xs text-[#8aa4b8]">Risk</span>
                  <b className={`text-xl ${riskTone(selected.risk)}`}>{selected.risk}</b>
                </div>
                <div className="rounded-lg border border-[#18364d] bg-[#081624] p-3">
                  <span className="block text-xs text-[#8aa4b8]">Confidence</span>
                  <b className="text-xl text-[#eff8ff]">{selected.confidence}</b>
                </div>
              </div>

              <h3 className="mt-5 text-sm font-semibold text-[#eff8ff]">What this means for a CIO</h3>
              <p className="mt-2 text-sm leading-6 text-[#c8d7e1]">{selected.cio}</p>

              <h3 className="mt-5 text-sm font-semibold text-[#eff8ff]">What you are really buying</h3>
              <div className="mt-2 grid gap-2">
                {selected.buying.map((item) => (
                  <div key={item} className="rounded-lg border border-[#18364d] bg-[#081624] p-3 text-sm text-[#eff8ff]">{item}</div>
                ))}
              </div>

              <div className={`mt-4 inline-flex rounded-full border px-2.5 py-1 text-xs font-semibold ${evidenceTone(selected.confidence)}`}>
                {selected.confidence} confidence evidence
              </div>
            </aside>
          </section>

          <section className="grid gap-4 xl:grid-cols-3">
            <div className="rounded-lg border border-[#1a3953] bg-[linear-gradient(180deg,rgba(11,23,39,0.87),rgba(6,16,28,0.8))] p-4 shadow-xl shadow-black/20">
              <h2 className="mb-3 text-base font-semibold text-[#eff8ff]">Dependency heat</h2>
              <DependencyHeat selectedId={selectedId} />
            </div>
            <div className="rounded-lg border border-[#1a3953] bg-[linear-gradient(180deg,rgba(11,23,39,0.87),rgba(6,16,28,0.8))] p-4 shadow-xl shadow-black/20">
              <h2 className="mb-3 text-base font-semibold text-[#eff8ff]">Category exposure</h2>
              <CategoryBars entity={selected} />
            </div>
            <div className="rounded-lg border border-[#1a3953] bg-[linear-gradient(180deg,rgba(11,23,39,0.87),rgba(6,16,28,0.8))] p-4 shadow-xl shadow-black/20">
              <h2 className="mb-3 text-base font-semibold text-[#eff8ff]">Board readout</h2>
              <p className="text-sm leading-6 text-[#c8d7e1]">
                {selected.name} should be assessed as {selected.role.toLowerCase()} with {selected.risk.toLowerCase()} dependency risk and {selected.reach}/100 ecosystem reach. The decision is not just whether to buy {selected.name}; it is whether to accept the surrounding ecosystem dependencies.
              </p>
            </div>
          </section>

          <section className="rounded-lg border border-[#1a3953] bg-[linear-gradient(180deg,rgba(11,23,39,0.87),rgba(6,16,28,0.8))] p-4 shadow-xl shadow-black/20">
            <h2 className="mb-3 text-base font-semibold text-[#eff8ff]">Q.U.A.D as layers</h2>
            <div className="grid gap-3 md:grid-cols-4">
              {[
                { href: "/query", title: "Query", copy: "Who matters?" },
                { href: "/understand", title: "Understand", copy: "How are they connected?" },
                { href: "/assess", title: "Assess", copy: "What stack fits us?" },
                { href: "/demonstrate", title: "Demonstrate", copy: "How do we defend it?" },
              ].map((item) => (
                <Link key={item.href} href={item.href} className="rounded-lg border border-[#1b3b55] bg-[#081624] p-4 transition hover:border-[#39d9c8]">
                  <b className="block text-[#eff8ff]">{item.title}</b>
                  <span className="mt-1 block text-sm text-[#8aa4b8]">{item.copy}</span>
                </Link>
              ))}
            </div>
          </section>
        </div>
      </div>
    </main>
  );
}
