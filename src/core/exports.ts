// Spreadsheet (CSV) exports of the shop's records. Amounts are written in
// normal currency units (e.g. 1250.50), not the cents the database stores.

import type { Db } from "./db.ts";
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
  label: string;
  description: string;
}

export const EXPORTS: ExportKind[] = [
  { id: "sales", label: "Sales, line by line", description: "Every item sold: who did it, their % and cut, the shop's cut" },
  { id: "payments", label: "Payments & tips", description: "How each sale was paid, references and tips" },
  { id: "expenses", label: "Expenses", description: "Every expense, including voided ones with the reason" },
  { id: "money", label: "Money in & out", description: "The cash book: every payment in and every payment out" },
  { id: "payroll", label: "Staff pay", description: "Each employee's month: share, tips, advances, paid, balance" },
  { id: "clients", label: "Clients", description: "Name, phone, visits and total spent" },
];

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
        ["Date", "Time", "Receipt", "Status", "Customer", "Phone", "Item", "Section", "Done by", "Qty", "Unit price", "Discount",
          "Line total", "Staff %", "Staff cut", "Shop cut", "Product cost", "Cashier"],
        rows.map((r: Record<string, never>) => [
          r.business_date, new Date(r.created_at).toLocaleTimeString(), r.receipt_no, r.status, r.customer_name, r.customer_phone,
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
        ["Date", "Receipt", "Status", "Type", "Method / tip for", "Reference", "Amount"],
        [
          ...pays.map((r: Record<string, never>) => [r.business_date, r.receipt_no, r.status, "Payment", r.method, r.reference, m(r.amount)]),
          ...tips.map((r: Record<string, never>) => [r.business_date, r.receipt_no, r.status, "Tip", r.staff, null, m(r.amount)]),
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
        ["Date", "Category", "Section", "Description", "Amount", "Paid from", "Recorded by", "Voided", "Void reason"],
        rows.map((r: Record<string, never>) => [
          r.business_date, r.category, r.dept ?? "Whole shop", r.description, m(r.amount),
          r.paid_from === "till" ? "Cash drawer" : "Elsewhere", r.by, r.voided_at ? "yes" : "", r.void_reason,
        ]),
      );
    }
    case "money": {
      const book = await cashbook(db, from, to, localDate);
      return toCsv(
        ["Date", "Time", "Entry", "Detail", "How", "By", "In", "Out"],
        [...book.entries].reverse().map((e) => [
          e.business_date, new Date(e.at).toLocaleTimeString(), e.label, e.detail, e.method, e.by,
          e.direction === "in" ? m(e.amount) : null, e.direction === "out" ? m(e.amount) : null,
        ]),
      );
    }
    case "payroll": {
      const month = from.slice(0, 7);
      const rows = await payroll(db, month);
      return toCsv(
        ["Month", "Employee", "Role", "Share %", "Clients", "Services", "Brought in", "Share earned", "Tips", "Salary", "Bonuses",
          "Deductions", "Advances", "Net pay", "Paid", "Balance"],
        rows.map((r) => [
          month, r.name, r.specialty, pct(r.commission_bp), r.clients, r.services, m(r.revenue), m(r.earned), m(r.tips), m(r.baseSalary),
          m(r.bonuses), m(r.deductions), m(r.advances), m(r.netPay), m(r.paid), m(r.balance),
        ]),
      );
    }
    case "clients": {
      const rows = await clientList(db);
      return toCsv(
        ["Name", "Phone", "Visits", "Total spent", "First visit", "Last visit"],
        rows.map((c) => [c.name, c.phone, c.visits, m(c.spent), c.first_date, c.last_date]),
      );
    }
  }
}
