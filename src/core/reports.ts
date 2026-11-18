// Every figure the app shows is calculated here from the recorded facts
// (sales lines, expenses, stock movements, staff adjustments). Nothing is
// typed in as a total, so the numbers always agree with the history.

import type { Db } from "./db.ts";
import { EXPENSE_APPROVED } from "./schema.ts";
import { addDays, addMonths, dayCount, daysInMonth, monthOf, monthRange } from "./dates.ts";

const COMPLETED = "s.status = 'completed'";

export interface DepartmentResult {
  id: string;
  name: string;
  kind: "service" | "product";
  revenue: number;
  items: number;
  staffShare: number;
  productCost: number;
  spoilage: number;
  directExpenses: number;
  profit: number;
}

export interface PeriodSummary {
  from: string;
  to: string;
  sales: number;
  revenue: number;
  discounts: number;
  /** Tips paid by customers. They belong to staff, so they are not revenue or profit. */
  tips: number;
  departments: DepartmentResult[];
  sharedExpenses: number;
  expensesByCategory: { category: string; amount: number }[];
  salaries: number;
  bonuses: number;
  deductions: number;
  totalCosts: number;
  netProfit: number;
}

export async function periodSummary(db: Db, from: string, to: string): Promise<PeriodSummary> {
  const depts = await db.all<{ id: string; name: string; kind: "service" | "product" }>(
    "SELECT id, name, kind FROM departments ORDER BY sort, name",
  );
  const sales = await db.all<{ department_id: string; revenue: number; items: number; share: number; cost: number }>(
    `SELECT l.department_id, SUM(l.line_total) AS revenue, SUM(l.qty) AS items,
            SUM(l.commission) AS share, SUM(l.cost_total) AS cost
       FROM sale_lines l JOIN sales s ON s.id = l.sale_id
      WHERE ${COMPLETED} AND s.business_date BETWEEN ? AND ?
      GROUP BY l.department_id`,
    [from, to],
  );
  const spoilage = await db.all<{ department_id: string; amount: number }>(
    `SELECT p.department_id, SUM(-m.qty * m.unit_cost) AS amount
       FROM stock_movements m JOIN products p ON p.id = m.product_id
      WHERE (m.reason = 'spoilage' OR (m.reason = 'adjustment' AND m.qty < 0)) AND m.business_date BETWEEN ? AND ?
      GROUP BY p.department_id`,
    [from, to],
  );
  const expenses = await db.all<{ department_id: string | null; category: string; amount: number }>(
    `SELECT department_id, category, SUM(amount) AS amount FROM expenses
      WHERE voided_at IS NULL AND ${EXPENSE_APPROVED} AND business_date BETWEEN ? AND ?
      GROUP BY department_id, category`,
    [from, to],
  );
  const counts = await db.get<{ n: number; disc: number }>(
    `SELECT COUNT(*) AS n, COALESCE(SUM(discount), 0) AS disc FROM sales s
      WHERE ${COMPLETED} AND s.business_date BETWEEN ? AND ?`,
    [from, to],
  );

  const tips = await tipTotal(db, from, to);

  const byId = new Map<string, DepartmentResult>();
  for (const d of depts) {
    byId.set(d.id, {
      ...d, revenue: 0, items: 0, staffShare: 0, productCost: 0, spoilage: 0, directExpenses: 0, profit: 0,
    });
  }
  const dept = (id: string) => {
    if (!byId.has(id)) {
      byId.set(id, {
        id, name: "Unknown section", kind: "service", revenue: 0, items: 0, staffShare: 0,
        productCost: 0, spoilage: 0, directExpenses: 0, profit: 0,
      });
    }
    return byId.get(id)!;
  };
  for (const r of sales) {
    const d = dept(r.department_id);
    d.revenue += Number(r.revenue);
    d.items += Number(r.items);
    d.staffShare += Number(r.share);
    d.productCost += Number(r.cost);
  }
  for (const r of spoilage) dept(r.department_id).spoilage += Number(r.amount);

  let sharedExpenses = 0;
  const categories = new Map<string, number>();
  for (const e of expenses) {
    const amount = Number(e.amount);
    categories.set(e.category, (categories.get(e.category) ?? 0) + amount);
    if (e.department_id) dept(e.department_id).directExpenses += amount;
    else sharedExpenses += amount;
  }

  const departments = [...byId.values()].map((d) => ({
    ...d,
    profit: d.revenue - d.staffShare - d.productCost - d.spoilage - d.directExpenses,
  }));

  const salaries = await proratedSalaries(db, from, to);
  const adj = await db.all<{ kind: string; amount: number }>(
    `SELECT kind, SUM(amount) AS amount FROM staff_adjustments
      WHERE voided_at IS NULL AND kind IN ('bonus', 'deduction') AND business_date BETWEEN ? AND ?
      GROUP BY kind`,
    [from, to],
  );
  const bonuses = Number(adj.find((a) => a.kind === "bonus")?.amount ?? 0);
  const deductions = Number(adj.find((a) => a.kind === "deduction")?.amount ?? 0);

  const revenue = departments.reduce((n, d) => n + d.revenue, 0);
  const contribution = departments.reduce((n, d) => n + d.profit, 0);
  const netProfit = contribution - sharedExpenses - salaries - bonuses + deductions;

  return {
    from,
    to,
    sales: Number(counts?.n ?? 0),
    revenue,
    discounts: Number(counts?.disc ?? 0),
    tips,
    departments,
    sharedExpenses,
    expensesByCategory: [...categories.entries()]
      .map(([category, amount]) => ({ category, amount }))
      .sort((a, b) => b.amount - a.amount),
    salaries,
    bonuses,
    deductions,
    totalCosts: revenue - netProfit,
    netProfit,
  };
}

