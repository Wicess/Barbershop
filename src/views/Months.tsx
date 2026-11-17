"use client";

import { AlertTriangle, CalendarRange, CheckCircle2, ChevronRight, RefreshCw, Wallet } from "lucide-react";
import { useState } from "react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { go, setParams } from "@/client/router.ts";
import { addMonths, currentMonth, dayCount, daysInMonth, formatDate, formatMonth, toBusinessDate } from "@/core/dates.ts";
import { monthFigures, periodSummary, type MonthSnapshot } from "@/core/reports.ts";
import { Badge, Button, Card, Empty, Money, PageHeader, SectionTitle, Sheet, Spinner, cx, useMoney } from "@/components/ui.tsx";

interface CloseRow {
  id: string;
  month: string;
  days: number;
  sales: number;
  revenue: number;
  staff_share: number;
  tips: number;
  salaries: number;
  bonuses: number;
  deductions: number;
  expenses: number;
  net_profit: number;
  staff_pay: number;
  snapshot: string;
  closes: number;
  closed_by: string;
  closed_at: string;
}

/**
 * Month-end. Every month runs from the 1st to its real last day (28–31). When
 * it ends, its results and each person's pay are worked out and stored, and
 * the new month starts from zero. This screen shows the month in progress and
 * every closed month's stored statement.
 */
export function MonthsView({ params }: { params: URLSearchParams }) {
  const fmt = useMoney();
  const today = toBusinessDate();
  const month = currentMonth();
  const open = params.get("m");
  const { data } = useQuery(
    async (db) => ({
      closes: await db.all<CloseRow>("SELECT * FROM month_closes ORDER BY month DESC"),
      current: await periodSummary(db, `${month}-01`, today),
      users: await db.all<{ id: string; name: string }>("SELECT id, name FROM users"),
    }),
    [month, today],
  );

  const total = daysInMonth(month);
  const day = dayCount(`${month}-01`, today);
  const userName = (id: string) => data?.users.find((u) => u.id === id)?.name ?? "someone";

  return (
    <div>
      <PageHeader title="Month-end" subtitle="Each month is worked out and stored when it ends" />
      {!data ? (
        <Spinner />
      ) : (
        <>
          {/* The month in progress, counted in its real number of days. */}
          <section className="theme-panel grain relative isolate animate-rise overflow-hidden rounded-[30px] bg-panel p-5 shadow-float ring-1 ring-white/10 sm:p-7">
            <div aria-hidden className="rings absolute inset-0 -z-10 animate-float-slow" />
            <div aria-hidden className="absolute -right-16 -top-20 -z-10 size-72 animate-glow rounded-full bg-[radial-gradient(circle,rgb(239_116_64/0.5),transparent_65%)] blur-2xl" />
            <div className="flex flex-wrap items-start justify-between gap-3">
              <div>
                <p className="text-sm font-medium text-ink-2">This month · in progress</p>
                <p className="font-display text-2xl font-bold uppercase tracking-[0.02em]">{formatMonth(month)}</p>
              </div>
              <span className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 ring-1 ring-line">
                Day {day} of {total}
              </span>
            </div>
            <div className="mt-5 h-2 overflow-hidden rounded-full bg-surface" aria-hidden>
              <div
                className="h-full origin-left animate-[grow_900ms_var(--ease-out)_both] rounded-full bg-linear-to-r from-primary-2 to-primary"
                style={{ width: `${(day / total) * 100}%` }}
              />
            </div>
            <div className="mt-6 grid grid-cols-2 gap-4 sm:grid-cols-3">
              <Figure label="Revenue so far" value={fmt(data.current.revenue)} />
              <Figure label="Net profit so far" value={fmt(data.current.netProfit)} />
              <Figure label="Sales" value={String(data.current.sales)} className="col-span-2 sm:col-span-1" />
            </div>
            <p className="mt-5 text-sm text-ink-3">
              {total - day === 0 ? "Last day of the month." : `${total - day} day${total - day === 1 ? "" : "s"} left.`} Closes automatically on{" "}
              {formatDate(`${addMonths(month, 1)}-01`, { day: "numeric", month: "long" })}, the first time the owner or manager opens the app.
            </p>
          </section>

          <SectionTitle>Closed months</SectionTitle>
          {data.closes.length === 0 ? (
            <Empty icon={<CalendarRange className="size-8" />} title="No months closed yet">
              When a month ends, its results and staff pay are worked out and stored here automatically.
            </Empty>
          ) : (
            <ul className="stagger grid gap-3 lg:grid-cols-2">
              {data.closes.map((c) => (
                <li key={c.id}>
                  <button
                    onClick={() => setParams({ m: c.month })}
                    className="press lift flex w-full cursor-pointer flex-col rounded-[24px] bg-surface text-left ring-1 ring-line transition-colors hover:bg-surface-2"
                  >
                    <span className="flex items-center gap-3 p-4 pb-3">
                      <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                        <CheckCircle2 className="size-5" />
                      </span>
                      <span className="min-w-0 flex-1">
                        <span className="block font-bold tracking-tight">{formatMonth(c.month)}</span>
                        <span className="block truncate text-xs text-ink-3">
                          {c.days} days · closed {formatDate(c.closed_at.slice(0, 10), { day: "numeric", month: "short" })} by {userName(c.closed_by)}
                          {c.closes > 1 ? ` · recalculated` : ""}
                        </span>
                      </span>
                      <ChevronRight className="size-4 shrink-0 text-ink-3" />
                    </span>
                    <span className="grid grid-cols-3 gap-2 border-t border-line px-4 py-3">
                      <Mini label="Revenue" value={fmt(c.revenue)} />
                      <Mini label="Net profit" value={fmt(c.net_profit)} tone={c.net_profit >= 0 ? "positive" : "negative"} />
                      <Mini label="Staff pay" value={fmt(c.staff_pay)} />
                    </span>
                  </button>
                </li>
              ))}
            </ul>
          )}
        </>
      )}

      <Statement row={data?.closes.find((c) => c.month === open) ?? null} closedByName={data ? userName : () => ""} onClose={() => setParams({ m: null })} />
    </div>
  );
}

