"use client";

import { useEffect, useState } from "react";
import { Banknote, ChevronLeft, ChevronRight, Plus, Repeat } from "lucide-react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { go, setParams } from "@/client/router.ts";
import { EXPENSE_CATEGORIES } from "@/core/commands.ts";
import { periodSummary, type PeriodSummary } from "@/core/reports.ts";
import { addMonths, currentMonth, formatDate, formatMonth, monthRange, toBusinessDate } from "@/core/dates.ts";
import {
  Badge, Button, Card, Chip, Empty, Field, IconButton, Input, Money, MoneyInput, PageHeader, SectionTitle, Select, Sheet, Spinner, Stat, Toggle, VoidSheet, cx,
} from "@/components/ui.tsx";
import { SortButton, SortSheet, SortSummary, sortRows, useSortRules, type SortKey } from "@/components/sort.tsx";

interface ExpenseRow {
  id: string;
  category: string;
  department_id: string | null;
  amount: number;
  description: string | null;
  paid_from: string;
  business_date: string;
  recurring_id: string | null;
  voided_at: string | null;
  void_reason: string | null;
  created_by_name: string | null;
}

interface Recurring {
  id: string;
  category: string;
  department_id: string | null;
  amount: number;
  description: string | null;
  active: number;
}

export function ExpensesView({ params }: { params: URLSearchParams }) {
  const { can, run } = useApp();
  const month = params.get("m") ?? currentMonth();
  const [adding, setAdding] = useState(params.get("add") === "1");
  const [editingFixed, setEditingFixed] = useState<Recurring | "new" | null>(null);
  const [voiding, setVoiding] = useState<string | null>(null);
  const { from, to } = monthRange(month);

  const { data } = useQuery(async (db) => ({
    expenses: await db.all<ExpenseRow>(
      `SELECT e.*, u.name AS created_by_name FROM expenses e LEFT JOIN users u ON u.id = e.created_by
        WHERE e.business_date BETWEEN ? AND ? ORDER BY e.business_date DESC, e.created_at DESC`,
      [from, to],
    ),
    fixed: await db.all<Recurring>("SELECT * FROM recurring_expenses ORDER BY active DESC, category"),
    depts: await db.all<{ id: string; name: string }>("SELECT id, name FROM departments WHERE active = 1 ORDER BY sort, name"),
    summary: can("reports.profit") ? await periodSummary(db, from, month === currentMonth() ? toBusinessDate() : to) : null,
  }), [from, to]);

  const live = (data?.expenses ?? []).filter((e) => !e.voided_at);
  const total = live.reduce((n, e) => n + e.amount, 0);
  const fromTill = live.filter((e) => e.paid_from === "till").reduce((n, e) => n + e.amount, 0);
  const deptName = (id: string | null) => data?.depts.find((d) => d.id === id)?.name;
  const sort = useSortRules("expenses", [{ id: "date", dir: "desc" }]);
  const [sorting, setSorting] = useState(false);
  const EXPENSE_SORT: SortKey<ExpenseRow>[] = [
    { id: "date", label: "Date", get: (e) => e.business_date, words: ["Oldest first", "Newest first"] },
    { id: "amount", label: "Amount", get: (e) => e.amount, words: ["Low to high", "High to low"] },
    { id: "category", label: "Category", get: (e) => e.category, words: ["A to Z", "Z to A"] },
    { id: "section", label: "Section", get: (e) => deptName(e.department_id) ?? null, words: ["A to Z", "Z to A"] },
    { id: "paid", label: "Paid from", get: (e) => (e.paid_from === "till" ? "Cash drawer" : "Other"), words: ["Cash drawer first", "Other first"] },
    { id: "status", label: "Voided", get: (e) => (e.voided_at ? 1 : 0), words: ["Active first", "Voided first"] },
  ];
  const expenses = sortRows(data?.expenses ?? [], EXPENSE_SORT, sort.rules);

  return (
    <div>
      <PageHeader
        title="Expenses"
        subtitle={formatMonth(month)}
        actions={
          <>
            <IconButton label="Previous month" onClick={() => setParams({ m: addMonths(month, -1) })}><ChevronLeft className="size-5" /></IconButton>
            <IconButton label="Next month" disabled={month >= currentMonth()} onClick={() => setParams({ m: addMonths(month, 1) })}><ChevronRight className="size-5" /></IconButton>
          </>
        }
      />
      {!data ? (
        <Spinner />
      ) : (
        <>
          <div className="grid grid-cols-2 gap-3">
            <Stat label="Spent this month" value={<Money value={total} />} hint={`${live.length} expense${live.length === 1 ? "" : "s"}`} />
            <Stat label="Paid from cash drawer" value={<Money value={fromTill} />} />
          </div>
          {data.summary && <MonthProfit summary={data.summary} month={month} />}
          {can("expense.create") && (
            <Button className="mt-3" block size="lg" onClick={() => setAdding(true)}>
              <Plus className="size-5" /> Record an expense
            </Button>
          )}

          <SectionTitle
            action={can("expense.create") && (
              <button className="min-h-11 cursor-pointer text-sm font-semibold text-accent" onClick={() => setEditingFixed("new")}>+ Add</button>
            )}
          >
            Fixed monthly costs
          </SectionTitle>
          {data.fixed.length === 0 ? (
            <Card className="p-4 text-sm text-ink-3">
              Add costs you pay every month, like rent or security. They're recorded automatically on the 1st of each month.
            </Card>
          ) : (
            <Card className="divide-y divide-line">
              {data.fixed.map((f) => (
                <button
                  key={f.id}
                  disabled={!can("expense.create")}
                  onClick={() => setEditingFixed(f)}
                  className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-surface-2 disabled:cursor-default"
                >
                  <Repeat className="size-4 shrink-0 text-ink-3" />
                  <div className="min-w-0 flex-1">
                    <div className={cx("font-semibold", !f.active && "text-ink-3")}>{f.description || f.category}</div>
                    <div className="text-xs text-ink-3">{f.category}{deptName(f.department_id) ? ` · ${deptName(f.department_id)}` : ""}{!f.active && " · paused"}</div>
                  </div>
                  <Money value={f.amount} className="font-semibold" />
                </button>
              ))}
            </Card>
          )}

          <SectionTitle action={expenses.length > 1 && <SortButton count={sort.rules.length} onClick={() => setSorting(true)} />}>All expenses</SectionTitle>
          <SortSheet open={sorting} onClose={() => setSorting(false)} keys={EXPENSE_SORT} rules={sort.rules} onChange={sort.setRules} onReset={sort.reset} />
          {expenses.length > 1 && <SortSummary keys={EXPENSE_SORT} rules={sort.rules} onOpen={() => setSorting(true)} />}
          {expenses.length === 0 ? (
            <Empty icon={<Banknote className="size-8" />} title="No expenses this month" />
          ) : (
            <Card className="divide-y divide-line">
              {expenses.map((e) => (
                <div key={e.id} className="flex items-center gap-3 px-4 py-3">
                  <div className="min-w-0 flex-1">
                    <div className={cx("font-semibold", e.voided_at && "text-ink-3 line-through")}>{e.description || e.category}</div>
                    <div className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-ink-3">
                      <span>{formatDate(e.business_date, { day: "numeric", month: "short" })}</span>
                      <span>· {e.category}</span>
                      {deptName(e.department_id) && <Badge tone="accent">{deptName(e.department_id)}</Badge>}
                      {e.paid_from === "till" && <Badge>Cash drawer</Badge>}
                      {e.recurring_id && <Badge>Fixed</Badge>}
                      {e.voided_at && <span className="text-negative">Voided: {e.void_reason}</span>}
                    </div>
                  </div>
                  <Money value={e.amount} className={cx("font-semibold", e.voided_at && "text-ink-3 line-through")} />
                  {can("expense.void") && !e.voided_at && (
                    <button onClick={() => setVoiding(e.id)} className="min-h-11 cursor-pointer px-1 text-xs font-semibold text-negative">Void</button>
                  )}
                </div>
              ))}
            </Card>
          )}

          <ExpenseSheet open={adding} depts={data.depts} onClose={() => { setAdding(false); setParams({ add: null }); }} />
          {editingFixed && <FixedSheet fixed={editingFixed === "new" ? null : editingFixed} depts={data.depts} onClose={() => setEditingFixed(null)} />}
          <VoidSheet
            open={!!voiding}
            onClose={() => setVoiding(null)}
            title="Void expense"
            onConfirm={(reason) => run("expense.void", { id: voiding!, reason }, "Expense voided")}
          />
        </>
      )}
    </div>
  );
}