async function tipTotal(db: Db, from: string, to: string): Promise<number> {
  const r = await db.get<{ v: number }>(
    `SELECT COALESCE(SUM(t.amount), 0) AS v FROM tips t JOIN sales s ON s.id = t.sale_id
      WHERE ${COMPLETED} AND s.business_date BETWEEN ? AND ?`,
    [from, to],
  );
  return Number(r?.v ?? 0);
}

/** Tips per staff member in a period, from completed sales. */
export async function tipsByStaff(db: Db, from: string, to: string): Promise<Map<string, number>> {
  const rows = await db.all<{ staff_id: string; v: number }>(
    `SELECT t.staff_id, SUM(t.amount) AS v FROM tips t JOIN sales s ON s.id = t.sale_id
      WHERE ${COMPLETED} AND s.business_date BETWEEN ? AND ? GROUP BY t.staff_id`,
    [from, to],
  );
  return new Map(rows.map((r) => [r.staff_id, Number(r.v)]));
}

interface PayStaff { id: string; base_salary: number; joined_on: string | null; left_on: string | null }
type SalaryHistory = Map<string, { from: string; salary: number }[]>;

/** Every recorded salary change, oldest first, per staff member. */
async function salaryHistory(db: Db): Promise<SalaryHistory> {
  const rows = await db.all<{ staff_id: string; effective_from: string; base_salary: number; created_at: string }>(
    "SELECT staff_id, effective_from, base_salary, created_at FROM pay_history ORDER BY effective_from, created_at",
  );
  const out: SalaryHistory = new Map();
  for (const r of rows) {
    const list = out.get(r.staff_id) ?? [];
    list.push({ from: r.effective_from, salary: Number(r.base_salary ?? 0) });
    out.set(r.staff_id, list);
  }
  return out;
}

/**
 * Salary earned between two dates: day by day, each month's salary divided by
 * that month's real number of days, using the salary in effect on each day and
 * counting only days the person worked here (from joining to their last day).
 * So a raise from the 15th, or someone leaving on the 10th, is paid exactly.
 */
export function salaryBetween(s: PayStaff, history: SalaryHistory, from: string, to: string): number {
  const changes = history.get(s.id) ?? [];
  const salaryOn = (d: string) => {
    let current: number | null = null;
    for (const c of changes) if (c.from <= d) current = c.salary;
    return current ?? Number(s.base_salary ?? 0);
  };
  let total = 0;
  for (let month = monthOf(from); month <= monthOf(to); month = addMonths(month, 1)) {
    const range = monthRange(month);
    const start = [range.from, from, s.joined_on ?? range.from].sort().at(-1)!;
    const end = [range.to, to, s.left_on ?? range.to].sort()[0];
    if (start > end) continue;
    let sum = 0;
    for (let d = start; d <= end; d = addDays(d, 1)) sum += salaryOn(d);
    total += Math.round(sum / daysInMonth(month));
  }
  return total;
}

/** All salaries for a period (staff who have left still count for the days they worked). */
export async function proratedSalaries(db: Db, from: string, to: string): Promise<number> {
  const staff = await db.all<PayStaff>("SELECT id, base_salary, joined_on, left_on FROM staff");
  if (staff.length === 0) return 0;
  const history = await salaryHistory(db);
  let total = 0;
  for (const s of staff) total += salaryBetween(s, history, from, to);
  return total;
}

export interface StaffResult {
  staff_id: string;
  name: string;
  clients: number;
  services: number;
  revenue: number;
  share: number;
}

export async function staffPerformance(db: Db, from: string, to: string): Promise<StaffResult[]> {
  return (
    await db.all<StaffResult>(
      `SELECT l.staff_id, st.name, COUNT(DISTINCT l.sale_id) AS clients,
              SUM(CASE WHEN l.kind = 'service' THEN l.qty ELSE 0 END) AS services,
              SUM(l.line_total) AS revenue, SUM(l.commission) AS share
         FROM sale_lines l JOIN sales s ON s.id = l.sale_id JOIN staff st ON st.id = l.staff_id
        WHERE ${COMPLETED} AND s.business_date BETWEEN ? AND ?
        GROUP BY l.staff_id ORDER BY revenue DESC`,
      [from, to],
    )
  ).map((r) => ({ ...r, clients: +r.clients, services: +r.services, revenue: +r.revenue, share: +r.share }));
}

