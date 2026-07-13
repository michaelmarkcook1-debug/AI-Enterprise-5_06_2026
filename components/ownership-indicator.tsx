export type OwnershipType = "public" | "private" | "subsidiary" | string;

type OwnershipTone = {
  label: string;
  shortLabel: string;
  description: string;
  badgeClassName: string;
  dotClassName: string;
  selectedChipClassName: string;
  chipClassName: string;
};

const OWNERSHIP_TONES: Record<string, OwnershipTone> = {
  public: {
    label: "Publicly traded",
    shortLabel: "Public",
    description: "Provider is publicly traded.",
    badgeClassName: "border-emerald-300 bg-emerald-50 text-emerald-800 dark:border-emerald-800 dark:bg-emerald-950/60 dark:text-emerald-300",
    dotClassName: "bg-emerald-500 dark:bg-emerald-300",
    selectedChipClassName: "border-emerald-700 bg-emerald-900 text-white dark:border-emerald-300 dark:bg-emerald-300 dark:text-emerald-950",
    chipClassName: "border-emerald-300 text-emerald-900 hover:bg-emerald-50 dark:border-emerald-800 dark:text-emerald-300 dark:hover:bg-emerald-950/40",
  },
  private: {
    label: "Private",
    shortLabel: "Private",
    description: "Provider is privately held.",
    badgeClassName: "border-violet-300 bg-violet-50 text-violet-800 dark:border-violet-800 dark:bg-violet-950/60 dark:text-violet-300",
    dotClassName: "bg-violet-500 dark:bg-violet-300",
    selectedChipClassName: "border-violet-700 bg-violet-900 text-white dark:border-violet-300 dark:bg-violet-300 dark:text-violet-950",
    chipClassName: "border-violet-300 text-violet-900 hover:bg-violet-50 dark:border-violet-800 dark:text-violet-300 dark:hover:bg-violet-950/40",
  },
  subsidiary: {
    label: "Public parent",
    shortLabel: "Subsidiary",
    description: "Provider is a subsidiary or business unit of a publicly traded parent.",
    badgeClassName: "border-sky-300 bg-sky-50 text-sky-800 dark:border-sky-800 dark:bg-sky-950/60 dark:text-sky-300",
    dotClassName: "bg-sky-500 dark:bg-sky-300",
    selectedChipClassName: "border-sky-700 bg-sky-900 text-white dark:border-sky-300 dark:bg-sky-300 dark:text-sky-950",
    chipClassName: "border-sky-300 text-sky-900 hover:bg-sky-50 dark:border-sky-800 dark:text-sky-300 dark:hover:bg-sky-950/40",
  },
};

function normalizeOwnership(ownershipType: OwnershipType | undefined): keyof typeof OWNERSHIP_TONES {
  const normalized = ownershipType?.toLowerCase();

  if (normalized === "public" || normalized === "private" || normalized === "subsidiary") {
    return normalized;
  }

  return "private";
}

export function ownershipTone(ownershipType: OwnershipType | undefined) {
  return OWNERSHIP_TONES[normalizeOwnership(ownershipType)];
}

export function OwnershipBadge({
  ownershipType,
  compact = false,
}: {
  ownershipType: OwnershipType | undefined;
  compact?: boolean;
}) {
  const tone = ownershipTone(ownershipType);

  return (
    <span
      className={`inline-flex items-center gap-1.5 rounded-full border px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${tone.badgeClassName}`}
      title={tone.description}
    >
      <span className={`h-1.5 w-1.5 rounded-full ${tone.dotClassName}`} aria-hidden />
      {compact ? tone.shortLabel : tone.label}
    </span>
  );
}

export function OwnershipDot({ ownershipType }: { ownershipType: OwnershipType | undefined }) {
  const tone = ownershipTone(ownershipType);

  return (
    <span
      className={`inline-block h-2.5 w-2.5 rounded-full ${tone.dotClassName}`}
      aria-label={tone.label}
      title={tone.description}
    />
  );
}

export function VendorNameWithOwnership({
  name,
  ownershipType,
  compactBadge = true,
}: {
  name: string;
  ownershipType: OwnershipType | undefined;
  compactBadge?: boolean;
}) {
  return (
    <span className="inline-flex min-w-0 flex-wrap items-center gap-2">
      <span>{name}</span>
      <OwnershipBadge ownershipType={ownershipType} compact={compactBadge} />
    </span>
  );
}

export function ownershipChipClassName(ownershipType: OwnershipType | undefined, selected: boolean) {
  const tone = ownershipTone(ownershipType);
  return selected ? tone.selectedChipClassName : tone.chipClassName;
}

export function OwnershipLegend() {
  return (
    <div className="flex flex-wrap items-center gap-2 text-xs text-[#5d6b80] dark:text-[#8fa5bb]" aria-label="Provider ownership color legend">
      <span className="font-semibold uppercase tracking-wide">Ownership key</span>
      <OwnershipBadge ownershipType="public" compact />
      <OwnershipBadge ownershipType="private" compact />
      <OwnershipBadge ownershipType="subsidiary" compact />
    </div>
  );
}
