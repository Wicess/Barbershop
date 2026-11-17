"use client";

import { Fragment, type ReactNode } from "react";
import { Printer, TrendingDown, TrendingUp } from "lucide-react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { setParams } from "@/client/router.ts";
import { PAYMENT_LABEL } from "@/core/commands.ts";
import { addDays, dayCount, formatDate, presetPeriod, toBusinessDate } from "@/core/dates.ts";
import { formatMoney } from "@/core/money.ts";
import { locale, plural, t, tk } from "@/core/i18n.ts";
import {
  dailyRevenue, paymentBreakdown, periodSummary, staffPerformance, topItems, type PeriodSummary, type StaffResult,
} from "@/core/reports.ts";
import type { Settings } from "@/core/settings.ts";
import { Bars, DailyColumns } from "@/components/charts.tsx";
import { PageSize, printContent } from "@/components/print.tsx";
import { Button, Card, Chip, Field, Input, Money, PageHeader, SectionTitle, Spinner, Stat, cx } from "@/components/ui.tsx";

const PRESETS = [
  ["today", tk("Today")], ["yesterday", tk("Yesterday")], ["week", tk("This week")], ["month", tk("This month")], ["lastMonth", tk("Last month")],
] as const;

export function ReportsView({ params }: { params: URLSearchParams }) {
  const { can, settings } = useApp();
  const preset = params.get("p") ?? "month";
  const custom = preset === "custom";
  const today = toBusinessDate();
  const period = custom
    ? { from: params.get("from") ?? today, to: params.get("to") ?? today, label: t("Custom") }
    : presetPeriod(preset as (typeof PRESETS)[number][0]);
  const profit = can("reports.profit");

  const { data } = useQuery(async (db) => {
    const days = await dailyRevenue(db, period.from, period.to);
    return {
      summary: await periodSummary(db, period.from, period.to),
      staff: await staffPerformance(db, period.from, period.to),
      payments: await paymentBreakdown(db, period.from, period.to),
      top: await topItems(db, period.from, period.to),
      days,
    };
  }, [period.from, period.to]);

  const fullDays = data && dayCount(period.from, period.to) <= 62
    ? Array.from({ length: dayCount(period.from, period.to) }, (_, i) => {
        const date = addDays(period.from, i);
        return { date, value: Number(data.days.find((d) => d.business_date === date)?.revenue ?? 0) };
      })
    : [];

  return (
    <div>
      <PageHeader
        title={profit ? t("Profit & loss") : t("Sales report")}
        subtitle={`${formatDate(period.from)}${period.from !== period.to ? ` – ${formatDate(period.to)}` : ""}`}
        actions={
          data && (
            <Button variant="secondary" size="sm" onClick={() => printContent(<ReportPrint data={data} settings={settings} profit={profit} period={period} />)}>
              <Printer className="size-4" /> {t("Print")}
            </Button>
          )
        }
      />

      <div className="chip-scroll -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {PRESETS.map(([k, label]) => (
          <Chip key={k} active={preset === k} onClick={() => setParams({ p: k, from: null, to: null })}>
            {t(label)}
          </Chip>
        ))}
        <Chip active={custom} onClick={() => setParams({ p: "custom", from: period.from, to: period.to })}>
          {t("Custom")}
        </Chip>
      </div>
      {custom && (
        <div className="mb-4 grid grid-cols-2 gap-3">
          <Field label={t("From")} htmlFor="from">
            <Input id="from" type="date" value={period.from} max={period.to} onChange={(e) => e.target.value && setParams({ from: e.target.value })} />
          </Field>
          <Field label={t("To")} htmlFor="to">
            <Input id="to" type="date" value={period.to} min={period.from} max={today} onChange={(e) => e.target.value && setParams({ to: e.target.value })} />
          </Field>
        </div>
      )}

      {!data ? <Spinner /> : <ReportBody data={data} profit={profit} fullDays={fullDays} />}
    </div>
  );
}

interface ReportData {
  summary: PeriodSummary;
  staff: StaffResult[];
  payments: { method: string; amount: number; count: number }[];
  top: { name: string; department: string; qty: number; revenue: number }[];
}