function ExpenseSheet({ open, depts, onClose }: { open: boolean; depts: { id: string; name: string }[]; onClose: () => void }) {
  const { run } = useApp();
  const [category, setCategory] = useState<string>(EXPENSE_CATEGORIES[3]);
  const [amount, setAmount] = useState<number | null>(null);
  const [description, setDescription] = useState("");
  const [dept, setDept] = useState("");
  const [paidFrom, setPaidFrom] = useState<"till" | "other">("till");
  const [date, setDate] = useState(toBusinessDate());
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    if (open) {
      setAmount(null);
      setDescription("");
      setDept("");
      setPaidFrom("till");
      setDate(toBusinessDate());
    }
  }, [open]);
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title="Record an expense"
      footer={
        <Button
          block size="lg" loading={busy} disabled={!amount}
          onClick={async () => {
            setBusy(true);
            const ok = await run("expense.create", {
              id: crypto.randomUUID(), category, amount: amount!, description, department_id: dept || null,
              paid_from: paidFrom, business_date: date,
            }, "Expense recorded");
            setBusy(false);
            if (ok) onClose();
          }}
        >
          Save expense
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Amount" htmlFor="ea"><MoneyInput id="ea" value={amount} onChange={setAmount} autoFocus /></Field>
        <Field label="Category" htmlFor="ec" hint={category === "Salaries & wages" ? "Staff with a monthly salary on their profile are already counted. Only add other wages here." : category === "Spoilage & breakage" ? "For spoiled drinks, use Price list & stock → Spoiled instead, so stock stays right." : undefined}>
          <Select id="ec" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="What was it for?" htmlFor="ed">
          <Input id="ed" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Nail polish remover, clipper blades" />
        </Field>
        <Field label="Which section is it for?" htmlFor="esec" hint="Pick a section to charge it to that section's profit. Leave as whole shop for rent, power etc.">
          <Select id="esec" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">Whole shop</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        <Field label="Paid from">
          <div className="flex gap-2">
            <Chip active={paidFrom === "till"} onClick={() => setPaidFrom("till")}>Cash drawer</Chip>
            <Chip active={paidFrom === "other"} onClick={() => setPaidFrom("other")}>Elsewhere (bank, M-money…)</Chip>
          </div>
        </Field>
        <Field label="Date" htmlFor="edate">
          <Input id="edate" type="date" value={date} max={toBusinessDate()} onChange={(e) => setDate(e.target.value)} />
        </Field>
      </div>
    </Sheet>
  );
}

