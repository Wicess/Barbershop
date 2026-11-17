// One schema, used by both the server database and the offline copy in the
// browser. Every synced table has an `id` primary key and a `rev` column: the
// server stamps `rev` from a global counter on every write, and devices pull
// rows whose `rev` is newer than the last one they saw.

type ColType = "TEXT" | "INTEGER";

export const TABLES = {
  settings: { id: "TEXT", value: "TEXT", updated_at: "TEXT" },
  users: {
    id: "TEXT", name: "TEXT", role: "TEXT", pin_hash: "TEXT", pin_salt: "TEXT",
    active: "INTEGER", created_at: "TEXT", updated_at: "TEXT",
  },
  devices: {
    id: "TEXT", code: "TEXT", name: "TEXT", registered_by: "TEXT",
    created_at: "TEXT", revoked_at: "TEXT",
  },
  departments: {
    id: "TEXT", name: "TEXT", kind: "TEXT", sort: "INTEGER", active: "INTEGER",
    created_at: "TEXT", updated_at: "TEXT",
  },
  services: {
    id: "TEXT", department_id: "TEXT", name: "TEXT", price: "INTEGER", active: "INTEGER",
    sort: "INTEGER", created_at: "TEXT", updated_at: "TEXT",
  },
  products: {
    id: "TEXT", department_id: "TEXT", name: "TEXT", price: "INTEGER", cost: "INTEGER",
    track_stock: "INTEGER", active: "INTEGER", sort: "INTEGER", created_at: "TEXT", updated_at: "TEXT",
  },
  stock_movements: {
    id: "TEXT", product_id: "TEXT", qty: "INTEGER", reason: "TEXT", unit_cost: "INTEGER",
    paid_from: "TEXT", ref_id: "TEXT", note: "TEXT", business_date: "TEXT", created_by: "TEXT",
    created_at: "TEXT",
  },
  staff: {
    id: "TEXT", name: "TEXT", phone: "TEXT", specialty: "TEXT", commission_bp: "INTEGER",
    base_salary: "INTEGER", active: "INTEGER", joined_on: "TEXT", notes: "TEXT",
    created_at: "TEXT", updated_at: "TEXT",
  },
  staff_rates: {
    id: "TEXT", staff_id: "TEXT", department_id: "TEXT", commission_bp: "INTEGER", updated_at: "TEXT",
  },
  sales: {
    id: "TEXT", receipt_no: "TEXT", device_id: "TEXT", customer_name: "TEXT", customer_phone: "TEXT",
    subtotal: "INTEGER", discount: "INTEGER", total: "INTEGER", tendered: "INTEGER", change_due: "INTEGER",
    status: "TEXT", note: "TEXT", business_date: "TEXT", created_by: "TEXT", created_at: "TEXT",
    voided_at: "TEXT", voided_by: "TEXT", void_reason: "TEXT",
  },
  sale_lines: {
    id: "TEXT", sale_id: "TEXT", position: "INTEGER", kind: "TEXT", item_id: "TEXT", name: "TEXT",
    department_id: "TEXT", staff_id: "TEXT", qty: "INTEGER", list_price: "INTEGER",
    unit_price: "INTEGER", discount: "INTEGER", line_total: "INTEGER", commission_bp: "INTEGER",
    commission: "INTEGER", unit_cost: "INTEGER", cost_total: "INTEGER",
  },
  /** A tip on a sale. It belongs entirely to one staff member and is not shop revenue. */
  tips: {
    id: "TEXT", sale_id: "TEXT", staff_id: "TEXT", amount: "INTEGER", created_at: "TEXT",
  },
  payments: {
    id: "TEXT", sale_id: "TEXT", method: "TEXT", amount: "INTEGER", reference: "TEXT", created_at: "TEXT",
  },
  expenses: {
    id: "TEXT", category: "TEXT", department_id: "TEXT", amount: "INTEGER", description: "TEXT",
    paid_from: "TEXT", business_date: "TEXT", recurring_id: "TEXT", created_by: "TEXT",
    created_at: "TEXT", voided_at: "TEXT", voided_by: "TEXT", void_reason: "TEXT",
  },
  recurring_expenses: {
    id: "TEXT", category: "TEXT", department_id: "TEXT", amount: "INTEGER", description: "TEXT",
    active: "INTEGER", created_at: "TEXT", updated_at: "TEXT",
  },
  staff_adjustments: {
    id: "TEXT", staff_id: "TEXT", month: "TEXT", kind: "TEXT", amount: "INTEGER", note: "TEXT",
    paid_from: "TEXT", business_date: "TEXT", created_by: "TEXT", created_at: "TEXT",
    voided_at: "TEXT", voided_by: "TEXT", void_reason: "TEXT",
  },
  payouts: {
    id: "TEXT", staff_id: "TEXT", month: "TEXT", amount: "INTEGER", method: "TEXT", paid_from: "TEXT",
    note: "TEXT", business_date: "TEXT", created_by: "TEXT", created_at: "TEXT",
    voided_at: "TEXT", voided_by: "TEXT", void_reason: "TEXT",
  },
  day_closes: {
    id: "TEXT", business_date: "TEXT", opening_float: "INTEGER", cash_sales: "INTEGER",
    cash_out: "INTEGER", expected: "INTEGER", counted: "INTEGER", variance: "INTEGER", note: "TEXT",
    closed_by: "TEXT", closed_at: "TEXT",
  },
  /**
   * A month's results, worked out from the records and stored when the month
   * ends (id "month-YYYY-MM"). Salaries use the month's real number of days.
   * `snapshot` holds the per-section and per-staff detail as JSON. Closing again
   * (after a late void, say) replaces the row and bumps `closes`.
   */
  month_closes: {
    id: "TEXT", month: "TEXT", from_date: "TEXT", to_date: "TEXT", days: "INTEGER",
    sales: "INTEGER", revenue: "INTEGER", staff_share: "INTEGER", tips: "INTEGER", salaries: "INTEGER",
    bonuses: "INTEGER", deductions: "INTEGER", expenses: "INTEGER", net_profit: "INTEGER",
    staff_pay: "INTEGER", snapshot: "TEXT", closes: "INTEGER", closed_by: "TEXT", closed_at: "TEXT",
  },
  audit_log: {
    id: "TEXT", actor_id: "TEXT", action: "TEXT", entity: "TEXT", entity_id: "TEXT",
    summary: "TEXT", device_id: "TEXT", created_at: "TEXT",
  },
} satisfies Record<string, Record<string, ColType>>;

