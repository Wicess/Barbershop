"use client";

import { ArrowDownLeft, ArrowUpRight, BookOpen, Printer } from "lucide-react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { go, setParams } from "@/client/router.ts";
import { PAYMENT_LABEL } from "@/core/commands.ts";
import { formatDate, formatTime, presetPeriod, toBusinessDate } from "@/core/dates.ts";
import { formatMoney } from "@/core/money.ts";
import { cashbook, type CashEntry, type CashKind, type Cashbook } from "@/core/reports.ts";
import type { Settings } from "@/core/settings.ts";
import { PageSize, printContent } from "@/components/print.tsx";
import { Button, Card, Chip, Empty, Money, PageHeader, SectionTitle, Spinner, Stat, cx } from "@/components/ui.tsx";

const PERIODS = [["today", "Today"], ["yesterday", "Yesterday"], ["week", "This week"], ["month", "This month"], ["lastMonth", "Last month"]] as const;
type PeriodKey = (typeof PERIODS)[number][0];

const KIND_LABEL: Record<CashKind, string> = {
  sale: "Customer payments",
  refund: "Refunds (voided sales)",
  expense: "Expenses",
  advance: "Staff advances",
  staff_pay: "Staff payments",
  stock: "Stock bought",
};

const localDate = (iso: string) => toBusinessDate(new Date(iso));

const methodLabel = (m: string | null) =>
  m === "till" ? "Cash drawer" : m === "other" ? "Paid elsewhere" : m ? PAYMENT_LABEL[m] ?? m : null;

/** The book of every coin that came in or went out, newest first, grouped by day. */
export function MoneyView({ params }: { params: URLSearchParams }) {
  const { settings } = useApp();
  const key = (PERIODS.some(([k]) => k === params.get("p")) ? params.get("p") : "month") as PeriodKey;
  const dir = (params.get("dir") ?? "all") as "all" | "in" | "out";
  const period = presetPeriod(key);
  const { data } = useQuery((db) => cashbook(db, period.from, period.to, localDate), [period.from, period.to]);

  const entries = (data?.entries ?? []).filter((e) => dir === "all" || e.direction === dir);
  const days = new Map<string, CashEntry[]>();
  for (const e of entries) days.set(e.business_date, [...(days.get(e.business_date) ?? []), e]);

  return (
    <div>
      <PageHeader
        title="Money in & out"
        subtitle="Every payment received and every shilling paid out"
        actions={
          data && (
            <Button variant="secondary" size="sm" onClick={() => printContent(<CashbookPrint book={data} settings={settings} from={period.from} to={period.to} />)}>
              <Printer className="size-4" /> Print
            </Button>
          )
        }
      />
      <div className="chip-scroll -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {PERIODS.map(([k, label]) => (
          <Chip key={k} active={key === k} onClick={() => setParams({ p: k })}>{label}</Chip>
        ))}
      </div>

      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat label="Money in" value={<Money value={data.totalIn} />} tone="positive" />
            <Stat label="Money out" value={<Money value={data.totalOut} />} tone="negative" />
            <Stat label="Difference" value={<Money value={data.net} />} tone={data.net >= 0 ? "positive" : "negative"} />
          </div>

          <Card className="mt-3 divide-y divide-line">
            {(Object.keys(KIND_LABEL) as CashKind[]).filter((k) => data.byKind[k] > 0).map((k) => (
              <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm">
                <span className="flex items-center gap-2 text-ink-2">
                  {k === "sale" ? <ArrowDownLeft className="size-4 text-positive" /> : <ArrowUpRight className="size-4 text-negative" />}
                  {KIND_LABEL[k]}
                </span>
                <Money value={k === "sale" ? data.byKind[k] : -data.byKind[k]} className="font-semibold" />
              </div>
            ))}
          </Card>
          <p className="mt-2 text-xs text-ink-3">
            This is the money that actually moved. Staff cuts count here when the shop pays them; your{" "}
            <button className="cursor-pointer font-semibold text-accent" onClick={() => go("/reports")}>profit report</button>{" "}
            counts them as soon as they're earned.
          </p>

          <SectionTitle
            action={
              <div className="flex gap-1">
                {(["all", "in", "out"] as const).map((d) => (
                  <button
                    key={d}
                    onClick={() => setParams({ dir: d === "all" ? null : d })}
                    className={cx("min-h-9 cursor-pointer rounded-full px-3 text-xs font-semibold", dir === d ? "bg-primary text-on-primary" : "text-ink-3 hover:bg-surface-2")}
                  >
                    {d === "all" ? "All" : d === "in" ? "In" : "Out"}
                  </button>
                ))}
              </div>
            }
          >
            Entries
          </SectionTitle>

          {entries.length === 0 ? (
            <Empty icon={<BookOpen className="size-8" />} title="Nothing recorded in this period" />
          ) : (
            <div className="space-y-4">
              {[...days.entries()].map(([date, list]) => {
                const dayIn = list.filter((e) => e.direction === "in").reduce((n, e) => n + e.amount, 0);
                const dayOut = list.filter((e) => e.direction === "out").reduce((n, e) => n + e.amount, 0);
                return (
                  <section key={date}>
                    <div className="mb-1.5 flex items-baseline justify-between px-1 text-xs">
                      <span className="font-semibold text-ink-2">{formatDate(date, { weekday: "short", day: "numeric", month: "short" })}</span>
                      <span className="num text-ink-3">
                        in <span className="text-positive">{formatMoney(dayIn, settings.currency)}</span> · out{" "}
                        <span className="text-negative">{formatMoney(dayOut, settings.currency)}</span>
                      </span>
                    </div>
                    <Card className="divide-y divide-line">
                      {list.map((e) => (
                        <EntryRow key={e.id} e={e} />
                      ))}
                    </Card>
                  </section>
                );
              })}
            </div>
          )}
        </>
      )}
    </div>
  );
}

