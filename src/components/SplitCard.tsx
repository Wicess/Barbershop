"use client";

import { Check, HandHeart, Store } from "lucide-react";
import { bpToPercent } from "@/core/money.ts";
import type { SaleSplit } from "@/core/reports.ts";
import { Money, cx } from "./ui.tsx";

/**
 * Who gets what from one sale: each line's staff cut and shop cut, then the
 * totals per person and for the shop. The parts always add up to the total.
 */
export function SplitCard({ split, compact }: { split: SaleSplit; compact?: boolean }) {
  const staffTotal = split.perStaff.reduce((n, p) => n + p.amount, 0);
  const balanced = staffTotal + split.shop === split.total;
  return (
    <div className="rounded-2xl border border-line bg-surface">
      {!compact && (
        <ul className="divide-y divide-line">
          {split.lines.map((l) => (
            <li key={l.line_id} className="px-4 py-3">
              <div className="flex items-baseline justify-between gap-3">
                <span className="min-w-0 truncate font-semibold">{l.name}</span>
                <Money value={l.line_total} className="shrink-0 text-sm font-semibold" />
              </div>
              <div className={cx("mt-1.5 grid gap-2 text-xs", l.staff_id ? "grid-cols-2" : "grid-cols-1")}>
                {l.staff_id && (
                  <div className="rounded-lg bg-accent-soft px-2.5 py-1.5 text-accent">
                    <div className="truncate font-medium">{l.staff} · {bpToPercent(l.commission_bp)}</div>
                    <Money value={l.staff_cut} className="text-sm font-bold" />
                  </div>
                )}
                <div className="rounded-lg bg-surface-2 px-2.5 py-1.5 text-ink-2">
                  <div className="font-medium">Shop · {l.line_total ? bpToPercent(Math.round((l.shop_cut / l.line_total) * 10000)) : "0%"}</div>
                  <Money value={l.shop_cut} className="text-sm font-bold text-ink" />
                </div>
              </div>
            </li>
          ))}
        </ul>
      )}
      <div className={cx("space-y-1.5 px-4 py-3 text-sm", !compact && "border-t border-line-strong")}>
        {split.perStaff.map((p) => (
          <div key={p.staff_id} className="flex justify-between gap-3">
            <span className="text-ink-2">{p.staff}</span>
            <Money value={p.amount} className="font-semibold" />
          </div>
        ))}
        <div className="flex justify-between gap-3">
          <span className="flex items-center gap-1.5 text-ink-2"><Store className="size-4" /> Shop keeps</span>
          <Money value={split.shop} className="font-semibold" />
        </div>
        <div className="flex items-center justify-between gap-3 border-t border-line pt-2 font-bold">
          <span className="flex items-center gap-1.5">
            Total
            {balanced && (
              <span className="inline-flex items-center gap-0.5 rounded-md bg-positive-soft px-1.5 text-[11px] font-semibold text-positive">
                <Check className="size-3" /> adds up
              </span>
            )}
          </span>
          <Money value={split.total} />
        </div>
        {split.tips.length > 0 && (
          <div className="space-y-1.5 border-t border-line pt-2">
            {split.tips.map((t) => (
              <div key={t.staff_id} className="flex justify-between gap-3">
                <span className="flex items-center gap-1.5 text-ink-2"><HandHeart className="size-4" /> Tip for {t.staff} (100%)</span>
                <Money value={t.amount} className="font-semibold text-accent" />
              </div>
            ))}
            <div className="flex justify-between gap-3 text-ink-3">
              <span>Customer paid</span>
              <Money value={split.total + split.tipTotal} />
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
