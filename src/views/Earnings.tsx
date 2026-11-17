"use client";

import { Fragment, useState, type ReactNode } from "react";
import { ChevronRight, Store, Users } from "lucide-react";
import { useQuery } from "@/client/app-context.tsx";
import { go, setParams } from "@/client/router.ts";
import { formatDate, formatTime, presetPeriod } from "@/core/dates.ts";
import { bpToPercent } from "@/core/money.ts";
import { plural, t, tk } from "@/core/i18n.ts";
import { staffEarnings, staffLines, type EarningRow } from "@/core/reports.ts";
import { Button, Card, Chip, Empty, Money, PageHeader, Sheet, Spinner, Stat, cx } from "@/components/ui.tsx";
import { Avatar } from "./Boot.tsx";

const PERIODS = [
  ["today", tk("Today")], ["yesterday", tk("Yesterday")], ["week", tk("This week")], ["month", tk("This month")], ["lastMonth", tk("Last month")],
] as const;
type PeriodKey = (typeof PERIODS)[number][0];

/**
 * Live earnings: what every employee has made so far in the period, worked
 * out from each service they did and their agreed percentage. Updates the
 * moment a sale is recorded on any device.
 */
export function EarningsView({ params }: { params: URLSearchParams }) {
  const key = (PERIODS.some(([k]) => k === params.get("p")) ? params.get("p") : "today") as PeriodKey;
  const period = presetPeriod(key);
  const openId = params.get("staff");
  const { data } = useQuery((db) => staffEarnings(db, period.from, period.to), [period.from, period.to]);

  const totals = (data ?? []).reduce(
    (acc, r) => ({ revenue: acc.revenue + r.revenue, staff: acc.staff + r.staff_cut, shop: acc.shop + r.shop_cut, services: acc.services + r.services, tips: acc.tips + r.tips }),
    { revenue: 0, staff: 0, shop: 0, services: 0, tips: 0 },
  );

  return (
    <div>
      <PageHeader title={t("Earnings")} subtitle={t("What each employee has made so far, updated with every sale")} />
      <div className="chip-scroll -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {PERIODS.map(([k, label]) => (
          <Chip key={k} active={key === k} onClick={() => setParams({ p: k, staff: null })}>{t(label)}</Chip>
        ))}
      </div>

      {!data ? (
        <Spinner />
      ) : data.length === 0 ? (
        <Empty icon={<Users className="size-8" />} title={t("No staff yet")} action={<Button onClick={() => go("/staff")}>{t("Add staff")}</Button>}>
          {t("Add your barbers and nail technicians, and their earnings show here as sales are recorded.")}
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat label={t("Brought in")} value={<Money value={totals.revenue} />} hint={plural(totals.services, "{n} service", "{n} services")} />
            <Stat label={t("Staff cuts")} value={<Money value={totals.staff} />} tone="accent" hint={totals.tips > 0 ? rich(t("+ {amount} tips"), { amount: <Money value={totals.tips} /> }) : undefined} />
            <Stat label={t("Shop keeps")} value={<Money value={totals.shop} />} />
          </div>

          <div className="mt-4 space-y-2.5 2xl:grid 2xl:grid-cols-2 2xl:gap-3 2xl:space-y-0">
            {data.map((r) => (
              <EmployeeCard key={r.staff_id} row={r} onOpen={() => setParams({ staff: r.staff_id })} />
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-3">
            {rich(t("Staff cuts here are earned from services. Advances, bonuses and payments for the month are under {link}."), {
              link: <button className="cursor-pointer font-semibold text-accent underline-offset-2 hover:underline" onClick={() => go("/payroll")}>{t("Staff pay")}</button>,
            })}
          </p>
        </>
      )}

      <EmployeeSheet
        row={data?.find((r) => r.staff_id === openId) ?? null}
        from={period.from}
        to={period.to}
        label={t(period.label)}
        onClose={() => setParams({ staff: null })}
      />
    </div>
  );
}

function EmployeeCard({ row, onOpen }: { row: EarningRow; onOpen: () => void }) {
  const staffPct = row.revenue ? (row.staff_cut / row.revenue) * 100 : 0;
  return (
    <button
      onClick={onOpen}
      className="flex w-full cursor-pointer items-center gap-3 rounded-2xl border border-line bg-surface p-4 text-left transition-[transform,background-color] duration-150 hover:bg-surface-2 active:scale-[0.99]"
    >
      <Avatar name={row.name} />
      <div className="min-w-0 flex-1">
        <div className="flex items-baseline justify-between gap-3">
          <span className="truncate font-semibold">{row.name}</span>
          <Money value={row.staff_cut + row.tips} className={cx("shrink-0 text-lg font-extrabold", row.staff_cut + row.tips > 0 ? "text-accent" : "text-ink-3")} />
        </div>
        <div className="mt-0.5 flex items-baseline justify-between gap-3 text-xs text-ink-3">
          <span className="truncate">
            {plural(row.services, "{n} service", "{n} services")} · {rich(t("brought in {amount}"), { amount: <Money value={row.revenue} /> })}
            {row.tips > 0 && <> · {rich(t("+ {amount} tips"), { amount: <Money value={row.tips} /> })}</>}
          </span>
          <span className="shrink-0">{row.last_at ? t("last {time}", { time: formatTime(row.last_at) }) : t("no services yet")}</span>
        </div>
        {row.revenue > 0 && (
          <div className="mt-2 flex h-1.5 overflow-hidden rounded-full bg-surface-2" aria-hidden>
            <div className="bg-accent" style={{ width: `${staffPct}%` }} />
          </div>
        )}
      </div>
      <ChevronRight className="size-4 shrink-0 text-ink-3" />
    </button>
  );
}

function EmployeeSheet({
  row, from, to, label, onClose,
}: { row: EarningRow | null; from: string; to: string; label: string; onClose: () => void }) {
  const [limit, setLimit] = useState(60);
  const { data: lines } = useQuery(async (db) => (row ? staffLines(db, row.staff_id, from, to) : []), [row?.staff_id, from, to]);
  if (!row) return null;
  const multiDay = from !== to;

  return (
    <Sheet open onClose={onClose} title={`${row.name} · ${label}`} wide>
      <div className="grid grid-cols-3 gap-2">
        <Stat label={t("Their money")} value={<Money value={row.staff_cut + row.tips} />} tone="accent" hint={row.tips > 0 ? rich(t("incl. {amount} tips"), { amount: <Money value={row.tips} /> }) : undefined} />
        <Stat label={t("Shop keeps")} value={<Money value={row.shop_cut} />} />
        <Stat label={t("Clients")} value={row.clients} hint={plural(row.services, "{n} service", "{n} services")} />
      </div>

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">{t("Every service")}</h3>
      {!lines ? (
        <Spinner />
      ) : lines.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">{t("No services in this period.")}</p>
      ) : (
        <Card className="divide-y divide-line">
          {lines.slice(0, limit).map((l) => (
            <button
              key={l.line_id}
              onClick={() => go("/sales", { date: l.business_date, id: l.sale_id })}
              className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
            >
              <div className="min-w-0 flex-1">
                <div className="truncate font-semibold">
                  {l.qty > 1 && <span className="num text-ink-3">{l.qty} × </span>}
                  {t(l.name)}
                </div>
                <div className="truncate text-xs text-ink-3">
                  {multiDay ? `${formatDate(l.business_date, { day: "numeric", month: "short" })}, ` : ""}
                  {formatTime(l.created_at)} · {l.receipt_no} · <Money value={l.line_total} /> × {bpToPercent(l.commission_bp)}
                </div>
              </div>
              <div className="shrink-0 text-right">
                <Money value={l.staff_cut} className="block font-bold text-accent" />
                <span className="flex items-center justify-end gap-1 text-[11px] text-ink-3">
                  <Store className="size-3" /> <Money value={l.shop_cut} />
                </span>
              </div>
            </button>
          ))}
        </Card>
      )}
      {lines && lines.length > limit && (
        <button className="mt-3 min-h-11 w-full cursor-pointer text-sm font-semibold text-accent" onClick={() => setLimit((n) => n + 60)}>
          {t("Show more ({n} left)", { n: lines.length - limit })}
        </button>
      )}
    </Sheet>
  );
}

/** Put React nodes into a translated sentence at its {placeholders}. */
function rich(text: string, nodes: Record<string, ReactNode>) {
  return text.split(/(\{\w+\})/).map((part, i) => {
    const m = part.match(/^\{(\w+)\}$/);
    return m && m[1] in nodes ? <Fragment key={i}>{nodes[m[1]]}</Fragment> : part;
  });
}