function FixedSheet({ fixed, depts, onClose }: { fixed: Recurring | null; depts: { id: string; name: string }[]; onClose: () => void }) {
  const { run } = useApp();
  const [category, setCategory] = useState(fixed?.category ?? "Rent");
  const [amount, setAmount] = useState<number | null>(fixed?.amount ?? null);
  const [description, setDescription] = useState(fixed?.description ?? "");
  const [dept, setDept] = useState(fixed?.department_id ?? "");
  const [active, setActive] = useState(fixed ? !!fixed.active : true);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open
      onClose={onClose}
      title={fixed ? "Fixed monthly cost" : "Add a fixed monthly cost"}
      footer={
        <Button
          block size="lg" loading={busy} disabled={!amount}
          onClick={async () => {
            setBusy(true);
            const ok = await run("recurring.upsert", {
              id: fixed?.id ?? crypto.randomUUID(), category, amount: amount!, description, department_id: dept || null, active: active ? 1 : 0,
            }, "Saved");
            setBusy(false);
            if (ok) onClose();
          }}
        >
          Save
        </Button>
      }
    >
      <div className="space-y-4">
        <Field label="Monthly amount" htmlFor="fa"><MoneyInput id="fa" value={amount} onChange={setAmount} /></Field>
        <Field label="Category" htmlFor="fc">
          <Select id="fc" value={category} onChange={(e) => setCategory(e.target.value)}>
            {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
          </Select>
        </Field>
        <Field label="Name" htmlFor="fd"><Input id="fd" value={description} onChange={(e) => setDescription(e.target.value)} placeholder="e.g. Shop rent" /></Field>
        <Field label="Section" htmlFor="fs">
          <Select id="fs" value={dept} onChange={(e) => setDept(e.target.value)}>
            <option value="">Whole shop</option>
            {depts.map((d) => <option key={d.id} value={d.id}>{d.name}</option>)}
          </Select>
        </Field>
        {fixed && <Toggle checked={active} onChange={setActive} label="Active" description="Paused costs stop being added from next month." />}
        <p className="text-xs text-ink-3">Changes apply from the next month that hasn't been recorded yet.</p>
      </div>
    </Sheet>
  );
}

/** The month in one sum: money made, minus every cost, equals profit. */
function MonthProfit({ summary: s, month }: { summary: PeriodSummary; month: string }) {
  const staffCuts = s.departments.reduce((n, d) => n + d.staffShare, 0);
  const productCost = s.departments.reduce((n, d) => n + d.productCost + d.spoilage, 0);
  const expenses = s.sharedExpenses + s.departments.reduce((n, d) => n + d.directExpenses, 0);
  const staffOther = s.salaries + s.bonuses - s.deductions;
  const row = (label: string, value: number, strong?: boolean) => (
    <div className={cx("flex justify-between gap-3 py-1 text-sm", strong && "border-t border-line-strong pt-2 text-base font-bold")}>
      <span className={strong ? "" : "text-ink-2"}>{label}</span>
      <Money value={value} className={cx(strong && (value >= 0 ? "text-positive" : "text-negative"))} />
    </div>
  );
  return (
    <Card className="mt-3 p-4">
      <div className="mb-1 flex items-center justify-between">
        <h2 className="font-bold">{month === currentMonth() ? "This month so far" : formatMonth(month)}</h2>
        <button className="min-h-9 cursor-pointer text-sm font-semibold text-accent" onClick={() => go("/reports", { p: month === currentMonth() ? "month" : "lastMonth" })}>
          Full report
        </button>
      </div>
      {row("Money made from sales", s.revenue)}
      {row("− Staff cuts", -staffCuts)}
      {productCost > 0 && row("− Cost of drinks sold & spoiled stock", -productCost)}
      {row("− Expenses", -expenses)}
      {staffOther !== 0 && row("− Salaries & bonuses", -staffOther)}
      {row("Profit", s.netProfit, true)}
    </Card>
  );
}
