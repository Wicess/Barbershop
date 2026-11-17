"use client";

import { useEffect, useState } from "react";
import { CheckCircle2, Printer, TriangleAlert } from "lucide-react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { setParams } from "@/client/router.ts";
import { PAYMENT_LABEL } from "@/core/commands.ts";
import { formatDate, formatDateTime, toBusinessDate } from "@/core/dates.ts";
import { formatMoney } from "@/core/money.ts";
import { cashFigures, type CashFigures } from "@/core/reports.ts";
import type { Settings } from "@/core/settings.ts";
import { PageSize, printContent } from "@/components/print.tsx";
import { Button, Card, Field, Money, MoneyInput, PageHeader, Spinner, Textarea, cx } from "@/components/ui.tsx";

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
      "Day closed",
    );
    setBusy(false);
    setRecount(false);
  };

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader
        title="Close the day"
        subtitle={date === today ? "Today" : formatDate(date, { weekday: "long", day: "numeric", month: "long" })}
        actions={
          can("cash.reclose") && (
            <input
              type="date"
              aria-label="Choose date"
              value={date}
              max={today}
              onChange={(e) => e.target.value && setParams({ date: e.target.value })}
              className="h-11 rounded-xl border border-line-strong bg-surface px-2 text-sm"
            />
          )
        }
      />

      {showForm ? (
        <Card className="p-5">
          <ol className="space-y-5">
            <li>
              <Field label="1. Cash in the drawer when the day started" htmlFor="flt" hint="The float left for change.">
                <MoneyInput id="flt" value={float} onChange={setFloat} />
              </Field>
            </li>
            <li>
              <Field label="2. Count all the cash in the drawer now" htmlFor="cnt" hint="Count notes and coins. Don't include mobile money or card.">
                <MoneyInput id="cnt" value={counted} onChange={setCounted} autoFocus />
              </Field>
            </li>
            <li>
              <Field label="3. Notes (optional)" htmlFor="nt">
                <Textarea id="nt" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Anything the owner should know" />
              </Field>
            </li>
          </ol>
          <Button className="mt-5" block size="lg" disabled={counted == null} loading={busy} onClick={submit}>
            Close day & see result
          </Button>
          {recount && (
            <Button className="mt-2" variant="ghost" block onClick={() => setRecount(false)}>Cancel</Button>
          )}
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
  const ok = close.variance === 0;
  const short = close.variance < 0;
  return (
    <>
      <Card className={cx("flex items-center gap-3 p-4", ok ? "border-positive/40" : "border-negative/40")}>
        {ok ? <CheckCircle2 className="size-8 shrink-0 text-positive" /> : <TriangleAlert className="size-8 shrink-0 text-negative" />}
        <div>
          <p className="text-lg font-bold">
            {ok ? "Cash matches" : short ? <>Short by <Money value={-close.variance} /></> : <>Over by <Money value={close.variance} /></>}
          </p>
          <p className="text-sm text-ink-3">
            Closed {formatDateTime(close.closed_at)}{close.closed_by_name ? ` by ${close.closed_by_name}` : ""}
          </p>
        </div>
      </Card>
      <Card className="mt-3 p-4">
        <CashTable close={close} />
        {figures.otherMethods.length > 0 && (
          <div className="mt-4 border-t border-line pt-3">
            <p className="mb-1 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Not in the drawer — check against statements</p>
            {figures.otherMethods.map((m) => (
              <div key={m.method} className="flex justify-between py-1 text-sm">
                <span>{PAYMENT_LABEL[m.method] ?? m.method}</span>
                <Money value={m.amount} className="font-semibold" />
              </div>
            ))}
          </div>
        )}
        {close.note && <p className="mt-3 rounded-xl bg-surface-2 p-3 text-sm">{close.note}</p>}
      </Card>
      <div className="mt-3 flex gap-2">
        <Button variant="secondary" className="flex-1" onClick={() => printContent(<ClosePrint close={close} figures={figures} settings={settings} />)}>
          <Printer className="size-4" /> Print
        </Button>
        {onRecount && <Button variant="secondary" className="flex-1" onClick={onRecount}>Count again</Button>}
      </div>
    </>
  );
}

function CashTable({ close }: { close: CloseRow }) {
  const row = (label: string, value: number, bold?: boolean) => (
    <div className={cx("flex justify-between py-1 text-sm", bold && "border-t border-line-strong pt-2 font-bold")}>
      <span>{label}</span>
      <Money value={value} />
    </div>
  );
  return (
    <div>
      {row("Opening float", close.opening_float)}
      {row("+ Cash sales", close.cash_sales)}
      {row("− Cash paid out (expenses, advances, stock)", -close.cash_out)}
      {row("Expected in drawer", close.expected, true)}
      {row("Counted", close.counted)}
      {row("Difference", close.variance, true)}
    </div>
  );
}

function ClosePrint({ close, figures, settings }: { close: CloseRow; figures: CashFigures; settings: Settings }) {
  const m = (v: number) => formatMoney(v, settings.currency);
  return (
    <div className="receipt mx-auto" data-width={settings.paper_width}>
      <PageSize size={settings.paper_width} />
      <div className="text-center font-bold">{settings.shop_name}</div>
      <div className="text-center">Day close · {formatDate(close.business_date)}</div>
      <div className="my-1.5 border-t border-dashed border-black" />
      {[
        ["Sales count", String(figures.salesCount)],
        ["Opening float", m(close.opening_float)],
        ["Cash sales", m(close.cash_sales)],
        ["Expenses from drawer", m(figures.tillExpenses)],
        ["Staff money from drawer", m(figures.tillStaffMoney)],
        ["Stock bought from drawer", m(figures.tillStockPurchases)],
        ["Expected", m(close.expected)],
        ["Counted", m(close.counted)],
        ["Difference", m(close.variance)],
        ...figures.otherMethods.map((o) => [PAYMENT_LABEL[o.method] ?? o.method, m(o.amount)]),
      ].map(([k, v]) => (
        <div key={k} className="flex justify-between"><span>{k}</span><span>{v}</span></div>
      ))}
      <div className="my-1.5 border-t border-dashed border-black" />
      <div>Closed by {close.closed_by_name ?? "—"}, {formatDateTime(close.closed_at)}</div>
      {close.note && <div>Note: {close.note}</div>}
      <div className="mt-6">Signature: ________________</div>
    </div>
  );
}

