"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Clock3, Printer, TriangleAlert } from "lucide-react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { setParams } from "@/client/router.ts";
import { AUTO_CLOSE_NOTE, PAYMENT_LABEL } from "@/core/commands.ts";
import { formatDate, formatDateTime, toBusinessDate } from "@/core/dates.ts";
import { formatMoney } from "@/core/money.ts";
import { t } from "@/core/i18n.ts";
import { cashFigures, type CashFigures } from "@/core/reports.ts";
import type { Settings } from "@/core/settings.ts";
import { PageSize, printContent } from "@/components/print.tsx";
import { Button, Card, DateInput, Field, Money, MoneyInput, PageHeader, Spinner, Textarea, cx } from "@/components/ui.tsx";

interface CloseRow {
  business_date: string;
  opening_float: number;
  cash_sales: number;
  cash_out: number;
  expected: number;
  counted: number;
  variance: number;
  note: string | null;
  closed_at: string;
  closed_by_name: string | null;
}

/**
 * Blind cash count: the cashier counts the drawer first and only then sees
 * what the system expected, so the count can't be bent to match.
 */
export function CloseDayView({ params }: { params: URLSearchParams }) {
  const { can, run, settings } = useApp();
  const today = toBusinessDate();
  const date = can("cash.reclose") ? params.get("date") ?? today : today;
  const [recount, setRecount] = useState(false);
  const { data } = useQuery(async (db) => ({
    figures: await cashFigures(db, date),
    close: await db.get<CloseRow>(
      "SELECT c.*, u.name AS closed_by_name FROM day_closes c LEFT JOIN users u ON u.id = c.closed_by WHERE c.business_date = ?",
      [date],
    ),
  }), [date]);

  const [float, setFloat] = useState<number | null>(settings.opening_float || null);
  const [counted, setCounted] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setRecount(false);
    setCounted(null);
    setNote("");
  }, [date]);

  if (!data) return <Spinner />;
  const showForm = !data.close || recount;

  const submit = async () => {
    if (counted == null) return;
    setBusy(true);
    const f = data.figures;
    const opening = float ?? 0;
    await run(
      "day.close",
      {
        business_date: date,
        opening_float: opening,
        cash_sales: f.cashSales,
        cash_out: f.cashOut,
        expected: opening + f.cashSales - f.cashOut,
        counted,
        note,
      },
      t("Day closed"),
    );
    setBusy(false);
    setRecount(false);
  };

  return (
    <div className="mx-auto max-w-xl lg:max-w-none">
      <PageHeader
        title={t("Close the day")}
        subtitle={date === today ? t("Today") : formatDate(date, { weekday: "long", day: "numeric", month: "long" })}
        actions={
          can("cash.reclose") && (
            <DateInput look="compact" label={t("Choose date")} value={date} max={today} onChange={(v) => setParams({ date: v })} />
          )
        }
      />

      {showForm ? (
        <Card className="p-5">
          <ol className="space-y-5 lg:grid lg:grid-cols-3 lg:gap-5 lg:space-y-0">
            <li>
              <Field label={t("1. Cash in the drawer when the day started")} htmlFor="flt" hint={t("The float left for change.")}>
                <MoneyInput id="flt" value={float} onChange={setFloat} />
              </Field>
            </li>
            <li>
              <Field label={t("2. Count all the cash in the drawer now")} htmlFor="cnt" hint={t("Count notes and coins. Don't include mobile money or card.")}>
                <MoneyInput id="cnt" value={counted} onChange={setCounted} autoFocus />
              </Field>
            </li>
            <li>
              <Field label={t("3. Notes (optional)")} htmlFor="nt">
                <Textarea id="nt" value={note} onChange={(e) => setNote(e.target.value)} placeholder={t("Anything the owner should know")} />
              </Field>
            </li>
          </ol>
          <div className="lg:mt-5 lg:flex lg:flex-row-reverse lg:items-center lg:gap-3">
            <Button className="mt-5 lg:mt-0 lg:w-auto lg:min-w-72" block size="lg" disabled={counted == null} loading={busy} onClick={submit}>
              {t("Close day & see result")}
            </Button>
            {recount && (
              <Button className="mt-2 lg:mt-0 lg:w-auto" variant="ghost" block onClick={() => setRecount(false)}>{t("Cancel")}</Button>
            )}
            {!recount && date === today && <p className="mt-3 text-xs text-ink-3 lg:mr-auto lg:mt-0">{t("If nobody closes it, the day closes on its own at 11:59 pm.")}</p>}
          </div>
        </Card>
      ) : (
        <CloseResult close={data.close!} figures={data.figures} onRecount={can("cash.reclose") ? () => setRecount(true) : undefined} settings={settings} />
      )}
    </div>
  );
}

