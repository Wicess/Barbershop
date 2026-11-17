"use client";

import { useEffect, useState } from "react";
import { ChevronLeft, ChevronRight, Printer, Wallet } from "lucide-react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { setParams } from "@/client/router.ts";
import { ADJUSTMENT_LABEL, PAYMENT_LABEL } from "@/core/commands.ts";
import { addMonths, currentMonth, formatDate, formatMonth, toBusinessDate } from "@/core/dates.ts";
import { bpToPercent, formatMoney } from "@/core/money.ts";
import { payroll, type PayrollRow } from "@/core/reports.ts";
import type { Settings } from "@/core/settings.ts";
import { PageSize, printContent } from "@/components/print.tsx";
import {
  Badge, Button, Card, Chip, Empty, Field, IconButton, Input, Money, MoneyInput, PageHeader, Sheet, Spinner, Stat, VoidSheet, cx,
} from "@/components/ui.tsx";

export function PayrollView({ params }: { params: URLSearchParams }) {
  const { settings } = useApp();
  const month = params.get("m") ?? currentMonth();
  const openId = params.get("id");
  const { data: rows } = useQuery((db) => payroll(db, month), [month]);

  const totals = (rows ?? []).reduce(
    (t, r) => ({ revenue: t.revenue + r.revenue, earned: t.earned + r.earned, net: t.net + r.netPay, paid: t.paid + r.paid }),
    { revenue: 0, earned: 0, net: 0, paid: 0 },
  );

  return (
    <div>
      <PageHeader
        title="Staff pay"
        subtitle={formatMonth(month)}
        actions={
          <>
            <IconButton label="Previous month" onClick={() => setParams({ m: addMonths(month, -1), id: null })}>
              <ChevronLeft className="size-5" />
            </IconButton>
            <IconButton label="Next month" disabled={month >= currentMonth()} onClick={() => setParams({ m: addMonths(month, 1), id: null })}>
              <ChevronRight className="size-5" />
            </IconButton>
            {rows && rows.length > 0 && (
              <IconButton label="Print pay sheet" onClick={() => printContent(<PaySheetPrint rows={rows} month={month} settings={settings} />)}>
                <Printer className="size-5" />
              </IconButton>
            )}
          </>
        }
      />

      {!rows ? (
        <Spinner />
      ) : rows.length === 0 ? (
        <Empty icon={<Wallet className="size-8" />} title="No staff yet">Add staff, record sales, and their pay is calculated here automatically.</Empty>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3 lg:grid-cols-4">
            <Stat label="Revenue by staff" value={<Money value={totals.revenue} />} />
            <Stat label="Staff share earned" value={<Money value={totals.earned} />} hint={`Shop keeps ${formatMoney(totals.revenue - totals.earned, settings.currency)}`} />
            <Stat label="Net pay due" value={<Money value={totals.net} />} hint="After salary, bonuses, advances" />
            <Stat label="Still to pay" value={<Money value={totals.net - totals.paid} />} tone={totals.net - totals.paid > 0 ? "accent" : undefined} />
          </div>

          <div className="mt-4 grid gap-3 md:grid-cols-2">
            {rows.map((r) => (
              <button
                key={r.staff_id}
                onClick={() => setParams({ id: r.staff_id })}
                className="cursor-pointer rounded-2xl border border-line bg-surface p-4 text-left transition hover:border-line-strong"
              >
                <div className="flex items-start justify-between gap-3">
                  <div>
                    <div className="text-base font-bold">{r.name}</div>
                    <div className="text-xs text-ink-3">{r.specialty ?? "Staff"} · {bpToPercent(r.commission_bp)} share</div>
                  </div>
                  {r.balance <= 0 && r.netPay > 0 ? <Badge tone="positive">Paid</Badge> : r.paid > 0 ? <Badge tone="warning">Part paid</Badge> : null}
                </div>
                <div className="mt-3 grid grid-cols-3 gap-2 text-center">
                  <Mini label="Clients" value={r.clients} />
                  <Mini label="Services" value={r.services} />
                  <Mini label="Brought in" value={<Money value={r.revenue} />} />
                </div>
                <div className="mt-3 flex items-end justify-between border-t border-line pt-3">
                  <div className="text-sm text-ink-3">
                    Earned <Money value={r.earned} className="font-semibold text-ink" />
                    {r.tips > 0 && <> · tips <Money value={r.tips} /></>}
                    {r.advances > 0 && <> · advances <Money value={-r.advances} /></>}
                  </div>
                  <div className="text-right">
                    <div className="text-xs text-ink-3">{r.balance > 0 ? "To pay" : "Net pay"}</div>
                    <Money value={r.balance > 0 ? r.balance : r.netPay} className="text-lg font-bold" />
                  </div>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <StaffPaySheet row={rows?.find((r) => r.staff_id === openId) ?? null} month={month} onClose={() => setParams({ id: null })} />
    </div>
  );
}

function Mini({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="rounded-xl bg-surface-2 px-2 py-2">
      <div className="num text-base font-bold">{value}</div>
      <div className="text-[11px] text-ink-3">{label}</div>
    </div>
  );
}

function StaffPaySheet({ row, month, onClose }: { row: PayrollRow | null; month: string; onClose: () => void }) {
  const { can, settings, run } = useApp();
  const [adding, setAdding] = useState<"advance" | "bonus" | "deduction" | "payout" | null>(null);
  const [voiding, setVoiding] = useState<{ table: "adjustment" | "payout"; id: string } | null>(null);
  const { data: entries } = useQuery(async (db) => {
    if (!row) return null;
    const adj = await db.all<{ id: string; kind: string; amount: number; note: string | null; business_date: string; voided_at: string | null; void_reason: string | null }>(
      "SELECT id, kind, amount, note, business_date, voided_at, void_reason FROM staff_adjustments WHERE staff_id = ? AND month = ? ORDER BY created_at",
      [row.staff_id, month],
    );
    const pays = await db.all<{ id: string; amount: number; method: string; note: string | null; business_date: string; voided_at: string | null; void_reason: string | null }>(
      "SELECT id, amount, method, note, business_date, voided_at, void_reason FROM payouts WHERE staff_id = ? AND month = ? ORDER BY created_at",
      [row.staff_id, month],
    );
    return { adj, pays };
  }, [row?.staff_id, month]);

  if (!row) return null;
  const line = (label: string, value: number, bold?: boolean) => (
    <div className={cx("flex justify-between py-1 text-sm", bold && "border-t border-line-strong pt-2 font-bold")}>
      <span>{label}</span>
      <Money value={value} />
    </div>
  );

  return (
    <>
      <Sheet
        open={!adding && !voiding}
        onClose={onClose}
        title={`${row.name} · ${formatMonth(month)}`}
        wide
        footer={
          <div className="flex flex-wrap gap-2">
            <Button variant="secondary" onClick={() => printContent(<PayslipPrint row={row} month={month} settings={settings} />)}>
              <Printer className="size-4" /> Payslip
            </Button>
            {can("payroll.pay") && (
              <Button className="flex-1" onClick={() => setAdding("payout")} disabled={row.balance <= 0}>
                Record payment
              </Button>
            )}
          </div>
        }
      >
        <div className="space-y-5">
          <div>
            <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Work this month</h3>
            <table className="num w-full text-sm">
              <thead>
                <tr className="text-left text-xs text-ink-3">
                  <th className="py-1 font-semibold">Section</th>
                  <th className="py-1 text-right font-semibold">Services</th>
                  <th className="py-1 text-right font-semibold">Brought in</th>
                  <th className="py-1 text-right font-semibold">Share</th>
                </tr>
              </thead>
              <tbody>
                {row.byDepartment.map((d) => (
                  <tr key={d.department} className="border-t border-line">
                    <td className="py-2">{d.department}</td>
                    <td className="py-2 text-right">{d.services}</td>
                    <td className="py-2 text-right"><Money value={d.revenue} /></td>
                    <td className="py-2 text-right font-semibold"><Money value={d.earned} /></td>
                  </tr>
                ))}
                {row.byDepartment.length === 0 && (
                  <tr><td colSpan={4} className="py-3 text-center text-ink-3">No services this month.</td></tr>
                )}
              </tbody>
            </table>
            <p className="mt-2 text-xs text-ink-3">
              {row.clients} client{row.clients === 1 ? "" : "s"}. Out of <Money value={row.revenue} /> brought in, the shop keeps <Money value={row.shopShare} />.
            </p>
          </div>

          <div className="rounded-2xl bg-surface-2 p-4">
            {line("Share earned", row.earned)}
            {row.tips > 0 && line("Tips from customers", row.tips)}
            {row.baseSalary > 0 && line("Monthly salary", row.baseSalary)}
            {row.bonuses > 0 && line("Bonuses", row.bonuses)}
            {row.deductions > 0 && line("Deductions", -row.deductions)}
            {row.advances > 0 && line("Advances already taken", -row.advances)}
            {line("Net pay", row.netPay, true)}
            {row.paid > 0 && line("Paid so far", -row.paid)}
            {row.paid > 0 && line(row.balance >= 0 ? "Balance to pay" : "Overpaid", row.balance, true)}
          </div>

          <div className="flex flex-wrap gap-2">
            {can("staff.adjust") && <Chip onClick={() => setAdding("advance")}>+ Advance</Chip>}
            {can("staff.setPay") && <Chip onClick={() => setAdding("bonus")}>+ Bonus</Chip>}
            {can("staff.setPay") && <Chip onClick={() => setAdding("deduction")}>+ Deduction</Chip>}
          </div>

          {entries && (entries.adj.length > 0 || entries.pays.length > 0) && (
            <div>
              <h3 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Entries</h3>
              <ul className="divide-y divide-line rounded-2xl border border-line">
                {entries.adj.map((a) => (
                  <EntryRow
                    key={a.id}
                    label={ADJUSTMENT_LABEL[a.kind]}
                    detail={`${formatDate(a.business_date)}${a.note ? ` · ${a.note}` : ""}`}
                    amount={a.kind === "bonus" ? a.amount : -a.amount}
                    voided={a.voided_at ? a.void_reason : null}
                    onVoid={(a.kind === "advance" ? can("staff.adjust") : can("staff.setPay")) ? () => setVoiding({ table: "adjustment", id: a.id }) : undefined}
                  />
                ))}
                {entries.pays.map((p) => (
                  <EntryRow
                    key={p.id}
                    label={`Paid (${PAYMENT_LABEL[p.method] ?? p.method})`}
                    detail={`${formatDate(p.business_date)}${p.note ? ` · ${p.note}` : ""}`}
                    amount={p.amount}
                    voided={p.voided_at ? p.void_reason : null}
                    onVoid={can("payroll.pay") ? () => setVoiding({ table: "payout", id: p.id }) : undefined}
                  />
                ))}
              </ul>
            </div>
          )}
        </div>
      </Sheet>

      <MoneyEntrySheet
        kind={adding}
        defaultAmount={adding === "payout" ? Math.max(row.balance, 0) : null}
        staffName={row.name}
        onClose={() => setAdding(null)}
        onSave={async ({ amount, note, paidFrom, method }) => {
          const base = { id: crypto.randomUUID(), staff_id: row.staff_id, month, amount, note, paid_from: paidFrom, business_date: toBusinessDate() };
          const ok = adding === "payout"
            ? await run("payout.create", { ...base, method }, "Payment recorded")
            : await run("adjustment.create", { ...base, kind: adding }, `${ADJUSTMENT_LABEL[adding!]} recorded`);
          if (ok) setAdding(null);
        }}
      />

      <VoidSheet
        open={!!voiding}
        onClose={() => setVoiding(null)}
        title="Void entry"
        onConfirm={(reason) =>
          voiding!.table === "payout"
            ? run("payout.void", { id: voiding!.id, reason }, "Voided")
            : run("adjustment.void", { id: voiding!.id, reason }, "Voided")
        }
      />
    </>
  );
}

function EntryRow({
  label, detail, amount, voided, onVoid,
}: { label: string; detail: string; amount: number; voided: string | null; onVoid?: () => void }) {
  return (
    <li className="flex items-center gap-3 px-4 py-2.5">
      <div className="min-w-0 flex-1">
        <div className={cx("text-sm font-semibold", voided && "text-ink-3 line-through")}>{label}</div>
        <div className="truncate text-xs text-ink-3">{voided ? `Voided: ${voided}` : detail}</div>
      </div>
      <Money value={amount} className={cx("font-semibold", voided && "text-ink-3 line-through")} />
      {onVoid && !voided && (
        <button className="min-h-11 cursor-pointer px-2 text-xs font-semibold text-negative" onClick={onVoid}>
          Void
        </button>
      )}
    </li>
  );
}

function MoneyEntrySheet({
  kind, defaultAmount, staffName, onClose, onSave,
}: {
  kind: "advance" | "bonus" | "deduction" | "payout" | null;
  defaultAmount: number | null;
  staffName: string;
  onClose: () => void;
  onSave: (v: { amount: number; note: string; paidFrom: "till" | "other"; method: string }) => Promise<void>;
}) {
  const [amount, setAmount] = useState<number | null>(null);
  const [note, setNote] = useState("");
  const [paidFrom, setPaidFrom] = useState<"till" | "other">("till");
  const [method, setMethod] = useState("cash");
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (kind) {
      setAmount(defaultAmount || null);
      setNote("");
      setPaidFrom(kind === "payout" ? "other" : "till");
      setMethod("cash");
    }
  }, [kind, defaultAmount]);
  if (!kind) return null;
  const titles = { advance: "Give an advance", bonus: "Add a bonus", deduction: "Add a deduction", payout: "Record payment" };
  const takesCash = kind === "advance" || kind === "payout";
  return (
    <Sheet
      open
      onClose={onClose}
      title={`${titles[kind]} · ${staffName}`}
      footer={
        <Button
          block
          size="lg"
          loading={busy}
          disabled={!amount || amount <= 0}
          onClick={async () => {
            setBusy(true);
            await onSave({ amount: amount!, note, paidFrom, method });
            setBusy(false);
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Amount" htmlFor="amt" hint={kind === "advance" ? "Taken off this month's pay automatically." : kind === "deduction" ? "e.g. a fine or damaged item. Reduces net pay." : undefined}>
          <MoneyInput id="amt" value={amount} onChange={setAmount} autoFocus />
        </Field>
        {kind === "payout" && (
          <Field label="Paid by">
            <div className="flex flex-wrap gap-2">
              {["cash", "mobile", "bank"].map((m) => (
                <Chip key={m} active={method === m} onClick={() => setMethod(m)}>{PAYMENT_LABEL[m]}</Chip>
              ))}
            </div>
          </Field>
        )}
        {takesCash && (
          <Field label="Money taken from" hint="If it came out of the cash drawer, the day's cash count accounts for it.">
            <div className="flex gap-2">
              <Chip active={paidFrom === "till"} onClick={() => setPaidFrom("till")}>Cash drawer</Chip>
              <Chip active={paidFrom === "other"} onClick={() => setPaidFrom("other")}>Elsewhere</Chip>
            </div>
          </Field>
        )}
        <Field label="Note (optional)" htmlFor="note">
          <Input id="note" value={note} onChange={(e) => setNote(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

function PayslipPrint({ row, month, settings }: { row: PayrollRow; month: string; settings: Settings }) {
  const m = (v: number) => formatMoney(v, settings.currency);
  return (
    <div className="report-print">
      <PageSize size={settings.paper_width === "a4" ? "a4" : settings.paper_width} />
      <h1 style={{ fontSize: 16, fontWeight: 700 }}>{settings.shop_name}</h1>
      <p>Payslip · {row.name} · {formatMonth(month)}</p>
      <table style={{ marginTop: 8 }}>
        <tbody>
          <tr><td>Clients served</td><td className="r">{row.clients}</td></tr>
          <tr><td>Services done</td><td className="r">{row.services}</td></tr>
          {row.byDepartment.map((d) => (
            <tr key={d.department}><td style={{ paddingLeft: 12 }}>{d.department}: {d.services} · {m(d.revenue)}</td><td className="r">{m(d.earned)}</td></tr>
          ))}
          <tr><td>Total brought in</td><td className="r">{m(row.revenue)}</td></tr>
          <tr><td>Share rate</td><td className="r">{bpToPercent(row.commission_bp)}</td></tr>
          <tr><td><b>Share earned</b></td><td className="r"><b>{m(row.earned)}</b></td></tr>
          {row.tips > 0 && <tr><td>Tips from customers</td><td className="r">{m(row.tips)}</td></tr>}
          {row.baseSalary > 0 && <tr><td>Monthly salary</td><td className="r">{m(row.baseSalary)}</td></tr>}
          {row.bonuses > 0 && <tr><td>Bonuses</td><td className="r">{m(row.bonuses)}</td></tr>}
          {row.deductions > 0 && <tr><td>Deductions</td><td className="r">−{m(row.deductions)}</td></tr>}
          {row.advances > 0 && <tr><td>Advances</td><td className="r">−{m(row.advances)}</td></tr>}
          <tr><td><b>Net pay</b></td><td className="r"><b>{m(row.netPay)}</b></td></tr>
          <tr><td>Paid</td><td className="r">{m(row.paid)}</td></tr>
          <tr><td><b>Balance</b></td><td className="r"><b>{m(row.balance)}</b></td></tr>
        </tbody>
      </table>
      <p style={{ marginTop: 24 }}>Received by: ____________________ &nbsp; Date: __________</p>
    </div>
  );
}

function PaySheetPrint({ rows, month, settings }: { rows: PayrollRow[]; month: string; settings: Settings }) {
  const m = (v: number) => formatMoney(v, settings.currency);
  return (
    <div className="report-print">
      <PageSize size="a4" />
      <h1 style={{ fontSize: 18, fontWeight: 700 }}>{settings.shop_name} — Staff pay, {formatMonth(month)}</h1>
      <p>Printed {new Date().toLocaleString()}</p>
      <table style={{ marginTop: 12 }}>
        <thead>
          <tr>
            <th>Name</th><th className="r">Clients</th><th className="r">Services</th><th className="r">Brought in</th><th className="r">Rate</th>
            <th className="r">Share</th><th className="r">Salary</th><th className="r">Bonus</th><th className="r">Deduct.</th><th className="r">Advances</th>
            <th className="r">Net pay</th><th className="r">Paid</th><th className="r">Balance</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => (
            <tr key={r.staff_id}>
              <td>{r.name}</td><td className="r">{r.clients}</td><td className="r">{r.services}</td><td className="r">{m(r.revenue)}</td>
              <td className="r">{bpToPercent(r.commission_bp)}</td><td className="r">{m(r.earned)}</td><td className="r">{m(r.baseSalary)}</td>
              <td className="r">{m(r.bonuses)}</td><td className="r">{m(r.deductions)}</td><td className="r">{m(r.advances)}</td>
              <td className="r"><b>{m(r.netPay)}</b></td><td className="r">{m(r.paid)}</td><td className="r"><b>{m(r.balance)}</b></td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
