"use client";

import { Fragment, type ReactNode } from "react";
import { ArrowDownLeft, ArrowUpRight, BookOpen, Printer } from "lucide-react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { go, setParams } from "@/client/router.ts";
import { PAYMENT_LABEL } from "@/core/commands.ts";
import { formatDate, formatMonth, formatTime, presetPeriod, toBusinessDate } from "@/core/dates.ts";
import { formatMoney } from "@/core/money.ts";
import { locale, t, tk } from "@/core/i18n.ts";
import { cashbook, type CashEntry, type CashKind, type Cashbook } from "@/core/reports.ts";
import type { Settings } from "@/core/settings.ts";
import { PageSize, printContent } from "@/components/print.tsx";
import { Button, Card, Chip, Empty, Money, PageHeader, SectionTitle, Spinner, Stat, cx } from "@/components/ui.tsx";

const PERIODS = [["today", tk("Today")], ["yesterday", tk("Yesterday")], ["week", tk("This week")], ["month", tk("This month")], ["lastMonth", tk("Last month")]] as const;
type PeriodKey = (typeof PERIODS)[number][0];

const KIND_LABEL: Record<CashKind, string> = {
  sale: tk("Customer payments"),
  refund: tk("Refunds (voided sales)"),
  expense: tk("Expenses"),
  advance: tk("Staff advances"),
  staff_pay: tk("Staff payments"),
  stock: tk("Stock bought"),
};

const localDate = (iso: string) => toBusinessDate(new Date(iso));

const methodLabel = (m: string | null) =>
  m === "till" ? t("Cash drawer") : m === "other" ? t("Paid elsewhere") : m ? t(PAYMENT_LABEL[m] ?? m) : null;

/**
 * The cash book builds its labels in English (core/reports.ts); show them in
 * the phone's language by reading the stored values back out of them.
 */
function entryLabel(e: CashEntry): string {
  let m: RegExpMatchArray | null;
  switch (e.kind) {
    case "sale":
      return (m = e.label.match(/^Sale (.+)$/)) ? t("Sale {receipt}", { receipt: m[1] }) : e.label;
    case "refund":
      return (m = e.label.match(/^Voided sale (.+)$/)) ? t("Voided sale {receipt}", { receipt: m[1] }) : e.label;
    case "advance":
      return (m = e.label.match(/^Advance to (.+)$/)) ? t("Advance to {name}", { name: m[1] }) : e.label;
    case "staff_pay":
      return (m = e.label.match(/^Pay to (.+)$/)) ? t("Pay to {name}", { name: m[1] }) : e.label;
    case "stock":
      return (m = e.label.match(/^Bought stock: (.+)$/)) ? t("Bought stock: {product}", { product: m[1] }) : e.label;
    case "expense":
      return t(e.label); // a category, or the shop's own description (left as typed)
    default:
      return e.label;
  }
}

