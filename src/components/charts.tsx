"use client";

import { cx, useMoney } from "./ui.tsx";

/** Labelled horizontal bars. Values are printed as text, so nothing depends on colour alone. */
export function Bars({
  rows, signed,
}: { rows: { label: string; value: number; sub?: string }[]; signed?: boolean }) {
  const fmt = useMoney();
  const max = Math.max(1, ...rows.map((r) => Math.abs(r.value)));
  return (
    <ul className="space-y-3">
      {rows.map((r) => {
        const pct = (Math.abs(r.value) / max) * 100;
        const negative = r.value < 0;
        return (
          <li key={r.label}>
            <div className="mb-1 flex items-baseline justify-between gap-3 text-sm">
              <span className="min-w-0 truncate font-medium text-ink">
                {r.label}
                {r.sub && <span className="ml-2 text-xs font-normal text-ink-3">{r.sub}</span>}
              </span>
              <span className={cx("num shrink-0 font-semibold", negative ? "text-negative" : signed && r.value > 0 ? "text-positive" : "text-ink")}>
                {fmt(r.value)}
              </span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-surface-2" aria-hidden>
              <div
                className={cx("h-full rounded-full", negative ? "bg-negative" : signed ? "bg-positive" : "bg-accent")}
                style={{ width: `${Math.max(pct, r.value === 0 ? 0 : 2)}%` }}
              />
            </div>
          </li>
        );
      })}
    </ul>
  );
}

/** Small daily columns for a period trend. */
export function DailyColumns({ days }: { days: { date: string; value: number }[] }) {
  const fmt = useMoney();
  const max = Math.max(1, ...days.map((d) => d.value));
  if (days.length === 0) return null;
  return (
    <div>
      <div className="flex h-28 items-end gap-[3px]" role="img" aria-label="Daily revenue">
        {days.map((d) => (
          <div key={d.date} className="group relative flex h-full flex-1 items-end">
            <div
              className="w-full rounded-t bg-accent/80 transition-colors group-hover:bg-accent"
              style={{ height: `${Math.max((d.value / max) * 100, d.value > 0 ? 3 : 0)}%` }}
              title={`${d.date}: ${fmt(d.value)}`}
            />
          </div>
        ))}
      </div>
      <div className="mt-1 flex justify-between text-[11px] text-ink-3">
        <span>{days[0].date.slice(5)}</span>
        <span>{days.at(-1)!.date.slice(5)}</span>
      </div>
    </div>
  );
}