function ReportBody({ data, profit, fullDays }: { data: ReportData; profit: boolean; fullDays: { date: string; value: number }[] }) {
  const s = data.summary;
  const staffShare = s.departments.reduce((n, d) => n + d.staffShare, 0);
  const expenses = s.sharedExpenses + s.departments.reduce((n, d) => n + d.directExpenses, 0);
  const active = s.departments.filter((d) => d.revenue || d.profit || d.directExpenses);
  const ranked = [...active].sort((a, b) => b.profit - a.profit);
  const best = ranked[0];
  const losing = ranked.filter((d) => d.profit < 0);

  return (
    <>
      <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
        <Stat label={t("Revenue")} value={<Money value={s.revenue} />} hint={plural(s.sales, "{n} sale", "{n} sales")} />
        <Stat label={t("Staff share (commission)")} value={<Money value={staffShare} />} hint={t("Shop keeps {percent}", { percent: formatPercent(s.revenue - staffShare, s.revenue) })} />
        {profit ? (
          <>
            <Stat label={t("Expenses")} value={<Money value={expenses + s.salaries + s.bonuses - s.deductions} />} hint={t("Incl. salaries & spoilage")} />
            <Stat label={t("Net profit")} value={<Money value={s.netProfit} />} tone={s.netProfit >= 0 ? "positive" : "negative"} hint={t("{percent} of revenue", { percent: formatPercent(s.netProfit, s.revenue) })} />
          </>
        ) : (
          <>
            <Stat label={t("Average sale")} value={<Money value={s.sales ? Math.round(s.revenue / s.sales) : 0} />} />
            <Stat label={t("Discounts given")} value={<Money value={s.discounts} />} />
          </>
        )}
      </div>

      {profit && best && (
        <div className="mt-4 grid gap-3 sm:grid-cols-2">
          <Card className="flex items-start gap-3 p-4">
            <TrendingUp className="mt-0.5 size-5 shrink-0 text-positive" />
            <p className="text-sm">
              {s.revenue > 0
                ? rich(t("{name} made the most profit: {amount} ({percent} of all revenue)."), {
                    name: <span className="font-semibold">{t(best.name)}</span>,
                    amount: <Money value={best.profit} className="font-semibold" />,
                    percent: formatPercent(best.revenue, s.revenue),
                  })
                : rich(t("{name} made the most profit: {amount}"), {
                    name: <span className="font-semibold">{t(best.name)}</span>,
                    amount: <Money value={best.profit} className="font-semibold" />,
                  })}
            </p>
          </Card>
          {losing.length > 0 && (
            <Card className="flex items-start gap-3 border-negative/30 p-4">
              <TrendingDown className="mt-0.5 size-5 shrink-0 text-negative" />
              <p className="text-sm">
                {rich(t("Losing money: {sections}"), {
                  sections: losing.map((d, i) => (
                    <span key={d.id}>{i > 0 && ", "}<span className="font-semibold">{t(d.name)}</span> (<Money value={d.profit} />)</span>
                  )),
                })}
              </p>
            </Card>
          )}
        </div>
      )}

      <div className="xl:grid xl:grid-cols-12 xl:grid-rows-[auto_auto_auto_auto_1fr] xl:items-start xl:gap-x-6">
      <section className={cx("xl:col-span-12 xl:col-start-1 xl:row-start-1", profit && "2xl:col-span-7")}>
      <SectionTitle>{profit ? t("Profit by section") : t("Revenue by section")}</SectionTitle>
      {/* Phones: one row per section with the profit on the right */}
      <Card className="divide-y divide-line sm:hidden">
        {(profit ? ranked : active).map((d) => (
          <div key={d.id} className="flex items-center justify-between gap-3 px-4 py-3">
            <div className="min-w-0">
              <div className="font-semibold">{t(d.name)}</div>
              <div className="text-xs text-ink-3">
                {plural(d.items, "{n} item", "{n} items")} · {rich(t("revenue {amount}"), { amount: <Money value={d.revenue} /> })} · {rich(t("staff {amount}"), { amount: <Money value={d.staffShare} /> })}
                {profit && d.productCost + d.spoilage + d.directExpenses > 0 && <> · {rich(t("costs {amount}"), { amount: <Money value={d.productCost + d.spoilage + d.directExpenses} /> })}</>}
              </div>
            </div>
            <Money
              value={profit ? d.profit : d.revenue}
              className={cx("shrink-0 font-bold", profit && (d.profit < 0 ? "text-negative" : "text-positive"))}
            />
          </div>
        ))}
        {active.length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-3">{t("No sales in this period.")}</p>}
      </Card>
      <Card className="hidden overflow-x-auto sm:block">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-line text-left text-xs text-ink-3">
              <th className="px-4 py-2.5 font-semibold">{t("Section")}</th>
              <th className="px-2 py-2.5 text-right font-semibold">{t("Items")}</th>
              <th className="px-2 py-2.5 text-right font-semibold">{t("Revenue")}</th>
              <th className="px-2 py-2.5 text-right font-semibold">{t("Staff share")}</th>
              {profit && <th className="px-2 py-2.5 text-right font-semibold">{t("Costs")}</th>}
              {profit && <th className="px-4 py-2.5 text-right font-semibold">{t("Profit")}</th>}
            </tr>
          </thead>
          <tbody className="num">
            {(profit ? ranked : active).map((d) => (
              <tr key={d.id} className="border-b border-line last:border-0">
                <td className="px-4 py-3 font-semibold lg:py-2.5">{t(d.name)}</td>
                <td className="px-2 py-3 text-right lg:py-2.5">{d.items}</td>
                <td className="px-2 py-3 text-right lg:py-2.5"><Money value={d.revenue} /></td>
                <td className="px-2 py-3 text-right lg:py-2.5"><Money value={d.staffShare} /></td>
                {profit && (
                  <td className="px-2 py-3 text-right lg:py-2.5" title={t("Cost of drinks sold + spoilage + expenses tagged to this section")}>
                    <Money value={d.productCost + d.spoilage + d.directExpenses} />
                  </td>
                )}
                {profit && (
                  <td className={cx("px-4 py-3 text-right font-bold lg:py-2.5", d.profit < 0 ? "text-negative" : "text-positive")}>
                    <Money value={d.profit} />
                  </td>
                )}
              </tr>
            ))}
            {active.length === 0 && (
              <tr><td colSpan={6} className="px-4 py-6 text-center text-ink-3">{t("No sales in this period.")}</td></tr>
            )}
          </tbody>
        </table>
      </Card>
      </section>

      {profit && (
        <section className="xl:col-span-5 xl:col-start-8 xl:row-start-2 2xl:row-span-2 2xl:row-start-1">
          <SectionTitle>{t("Profit & loss statement")}</SectionTitle>
          <Card className="p-4">
            <PnL summary={s} />
          </Card>
        </section>
      )}

      <div className="grid gap-x-6 lg:grid-cols-2 xl:contents">
        <section className="xl:col-span-4 xl:col-start-1 xl:row-span-3 xl:row-start-3">
          <SectionTitle>{t("Staff")}</SectionTitle>
          <Card className="divide-y divide-line">
            {data.staff.length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-3">{t("No services recorded.")}</p>}
            {data.staff.map((st) => (
              <div key={st.staff_id} className="flex items-center justify-between gap-3 px-4 py-3 lg:py-2.5">
                <div>
                  <div className="font-semibold">{st.name}</div>
                  <div className="text-xs text-ink-3">{plural(st.clients, "{n} client", "{n} clients")} · {plural(st.services, "{n} service", "{n} services")}</div>
                </div>
                <div className="text-right">
                  <Money value={st.revenue} className="font-semibold" />
                  <div className="text-xs text-ink-3">{rich(t("share {amount}"), { amount: <Money value={st.share} /> })}</div>
                </div>
              </div>
            ))}
          </Card>
        </section>
        <section className="xl:col-span-4 xl:col-start-9 xl:row-start-3">
          <SectionTitle>{t("Payment methods")}</SectionTitle>
          <Card className="p-4">
            {data.payments.length === 0 ? (
              <p className="py-2 text-center text-sm text-ink-3">{t("No payments.")}</p>
            ) : (
              <Bars rows={data.payments.map((p) => ({ label: t(PAYMENT_LABEL[p.method] ?? p.method), value: Number(p.amount), sub: `${p.count}×` }))} />
            )}
          </Card>
          {data.summary.tips > 0 && (
            <p className="mt-2 text-xs text-ink-3">
              {rich(t("Includes {amount} in tips. Tips belong to staff, so they are not in sales or profit."), { amount: <Money value={data.summary.tips} /> })}
            </p>
          )}
        </section>
      </div>

      {fullDays.length > 1 && (
        <section className={cx("xl:col-start-1 xl:row-start-2", profit ? "xl:col-span-7" : "xl:col-span-12")}>
          <SectionTitle>{t("Daily revenue")}</SectionTitle>
          <Card className="p-4">
            <DailyColumns days={fullDays} />
          </Card>
        </section>
      )}

      <div className="grid gap-x-6 lg:grid-cols-2 xl:contents">
        <section className="xl:col-span-4 xl:col-start-5 xl:row-span-3 xl:row-start-3">
          <SectionTitle>{t("Best sellers")}</SectionTitle>
          <Card className="divide-y divide-line">
            {data.top.length === 0 && <p className="px-4 py-6 text-center text-sm text-ink-3">{t("Nothing sold.")}</p>}
            {data.top.map((item) => (
              <div key={item.name + item.department} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span><span className="font-semibold">{t(item.name)}</span> <span className="text-ink-3">· {t(item.department)} · {item.qty}×</span></span>
                <Money value={item.revenue} className="font-semibold" />
              </div>
            ))}
          </Card>
        </section>
        {profit && (
          <section className="xl:col-span-4 xl:col-start-9 xl:row-start-4">
            <SectionTitle>{t("Expenses by category")}</SectionTitle>
            <Card className="p-4">
              {s.expensesByCategory.length === 0 ? (
                <p className="py-2 text-center text-sm text-ink-3">{t("No expenses recorded.")}</p>
              ) : (
                <Bars rows={s.expensesByCategory.map((e) => ({ label: t(e.category), value: e.amount }))} />
              )}
            </Card>
          </section>
        )}
      </div>
      </div>
    </>
  );
}

/** Put React nodes into a translated sentence at its {placeholders}. */
function rich(text: string, nodes: Record<string, ReactNode>) {
  return text.split(/(\{\w+\})/).map((part, i) => {
    const m = part.match(/^\{(\w+)\}$/);
    return m && m[1] in nodes ? <Fragment key={i}>{nodes[m[1]]}</Fragment> : part;
  });
}

function formatPercent(part: number, whole: number) {
  return new Intl.NumberFormat(locale(), { style: "percent", maximumFractionDigits: 0 }).format(whole ? part / whole : 0);
}

function PnL({ summary: s }: { summary: PeriodSummary }) {
  const rows = pnlRows(s);
  return (
    <table className="num w-full text-sm">
      <tbody>
        {rows.map((r, i) => (
          <tr key={i} className={cx(r.total && "border-t border-line-strong font-bold", r.indent && "text-ink-2")}>
            <td className={cx("py-1.5", r.indent && "pl-4")}>{r.label}</td>
            <td className={cx("py-1.5 text-right", r.total && r.value < 0 && "text-negative", r.total && r.value > 0 && r.net && "text-positive")}>
              <Money value={r.value} />
            </td>
          </tr>
        ))}
      </tbody>
    </table>
  );
}

function pnlRows(s: PeriodSummary) {
  const rows: { label: string; value: number; indent?: boolean; total?: boolean; net?: boolean }[] = [];
  const active = s.departments.filter((d) => d.revenue || d.profit || d.directExpenses);
  for (const d of active) rows.push({ label: t("{section} revenue", { section: t(d.name) }), value: d.revenue, indent: true });
  rows.push({ label: t("Total revenue"), value: s.revenue, total: true });
  const sum = (f: (d: (typeof active)[number]) => number) => active.reduce((n, d) => n + f(d), 0);
  rows.push({ label: t("Staff share (commission)"), value: -sum((d) => d.staffShare), indent: true });
  if (sum((d) => d.productCost)) rows.push({ label: t("Cost of drinks/products sold"), value: -sum((d) => d.productCost), indent: true });
  if (sum((d) => d.spoilage)) rows.push({ label: t("Spoiled or missing stock"), value: -sum((d) => d.spoilage), indent: true });
  if (sum((d) => d.directExpenses)) rows.push({ label: t("Section expenses"), value: -sum((d) => d.directExpenses), indent: true });
  const contribution = sum((d) => d.profit);
  rows.push({ label: t("Profit from sections"), value: contribution, total: true });
  if (s.sharedExpenses) rows.push({ label: t("Shop expenses (rent, utilities…)"), value: -s.sharedExpenses, indent: true });
  if (s.salaries) rows.push({ label: t("Staff salaries"), value: -s.salaries, indent: true });
  if (s.bonuses) rows.push({ label: t("Staff bonuses"), value: -s.bonuses, indent: true });
  if (s.deductions) rows.push({ label: t("Staff deductions (fines)"), value: s.deductions, indent: true });
  rows.push({ label: t("Net profit"), value: s.netProfit, total: true, net: true });
  return rows;
}

function ReportPrint({
  data, settings, profit, period,
}: { data: ReportData; settings: Settings; profit: boolean; period: { from: string; to: string } }) {
  const m = (v: number) => formatMoney(v, settings.currency);
  const s = data.summary;
  const active = s.departments.filter((d) => d.revenue || d.profit || d.directExpenses);
  return (
    <div className="report-print">
      <PageSize size="a4" />
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>{settings.shop_name} — {profit ? t("Profit & loss") : t("Sales report")}</h1>
      <p>{t("{from} – {to} · printed {when}", { from: formatDate(period.from), to: formatDate(period.to), when: new Date().toLocaleString(locale()) })}</p>
      <h2 style={{ marginTop: 16, fontWeight: 700 }}>{t("Sections")}</h2>
      <table>
        <thead>
          <tr><th>{t("Section")}</th><th className="r">{t("Items")}</th><th className="r">{t("Revenue")}</th><th className="r">{t("Staff share")}</th>{profit && <th className="r">{t("Costs")}</th>}{profit && <th className="r">{t("Profit")}</th>}</tr>
        </thead>
        <tbody>
          {active.map((d) => (
            <tr key={d.id}>
              <td>{t(d.name)}</td><td className="r">{d.items}</td><td className="r">{m(d.revenue)}</td><td className="r">{m(d.staffShare)}</td>
              {profit && <td className="r">{m(d.productCost + d.spoilage + d.directExpenses)}</td>}
              {profit && <td className="r">{m(d.profit)}</td>}
            </tr>
          ))}
        </tbody>
      </table>
      {profit && (
        <>
          <h2 style={{ marginTop: 16, fontWeight: 700 }}>{t("Profit & loss")}</h2>
          <table>
            <tbody>
              {pnlRows(s).map((r, i) => (
                <tr key={i} style={r.total ? { fontWeight: 700 } : undefined}>
                  <td style={r.indent ? { paddingLeft: 18 } : undefined}>{r.label}</td><td className="r">{m(r.value)}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </>
      )}
      <h2 style={{ marginTop: 16, fontWeight: 700 }}>{t("Staff")}</h2>
      <table>
        <thead><tr><th>{t("Name")}</th><th className="r">{t("Clients")}</th><th className="r">{t("Services")}</th><th className="r">{t("Revenue")}</th><th className="r">{t("Share")}</th></tr></thead>
        <tbody>
          {data.staff.map((st) => (
            <tr key={st.staff_id}><td>{st.name}</td><td className="r">{st.clients}</td><td className="r">{st.services}</td><td className="r">{m(st.revenue)}</td><td className="r">{m(st.share)}</td></tr>
          ))}
        </tbody>
      </table>
      <h2 style={{ marginTop: 16, fontWeight: 700 }}>{t("Payments")}</h2>
      <table>
        <tbody>
          {data.payments.map((p) => (
            <tr key={p.method}><td>{t(PAYMENT_LABEL[p.method] ?? p.method)}</td><td className="r">{p.count}</td><td className="r">{m(Number(p.amount))}</td></tr>
          ))}
        </tbody>
      </table>
      {profit && s.expensesByCategory.length > 0 && (
        <>
          <h2 style={{ marginTop: 16, fontWeight: 700 }}>{t("Expenses by category")}</h2>
          <table>
            <tbody>
              {s.expensesByCategory.map((e) => (
                <tr key={e.category}><td>{t(e.category)}</td><td className="r">{m(e.amount)}</td></tr>
              ))}
            </tbody>
          </table>
        </>
      )}
    </div>
  );
}
