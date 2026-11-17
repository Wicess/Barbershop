// Every change to the shop's data is a command. A device applies the command
// to its own offline database immediately, queues it, and later sends it to
// the server, which re-checks permissions and applies the same handler to the
// master database. Handlers never delete rows: voids and corrections are new
// facts, so the history of every shilling stays intact.
//
// Rows a handler creates get ids derived from the command id, so the device's
// optimistic copy and the server's copy are the same row.

import { upsert, type Db, type Row } from "./db.ts";
import { can, parseRoleAccess, roleOptions, type Permission, type Role } from "./permissions.ts";
import { share } from "./money.ts";
import { loadSettings, serializeSetting, type Settings } from "./settings.ts";
import type { TableName } from "./schema.ts";
import { addDays, monthOf } from "./dates.ts";
import { monthFigures } from "./reports.ts";

export interface Actor {
  id: string;
  name: string;
  role: Role;
}

export interface Command<T = unknown> {
  id: string;
  type: CommandType;
  payload: T;
  actor_id: string;
  device_id: string;
  at: string;
}

export interface Ctx {
  db: Db;
  actor: Actor;
  deviceId: string;
  /** Stamp for every row written by this command (0 on devices, the server counter on the server). */
  rev: number;
  cmd: Command;
  /** The shop's settings, loaded before the command runs (access rules live here). */
  settings?: Settings;
}

export class CommandError extends Error {}

export const PAYMENT_METHODS = ["cash", "mobile", "card", "bank"] as const;
export type PaymentMethod = (typeof PAYMENT_METHODS)[number];
export const PAYMENT_LABEL: Record<string, string> = {
  cash: "Cash",
  mobile: "Mobile money",
  card: "Card",
  bank: "Bank transfer",
};

export const EXPENSE_CATEGORIES = [
  "Rent",
  "Utilities (power, water)",
  "Salaries & wages",
  "Supplies & consumables",
  "Repairs & maintenance",
  "Spoilage & breakage",
  "Equipment",
  "Transport",
  "Marketing",
  "Taxes & licences",
  "Other",
] as const;

export const ADJUSTMENT_LABEL: Record<string, string> = {
  advance: "Advance",
  bonus: "Bonus",
  deduction: "Deduction",
};

// ---------- payloads ----------

export interface SaleLineInput {
  id: string;
  position: number;
  kind: "service" | "product";
  item_id: string;
  name: string;
  department_id: string;
  staff_id: string | null;
  qty: number;
  list_price: number;
  unit_price: number;
  discount: number;
  commission_bp: number;
  unit_cost: number;
}

export interface SalePayload {
  sale: {
    id: string;
    receipt_no: string;
    customer_name: string | null;
    customer_phone: string | null;
    note: string | null;
    business_date: string;
    created_at: string;
    tendered: number;
  };
  lines: SaleLineInput[];
  payments: { id: string; method: PaymentMethod; amount: number; reference: string | null }[];
  /** Tips go 100% to the staff member named; they are paid on top of the total. */
  tips?: { id: string; staff_id: string; amount: number }[];
}

/** Keep phone numbers comparable: digits only, with a leading + kept. */
export function normalizePhone(v: unknown): string | null {
  if (typeof v !== "string") return null;
  const t = v.trim();
  const digits = t.replace(/\D/g, "");
  if (digits.length < 6) return null;
  // Cameroon (+237): "+237 6 77 12 34 56", "00237677123456" and "677 12 34 56"
  // are the same person, so they're all kept as the 9-digit local number.
  const cm = digits.match(/^(?:00)?237([26]\d{8})$/);
  if (cm) return cm[1];
  return (t.startsWith("+") ? "+" : "") + digits;
}

export interface VoidPayload {
  id: string;
  reason: string;
  /** The shop's local date when the void happened. */
  business_date?: string;
}