export async function paymentBreakdown(db: Db, from: string, to: string) {
  return db.all<{ method: string; amount: number; count: number }>(
    `SELECT p.method, SUM(p.amount) AS amount, COUNT(*) AS count
       FROM payments p JOIN sales s ON s.id = p.sale_id
      WHERE ${COMPLETED} AND s.business_date BETWEEN ? AND ?
      GROUP BY p.method ORDER BY amount DESC`,
    [from, to],
  );
}

export async function dailyRevenue(db: Db, from: string, to: string) {
  return db.all<{ business_date: string; revenue: number; sales: number }>(
    `SELECT business_date, SUM(total) AS revenue, COUNT(*) AS sales FROM sales s
      WHERE ${COMPLETED} AND business_date BETWEEN ? AND ?
      GROUP BY business_date ORDER BY business_date`,
    [from, to],
  );
}

export async function topItems(db: Db, from: string, to: string, limit = 8) {
  return db.all<{ name: string; department: string; qty: number; revenue: number }>(
    `SELECT l.name, d.name AS department, SUM(l.qty) AS qty, SUM(l.line_total) AS revenue
       FROM sale_lines l JOIN sales s ON s.id = l.sale_id LEFT JOIN departments d ON d.id = l.department_id
      WHERE ${COMPLETED} AND s.business_date BETWEEN ? AND ?
      GROUP BY l.item_id ORDER BY revenue DESC LIMIT ?`,
    [from, to, limit],
  );
}

// ---------- payroll ----------

export interface PayrollRow {
  staff_id: string;
  name: string;
  specialty: string | null;
  commission_bp: number;
  clients: number;
  services: number;
  revenue: number;
  earned: number;
  shopShare: number;
  tips: number;
  baseSalary: number;
  bonuses: number;
  deductions: number;
  advances: number;
  netPay: number;
  paid: number;
  balance: number;
  byDepartment: { department: string; services: number; revenue: number; earned: number }[];
}

export async function payroll(db: Db, month: string): Promise<PayrollRow[]> {
  const { from, to } = monthRange(month);
  const staff = await db.all<{
    id: string; name: string; specialty: string | null; commission_bp: number; base_salary: number;
    active: number; joined_on: string | null; left_on: string | null;
  }>("SELECT id, name, specialty, commission_bp, base_salary, active, joined_on, left_on FROM staff ORDER BY name");
  const history = await salaryHistory(db);

  const work = await db.all<{
    staff_id: string; department: string; services: number; clients: number; revenue: number; earned: number;
  }>(
    `SELECT l.staff_id, COALESCE(d.name, 'Other') AS department,
            SUM(CASE WHEN l.kind = 'service' THEN l.qty ELSE 0 END) AS services,
            COUNT(DISTINCT l.sale_id) AS clients, SUM(l.line_total) AS revenue, SUM(l.commission) AS earned
       FROM sale_lines l JOIN sales s ON s.id = l.sale_id LEFT JOIN departments d ON d.id = l.department_id
      WHERE ${COMPLETED} AND s.business_date BETWEEN ? AND ? AND l.staff_id IS NOT NULL
      GROUP BY l.staff_id, l.department_id`,
    [from, to],
  );
  const clients = await db.all<{ staff_id: string; n: number }>(
    `SELECT l.staff_id, COUNT(DISTINCT l.sale_id) AS n FROM sale_lines l JOIN sales s ON s.id = l.sale_id
      WHERE ${COMPLETED} AND s.business_date BETWEEN ? AND ? AND l.staff_id IS NOT NULL GROUP BY l.staff_id`,
    [from, to],
  );
  const adjustments = await db.all<{ staff_id: string; kind: string; amount: number }>(
    `SELECT staff_id, kind, SUM(amount) AS amount FROM staff_adjustments
      WHERE voided_at IS NULL AND month = ? GROUP BY staff_id, kind`,
    [month],
  );
  const payouts = await db.all<{ staff_id: string; amount: number }>(
    "SELECT staff_id, SUM(amount) AS amount FROM payouts WHERE voided_at IS NULL AND month = ? GROUP BY staff_id",
    [month],
  );

  const tipMap = await tipsByStaff(db, from, to);

  const rows: PayrollRow[] = [];
  for (const s of staff) {
    const mine = work.filter((w) => w.staff_id === s.id);
    const adj = (kind: string) => Number(adjustments.find((a) => a.staff_id === s.id && a.kind === kind)?.amount ?? 0);
    const paid = Number(payouts.find((p) => p.staff_id === s.id)?.amount ?? 0);
    // Salary for the days they actually worked this month, at the rate in effect each day.
    const baseSalary = salaryBetween(s, history, from, to);
    const tips = tipMap.get(s.id) ?? 0;
    if (!s.active && mine.length === 0 && paid === 0 && tips === 0 && baseSalary === 0) continue;

    const revenue = mine.reduce((n, w) => n + Number(w.revenue), 0);
    const earned = mine.reduce((n, w) => n + Number(w.earned), 0);
    const bonuses = adj("bonus");
    const deductions = adj("deduction");
    const advances = adj("advance");
    const netPay = earned + tips + baseSalary + bonuses - deductions - advances;
    rows.push({
      staff_id: s.id,
      name: s.name,
      specialty: s.specialty,
      commission_bp: Number(s.commission_bp),
      clients: Number(clients.find((c) => c.staff_id === s.id)?.n ?? 0),
      services: mine.reduce((n, w) => n + Number(w.services), 0),
      revenue,
      earned,
      shopShare: revenue - earned,
      tips,
      baseSalary,
      bonuses,
      deductions,
      advances,
      netPay,
      paid,
      balance: netPay - paid,
      byDepartment: mine
        .map((w) => ({ department: w.department, services: +w.services, revenue: +w.revenue, earned: +w.earned }))
        .sort((a, b) => b.revenue - a.revenue),
    });
  }
  return rows.sort((a, b) => b.revenue - a.revenue);
}