function CloseResult({
  close, figures, onRecount, settings,
}: { close: CloseRow; figures: CashFigures; onRecount?: () => void; settings: Settings }) {
  const auto = close.note === AUTO_CLOSE_NOTE;
  const ok = close.variance === 0;
  const short = close.variance < 0;
  return (
    <div className="lg:grid lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-6">
      {auto ? (
        <Card className="flex items-center gap-3 p-4 lg:col-start-1 lg:row-start-1">
          <Clock3 className="size-8 shrink-0 text-warning" />
          <div>
            <p className="text-lg font-bold">{t("Closed automatically")}</p>
            <p className="text-sm text-ink-3">
              {t("At 11:59 pm on {date}. The cash was not counted.", { date: formatDate(close.business_date, { weekday: "long", day: "numeric", month: "long" }) })}
            </p>
          </div>
        </Card>
      ) : (
      <Card className={cx("flex items-center gap-3 p-4 lg:col-start-1 lg:row-start-1", ok ? "border-positive/40" : "border-negative/40")}>
        {ok ? <CheckCircle2 className="size-8 shrink-0 text-positive" /> : <TriangleAlert className="size-8 shrink-0 text-negative" />}
        <div>
          <p className="text-lg font-bold">
            {ok ? t("Cash matches") : short ? <>{t("Short by")} <Money value={-close.variance} /></> : <>{t("Over by")} <Money value={close.variance} /></>}
          </p>
          <p className="text-sm text-ink-3">
            {close.closed_by_name ? t("Closed {date} by {name}", { date: formatDateTime(close.closed_at), name: close.closed_by_name }) : t("Closed {date}", { date: formatDateTime(close.closed_at) })}
          </p>
        </div>
      </Card>
      )}
      <Card className="mt-3 p-4 lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:mt-0">
        <CashTable close={close} counted={!auto} />
        {figures.otherMethods.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">{t("Not in the drawer — check against statements")}</p>
            {figures.otherMethods.map((m) => (
              <div key={m.method} className="flex justify-between py-1 text-sm">
                <span>{t(PAYMENT_LABEL[m.method] ?? m.method)}</span>
                <Money value={m.amount} className="font-semibold" />
              </div>
            ))}
          </div>
        )}
        {close.note && !auto && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">{close.note}</p>}
      </Card>
      <div className="mt-3 flex gap-2 lg:col-start-1 lg:row-start-2">
        <Button variant="secondary" className="flex-1" onClick={() => printContent(<ClosePrint close={close} figures={figures} settings={settings} />)}>
          <Printer className="size-4" /> {t("Print")}
        </Button>
        {onRecount && <Button variant={auto ? "primary" : "secondary"} className="flex-1" onClick={onRecount}>{auto ? t("Count the cash") : t("Count again")}</Button>}
      </div>
    </div>
  );
}

function CashTable({ close, counted = true }: { close: CloseRow; counted?: boolean }) {
  const row = (label: string, value: number, bold?: boolean) => (
    <div className={cx("flex justify-between py-1 text-sm", bold && "border-t border-line-strong pt-2 font-bold")}>
      <span>{label}</span>
      <Money value={value} />
    </div>
  );
  return (
    <div>
      {row(t("Opening float"), close.opening_float)}
      {row(`+ ${t("Cash sales")}`, close.cash_sales)}
      {row(`− ${t("Cash paid out (expenses, advances, stock)")}`, -close.cash_out)}
      {row(t("Expected in drawer"), close.expected, true)}
      {counted && row(t("Counted"), close.counted)}
      {counted && row(t("Difference"), close.variance, true)}
    </div>
  );
}

function ClosePrint({ close, figures, settings }: { close: CloseRow; figures: CashFigures; settings: Settings }) {
  const m = (v: number) => formatMoney(v, settings.currency);
  return (
    <div className="receipt mx-auto" data-width={settings.paper_width}>
      <PageSize size={settings.paper_width} />
      <div className="text-center font-bold">{settings.shop_name}</div>
      <div className="text-center">{t("Day close · {date}", { date: formatDate(close.business_date) })}</div>
      <div className="my-1.5 border-t border-dashed border-black" />
      {[
        [t("Sales count"), String(figures.salesCount)],
        [t("Opening float"), m(close.opening_float)],
        [t("Cash sales"), m(close.cash_sales)],
        [t("Expenses from drawer"), m(figures.tillExpenses)],
        [t("Staff money from drawer"), m(figures.tillStaffMoney)],
        [t("Stock bought from drawer"), m(figures.tillStockPurchases)],
        [t("Expected"), m(close.expected)],
        ...(close.note === AUTO_CLOSE_NOTE ? [] : [[t("Counted"), m(close.counted)], [t("Difference"), m(close.variance)]]),
        ...figures.otherMethods.map((o) => [t(PAYMENT_LABEL[o.method] ?? o.method), m(o.amount)]),
      ].map(([k, v]) => (
        <div key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></div>
      ))}
      <div className="my-1.5 border-t border-dashed border-black" />
      <div>{t("Closed by {name}, {date}", { name: close.closed_by_name ?? "—", date: formatDateTime(close.closed_at) })}</div>
      {close.note && <div>{close.note === AUTO_CLOSE_NOTE ? t(AUTO_CLOSE_NOTE) : t("Note: {note}", { note: close.note })}</div>}
      <div className="mt-6">{t("Signature:")} ________________</div>
    </div>
  );
}