function EntryRow({ e }: { e: CashEntry }) {
  const isIn = e.direction === "in";
  const content = (
    <>
      <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-full", isIn ? "bg-positive-soft text-positive" : "bg-negative-soft text-negative")}>
        {isIn ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{e.label}</span>
        <span className="block truncate text-xs text-ink-3">
          {[formatTime(e.at), methodLabel(e.method), e.detail, e.by && `by ${e.by}`].filter(Boolean).join(" · ")}
        </span>
      </span>
      <Money value={isIn ? e.amount : -e.amount} sign className={cx("shrink-0 font-bold", isIn ? "text-positive" : "text-negative")} />
    </>
  );
  return e.sale_id ? (
    <button onClick={() => go("/sales", { date: e.business_date, id: e.sale_id })} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
      {content}
    </button>
  ) : (
    <div className="flex items-center gap-3 px-4 py-3">{content}</div>
  );
}

function CashbookPrint({ book, settings, from, to }: { book: Cashbook; settings: Settings; from: string; to: string }) {
  const m = (v: number) => formatMoney(v, settings.currency);
  return (
    <div className="report-print">
      <PageSize size="a4" />
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>{settings.shop_name} — Money in & out</h1>
      <p>{formatDate(from)} – {formatDate(to)} · printed {new Date().toLocaleString()}</p>
      <table style={{ marginTop: 10 }}>
        <tbody>
          <tr><td>Money in</td><td className="r">{m(book.totalIn)}</td></tr>
          <tr><td>Money out</td><td className="r">{m(book.totalOut)}</td></tr>
          <tr><td><b>Difference</b></td><td className="r"><b>{m(book.net)}</b></td></tr>
        </tbody>
      </table>
      <table style={{ marginTop: 14 }}>
        <thead>
          <tr><th>Date</th><th>Time</th><th>Entry</th><th>Detail</th><th>How</th><th>By</th><th className="r">In</th><th className="r">Out</th></tr>
        </thead>
        <tbody>
          {[...book.entries].reverse().map((e) => (
            <tr key={e.id}>
              <td>{e.business_date}</td>
              <td>{formatTime(e.at)}</td>
              <td>{e.label}</td>
              <td>{e.detail}</td>
              <td>{methodLabel(e.method)}</td>
              <td>{e.by}</td>
              <td className="r">{e.direction === "in" ? m(e.amount) : ""}</td>
              <td className="r">{e.direction === "out" ? m(e.amount) : ""}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