// ---------- month-end ----------

/** Detail kept with a closed month (stored as JSON in month_closes.snapshot). */
export interface MonthSnapshot {
  departments: DepartmentResult[];
  expensesByCategory: { category: string; amount: number }[];
  discounts: number;
  sharedExpenses: number;
  totalCosts: number;
  payroll: PayrollRow[];
}

/** The figures stored when a month is closed: the whole calendar month, its real number of days. */
export interface MonthFigures {
  month: string;
  from: string;
  to: string;
  days: number;
  sales: number;
  revenue: number;
  staffShare: number;
  tips: number;
  salaries: number;
  bonuses: number;
  deductions: number;
  expenses: number;
  netProfit: number;
  staffPay: number;
  snapshot: MonthSnapshot;
}

export async function monthFigures(db: Db, month: string): Promise<MonthFigures> {
  const { from, to } = monthRange(month);
  const s = await periodSummary(db, from, to);
  const pay = await payroll(db, month);
  return {
    month,
    from,
    to,
    days: daysInMonth(month),
    sales: s.sales,
    revenue: s.revenue,
    staffShare: s.departments.reduce((n, d) => n + d.staffShare, 0),
    tips: s.tips,
    salaries: s.salaries,
    bonuses: s.bonuses,
    deductions: s.deductions,
    expenses: s.sharedExpenses + s.departments.reduce((n, d) => n + d.directExpenses, 0),
    netProfit: s.netProfit,
    staffPay: pay.reduce((n, r) => n + r.netPay, 0),
    snapshot: {
      departments: s.departments,
      expensesByCategory: s.expensesByCategory,
      discounts: s.discounts,
      sharedExpenses: s.sharedExpenses,
      totalCosts: s.totalCosts,
      payroll: pay,
    },
  };
}

// ---------- cash ----------

export interface CashFigures {
  cashSales: number;
  tillExpenses: number;
  tillStaffMoney: number;
  tillStockPurchases: number;
  cashOut: number;
  salesCount: number;
  otherMethods: { method: string; amount: number }[];
}

/** Cash that should have moved through the drawer on a business day. */
export async function cashFigures(db: Db, date: string): Promise<CashFigures> {
  const pay = await paymentBreakdown(db, date, date);
  const cashSales = Number(pay.find((p) => p.method === "cash")?.amount ?? 0);
  const one = async (sql: string) => Number((await db.get<{ v: number }>(sql, [date]))?.v ?? 0);
  const tillExpenses = await one(
    `SELECT COALESCE(SUM(amount), 0) AS v FROM expenses WHERE voided_at IS NULL AND ${EXPENSE_APPROVED} AND paid_from = 'till' AND business_date = ?`,
  );
  const tillAdvances = await one(
    "SELECT COALESCE(SUM(amount), 0) AS v FROM staff_adjustments WHERE voided_at IS NULL AND paid_from = 'till' AND kind = 'advance' AND business_date = ?",
  );
  const tillPayouts = await one(
    "SELECT COALESCE(SUM(amount), 0) AS v FROM payouts WHERE voided_at IS NULL AND paid_from = 'till' AND business_date = ?",
  );
  const tillStockPurchases = await one(
    "SELECT COALESCE(SUM(qty * unit_cost), 0) AS v FROM stock_movements WHERE reason = 'purchase' AND paid_from = 'till' AND business_date = ?",
  );
  const salesCount = await one(`SELECT COUNT(*) AS v FROM sales s WHERE ${COMPLETED} AND business_date = ?`);
  const tillStaffMoney = tillAdvances + tillPayouts;
  return {
    cashSales,
    tillExpenses,
    tillStaffMoney,
    tillStockPurchases,
    cashOut: tillExpenses + tillStaffMoney + tillStockPurchases,
    salesCount,
    otherMethods: pay.filter((p) => p.method !== "cash").map((p) => ({ method: p.method, amount: +p.amount })),
  };
}

