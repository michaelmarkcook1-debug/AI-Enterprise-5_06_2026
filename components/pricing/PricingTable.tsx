"use client";

// C16 — Pricing table (client: monthly/annual toggle only). SCAFFOLD ONLY.
// Renders the tier ladder + entitlement matrix from server-resolved plan data.
// It charges nothing — CTAs are non-checkout while billing is off.

import { useState } from "react";
import Link from "next/link";

const MUTED = "text-[#123d2c]/65 dark:text-[#eef3f8]/60";
const GOLD = "text-[#b08d2f] dark:text-[#d4af37]";

export interface PlanView {
  id: string;
  name: string;
  tagline: string;
  priceMonthlyUsd: number | null;
  annualMonthlyUsd: number | null;
  creditsIncluded: number;
  highlighted?: boolean;
  contactSales?: boolean;
}

export interface MatrixRow {
  feature: string;
  label: string;
  /** planId → included? */
  byPlan: Record<string, boolean>;
}

export interface PricingTableProps {
  plans: PlanView[];
  matrix: MatrixRow[];
  /** True once billing is live — flips CTAs from "notify me" to real (future). */
  billingLive: boolean;
}

function priceLabel(plan: PlanView, annual: boolean): string {
  if (plan.priceMonthlyUsd == null) return "Let's talk";
  if (plan.priceMonthlyUsd === 0) return "Free";
  const v = annual ? plan.annualMonthlyUsd : plan.priceMonthlyUsd;
  return `$${v}`;
}

export default function PricingTable({ plans, matrix, billingLive }: PricingTableProps) {
  const [annual, setAnnual] = useState(true);

  return (
    <div>
      {/* Billing period toggle */}
      <div className="mt-6 flex items-center justify-center gap-3">
        <button
          type="button"
          onClick={() => setAnnual(false)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            !annual ? "bg-[#123d2c] text-white dark:bg-white dark:text-[#0b2519]" : MUTED
          }`}
        >
          Monthly
        </button>
        <button
          type="button"
          onClick={() => setAnnual(true)}
          className={`rounded-full px-4 py-1.5 text-sm font-medium transition ${
            annual ? "bg-[#123d2c] text-white dark:bg-white dark:text-[#0b2519]" : MUTED
          }`}
        >
          Annual <span className={annual ? "text-[#d4af37]" : GOLD}>· ~17% off</span>
        </button>
      </div>

      {/* Tier cards */}
      <div className="mt-8 grid grid-cols-1 gap-4 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
        {plans.map((plan) => (
          <div
            key={plan.id}
            className={`flex flex-col rounded-xl border p-5 dark:bg-white/5 ${
              plan.highlighted
                ? "border-[#d4af37]/60 bg-[#d4af37]/5 ring-1 ring-[#d4af37]/30"
                : "border-black/10 bg-white/60 dark:border-white/10"
            }`}
          >
            <div className="flex items-center justify-between">
              <h3 className="font-display text-lg font-semibold">{plan.name}</h3>
              {plan.highlighted && (
                <span className={`rounded-full border border-[#d4af37]/50 px-2 py-0.5 text-xs font-semibold uppercase tracking-wide ${GOLD}`}>
                  Popular
                </span>
              )}
            </div>
            <div className="mt-3 flex items-baseline gap-1">
              <span className="text-3xl font-bold tabular-nums">{priceLabel(plan, annual)}</span>
              {plan.priceMonthlyUsd != null && plan.priceMonthlyUsd > 0 && (
                <span className={`text-sm ${MUTED}`}>/mo</span>
              )}
            </div>
            <p className={`mt-3 min-h-[3.5rem] text-sm ${MUTED}`}>{plan.tagline}</p>
            {plan.creditsIncluded > 0 && (
              <p className="mt-2 text-xs font-medium">
                {plan.creditsIncluded.toLocaleString()} credits / mo
              </p>
            )}
            <div className="mt-5 pt-1">
              {plan.id === "free" ? (
                <Link
                  href="/"
                  className="block rounded-lg border border-black/10 px-4 py-2 text-center text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                >
                  Explore the market
                </Link>
              ) : plan.contactSales ? (
                <Link
                  href="/subscribe"
                  className="block rounded-lg border border-black/10 px-4 py-2 text-center text-sm font-medium hover:bg-black/5 dark:border-white/15 dark:hover:bg-white/10"
                >
                  Contact sales
                </Link>
              ) : (
                <Link
                  href="/subscribe"
                  className={`block rounded-lg px-4 py-2 text-center text-sm font-semibold ${
                    plan.highlighted
                      ? "bg-[#d4af37] text-[#0b2519] hover:bg-[#c9a230]"
                      : "bg-[#123d2c] text-white hover:bg-[#1d3350] dark:bg-white dark:text-[#0b2519] dark:hover:bg-white/90"
                  }`}
                >
                  {billingLive ? "Start free trial" : "Notify me at launch"}
                </Link>
              )}
            </div>
          </div>
        ))}
      </div>

      {/* Entitlement matrix */}
      <div className="mt-12 overflow-x-auto">
        <h2 className="font-display text-xl font-semibold">What's included</h2>
        <p className={`mt-1 text-sm ${MUTED}`}>
          The free <strong>Market Today</strong> experience — news, rankings, the dependency graph, and the
          use-case front door — is always open to everyone. Paid tiers add assessment depth.
        </p>
        <table className="mt-4 w-full min-w-[640px] border-collapse text-sm">
          <thead>
            <tr className="border-b border-black/10 dark:border-white/10">
              <th className="py-2 pr-4 text-left font-medium">Capability</th>
              {plans.map((p) => (
                <th key={p.id} className="px-3 py-2 text-center font-medium">{p.name}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {matrix.map((row) => (
              <tr key={row.feature} className="border-b border-black/5 dark:border-white/5">
                <td className="py-2.5 pr-4">{row.label}</td>
                {plans.map((p) => (
                  <td key={p.id} className="px-3 py-2.5 text-center">
                    {row.byPlan[p.id] ? (
                      <span className={GOLD} aria-label="included">✓</span>
                    ) : (
                      <span className={MUTED} aria-label="not included">—</span>
                    )}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
