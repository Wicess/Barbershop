"use client";

import { useState } from "react";
import { ChevronRight, Store, Users } from "lucide-react";
import { useQuery } from "@/client/app-context.tsx";
import { go, setParams } from "@/client/router.ts";
import { formatDate, formatTime, presetPeriod } from "@/core/dates.ts";
import { bpToPercent } from "@/core/money.ts";
import { staffEarnings, staffLines, type EarningRow } from "@/core/reports.ts";
import { Button, Card, Chip, Empty, Money, PageHeader, Sheet, Spinner, Stat, cx } from "@/components/ui.tsx";
import { Avatar } from "./Boot.tsx";

const PERIODS = [
  ["today", "Today"], ["yesterday", "Yesterday"], ["week", "This week"], ["month", "This month"], ["lastMonth", "Last month"],
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
    (t, r) => ({ revenue: t.revenue + r.revenue, staff: t.staff + r.staff_cut, shop: t.shop + r.shop_cut, services: t.services + r.services, tips: t.tips + r.tips }),
    { revenue: 0, staff: 0, shop: 0, services: 0, tips: 0 },
  );

  return (
    <div>
      <PageHeader title="Earnings" subtitle="What each employee has made so far, updated with every sale" />
      <div className="chip-scroll -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {PERIODS.map(([k, label]) => (
          <Chip key={k} active={key === k} onClick={() => setParams({ p: k, staff: null })}>{label}</Chip>
        ))}
      </div>

      {!data ? (
        <Spinner />
      ) : data.length === 0 ? (
        <Empty icon={<Users className="size-8" />} title="No staff yet" action={<Button onClick={() => go("/staff")}>Add staff</Button>}>
          Add your barbers and nail technicians, and their earnings show here as sales are recorded.
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat label="Brought in" value={<Money value={totals.revenue} />} hint={`${totals.services} service${totals.services === 1 ? "" : "s"}`} />
            <Stat label="Staff cuts" value={<Money value={totals.staff} />} tone="accent" hint={totals.tips > 0 ? <>+ <Money value={totals.tips} /> tips</> : undefined} />
            <Stat label="Shop keeps" value={<Money value={totals.shop} />} />
          </div>

          <div className="mt-4 space-y-2.5">
            {data.map((r) => (
              <EmployeeCard key={r.staff_id} row={r} onOpen={() => setParams({ staff: r.staff_id })} />
            ))}
          </div>
          <p className="mt-3 text-xs text-ink-3">
            Staff cuts here are earned from services. Advances, bonuses and payments for the month are under{" "}
            <button className="cursor-pointer font-semibold text-accent underline-offset-2 hover:underline" onClick={() => go("/payroll")}>Staff pay</button>.
          </p>
        </>
      )}

      <EmployeeSheet
        row={data?.find((r) => r.staff_id === openId) ?? null}
        from={period.from}
        to={period.to}
        label={period.label}
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
            {row.services} service{row.services === 1 ? "" : "s"} · brought in <Money value={row.revenue} />
            {row.tips > 0 && <> · + <Money value={row.tips} /> tips</>}
          </span>
          <span className="shrink-0">{row.last_at ? `last ${formatTime(row.last_at)}` : "no services yet"}</span>
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
        <Stat label="Their money" value={<Money value={row.staff_cut + row.tips} />} tone="accent" hint={row.tips > 0 ? <>incl. <Money value={row.tips} /> tips</> : undefined} />
        <Stat label="Shop keeps" value={<Money value={row.shop_cut} />} />
        <Stat label="Clients" value={row.clients} hint={`${row.services} service${row.services === 1 ? "" : "s"}`} />
      </div>

      <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Every service</h3>
      {!lines ? (
        <Spinner />
      ) : lines.length === 0 ? (
        <p className="py-6 text-center text-sm text-ink-3">No services in this period.</p>
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
                  {l.name}
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
          Show more ({lines.length - limit} left)
        </button>
      )}
    </Sheet>
  );
}