// ---------- stock ----------

export async function stockLevels(db: Db) {
  return db.all<{
    id: string; name: string; department_id: string; price: number; cost: number; track_stock: number;
    active: number; sort: number; on_hand: number;
  }>(
    `SELECT p.id, p.name, p.department_id, p.price, p.cost, p.track_stock, p.active, p.sort,
            COALESCE((SELECT SUM(qty) FROM stock_movements m WHERE m.product_id = p.id), 0) AS on_hand
       FROM products p ORDER BY p.sort, p.name`,
  );
}

// ---------- splits: who gets what from each sale ----------

export interface SplitLine {
  line_id: string;
  name: string;
  department: string | null;
  staff_id: string | null;
  staff: string | null;
  line_total: number;
  commission_bp: number;
  /** The staff member's cut. */
  staff_cut: number;
  /** What the shop keeps from this line. Staff cut + shop cut = line total, always. */
  shop_cut: number;
}

export interface SaleSplit {
  lines: SplitLine[];
  total: number;
  perStaff: { staff_id: string; staff: string; amount: number }[];
  shop: number;
  /** Tips on this sale: 100% to the staff member, on top of the total. */
  tips: { staff_id: string; staff: string; amount: number }[];
  tipTotal: number;
}

export async function saleSplit(db: Db, saleId: string): Promise<SaleSplit> {
  const rows = await db.all<Omit<SplitLine, "shop_cut">>(
    `SELECT l.id AS line_id, l.name, d.name AS department, l.staff_id, st.name AS staff,
            l.line_total, l.commission_bp, l.commission AS staff_cut
       FROM sale_lines l LEFT JOIN staff st ON st.id = l.staff_id LEFT JOIN departments d ON d.id = l.department_id
      WHERE l.sale_id = ? ORDER BY l.position`,
    [saleId],
  );
  const lines = rows.map((r) => ({
    ...r,
    line_total: Number(r.line_total),
    commission_bp: Number(r.commission_bp),
    staff_cut: Number(r.staff_cut),
    shop_cut: Number(r.line_total) - Number(r.staff_cut),
  }));
  const perStaff = new Map<string, { staff_id: string; staff: string; amount: number }>();
  for (const l of lines) {
    if (!l.staff_id) continue;
    const e = perStaff.get(l.staff_id) ?? { staff_id: l.staff_id, staff: l.staff ?? "?", amount: 0 };
    e.amount += l.staff_cut;
    perStaff.set(l.staff_id, e);
  }
  const tips = (
    await db.all<{ staff_id: string; staff: string | null; amount: number }>(
      `SELECT t.staff_id, st.name AS staff, SUM(t.amount) AS amount FROM tips t LEFT JOIN staff st ON st.id = t.staff_id
        WHERE t.sale_id = ? GROUP BY t.staff_id`,
      [saleId],
    )
  ).map((t) => ({ staff_id: t.staff_id, staff: t.staff ?? "?", amount: Number(t.amount) }));
  return {
    lines,
    total: lines.reduce((n, l) => n + l.line_total, 0),
    perStaff: [...perStaff.values()],
    shop: lines.reduce((n, l) => n + l.shop_cut, 0),
    tips,
    tipTotal: tips.reduce((n, t) => n + t.amount, 0),
  };
}

// ---------- live earnings per employee ----------

export interface EarningRow {
  staff_id: string;
  name: string;
  specialty: string | null;
  active: number;
  clients: number;
  services: number;
  revenue: number;
  staff_cut: number;
  shop_cut: number;
  tips: number;
  last_at: string | null;
}

/** What every employee has earned in a period, from completed sales. Includes staff with nothing yet. */
export async function staffEarnings(db: Db, from: string, to: string): Promise<EarningRow[]> {
  const rows = await db.all<EarningRow>(
    `SELECT st.id AS staff_id, st.name, st.specialty, st.active,
            COUNT(DISTINCT l.sale_id) AS clients,
            COALESCE(SUM(CASE WHEN l.kind = 'service' THEN l.qty END), 0) AS services,
            COALESCE(SUM(l.line_total), 0) AS revenue,
            COALESCE(SUM(l.commission), 0) AS staff_cut,
            COALESCE(SUM(l.line_total - l.commission), 0) AS shop_cut,
            MAX(s.created_at) AS last_at
       FROM staff st
       LEFT JOIN sale_lines l ON l.staff_id = st.id
        AND l.sale_id IN (SELECT id FROM sales WHERE status = 'completed' AND business_date BETWEEN ? AND ?)
       LEFT JOIN sales s ON s.id = l.sale_id
      GROUP BY st.id
     HAVING st.active = 1 OR COUNT(l.id) > 0
      ORDER BY staff_cut DESC, st.name`,
    [from, to],
  );
  const tips = await tipsByStaff(db, from, to);
  return rows.map((r) => ({
    ...r,
    clients: Number(r.clients), services: Number(r.services), revenue: Number(r.revenue),
    staff_cut: Number(r.staff_cut), shop_cut: Number(r.shop_cut), tips: tips.get(r.staff_id) ?? 0,
  }));
}