function entryDetail(e: CashEntry): string | null {
  if (!e.detail) return null;
  if (e.kind === "staff_pay") {
    const m = e.detail.match(/^For (\d{4}-\d{2})(?: · ([\s\S]*))?$/);
    if (m) {
      const forMonth = t("For {month}", { month: formatMonth(m[1]) });
      return m[2] ? `${forMonth} · ${m[2]}` : forMonth;
    }
  }
  // Expense category and section, both stored in English.
  if (e.kind === "expense") return e.detail.split(" · ").map((part) => t(part)).join(" · ");
  return e.detail;
}

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
        title={t("Money in & out")}
        subtitle={t("Every payment in and every franc out")}
        actions={
          data && (
            <Button variant="secondary" size="sm" onClick={() => printContent(<CashbookPrint book={data} settings={settings} from={period.from} to={period.to} />)}>
              <Printer className="size-4" /> {t("Print")}
            </Button>
          )
        }
      />
      <div className="chip-scroll -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {PERIODS.map(([k, label]) => (
          <Chip key={k} active={key === k} onClick={() => setParams({ p: k })}>{t(label)}</Chip>
        ))}
      </div>

      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="xl:grid xl:grid-cols-[minmax(0,1fr)_minmax(0,1fr)] xl:items-start xl:gap-4">
          <div>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat label={t("Money in")} value={<Money value={data.totalIn} />} tone="positive" />
            <Stat label={t("Money out")} value={<Money value={data.totalOut} />} tone="negative" />
            <Stat label={t("Net balance")} value={<Money value={data.net} />} tone={data.net >= 0 ? "positive" : "negative"} />
          </div>
          <p className="mt-3 hidden text-xs text-ink-3 xl:block">
            {rich(t("This is the money that actually moved. Staff cuts count here when the shop pays them; your {link} counts them as soon as they're earned."), {
              link: <button className="cursor-pointer font-semibold text-accent" onClick={() => go("/reports")}>{t("profit report")}</button>,
            })}
          </p>
          </div>

          <Card className="mt-3 divide-y divide-line xl:mt-0">
            {(Object.keys(KIND_LABEL) as CashKind[]).filter((k) => data.byKind[k] > 0).map((k) => (
              <div key={k} className="flex items-center justify-between gap-3 px-4 py-2.5 text-sm lg:py-2">
                <span className="flex items-center gap-2 text-ink-2">
                  {k === "sale" ? <ArrowDownLeft className="size-4 text-positive" /> : <ArrowUpRight className="size-4 text-negative" />}
                  {t(KIND_LABEL[k])}
                </span>
                <Money value={k === "sale" ? data.byKind[k] : -data.byKind[k]} className="font-semibold" />
              </div>
            ))}
          </Card>
          </div>
          <p className="mt-2 text-xs text-ink-3 xl:hidden">
            {rich(t("This is the money that actually moved. Staff cuts count here when the shop pays them; your {link} counts them as soon as they're earned."), {
              link: <button className="cursor-pointer font-semibold text-accent" onClick={() => go("/reports")}>{t("profit report")}</button>,
            })}
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
                    {d === "all" ? t("Everything") : d === "in" ? t("In") : t("Out")}
                  </button>
                ))}
              </div>
            }
          >
            {t("Entries")}
          </SectionTitle>

          {entries.length === 0 ? (
            <Empty icon={<BookOpen className="size-8" />} title={t("Nothing recorded in this period")} />
          ) : (
            <div className="space-y-4 xl:columns-2 xl:gap-4 xl:space-y-0">
              {[...days.entries()].map(([date, list]) => {
                const dayIn = list.filter((e) => e.direction === "in").reduce((n, e) => n + e.amount, 0);
                const dayOut = list.filter((e) => e.direction === "out").reduce((n, e) => n + e.amount, 0);
                return (
                  <section key={date} className="xl:mb-4 xl:break-inside-avoid">
                    <div className="mb-1.5 flex items-baseline justify-between px-1 text-xs">
                      <span className="font-semibold text-ink-2">{formatDate(date, { weekday: "short", day: "numeric", month: "short" })}</span>
                      <span className="num text-ink-3">
                        {rich(t("in {in} · out {out}"), {
                          in: <span className="text-positive">{formatMoney(dayIn, settings.currency)}</span>,
                          out: <span className="text-negative">{formatMoney(dayOut, settings.currency)}</span>,
                        })}
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
      <span className={cx("flex size-9 shrink-0 items-center justify-center rounded-full lg:size-8", isIn ? "bg-positive-soft text-positive" : "bg-negative-soft text-negative")}>
        {isIn ? <ArrowDownLeft className="size-4" /> : <ArrowUpRight className="size-4" />}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate font-semibold">{entryLabel(e)}</span>
        <span className="block truncate text-xs text-ink-3">
          {[formatTime(e.at), methodLabel(e.method), entryDetail(e), e.by && t("by {name}", { name: e.by })].filter(Boolean).join(" · ")}
        </span>
      </span>
      <Money value={isIn ? e.amount : -e.amount} sign className={cx("shrink-0 font-bold", isIn ? "text-positive" : "text-negative")} />
    </>
  );
  return e.sale_id ? (
    <button onClick={() => go("/sales", { date: e.business_date, id: e.sale_id })} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 lg:py-2">
      {content}
    </button>
  ) : (
    <div className="flex items-center gap-3 px-4 py-3 lg:py-2">{content}</div>
  );
}

function CashbookPrint({ book, settings, from, to }: { book: Cashbook; settings: Settings; from: string; to: string }) {
  const m = (v: number) => formatMoney(v, settings.currency);
  return (
    <div className="report-print">
      <PageSize size="a4" />
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>{settings.shop_name} — {t("Money in & out")}</h1>
      <p>{t("{from} – {to} · printed {when}", { from: formatDate(from), to: formatDate(to), when: new Date().toLocaleString(locale()) })}</p>
      <table style={{ marginTop: 10 }}>
        <tbody>
          <tr><td>{t("Money in")}</td><td className="r">{m(book.totalIn)}</td></tr>
          <tr><td>{t("Money out")}</td><td className="r">{m(book.totalOut)}</td></tr>
          <tr><td><b>{t("Net balance")}</b></td><td className="r"><b>{m(book.net)}</b></td></tr>
        </tbody>
      </table>
      <table style={{ marginTop: 14 }}>
        <thead>
          <tr><th>{t("Date")}</th><th>{t("Time")}</th><th>{t("Entry")}</th><th>{t("Detail")}</th><th>{t("How")}</th><th>{t("By")}</th><th className="r">{t("In")}</th><th className="r">{t("Out")}</th></tr>
        </thead>
        <tbody>
          {[...book.entries].reverse().map((e) => (
            <tr key={e.id}>
              <td>{e.business_date}</td>
              <td>{formatTime(e.at)}</td>
              <td>{entryLabel(e)}</td>
              <td>{entryDetail(e)}</td>
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

/** Put React nodes into a translated sentence at its {placeholders}. */
function rich(text: string, nodes: Record<string, ReactNode>) {
  return text.split(/(\{\w+\})/).map((part, i) => {
    const m = part.match(/^\{(\w+)\}$/);
    return m && m[1] in nodes ? <Fragment key={i}>{nodes[m[1]]}</Fragment> : part;
  });
}