export interface Payloads {
  "sale.create": SalePayload;
  "sale.void": VoidPayload;
  "expense.create": Row;
  "expense.void": VoidPayload;
  "recurring.upsert": Row;
  "recurring.post": { month: string };
  "staff.upsert": { staff: Row; rates?: { department_id: string; commission_bp: number | null }[] };
  "adjustment.create": Row;
  "adjustment.void": VoidPayload;
  "payout.create": Row;
  "payout.void": VoidPayload;
  "department.upsert": Row;
  "service.upsert": Row;
  "product.upsert": Row;
  "stock.move": Row;
  "day.close": Row;
  "month.close": { month: string };
  "user.upsert": Row;
  "settings.update": { values: Record<string, unknown> };
  "device.revoke": { id: string };
}

export type CommandType = keyof Payloads;

// ---------- helpers ----------

function need(ctx: Ctx, perm: Permission, settings?: Settings) {
  if (!can(ctx.actor.role, perm, roleOptions(settings ?? ctx.settings))) {
    throw new CommandError("You don't have permission to do that.");
  }
}

function check(condition: unknown, message: string): asserts condition {
  if (!condition) throw new CommandError(message);
}

const isInt = (n: unknown) => Number.isInteger(n);
const isDate = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}-\d{2}$/.test(s);
const isMonth = (s: unknown) => typeof s === "string" && /^\d{4}-\d{2}$/.test(s);
const text = (s: unknown) => (typeof s === "string" ? s.trim() : "");

async function put(ctx: Ctx, table: TableName, row: Row) {
  await upsert(ctx.db, table, row, ctx.rev);
}

async function getRow(ctx: Ctx, table: TableName, id: unknown): Promise<Row | undefined> {
  if (typeof id !== "string") return undefined;
  return ctx.db.get(`SELECT * FROM ${table} WHERE id = ?`, [id]);
}

async function patch(ctx: Ctx, table: TableName, id: string, changes: Row): Promise<Row> {
  const existing = await getRow(ctx, table, id);
  check(existing, "Record not found.");
  const row = { ...existing, ...changes };
  await put(ctx, table, row);
  return row;
}

async function audit(ctx: Ctx, action: string, entity: string, entityId: string, summary: string, n = 0) {
  await put(ctx, "audit_log", {
    id: `${ctx.cmd.id}:a${n}`,
    actor_id: ctx.actor.id,
    action,
    entity,
    entity_id: entityId,
    summary,
    device_id: ctx.deviceId,
    created_at: ctx.cmd.at,
  });
}

async function voidRecord(ctx: Ctx, table: TableName, p: VoidPayload, label: string) {
  check(text(p.reason).length >= 3, "Give a reason (at least 3 characters).");
  const row = await getRow(ctx, table, p.id);
  check(row, "Record not found.");
  check(!row.voided_at, "This record is already voided.");
  await patch(ctx, table, p.id, { voided_at: ctx.cmd.at, voided_by: ctx.actor.id, void_reason: text(p.reason) });
  await audit(ctx, `${table}.void`, table, p.id, `Voided ${label}: ${text(p.reason)}`);
}

/** The share rate for a staff member in a department: department override, else their default. */
export async function staffRate(db: Db, staffId: string, departmentId: string): Promise<number> {
  const override = await db.get<{ commission_bp: number | null }>(
    "SELECT commission_bp FROM staff_rates WHERE staff_id = ? AND department_id = ?",
    [staffId, departmentId],
  );
  if (override && override.commission_bp != null) return Number(override.commission_bp);
  const staff = await db.get<{ commission_bp: number }>("SELECT commission_bp FROM staff WHERE id = ?", [staffId]);
  return Number(staff?.commission_bp ?? 0);
}

/** Totals of a sale, computed the same way everywhere. */
export function saleTotals(lines: Pick<SaleLineInput, "qty" | "unit_price" | "discount">[]) {
  let subtotal = 0;
  let discount = 0;
  for (const l of lines) {
    subtotal += l.qty * l.unit_price;
    discount += l.discount;
  }
  return { subtotal, discount, total: subtotal - discount };
}

export function lineTotal(l: Pick<SaleLineInput, "qty" | "unit_price" | "discount">): number {
  return l.qty * l.unit_price - l.discount;
}

// ---------- handlers ----------

type Handler<K extends CommandType> = (ctx: Ctx, payload: Payloads[K], settings: Settings) => Promise<void>;

/** The note stored on a day the app closed by itself (shown translated on screen). */
export const AUTO_CLOSE_NOTE = "Closed automatically at 11:59 pm. The cash was not counted.";