export interface EarningLine {
  line_id: string;
  sale_id: string;
  receipt_no: string;
  created_at: string;
  business_date: string;
  name: string;
  department: string | null;
  qty: number;
  line_total: number;
  commission_bp: number;
  staff_cut: number;
  shop_cut: number;
}

/** Every service one employee did in a period, newest first, with their cut and the shop's. */
export async function staffLines(db: Db, staffId: string, from: string, to: string): Promise<EarningLine[]> {
  const rows = await db.all<EarningLine>(
    `SELECT l.id AS line_id, s.id AS sale_id, s.receipt_no, s.created_at, s.business_date, l.name,
            d.name AS department, l.qty, l.line_total, l.commission_bp, l.commission AS staff_cut,
            l.line_total - l.commission AS shop_cut
       FROM sale_lines l JOIN sales s ON s.id = l.sale_id LEFT JOIN departments d ON d.id = l.department_id
      WHERE l.staff_id = ? AND s.status = 'completed' AND s.business_date BETWEEN ? AND ?
      ORDER BY s.created_at DESC, l.position`,
    [staffId, from, to],
  );
  return rows.map((r) => ({
    ...r,
    qty: Number(r.qty), line_total: Number(r.line_total), commission_bp: Number(r.commission_bp),
    staff_cut: Number(r.staff_cut), shop_cut: Number(r.shop_cut),
  }));
}

// ---------- money in & out ----------

export type CashKind = "sale" | "refund" | "expense" | "advance" | "staff_pay" | "stock";

export interface CashEntry {
  id: string;
  at: string;
  business_date: string;
  direction: "in" | "out";
  kind: CashKind;
  label: string;
  detail: string | null;
  /** cash / mobile / card / bank for sales and refunds; "till" or "other" for money paid out. */
  method: string | null;
  amount: number;
  sale_id: string | null;
  by: string | null;
}

export interface Cashbook {
  entries: CashEntry[];
  totalIn: number;
  totalOut: number;
  net: number;
  byKind: Record<CashKind, number>;
}

/**
 * Every shilling that actually moved, in a period: customer payments in, and
 * refunds, expenses, staff advances, staff payments and stock purchases out.
 * (Staff cuts not yet paid are not here: they appear when the shop pays them.)
 */
