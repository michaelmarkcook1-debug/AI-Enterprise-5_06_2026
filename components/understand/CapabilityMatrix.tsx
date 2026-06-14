"use client";

import { useMemo } from "react";

interface CapabilityMatrixProps {
  vendorFilter?: string;
  pillarFilter?: string;
}

// Sample vendor capability data
const VENDOR_CAPABILITIES = [
  {
    vendor: "Salesforce",
    pillars: {
      "Product Roadmap": 92,
      "Customer Service": 88,
      Execute: 85,
      Vision: 90,
      Innovation: 87,
      "Market Breadth": 91,
    },
  },
  {
    vendor: "Microsoft",
    pillars: {
      "Product Roadmap": 89,
      "Customer Service": 86,
      Execute: 88,
      Vision: 92,
      Innovation: 93,
      "Market Breadth": 94,
    },
  },
  {
    vendor: "Oracle",
    pillars: {
      "Product Roadmap": 85,
      "Customer Service": 82,
      Execute: 90,
      Vision: 78,
      Innovation: 75,
      "Market Breadth": 88,
    },
  },
  {
    vendor: "SAP",
    pillars: {
      "Product Roadmap": 84,
      "Customer Service": 85,
      Execute: 89,
      Vision: 76,
      Innovation: 72,
      "Market Breadth": 92,
    },
  },
  {
    vendor: "Workday",
    pillars: {
      "Product Roadmap": 91,
      "Customer Service": 87,
      Execute: 83,
      Vision: 89,
      Innovation: 88,
      "Market Breadth": 72,
    },
  },
];

const PILLAR_COLORS: Record<string, string> = {
  Execute: "bg-blue-100 text-blue-900",
  Vision: "bg-purple-100 text-purple-900",
  "Product Roadmap": "bg-green-100 text-green-900",
  "Customer Service": "bg-amber-100 text-amber-900",
  Innovation: "bg-pink-100 text-pink-900",
  "Market Breadth": "bg-slate-100 text-slate-900",
};

function ScoreBar({ score }: { score: number }) {
  const getColor = () => {
    if (score >= 90) return "bg-green-500";
    if (score >= 80) return "bg-blue-500";
    if (score >= 70) return "bg-amber-500";
    return "bg-red-500";
  };

  return (
    <div className="w-full bg-slate-200 rounded-full h-2 overflow-hidden">
      <div
        className={`h-full ${getColor()} transition-all`}
        style={{ width: `${score}%` }}
      />
    </div>
  );
}

export default function CapabilityMatrix({
  vendorFilter,
  pillarFilter,
}: CapabilityMatrixProps) {
  const filteredData = useMemo(() => {
    return VENDOR_CAPABILITIES.filter(
      (item) => !vendorFilter || item.vendor === vendorFilter
    );
  }, [vendorFilter]);

  const pillars = pillarFilter
    ? [pillarFilter]
    : [
        "Execute",
        "Vision",
        "Product Roadmap",
        "Customer Service",
        "Innovation",
        "Market Breadth",
      ];

  return (
    <div className="bg-white rounded-lg border border-slate-200 overflow-hidden">
      {/* Header */}
      <div className="bg-gradient-to-r from-slate-900 to-slate-800 text-white p-6">
        <h2 className="text-2xl font-bold">Capability Matrix</h2>
        <p className="text-slate-300 mt-1">
          Vendor strength across key capability pillars (0-100 scale)
        </p>
      </div>

      {/* Matrix Table */}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-slate-100 border-b border-slate-200">
              <th className="px-6 py-4 text-left font-semibold text-slate-900 w-24">
                Vendor
              </th>
              {pillars.map((pillar) => (
                <th
                  key={pillar}
                  className={`px-4 py-4 text-left font-semibold text-xs uppercase tracking-wider ${
                    PILLAR_COLORS[pillar]
                  }`}
                >
                  {pillar}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {filteredData.length === 0 ? (
              <tr>
                <td colSpan={pillars.length + 1} className="px-6 py-8 text-center">
                  <p className="text-slate-600">No vendors match the selected filters</p>
                </td>
              </tr>
            ) : (
              filteredData.map((vendor, idx) => (
                <tr
                  key={vendor.vendor}
                  className={idx % 2 === 0 ? "bg-white" : "bg-slate-50"}
                >
                  <td className="px-6 py-4 font-semibold text-slate-900 whitespace-nowrap">
                    {vendor.vendor}
                  </td>
                  {pillars.map((pillar) => {
                    const score = vendor.pillars[pillar as keyof typeof vendor.pillars];
                    return (
                      <td key={pillar} className="px-4 py-4">
                        <div className="space-y-1">
                          <ScoreBar score={score} />
                          <div className="text-right text-sm font-medium text-slate-900">
                            {score}
                          </div>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>

      {/* Legend */}
      <div className="px-6 py-4 bg-slate-50 border-t border-slate-200">
        <p className="text-xs font-semibold text-slate-600 uppercase tracking-wider mb-3">
          Score Scale
        </p>
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 rounded-full bg-green-500" />
            <span className="text-xs text-slate-600">90–100: Excellent</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 rounded-full bg-blue-500" />
            <span className="text-xs text-slate-600">80–89: Strong</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 rounded-full bg-amber-500" />
            <span className="text-xs text-slate-600">70–79: Adequate</span>
          </div>
          <div className="flex items-center gap-2">
            <div className="w-4 h-2 rounded-full bg-red-500" />
            <span className="text-xs text-slate-600">Below 70: Weak</span>
          </div>
        </div>
      </div>
    </div>
  );
}