const handlers: { [K in CommandType]: Handler<K> } = {
  async "sale.create"(ctx, p, settings) {
    need(ctx, "sale.create");
    const s = p.sale;
    check(typeof s?.id === "string" && s.id.length > 8, "Invalid sale.");
    check(!(await getRow(ctx, "sales", s.id)), "This sale was already recorded.");
    check(isDate(s.business_date), "Invalid date.");
    check(Array.isArray(p.lines) && p.lines.length > 0, "Add at least one item.");

    for (const l of p.lines) {
      check(l.kind === "service" || l.kind === "product", "Invalid item.");
      check(isInt(l.qty) && l.qty >= 1, "Quantity must be at least 1.");
      check(isInt(l.unit_price) && l.unit_price >= 0, "Invalid price.");
      check(isInt(l.discount) && l.discount >= 0 && l.discount <= l.qty * l.unit_price, "Invalid discount.");
      check(isInt(l.commission_bp) && l.commission_bp >= 0 && l.commission_bp <= 10000, "Invalid share rate.");
      const item = await getRow(ctx, l.kind === "service" ? "services" : "products", l.item_id);
      check(item, `“${l.name}” is not in the price list.`);
      if (l.kind === "service") check(l.staff_id, `Choose who did “${l.name}”.`);
      if (l.staff_id) check(await getRow(ctx, "staff", l.staff_id), "Unknown staff member.");
      if (l.unit_price !== l.list_price) need(ctx, "sale.editPrice", settings);
      if (l.discount > 0) need(ctx, "sale.discount", settings);
    }

    const totals = saleTotals(p.lines);
    const tips = Array.isArray(p.tips) ? p.tips : [];
    let tipTotal = 0;
    for (const t of tips) {
      check(typeof t.id === "string" && t.id.length > 8, "Invalid tip.");
      check(isInt(t.amount) && t.amount > 0, "Invalid tip amount.");
      check(await getRow(ctx, "staff", t.staff_id), "Choose who gets the tip.");
      tipTotal += t.amount;
    }
    check(Array.isArray(p.payments) && p.payments.length > 0, "Add a payment.");
    let paid = 0;
    let cash = 0;
    for (const pay of p.payments) {
      check((PAYMENT_METHODS as readonly string[]).includes(pay.method), "Invalid payment method.");
      check(isInt(pay.amount) && pay.amount > 0, "Invalid payment amount.");
      paid += pay.amount;
      if (pay.method === "cash") cash += pay.amount;
    }
    check(paid === totals.total + tipTotal, "Payments must add up to the total.");
    const tendered = isInt(s.tendered) && s.tendered > cash ? s.tendered : cash;

    await put(ctx, "sales", {
      id: s.id,
      receipt_no: text(s.receipt_no),
      device_id: ctx.deviceId,
      customer_name: text(s.customer_name) || null,
      customer_phone: normalizePhone(s.customer_phone),
      subtotal: totals.subtotal,
      discount: totals.discount,
      total: totals.total,
      tendered: cash > 0 ? tendered : 0,
      change_due: cash > 0 ? tendered - cash : 0,
      status: "completed",
      note: text(s.note) || null,
      business_date: s.business_date,
      created_by: ctx.actor.id,
      created_at: s.created_at || ctx.cmd.at,
    });

    for (const l of p.lines) {
      const total = lineTotal(l);
      await put(ctx, "sale_lines", {
        ...l,
        sale_id: s.id,
        line_total: total,
        commission: l.staff_id ? share(total, l.commission_bp) : 0,
        cost_total: l.qty * l.unit_cost,
      });
      if (l.kind === "product") {
        const product = await getRow(ctx, "products", l.item_id);
        if (product?.track_stock) {
          await put(ctx, "stock_movements", {
            id: `${l.id}:m`,
            product_id: l.item_id,
            qty: -l.qty,
            reason: "sale",
            unit_cost: l.unit_cost,
            ref_id: s.id,
            business_date: s.business_date,
            created_by: ctx.actor.id,
            created_at: ctx.cmd.at,
          });
        }
      }
    }

    for (const pay of p.payments) {
      await put(ctx, "payments", {
        id: pay.id,
        sale_id: s.id,
        method: pay.method,
        amount: pay.amount,
        reference: text(pay.reference) || null,
        created_at: ctx.cmd.at,
      });
    }

    for (const t of tips) {
      await put(ctx, "tips", { id: t.id, sale_id: s.id, staff_id: t.staff_id, amount: t.amount, created_at: ctx.cmd.at });
    }

    await audit(
      ctx, "sale.create", "sales", s.id,
      `Sale ${text(s.receipt_no)} · ${p.lines.length} item(s)${tipTotal ? ` · tip ${tipTotal}` : ""}`,
    );
    let n = 1;
    for (const l of p.lines) {
      if (l.unit_price === l.list_price && l.discount === 0) continue;
      const parts = [];
      if (l.unit_price !== l.list_price) parts.push(`price ${l.list_price} → ${l.unit_price}`);
      if (l.discount > 0) parts.push(`discount ${l.discount}`);
      await audit(ctx, "sale.priceChange", "sales", s.id, `${text(s.receipt_no)}: ${l.name} ${parts.join(", ")}`, n++);
    }
  },

  async "sale.void"(ctx, p) {
    need(ctx, "sale.void");
    check(text(p.reason).length >= 3, "Give a reason (at least 3 characters).");
    const sale = await getRow(ctx, "sales", p.id);
    check(sale, "Sale not found.");
    check(sale.status === "completed", "This sale is already voided.");
    await patch(ctx, "sales", p.id, {
      status: "voided",
      voided_at: ctx.cmd.at,
      voided_by: ctx.actor.id,
      void_reason: text(p.reason),
    });
    const moves = await ctx.db.all<Row>(
      "SELECT * FROM stock_movements WHERE ref_id = ? AND reason = 'sale'",
      [p.id],
    );
    for (const m of moves) {
      await put(ctx, "stock_movements", {
        ...m,
        id: `${m.id}:v`,
        qty: -Number(m.qty),
        reason: "void",
        business_date: isDate(p.business_date) ? p.business_date : m.business_date,
        created_by: ctx.actor.id,
        created_at: ctx.cmd.at,
      });
    }
    await audit(ctx, "sale.void", "sales", p.id, `Voided sale ${sale.receipt_no}: ${text(p.reason)}`);
  },

  async "expense.create"(ctx, p) {
    need(ctx, "expense.create");
    check(typeof p.id === "string", "Invalid expense.");
    check(!(await getRow(ctx, "expenses", p.id)), "This expense was already recorded.");
    check(isInt(p.amount) && Number(p.amount) > 0, "Enter an amount.");
    check(text(p.category), "Choose a category.");
    check(isDate(p.business_date), "Choose a date.");
    await put(ctx, "expenses", {
      ...p,
      description: text(p.description) || null,
      paid_from: p.paid_from === "till" ? "till" : "other",
      created_by: ctx.actor.id,
      created_at: ctx.cmd.at,
      voided_at: null,
      voided_by: null,
      void_reason: null,
    });
    await audit(ctx, "expense.create", "expenses", String(p.id), `Expense: ${text(p.category)}`);
  },

  async "expense.void"(ctx, p) {
    need(ctx, "expense.void");
    await voidRecord(ctx, "expenses", p, "expense");
  },

  async "recurring.upsert"(ctx, p) {
    need(ctx, "expense.create");
    check(typeof p.id === "string", "Invalid fixed cost.");
    check(isInt(p.amount) && Number(p.amount) > 0, "Enter an amount.");
    check(text(p.category), "Choose a category.");
    const existing = await getRow(ctx, "recurring_expenses", p.id);
    await put(ctx, "recurring_expenses", {
      ...p,
      description: text(p.description) || null,
      active: p.active ? 1 : 0,
      created_at: existing?.created_at ?? ctx.cmd.at,
      updated_at: ctx.cmd.at,
    });
    await audit(ctx, "recurring.upsert", "recurring_expenses", String(p.id), `Fixed monthly cost: ${text(p.category)}`);
  },

  async "recurring.post"(ctx, p) {
    need(ctx, "expense.create");
    check(isMonth(p.month), "Invalid month.");
    const fixed = await ctx.db.all<Row>("SELECT * FROM recurring_expenses WHERE active = 1");
    let n = 0;
    for (const r of fixed) {
      const id = `rec-${r.id}-${p.month}`;
      if (await getRow(ctx, "expenses", id)) continue;
      await put(ctx, "expenses", {
        id,
        category: r.category,
        department_id: r.department_id,
        amount: r.amount,
        description: r.description,
        paid_from: "other",
        business_date: `${p.month}-01`,
        recurring_id: r.id,
        created_by: ctx.actor.id,
        created_at: ctx.cmd.at,
      });
      n++;
    }
    if (n > 0) await audit(ctx, "recurring.post", "expenses", p.month, `Posted ${n} fixed cost(s) for ${p.month}`);
  },

  async "staff.upsert"(ctx, p, settings) {
    need(ctx, "staff.manage");
    const s = p.staff;
    check(typeof s.id === "string", "Invalid staff member.");
    check(text(s.name), "Enter a name.");
    const existing = await getRow(ctx, "staff", s.id);
    const canPay = can(ctx.actor.role, "staff.setPay", roleOptions(ctx.settings));
    let commission = Number(s.commission_bp);
    let salary = Number(s.base_salary ?? 0);
    if (!canPay) {
      commission = existing ? Number(existing.commission_bp) : settings.default_commission_bp;
      salary = existing ? Number(existing.base_salary ?? 0) : 0;
    }
    check(isInt(commission) && commission >= 0 && commission <= 10000, "Share must be between 0% and 100%.");
    check(isInt(salary) && salary >= 0, "Invalid salary.");
    await put(ctx, "staff", {
      id: s.id,
      name: text(s.name),
      phone: text(s.phone) || null,
      specialty: text(s.specialty) || null,
      commission_bp: commission,
      base_salary: salary,
      active: s.active === 0 || s.active === false ? 0 : 1,
      joined_on: isDate(s.joined_on) ? s.joined_on : existing?.joined_on ?? ctx.cmd.at.slice(0, 10),
      notes: text(s.notes) || null,
      created_at: existing?.created_at ?? ctx.cmd.at,
      updated_at: ctx.cmd.at,
    });
    if (canPay && Array.isArray(p.rates)) {
      for (const r of p.rates) {
        const bp = r.commission_bp;
        check(bp == null || (isInt(bp) && bp >= 0 && bp <= 10000), "Share must be between 0% and 100%.");
        await put(ctx, "staff_rates", {
          id: `${s.id}:${r.department_id}`,
          staff_id: s.id,
          department_id: r.department_id,
          commission_bp: bp,
          updated_at: ctx.cmd.at,
        });
      }
    }
    const what = existing ? "Updated" : "Added";
    await audit(ctx, "staff.upsert", "staff", String(s.id), `${what} staff: ${text(s.name)}`);
  },

  async "adjustment.create"(ctx, p) {
    check(["advance", "bonus", "deduction"].includes(String(p.kind)), "Invalid type.");
    need(ctx, p.kind === "advance" ? "staff.adjust" : "staff.setPay");
    check(typeof p.id === "string", "Invalid entry.");
    check(!(await getRow(ctx, "staff_adjustments", p.id)), "Already recorded.");
    check(await getRow(ctx, "staff", p.staff_id), "Unknown staff member.");
    check(isMonth(p.month), "Choose a month.");
    check(isInt(p.amount) && Number(p.amount) > 0, "Enter an amount.");
    check(isDate(p.business_date), "Invalid date.");
    await put(ctx, "staff_adjustments", {
      ...p,
      note: text(p.note) || null,
      // Only advances are cash handed over now; bonuses and deductions change the month's pay.
      paid_from: p.kind === "advance" ? (p.paid_from === "till" ? "till" : "other") : null,
      created_by: ctx.actor.id,
      created_at: ctx.cmd.at,
      voided_at: null,
      voided_by: null,
      void_reason: null,
    });
    await audit(ctx, "adjustment.create", "staff_adjustments", String(p.id), `${ADJUSTMENT_LABEL[String(p.kind)]} recorded`);
  },

  async "adjustment.void"(ctx, p) {
    const row = await getRow(ctx, "staff_adjustments", p.id);
    need(ctx, row?.kind === "advance" ? "staff.adjust" : "staff.setPay");
    await voidRecord(ctx, "staff_adjustments", p, "pay adjustment");
  },

  async "payout.create"(ctx, p) {
    need(ctx, "payroll.pay");
    check(typeof p.id === "string", "Invalid payment.");
    check(!(await getRow(ctx, "payouts", p.id)), "Already recorded.");
    check(await getRow(ctx, "staff", p.staff_id), "Unknown staff member.");
    check(isMonth(p.month), "Choose a month.");
    check(isInt(p.amount) && Number(p.amount) > 0, "Enter an amount.");
    check(isDate(p.business_date), "Invalid date.");
    await put(ctx, "payouts", {
      ...p,
      method: text(p.method) || "cash",
      paid_from: p.paid_from === "till" ? "till" : "other",
      note: text(p.note) || null,
      created_by: ctx.actor.id,
      created_at: ctx.cmd.at,
      voided_at: null,
      voided_by: null,
      void_reason: null,
    });
    await audit(ctx, "payout.create", "payouts", String(p.id), `Staff pay recorded for ${p.month}`);
  },

  async "payout.void"(ctx, p) {
    need(ctx, "payroll.pay");
    await voidRecord(ctx, "payouts", p, "staff payment");
  },

  async "department.upsert"(ctx, p) {
    need(ctx, "catalog.manage");
    check(typeof p.id === "string", "Invalid section.");
    check(text(p.name), "Enter a name.");
    check(p.kind === "service" || p.kind === "product", "Choose what the section sells.");
    const existing = await getRow(ctx, "departments", p.id);
    await put(ctx, "departments", {
      id: p.id,
      name: text(p.name),
      kind: p.kind,
      sort: isInt(p.sort) ? p.sort : existing?.sort ?? 99,
      active: p.active === 0 || p.active === false ? 0 : 1,
      created_at: existing?.created_at ?? ctx.cmd.at,
      updated_at: ctx.cmd.at,
    });
    await audit(ctx, "department.upsert", "departments", String(p.id), `Section: ${text(p.name)}`);
  },

  async "service.upsert"(ctx, p) {
    need(ctx, "catalog.manage");
    check(typeof p.id === "string", "Invalid service.");
    check(text(p.name), "Enter a name.");
    check(isInt(p.price) && Number(p.price) >= 0, "Enter a price.");
    const dept = await getRow(ctx, "departments", p.department_id);
    check(dept && dept.kind === "service", "Choose a service section.");
    const existing = await getRow(ctx, "services", p.id);
    await put(ctx, "services", {
      id: p.id,
      department_id: p.department_id,
      name: text(p.name),
      price: p.price,
      active: p.active === 0 || p.active === false ? 0 : 1,
      sort: isInt(p.sort) ? p.sort : existing?.sort ?? 99,
      created_at: existing?.created_at ?? ctx.cmd.at,
      updated_at: ctx.cmd.at,
    });
    const change = existing && existing.price !== p.price ? ` (price ${existing.price} → ${p.price})` : "";
    await audit(ctx, "service.upsert", "services", String(p.id), `Service: ${text(p.name)}${change}`);
  },

  async "product.upsert"(ctx, p) {
    need(ctx, "catalog.manage");
    check(typeof p.id === "string", "Invalid product.");
    check(text(p.name), "Enter a name.");
    check(isInt(p.price) && Number(p.price) >= 0, "Enter a selling price.");
    check(isInt(p.cost) && Number(p.cost) >= 0, "Enter the cost price.");
    const dept = await getRow(ctx, "departments", p.department_id);
    check(dept && dept.kind === "product", "Choose a product section.");
    const existing = await getRow(ctx, "products", p.id);
    await put(ctx, "products", {
      id: p.id,
      department_id: p.department_id,
      name: text(p.name),
      price: p.price,
      cost: p.cost,
      track_stock: p.track_stock === 0 || p.track_stock === false ? 0 : 1,
      active: p.active === 0 || p.active === false ? 0 : 1,
      sort: isInt(p.sort) ? p.sort : existing?.sort ?? 99,
      created_at: existing?.created_at ?? ctx.cmd.at,
      updated_at: ctx.cmd.at,
    });
    await audit(ctx, "product.upsert", "products", String(p.id), `Product: ${text(p.name)}`);
  },

  async "stock.move"(ctx, p) {
    need(ctx, "stock.manage");
    check(["purchase", "spoilage", "adjustment"].includes(String(p.reason)), "Invalid stock change.");
    check(typeof p.id === "string", "Invalid stock change.");
    check(!(await getRow(ctx, "stock_movements", p.id)), "Already recorded.");
    const product = await getRow(ctx, "products", p.product_id);
    check(product, "Unknown product.");
    check(isInt(p.qty) && p.qty !== 0, "Enter a quantity.");
    if (p.reason === "purchase") check(Number(p.qty) > 0, "Purchased quantity must be positive.");
    if (p.reason === "spoilage") check(Number(p.qty) < 0, "Spoiled quantity is taken out of stock.");
    check(isDate(p.business_date), "Invalid date.");
    await put(ctx, "stock_movements", {
      ...p,
      unit_cost: isInt(p.unit_cost) ? p.unit_cost : product.cost,
      paid_from: p.reason === "purchase" && p.paid_from === "till" ? "till" : null,
      note: text(p.note) || null,
      ref_id: null,
      created_by: ctx.actor.id,
      created_at: ctx.cmd.at,
    });
    if (p.reason === "purchase" && isInt(p.unit_cost) && p.unit_cost !== product.cost) {
      await put(ctx, "products", { ...product, cost: p.unit_cost, updated_at: ctx.cmd.at });
    }
    await audit(ctx, "stock.move", "products", String(p.product_id), `Stock ${p.reason}: ${product.name} ${Number(p.qty) > 0 ? "+" : ""}${p.qty}`);
  },

  /**
   * Close a business day. A person closes it by counting the drawer. If nobody
   * does, the app closes it on its own at 11:59 pm by the device's clock
   * (`auto`): it stores the expected cash, marks the day as not counted, and
   * never replaces a day that was already closed (so two devices closing the
   * same day at midnight just record it once).
   */
  async "day.close"(ctx, p) {
    need(ctx, "cash.close");
    check(isDate(p.business_date), "Invalid date.");
    const id = `close-${p.business_date}`;
    const existing = await getRow(ctx, "day_closes", id);
    const auto = p.auto === true;
    if (auto && existing) return;
    if (existing) need(ctx, "cash.reclose");
    for (const k of ["opening_float", "cash_sales", "cash_out", "expected"]) {
      check(isInt(p[k]), "Invalid cash count.");
    }
    if (!auto) check(isInt(p.counted), "Invalid cash count.");
    // An automatic close is stamped 11:59 pm of its own day, even when it runs the next morning.
    const closedAt = auto && typeof p.closed_at === "string" && !Number.isNaN(Date.parse(p.closed_at)) ? p.closed_at : ctx.cmd.at;
    const counted = auto ? Number(p.expected) : Number(p.counted);
    await put(ctx, "day_closes", {
      id,
      business_date: p.business_date,
      opening_float: p.opening_float,
      cash_sales: p.cash_sales,
      cash_out: p.cash_out,
      expected: p.expected,
      counted,
      variance: counted - Number(p.expected),
      note: auto ? AUTO_CLOSE_NOTE : text(p.note) || null,
      closed_by: ctx.actor.id,
      closed_at: closedAt,
    });
    await audit(
      ctx,
      "day.close",
      "day_closes",
      id,
      auto ? `Closed ${p.business_date} automatically at 11:59 pm: expected ${p.expected}, not counted` : `Closed ${p.business_date}: counted ${p.counted}, expected ${p.expected}`,
    );
  },

  async "user.upsert"(ctx, p) {
    need(ctx, "users.manage");
    check(typeof p.id === "string", "Invalid user.");
    check(text(p.name), "Enter a name.");
    check(["owner", "manager", "cashier"].includes(String(p.role)), "Choose a role.");
    const existing = await getRow(ctx, "users", p.id);
    const active = p.active === 0 || p.active === false ? 0 : 1;
    if (existing?.role === "owner" && (p.role !== "owner" || !active)) {
      const owners = await ctx.db.all("SELECT id FROM users WHERE role = 'owner' AND active = 1 AND id != ?", [p.id]);
      check(owners.length > 0, "The shop needs at least one active owner.");
    }
    const pinHash = p.pin_hash ?? existing?.pin_hash;
    const pinSalt = p.pin_salt ?? existing?.pin_salt;
    check(pinHash && pinSalt, "Set a PIN.");
    await put(ctx, "users", {
      id: p.id,
      name: text(p.name),
      role: p.role,
      pin_hash: pinHash,
      pin_salt: pinSalt,
      active,
      created_at: existing?.created_at ?? ctx.cmd.at,
      updated_at: ctx.cmd.at,
    });
    const pinNote = p.pin_hash && existing ? " (PIN changed)" : "";
    await audit(ctx, "user.upsert", "users", String(p.id), `${existing ? "Updated" : "Added"} user ${text(p.name)} as ${p.role}${pinNote}`);
  },

  /**
   * Close a finished month: work out its results from the records (the whole
   * calendar month, salaries by its real number of days) and store them. The
   * server re-runs this against the master database, so the stored figures
   * come from complete records even if the device that asked was behind.
   * Closing again recalculates and replaces the stored figures.
   */
  async "month.close"(ctx, p) {
    need(ctx, "reports.profit");
    check(isMonth(p.month), "Invalid month.");
    // Only finished months; one day of grace so a device a few hours ahead of UTC can close on the 1st.
    check(p.month < monthOf(addDays(ctx.cmd.at.slice(0, 10), 1)), "This month hasn't ended yet.");
    const id = `month-${p.month}`;
    const existing = await getRow(ctx, "month_closes", id);
    const f = await monthFigures(ctx.db, p.month);
    await put(ctx, "month_closes", {
      id,
      month: f.month,
      from_date: f.from,
      to_date: f.to,
      days: f.days,
      sales: f.sales,
      revenue: f.revenue,
      staff_share: f.staffShare,
      tips: f.tips,
      salaries: f.salaries,
      bonuses: f.bonuses,
      deductions: f.deductions,
      expenses: f.expenses,
      net_profit: f.netProfit,
      staff_pay: f.staffPay,
      snapshot: JSON.stringify(f.snapshot),
      closes: Number(existing?.closes ?? 0) + 1,
      closed_by: ctx.actor.id,
      closed_at: ctx.cmd.at,
    });
    await audit(
      ctx,
      "month.close",
      "month_closes",
      id,
      `${existing ? "Recalculated" : "Closed"} ${p.month} (${f.days} days): revenue ${f.revenue}, net profit ${f.netProfit}, staff pay ${f.staffPay}`,
    );
  },

  async "settings.update"(ctx, p) {
    need(ctx, "settings.manage");
    const keys = Object.keys(p.values ?? {});
    check(keys.length > 0, "Nothing to save.");
    if ("role_access" in p.values) {
      // Store only a clean, valid list (unknown or owner-only rights are dropped).
      p.values.role_access = p.values.role_access ? JSON.stringify(parseRoleAccess(String(p.values.role_access))) : "";
    }
    for (const key of keys) {
      await put(ctx, "settings", { id: key, value: serializeSetting(p.values[key]), updated_at: ctx.cmd.at });
    }
    await audit(ctx, "settings.update", "settings", keys.join(","), `Changed settings: ${keys.join(", ")}`);
  },

  async "device.revoke"(ctx, p) {
    need(ctx, "users.manage");
    const device = await getRow(ctx, "devices", p.id);
    check(device, "Device not found.");
    await patch(ctx, "devices", p.id, { revoked_at: ctx.cmd.at });
    await audit(ctx, "device.revoke", "devices", p.id, `Signed out device ${device.code} (${device.name})`);
  },
};

export async function applyCommand(ctx: Ctx): Promise<void> {
  const handler = handlers[ctx.cmd.type] as Handler<CommandType> | undefined;
  if (!handler) throw new CommandError(`Unknown action: ${ctx.cmd.type}`);
  const settings = await loadSettings(ctx.db);
  ctx.settings = settings;
  await handler(ctx, ctx.cmd.payload as Payloads[CommandType], settings);
}
