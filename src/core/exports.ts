// Spreadsheet (CSV) exports of the shop's records. Amounts are written in
// normal currency units (e.g. 1250.50), not the cents the database stores.

import type { Db } from "./db.ts";
import { PAYMENT_LABEL } from "./commands.ts";
import { locale, t, tk, tMessage } from "./i18n.ts";
import { currencyDecimals } from "./money.ts";
import { cashbook, clientList, payroll } from "./reports.ts";

type Cell = string | number | null | undefined;

/** One CSV cell. Text that a spreadsheet would run as a formula is neutralised. */
function cell(v: Cell): string {
  if (v == null) return "";
  if (typeof v === "number") return String(v);
  let s = String(v);
  if (/^[=+\-@\t\r]/.test(s)) s = `'${s}`;
  return /[",\n\r]/.test(s) ? `"${s.replace(/"/g, '""')}"` : s;
}

export function toCsv(header: string[], rows: Cell[][]): string {
  return [header, ...rows].map((r) => r.map(cell).join(",")).join("\r\n") + "\r\n";
}

export interface ExportKind {
  id: "sales" | "payments" | "expenses" | "money" | "payroll" | "clients";
  /** English; shown through t(). */
  label: string;
  /** English; shown through t(). */
  description: string;
}

export const EXPORTS: ExportKind[] = [
  { id: "sales", label: tk("Sales, line by line"), description: tk("Every item sold: who did it, their % and cut, the shop's cut") },
  { id: "payments", label: tk("Payments & tips"), description: tk("How each sale was paid, references and tips") },
  { id: "expenses", label: tk("Expenses"), description: tk("Every expense, including voided ones with the reason") },
  { id: "money", label: tk("Money in & out"), description: tk("The cash book: every payment in and every payment out") },
  { id: "payroll", label: tk("Staff pay"), description: tk("Each employee's month: share, tips, advances, paid, balance") },
  { id: "clients", label: tk("Clients"), description: tk("Name, phone, visits and total spent") },
];

// Words written into the spreadsheet follow the phone's language; numbers and
// dates stay machine-readable.
const STATUS_LABEL: Record<string, string> = { completed: tk("Completed"), voided: tk("Voided") };
const status = (s: string | null | undefined) => (s ? t(STATUS_LABEL[s] ?? s) : s);
const payMethod = (m: string | null | undefined) => (m ? t(PAYMENT_LABEL[m] ?? m) : m);
/** Where money paid out came from: the cash drawer, elsewhere, or a payment method. */
const paidFrom = (m: string | null | undefined) =>
  m === "till" ? t("Cash drawer") : m === "other" ? t("Elsewhere") : payMethod(m);
const time = (iso: string) => new Date(iso).toLocaleTimeString(locale());

export async function buildExport(
  db: Db, kind: ExportKind["id"], from: string, to: string, currency: string, localDate: (iso: string) => string,
): Promise<string> {
  const d = currencyDecimals(currency);
  const m = (v: number | null | undefined) => (v == null ? null : Number((Number(v) / 10 ** d).toFixed(d)));
  const pct = (bp: number) => Number(bp) / 100;

  switch (kind) {
    case "sales": {
      const rows = await db.all<Record<string, never>>(
        `SELECT s.business_date, s.created_at, s.receipt_no, s.status, s.customer_name, s.customer_phone, l.name, d.name AS dept,
                st.name AS staff, l.qty, l.unit_price, l.discount, l.line_total, l.commission_bp, l.commission, l.cost_total, u.name AS cashier
           FROM sale_lines l JOIN sales s ON s.id = l.sale_id LEFT JOIN departments d ON d.id = l.department_id
           LEFT JOIN staff st ON st.id = l.staff_id LEFT JOIN users u ON u.id = s.created_by
          WHERE s.business_date BETWEEN ? AND ? ORDER BY s.created_at, l.position`,
        [from, to],
      );
      return toCsv(
        [t("Date"), t("Time"), t("Receipt"), t("Status"), t("Customer"), t("Phone"), t("Item"), t("Section"), t("Done by"), t("Qty"),
          t("Unit price"), t("Discount"), t("Line total"), t("Staff %"), t("Staff cut"), t("Shop cut"), t("Product cost"), t("Cashier")],
        rows.map((r: Record<string, never>) => [
          r.business_date, time(r.created_at), r.receipt_no, status(r.status), r.customer_name, r.customer_phone,
          r.name, r.dept, r.staff, r.qty, m(r.unit_price), m(r.discount), m(r.line_total), pct(r.commission_bp), m(r.commission),
          m(Number(r.line_total) - Number(r.commission)), m(r.cost_total), r.cashier,
        ]),
      );
    }
    case "payments": {
      const pays = await db.all<Record<string, never>>(
        `SELECT s.business_date, s.receipt_no, s.status, p.method, p.reference, p.amount
           FROM payments p JOIN sales s ON s.id = p.sale_id WHERE s.business_date BETWEEN ? AND ? ORDER BY s.created_at`,
        [from, to],
      );
      const tips = await db.all<Record<string, never>>(
        `SELECT s.business_date, s.receipt_no, s.status, st.name AS staff, t.amount
           FROM tips t JOIN sales s ON s.id = t.sale_id LEFT JOIN staff st ON st.id = t.staff_id
          WHERE s.business_date BETWEEN ? AND ? ORDER BY s.created_at`,
        [from, to],
      );
      return toCsv(
        [t("Date"), t("Receipt"), t("Status"), t("Type"), t("Method / tip for"), t("Reference"), t("Amount")],
        [
          ...pays.map((r: Record<string, never>) => [r.business_date, r.receipt_no, status(r.status), t("Payment"), payMethod(r.method), r.reference, m(r.amount)]),
          ...tips.map((r: Record<string, never>) => [r.business_date, r.receipt_no, status(r.status), t("Tip"), r.staff, null, m(r.amount)]),
        ],
      );
    }
    case "expenses": {
      const rows = await db.all<Record<string, never>>(
        `SELECT e.business_date, e.category, d.name AS dept, e.description, e.amount, e.paid_from, u.name AS by, e.voided_at, e.void_reason
           FROM expenses e LEFT JOIN departments d ON d.id = e.department_id LEFT JOIN users u ON u.id = e.created_by
          WHERE e.business_date BETWEEN ? AND ? ORDER BY e.business_date, e.created_at`,
        [from, to],
      );
      return toCsv(
        [t("Date"), t("Category"), t("Section"), t("Description"), t("Amount"), t("Paid from"), t("Recorded by"), t("Voided"), t("Void reason")],
        rows.map((r: Record<string, never>) => [
          r.business_date, r.category ? t(r.category) : r.category, r.dept ?? t("Whole shop"), r.description, m(r.amount),
          r.paid_from === "till" ? t("Cash drawer") : t("Elsewhere"), r.by, r.voided_at ? t("yes") : "", r.void_reason,
        ]),
      );
    }
    case "money": {
      const book = await cashbook(db, from, to, localDate);
      return toCsv(
        [t("Date"), t("Time"), t("Entry"), t("Detail"), t("How"), t("By"), t("In"), t("Out")],
        [...book.entries].reverse().map((e) => [
          // Expense labels are the shop's own descriptions (or a stored category); the rest are built in English.
          e.business_date, time(e.at), e.kind === "expense" ? t(e.label) : tMessage(e.label),
          e.kind === "expense" || !e.detail ? e.detail : tMessage(e.detail), e.direction === "in" ? payMethod(e.method) : paidFrom(e.method), e.by,
          e.direction === "in" ? m(e.amount) : null, e.direction === "out" ? m(e.amount) : null,
        ]),
      );
    }
    case "payroll": {
      const month = from.slice(0, 7);
      const rows = await payroll(db, month);
      return toCsv(
        [t("Month"), t("Employee"), t("Role"), t("Share %"), t("Clients"), t("Services"), t("Brought in"), t("Share earned"), t("Tips"),
          t("Salary"), t("Bonuses"), t("Deductions"), t("Advances"), t("Net pay"), t("Paid"), t("Balance")],
        rows.map((r) => [
          month, r.name, r.specialty, pct(r.commission_bp), r.clients, r.services, m(r.revenue), m(r.earned), m(r.tips), m(r.baseSalary),
          m(r.bonuses), m(r.deductions), m(r.advances), m(r.netPay), m(r.paid), m(r.balance),
        ]),
      );
    }
    case "clients": {
      const rows = await clientList(db);
      return toCsv(
        [t("Name"), t("Phone"), t("Visits"), t("Total spent"), t("First visit"), t("Last visit")],
        rows.map((c) => [c.name, c.phone, c.visits, m(c.spent), c.first_date, c.last_date]),
      );
    }
  }
}