export type TableName = keyof typeof TABLES;
export const TABLE_NAMES = Object.keys(TABLES) as TableName[];

const INDEXES = [
  "CREATE INDEX IF NOT EXISTS ix_sales_date ON sales(business_date)",
  "CREATE INDEX IF NOT EXISTS ix_lines_sale ON sale_lines(sale_id)",
  "CREATE INDEX IF NOT EXISTS ix_lines_staff ON sale_lines(staff_id)",
  "CREATE INDEX IF NOT EXISTS ix_payments_sale ON payments(sale_id)",
  "CREATE INDEX IF NOT EXISTS ix_tips_sale ON tips(sale_id)",
  "CREATE INDEX IF NOT EXISTS ix_tips_staff ON tips(staff_id)",
  "CREATE INDEX IF NOT EXISTS ix_sales_phone ON sales(customer_phone)",
  "CREATE INDEX IF NOT EXISTS ix_expenses_date ON expenses(business_date)",
  "CREATE INDEX IF NOT EXISTS ix_stock_product ON stock_movements(product_id)",
  "CREATE INDEX IF NOT EXISTS ix_adj_staff_month ON staff_adjustments(staff_id, month)",
  "CREATE INDEX IF NOT EXISTS ix_payouts_staff_month ON payouts(staff_id, month)",
  "CREATE INDEX IF NOT EXISTS ix_audit_created ON audit_log(created_at)",
];

export function schemaStatements(): string[] {
  const tables = TABLE_NAMES.map((name) => {
    const cols = Object.entries(TABLES[name]).map(([col, type]) =>
      col === "id" ? "id TEXT PRIMARY KEY" : `${col} ${type}`,
    );
    cols.push("rev INTEGER NOT NULL DEFAULT 0");
    return `CREATE TABLE IF NOT EXISTS ${name} (${cols.join(", ")})`;
  });
  const revIndexes = TABLE_NAMES.map((n) => `CREATE INDEX IF NOT EXISTS ix_${n}_rev ON ${n}(rev)`);
  return [...tables, ...INDEXES, ...revIndexes];
}

export function columnsOf(table: TableName): string[] {
  return Object.keys(TABLES[table]);
}