export async function cashbook(db: Db, from: string, to: string, localDate: (iso: string) => string): Promise<Cashbook> {
  const entries: CashEntry[] = [];

  const pays = await db.all<{
    id: string; sale_id: string; method: string; amount: number; receipt_no: string; created_at: string;
    business_date: string; items: string | null; by: string | null; customer_name: string | null;
  }>(
    `SELECT p.id, p.sale_id, p.method, p.amount, s.receipt_no, s.created_at, s.business_date, u.name AS by, s.customer_name,
            (SELECT GROUP_CONCAT(name, ', ') FROM sale_lines WHERE sale_id = s.id) AS items
       FROM payments p JOIN sales s ON s.id = p.sale_id LEFT JOIN users u ON u.id = s.created_by
      WHERE s.business_date BETWEEN ? AND ?`,
    [from, to],
  );
  for (const p of pays) {
    entries.push({
      id: `in-${p.id}`, at: p.created_at, business_date: p.business_date, direction: "in", kind: "sale",
      label: `Sale ${p.receipt_no}`, detail: [p.items, p.customer_name].filter(Boolean).join(" · ") || null,
      method: p.method, amount: Number(p.amount), sale_id: p.sale_id, by: p.by,
    });
  }

  // Voided sales: the money went back to the customer on the day of the void.
  const voids = await db.all<{
    id: string; sale_id: string; method: string; amount: number; receipt_no: string; voided_at: string;
    void_reason: string | null; by: string | null;
  }>(
    `SELECT p.id, p.sale_id, p.method, p.amount, s.receipt_no, s.voided_at, s.void_reason, u.name AS by
       FROM payments p JOIN sales s ON s.id = p.sale_id LEFT JOIN users u ON u.id = s.voided_by
      WHERE s.status = 'voided' AND s.voided_at IS NOT NULL`,
  );
  for (const v of voids) {
    const date = localDate(v.voided_at);
    if (date < from || date > to) continue;
    entries.push({
      id: `void-${v.id}`, at: v.voided_at, business_date: date, direction: "out", kind: "refund",
      label: `Voided sale ${v.receipt_no}`, detail: v.void_reason, method: v.method, amount: Number(v.amount),
      sale_id: v.sale_id, by: v.by,
    });
  }

  const expenses = await db.all<{ id: string; category: string; description: string | null; amount: number; paid_from: string; business_date: string; created_at: string; by: string | null; dept: string | null }>(
    `SELECT e.id, e.category, e.description, e.amount, e.paid_from, e.business_date, e.created_at, u.name AS by, d.name AS dept
       FROM expenses e LEFT JOIN users u ON u.id = e.created_by LEFT JOIN departments d ON d.id = e.department_id
      WHERE e.voided_at IS NULL AND (e.status IS NULL OR e.status = 'approved') AND e.business_date BETWEEN ? AND ?`,
    [from, to],
  );
  for (const e of expenses) {
    entries.push({
      id: `exp-${e.id}`, at: e.business_date === e.created_at.slice(0, 10) ? e.created_at : `${e.business_date}T12:00:00`,
      business_date: e.business_date, direction: "out", kind: "expense", label: e.description || e.category,
      detail: [e.category, e.dept].filter(Boolean).join(" · "), method: e.paid_from, amount: Number(e.amount),
      sale_id: null, by: e.by,
    });
  }

  const advances = await db.all<{ id: string; amount: number; paid_from: string | null; business_date: string; created_at: string; note: string | null; staff: string; by: string | null }>(
    `SELECT a.id, a.amount, a.paid_from, a.business_date, a.created_at, a.note, st.name AS staff, u.name AS by
       FROM staff_adjustments a JOIN staff st ON st.id = a.staff_id LEFT JOIN users u ON u.id = a.created_by
      WHERE a.voided_at IS NULL AND a.kind = 'advance' AND a.business_date BETWEEN ? AND ?`,
    [from, to],
  );
  for (const a of advances) {
    entries.push({
      id: `adv-${a.id}`, at: a.created_at, business_date: a.business_date, direction: "out", kind: "advance",
      label: `Advance to ${a.staff}`, detail: a.note, method: a.paid_from, amount: Number(a.amount), sale_id: null, by: a.by,
    });
  }

  const payouts = await db.all<{ id: string; amount: number; paid_from: string; method: string; month: string; business_date: string; created_at: string; note: string | null; staff: string; by: string | null }>(
    `SELECT p.id, p.amount, p.paid_from, p.method, p.month, p.business_date, p.created_at, p.note, st.name AS staff, u.name AS by
       FROM payouts p JOIN staff st ON st.id = p.staff_id LEFT JOIN users u ON u.id = p.created_by
      WHERE p.voided_at IS NULL AND p.business_date BETWEEN ? AND ?`,
    [from, to],
  );
  for (const p of payouts) {
    entries.push({
      id: `pay-${p.id}`, at: p.created_at, business_date: p.business_date, direction: "out", kind: "staff_pay",
      label: `Pay to ${p.staff}`, detail: `For ${p.month}${p.note ? ` · ${p.note}` : ""}`, method: p.paid_from,
      amount: Number(p.amount), sale_id: null, by: p.by,
    });
  }

  const stock = await db.all<{ id: string; qty: number; unit_cost: number; paid_from: string | null; business_date: string; created_at: string; product: string; by: string | null }>(
    `SELECT m.id, m.qty, m.unit_cost, m.paid_from, m.business_date, m.created_at, p.name AS product, u.name AS by
       FROM stock_movements m JOIN products p ON p.id = m.product_id LEFT JOIN users u ON u.id = m.created_by
      WHERE m.reason = 'purchase' AND m.business_date BETWEEN ? AND ?`,
    [from, to],
  );
  for (const m of stock) {
    entries.push({
      id: `stk-${m.id}`, at: m.created_at, business_date: m.business_date, direction: "out", kind: "stock",
      label: `Bought stock: ${m.product}`, detail: `${m.qty} × ${m.unit_cost}`, method: m.paid_from ?? "other",
      amount: Number(m.qty) * Number(m.unit_cost), sale_id: null, by: m.by,
    });
  }

  entries.sort((a, b) => (a.business_date === b.business_date ? b.at.localeCompare(a.at) : b.business_date.localeCompare(a.business_date)));
  const byKind = { sale: 0, refund: 0, expense: 0, advance: 0, staff_pay: 0, stock: 0 } as Record<CashKind, number>;
  let totalIn = 0;
  let totalOut = 0;
  for (const e of entries) {
    byKind[e.kind] += e.amount;
    if (e.direction === "in") totalIn += e.amount;
    else totalOut += e.amount;
  }
  return { entries, totalIn, totalOut, net: totalIn - totalOut, byKind };
}

// ---------- clients ----------

/** One client is one phone number; walk-ins with only a name are grouped by name. */
const CLIENT_KEY = "COALESCE(s.customer_phone, 'n:' || LOWER(TRIM(s.customer_name)))";

export interface ClientRow {
  key: string;
  name: string | null;
  phone: string | null;
  visits: number;
  spent: number;
  first_date: string;
  last_date: string;
}