function Figure({ label, value, className }: { label: string; value: string; className?: string }) {
  return (
    <div className={className}>
      <p className="text-xs font-medium text-ink-3">{label}</p>
      <p className="num mt-1 text-xl font-extrabold tracking-tight">{value}</p>
    </div>
  );
}

function Mini({ label, value, tone }: { label: string; value: string; tone?: "positive" | "negative" }) {
  return (
    <span className="min-w-0">
      <span className="block text-[11px] font-semibold uppercase tracking-[0.08em] text-ink-3">{label}</span>
      <span className={cx("num block truncate text-[15px] font-extrabold tracking-tight", tone === "positive" && "text-positive", tone === "negative" && "text-negative")}>
        {value}
      </span>
    </span>
  );
}

/** A closed month's stored statement, with a live check for records changed since. */
function Statement({ row, closedByName, onClose }: { row: CloseRow | null; closedByName: (id: string) => string; onClose: () => void }) {
  const { can, run } = useApp();
  const fmt = useMoney();
  const [busy, setBusy] = useState(false);
  const month = row?.month ?? "";
  const { data: live } = useQuery(async (db) => (month ? monthFigures(db, month) : null), [month, row?.closed_at]);
  const snap: MonthSnapshot | null = row ? (JSON.parse(row.snapshot) as MonthSnapshot) : null;
  const changed =
    !!row && !!live && (live.revenue !== row.revenue || live.netProfit !== row.net_profit || live.staffPay !== row.staff_pay || live.sales !== row.sales);

  return (
    <Sheet open={!!row} onClose={onClose} title={row ? `${formatMonth(row.month)} statement` : ""} wide>
      {row && snap && (
        <div className="space-y-6">
          <p className="text-sm text-ink-3">
            {formatDate(`${row.month}-01`, { day: "numeric", month: "long" })} – {formatDate(`${row.month}-${String(row.days).padStart(2, "0")}`, { day: "numeric", month: "long", year: "numeric" })}{" "}
            · {row.days} days · closed {formatDate(row.closed_at.slice(0, 10))} by {closedByName(row.closed_by)}
          </p>

          {changed && (
            <div className="flex flex-col gap-3 rounded-2xl bg-warning-soft p-4 text-sm sm:flex-row sm:items-center">
              <AlertTriangle className="size-5 shrink-0 text-warning" />
              <p className="flex-1 text-ink-2">
                Records for this month changed after it was closed (for example a late void). Stored net profit {fmt(row.net_profit)}; from the records now{" "}
                {fmt(live!.netProfit)}.
              </p>
              {can("reports.profit") && (
                <Button
                  size="sm"
                  loading={busy}
                  onClick={async () => {
                    setBusy(true);
                    await run("month.close", { month: row.month }, `${formatMonth(row.month)} recalculated`);
                    setBusy(false);
                  }}
                >
                  <RefreshCw className="size-4" /> Recalculate
                </Button>
              )}
            </div>
          )}

          <Card className="divide-y divide-line">
            <Line label="Revenue" value={row.revenue} hint={`${row.sales} sale${row.sales === 1 ? "" : "s"}${snap.discounts ? ` · after ${fmt(snap.discounts)} discounts` : ""}`} strong />
            <Line label="Staff share (commission)" value={-row.staff_share} />
            {/* What the drinks sold cost the shop, plus any spoiled or missing stock: net profit subtracts it, so it's shown. */}
            {snap.departments.some((d) => d.productCost || d.spoilage) && (
              <Line
                label="Cost of drinks sold"
                hint={snap.departments.some((d) => d.spoilage) ? "Including spoiled or missing stock" : undefined}
                value={-snap.departments.reduce((n, d) => n + d.productCost + d.spoilage, 0)}
              />
            )}
            <Line label={`Salaries (${row.days} days)`} value={-row.salaries} />
            {row.bonuses > 0 && <Line label="Bonuses" value={-row.bonuses} />}
            {row.deductions > 0 && <Line label="Deductions" value={row.deductions} />}
            <Line label="Expenses" value={-row.expenses} />
            <Line label="Net profit" value={row.net_profit} strong tone={row.net_profit >= 0 ? "positive" : "negative"} />
            {row.tips > 0 && <Line label="Tips (paid to staff, not shop money)" value={row.tips} muted />}
          </Card>

          <section>
            <h3 className="mb-2 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">By section</h3>
            <Card className="overflow-x-auto">
              <table className="num w-full text-sm">
                <thead>
                  <tr className="border-b border-line text-left text-xs text-ink-3">
                    <th className="px-4 py-2.5 font-semibold">Section</th>
                    <th className="px-3 py-2.5 text-right font-semibold">Revenue</th>
                    <th className="hidden px-3 py-2.5 text-right font-semibold sm:table-cell">Staff share</th>
                    <th className="px-4 py-2.5 text-right font-semibold">Profit</th>
                  </tr>
                </thead>
                <tbody>
                  {snap.departments.filter((d) => d.revenue || d.profit).map((d) => (
                    <tr key={d.id} className="border-b border-line last:border-0">
                      <td className="px-4 py-2.5 font-semibold">{d.name}</td>
                      <td className="px-3 py-2.5 text-right">{fmt(d.revenue)}</td>
                      <td className="hidden px-3 py-2.5 text-right text-ink-2 sm:table-cell">{fmt(d.staffShare)}</td>
                      <td className={cx("px-4 py-2.5 text-right font-bold", d.profit < 0 ? "text-negative" : "text-positive")}>{fmt(d.profit)}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </Card>
          </section>

          <section>
            <div className="mb-2 flex items-center justify-between gap-2">
              <h3 className="text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">Staff pay</h3>
              {can("payroll.view") && (
                <button className="flex min-h-11 cursor-pointer items-center gap-1.5 text-sm font-semibold text-accent" onClick={() => go("/payroll", { m: row.month })}>
                  <Wallet className="size-4" /> Pay staff
                </button>
              )}
            </div>
            {snap.payroll.length === 0 ? (
              <p className="text-sm text-ink-3">No staff earnings this month.</p>
            ) : (
              <ul className="space-y-2.5">
                {snap.payroll.map((p) => {
                  // Pay is often handed over after the month closes: show what has been paid so far, live.
                  const paid = live?.snapshot.payroll.find((r) => r.staff_id === p.staff_id)?.paid ?? p.paid;
                  const balance = p.netPay - paid;
                  return (
                  <li key={p.staff_id} className="rounded-[20px] bg-surface p-4 ring-1 ring-line">
                    <div className="flex items-baseline justify-between gap-3">
                      <span className="font-semibold">{p.name}</span>
                      <Money value={p.netPay} className="text-lg font-extrabold tracking-tight" />
                    </div>
                    <p className="mt-1 text-xs text-ink-3">
                      {p.services} service{p.services === 1 ? "" : "s"} · share {fmt(p.earned)}
                      {p.tips ? ` · tips ${fmt(p.tips)}` : ""}
                      {p.baseSalary ? ` · salary ${fmt(p.baseSalary)}` : ""}
                      {p.bonuses ? ` · bonus ${fmt(p.bonuses)}` : ""}
                      {p.deductions ? ` · −${fmt(p.deductions)} deductions` : ""}
                      {p.advances ? ` · −${fmt(p.advances)} advances` : ""}
                    </p>
                    <div className="mt-2 flex items-center gap-2 text-xs">
                      <Badge tone={balance <= 0 ? "positive" : "warning"}>{balance <= 0 ? "Paid in full" : `${fmt(balance)} still to pay`}</Badge>
                      {paid > 0 && <span className="text-ink-3">Paid {fmt(paid)} so far</span>}
                    </div>
                  </li>
                  );
                })}
              </ul>
            )}
          </section>
        </div>
      )}
    </Sheet>
  );
}

function Line({ label, value, hint, strong, tone, muted }: { label: string; value: number; hint?: string; strong?: boolean; tone?: "positive" | "negative"; muted?: boolean }) {
  const fmt = useMoney();
  return (
    <div className={cx("flex items-baseline justify-between gap-3 px-4 py-3", muted && "text-ink-3")}>
      <span className={cx("text-sm", strong && "font-bold")}>
        {label}
        {hint && <span className="block text-xs font-normal text-ink-3">{hint}</span>}
      </span>
      <span className={cx("num shrink-0", strong ? "text-lg font-extrabold" : "font-semibold", tone === "positive" && "text-positive", tone === "negative" && "text-negative")}>
        {fmt(value)}
      </span>
    </div>
  );
}
