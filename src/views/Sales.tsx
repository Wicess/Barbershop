"use client";

import { useState } from "react";
import { CalendarDays, Printer, ReceiptText, Search } from "lucide-react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { setParams } from "@/client/router.ts";
import { PAYMENT_LABEL } from "@/core/commands.ts";
import { addDays, formatDate, formatTime, toBusinessDate } from "@/core/dates.ts";
import { bpToPercent } from "@/core/money.ts";
import { paymentBreakdown, saleSplit } from "@/core/reports.ts";
import { SplitCard } from "@/components/SplitCard.tsx";
import { loadReceipt, ReceiptDoc } from "@/components/Receipt.tsx";
import { printContent } from "@/components/print.tsx";
import { itemImage, Photo } from "@/components/media.tsx";
import { SortButton, SortSheet, SortSummary, sortRows, useSortRules, type SortKey } from "@/components/sort.tsx";
import {
  Badge, Button, Empty, Input, Money, PageHeader, Sheet, Spinner, Stat, VoidSheet, cx,
} from "@/components/ui.tsx";

interface SaleRow {
  id: string;
  receipt_no: string;
  created_at: string;
  total: number;
  status: string;
  customer_name: string | null;
  items: string;
  methods: string;
}

/** What a day's receipts can be sorted by. */
const SALE_SORT: SortKey<SaleRow>[] = [
  { id: "time", label: "Time", get: (s) => s.created_at, words: ["Oldest first", "Newest first"] },
  { id: "amount", label: "Amount", get: (s) => s.total, words: ["Low to high", "High to low"] },
  { id: "receipt", label: "Receipt number", get: (s) => s.receipt_no, words: ["First to last", "Last to first"] },
  { id: "customer", label: "Customer", get: (s) => s.customer_name, words: ["A to Z", "Z to A"] },
  { id: "items", label: "Number of items", get: (s) => (s.items ? s.items.split(", ").length : 0), words: ["Fewest first", "Most first"] },
  { id: "payment", label: "Payment method", get: (s) => s.methods, words: ["A to Z", "Z to A"] },
  { id: "status", label: "Status", get: (s) => s.status, words: ["Completed first", "Voided first"] },
];

export function SalesView({ params }: { params: URLSearchParams }) {
  const { can } = useApp();
  const today = toBusinessDate();
  const date = can("sales.viewAll") ? params.get("date") ?? today : today;
  const [search, setSearch] = useState("");
  const openId = params.get("id");

  const { data } = useQuery(async (db) => ({
    sales: await db.all<SaleRow>(
      `SELECT s.id, s.receipt_no, s.created_at, s.total, s.status, s.customer_name,
              (SELECT GROUP_CONCAT(name, ', ') FROM sale_lines WHERE sale_id = s.id) AS items,
              (SELECT GROUP_CONCAT(DISTINCT method) FROM payments WHERE sale_id = s.id) AS methods
         FROM sales s WHERE s.business_date = ? ORDER BY s.created_at DESC`,
      [date],
    ),
    methods: await paymentBreakdown(db, date, date),
  }), [date]);

  const sort = useSortRules("sales", [{ id: "time", dir: "desc" }]);
  const [sorting, setSorting] = useState(false);
  const q = search.trim().toLowerCase();
  const sales = sortRows(
    (data?.sales ?? []).filter(
      (s) => !q || s.receipt_no.toLowerCase().includes(q) || (s.customer_name ?? "").toLowerCase().includes(q) || (s.items ?? "").toLowerCase().includes(q),
    ),
    SALE_SORT,
    sort.rules,
  );
  const completed = (data?.sales ?? []).filter((s) => s.status === "completed");
  const total = completed.reduce((n, s) => n + s.total, 0);

  return (
    <div>
      <PageHeader
        title="Sales"
        subtitle={date === today ? "Today" : formatDate(date, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
        actions={
          <>
            <SortButton count={sort.rules.length} onClick={() => setSorting(true)} />
            {can("sales.viewAll") && (
              // Any older date: a round calendar button with the native picker laid over it.
              <label className="relative flex size-11 cursor-pointer items-center justify-center rounded-full text-ink ring-1 ring-line-strong transition-transform active:scale-90" title="Choose a date">
                <CalendarDays className="size-5" />
                <input
                  type="date"
                  aria-label="Choose date"
                  value={date}
                  max={today}
                  onChange={(e) => e.target.value && setParams({ date: e.target.value })}
                  className="absolute inset-0 cursor-pointer opacity-0"
                />
              </label>
            )}
          </>
        }
      />
      <SortSheet open={sorting} onClose={() => setSorting(false)} keys={SALE_SORT} rules={sort.rules} onChange={sort.setRules} onReset={sort.reset} />
      {can("sales.viewAll") && <DayStrip date={date} today={today} />}

      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 sm:grid-cols-4">
            <Stat label="Total" value={<Money value={total} />} hint={`${completed.length} sale${completed.length === 1 ? "" : "s"}`} />
            {data.methods.map((m) => (
              <Stat key={m.method} label={PAYMENT_LABEL[m.method] ?? m.method} value={<Money value={m.amount} />} hint={`${m.count} payment${m.count === 1 ? "" : "s"}`} />
            ))}
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Input className="pl-10" placeholder="Search receipt, customer or service" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search sales" />
          </div>

          <div className="mt-3">
            {sales.length > 1 && <SortSummary keys={SALE_SORT} rules={sort.rules} onOpen={() => setSorting(true)} />}
            {sales.length === 0 ? (
              <Empty icon={<ReceiptText className="size-8" />} title={q ? "No matching sales" : "No sales on this day"} />
            ) : (
              <ul className="stagger space-y-2.5">
                {sales.map((s) => {
                  const first = (s.items ?? "").split(", ")[0] ?? "";
                  const voided = s.status === "voided";
                  return (
                    <li key={s.id}>
                      <button
                        onClick={() => setParams({ id: s.id })}
                        className="press flex w-full cursor-pointer items-center gap-3.5 rounded-[22px] bg-surface p-2.5 pr-4 text-left ring-1 ring-line transition-colors hover:bg-surface-2"
                      >
                        <Photo src={itemImage(first, "")} alt="" className={cx("size-16 shrink-0 rounded-2xl", voided && "grayscale")} />
                        <span className="min-w-0 flex-1">
                          <span className={cx("block truncate font-semibold", voided && "text-ink-3 line-through")}>{s.items || "Sale"}</span>
                          <span className="mt-0.5 flex items-center gap-1.5 text-xs text-ink-3">
                            <span className="num font-semibold text-ink-2">{s.receipt_no}</span>
                            <span aria-hidden>·</span>
                            <span>{formatTime(s.created_at)}</span>
                            {voided && <Badge tone="negative">Voided</Badge>}
                          </span>
                          <span className="mt-0.5 block truncate text-xs text-ink-3">
                            {(s.methods ?? "").split(",").map((m) => PAYMENT_LABEL[m] ?? m).join(" + ")}
                            {s.customer_name ? ` · ${s.customer_name}` : ""}
                          </span>
                        </span>
                        <Money value={s.total} className={cx("shrink-0 text-[15px] font-extrabold", voided ? "text-ink-3 line-through" : "text-accent")} />
                      </button>
                    </li>
                  );
                })}
              </ul>
            )}
          </div>
        </>
      )}

      <SaleDetail id={openId} onClose={() => setParams({ id: null })} />
    </div>
  );
}