export async function clientList(db: Db): Promise<ClientRow[]> {
  const rows = await db.all<ClientRow>(
    `SELECT ${CLIENT_KEY} AS key,
            (SELECT customer_name FROM sales x WHERE COALESCE(x.customer_phone, 'n:' || LOWER(TRIM(x.customer_name))) = ${CLIENT_KEY}
               AND x.customer_name IS NOT NULL ORDER BY x.created_at DESC LIMIT 1) AS name,
            MAX(s.customer_phone) AS phone, COUNT(*) AS visits, SUM(s.total) AS spent,
            MIN(s.business_date) AS first_date, MAX(s.business_date) AS last_date
       FROM sales s
      WHERE ${COMPLETED} AND (s.customer_phone IS NOT NULL OR TRIM(COALESCE(s.customer_name, '')) <> '')
      GROUP BY key ORDER BY last_date DESC, visits DESC`,
  );
  return rows.map((r) => ({ ...r, visits: Number(r.visits), spent: Number(r.spent) }));
}

export interface ClientVisit {
  sale_id: string;
  receipt_no: string;
  business_date: string;
  created_at: string;
  total: number;
  items: string | null;
  staff: string | null;
}

export interface ClientProfile {
  visits: ClientVisit[];
  /** Staff who served this client most, with the number of visits. */
  usualStaff: { staff_id: string; name: string; n: number }[];
  /** Services this client has most often. */
  favourites: { name: string; n: number }[];
}

export async function clientProfile(db: Db, key: string): Promise<ClientProfile> {
  const where = `${COMPLETED} AND ${CLIENT_KEY} = ?`;
  const visits = await db.all<ClientVisit>(
    `SELECT s.id AS sale_id, s.receipt_no, s.business_date, s.created_at, s.total,
            (SELECT GROUP_CONCAT(name, ', ') FROM sale_lines WHERE sale_id = s.id) AS items,
            (SELECT GROUP_CONCAT(DISTINCT st.name) FROM sale_lines l JOIN staff st ON st.id = l.staff_id WHERE l.sale_id = s.id) AS staff
       FROM sales s WHERE ${where} ORDER BY s.created_at DESC LIMIT 200`,
    [key],
  );
  const usualStaff = await db.all<{ staff_id: string; name: string; n: number }>(
    `SELECT l.staff_id, st.name, COUNT(DISTINCT s.id) AS n
       FROM sale_lines l JOIN sales s ON s.id = l.sale_id JOIN staff st ON st.id = l.staff_id
      WHERE ${where} GROUP BY l.staff_id ORDER BY n DESC LIMIT 3`,
    [key],
  );
  const favourites = await db.all<{ name: string; n: number }>(
    `SELECT l.name, SUM(l.qty) AS n FROM sale_lines l JOIN sales s ON s.id = l.sale_id
      WHERE ${where} AND l.kind = 'service' GROUP BY l.item_id ORDER BY n DESC LIMIT 3`,
    [key],
  );
  return {
    visits: visits.map((v) => ({ ...v, total: Number(v.total) })),
    usualStaff: usualStaff.map((u) => ({ ...u, n: Number(u.n) })),
    favourites: favourites.map((f) => ({ ...f, n: Number(f.n) })),
  };
}

/** What the till needs to know about a returning client, by phone number. */
export async function clientLookup(db: Db, phone: string) {
  const row = await db.get<{ name: string | null; visits: number; last_date: string | null }>(
    `SELECT (SELECT customer_name FROM sales WHERE customer_phone = ? AND customer_name IS NOT NULL ORDER BY created_at DESC LIMIT 1) AS name,
            COUNT(*) AS visits, MAX(business_date) AS last_date
       FROM sales s WHERE ${COMPLETED} AND s.customer_phone = ?`,
    [phone, phone],
  );
  if (!row || !Number(row.visits)) return null;
  const profile = await clientProfile(db, phone);
  return {
    name: row.name,
    visits: Number(row.visits),
    last_date: row.last_date,
    usualStaff: profile.usualStaff,
    favourites: profile.favourites,
    lastStaff: profile.visits[0]?.staff ?? null,
    lastItems: profile.visits[0]?.items ?? null,
  };
}

// ---------- alerts ----------

/** Products that track stock and are running low (at or below `threshold`). */
export async function lowStock(db: Db, threshold = 5) {
  return (await stockLevels(db))
    .filter((p) => p.active && p.track_stock && Number(p.on_hand) <= threshold)
    .map((p) => ({ id: p.id, name: p.name, on_hand: Number(p.on_hand) }))
    .sort((a, b) => a.on_hand - b.on_hand);
}

/** Sales on a business date recorded up to a moment in time (for "same time last week"). */
export async function revenueUntil(db: Db, date: string, untilIso: string): Promise<number> {
  const r = await db.get<{ v: number }>(
    `SELECT COALESCE(SUM(total), 0) AS v FROM sales s WHERE ${COMPLETED} AND business_date = ? AND created_at <= ?`,
    [date, untilIso],
  );
  return Number(r?.v ?? 0);
}