/**
 * A week of days to tap through, like a fixtures calendar. Normally ends today;
 * when an older date is picked it keeps that day in view.
 */
function DayStrip({ date, today }: { date: string; today: string }) {
  const end = addDays(date, 3) < today ? addDays(date, 3) : today;
  const days = Array.from({ length: 7 }, (_, i) => addDays(end, i - 6));
  return (
    <div role="radiogroup" aria-label="Day" className="-mt-1 mb-5 grid grid-cols-7 gap-1.5">
      {days.map((d) => {
        const active = d === date;
        return (
          <button
            key={d}
            role="radio"
            aria-checked={active}
            aria-label={formatDate(d, { weekday: "long", day: "numeric", month: "long" })}
            onClick={() => setParams({ date: d === today ? null : d })}
            className={cx(
              "press flex h-[66px] cursor-pointer flex-col items-center justify-center gap-0.5 rounded-2xl transition-[background-color,color,box-shadow] duration-200",
              active ? "bg-primary text-on-primary shadow-cta" : "text-ink-2 hover:bg-surface",
            )}
          >
            <span className={cx("text-[12px] font-medium", !active && d === today && "text-accent")}>{formatDate(d, { weekday: "short" })}</span>
            <span className="num text-[18px] font-bold leading-none">{Number(d.slice(8, 10))}</span>
          </button>
        );
      })}
    </div>
  );
}

function SaleDetail({ id, onClose }: { id: string | null; onClose: () => void }) {
  const { can, run, settings } = useApp();
  const [voiding, setVoiding] = useState(false);
  const { data } = useQuery(async (db) => {
    if (!id) return null;
    const receipt = await loadReceipt(db, id);
    const split = await saleSplit(db, id);
    const voider = receipt?.sale.status === "voided"
      ? await db.get<{ name: string }>("SELECT u.name FROM sales s JOIN users u ON u.id = s.voided_by WHERE s.id = ?", [id])
      : undefined;
    return receipt ? { receipt, split, voider: voider?.name } : null;
  }, [id]);

  if (!id) return null;
  const sale = data?.receipt.sale;

  return (
    <>
      <Sheet
        open={!!id && !voiding}
        onClose={onClose}
        title={sale ? `Receipt ${sale.receipt_no}` : "Receipt"}
        footer={
          data ? (
            <div className="flex gap-2">
              {can("sale.void") && sale?.status === "completed" && (
                <Button variant="secondary" className="text-negative" onClick={() => setVoiding(true)}>
                  Void sale
                </Button>
              )}
              <Button block onClick={() => printContent(<ReceiptDoc data={data.receipt} settings={settings} />)}>
                <Printer className="size-4" /> Print receipt
              </Button>
            </div>
          ) : undefined
        }
      >
        {!data ? (
          <Spinner />
        ) : (
          <div className="space-y-4">
            {sale?.status === "voided" && (
              <div className="rounded-xl bg-negative-soft p-3 text-sm text-negative">
                Voided{data.voider ? ` by ${data.voider}` : ""}: {sale.void_reason}
              </div>
            )}
            {can("payroll.view") && (
              <div>
                <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Who gets what</h3>
                <SplitCard split={data.split} />
              </div>
            )}
            <div>
              {can("payroll.view") && <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Receipt</h3>}
              <div className="rounded-xl bg-white p-2">
                <ReceiptDoc data={data.receipt} settings={{ ...settings, paper_width: "a4" }} />
              </div>
            </div>
          </div>
        )}
      </Sheet>
      <VoidSheet
        open={voiding}
        onClose={() => setVoiding(false)}
        title={`Void receipt ${sale?.receipt_no ?? ""}`}
        onConfirm={(reason) => run("sale.void", { id: id!, reason, business_date: toBusinessDate() }, "Sale voided")}
      >
        {sale && (
          <p className="text-sm">
            Total <Money value={sale.total} className="font-semibold" />. Any drinks on it go back into stock and staff shares are removed.
          </p>
        )}
      </VoidSheet>
    </>
  );
}
