import { test } from "node:test";
import assert from "node:assert/strict";
import initSqlJs from "sql.js";
import { applyCommand, AUTO_CLOSE_NOTE, CommandError, staffRate, type Actor, type CommandType, type Payloads } from "../src/core/commands.ts";
import { can } from "../src/core/permissions.ts";
import { upsert, type Db, type Store } from "../src/core/db.ts";
import { schemaStatements } from "../src/core/schema.ts";
import { demoShop } from "../src/core/demo.ts";
import { DEFAULT_DEPARTMENTS } from "../src/core/seed.ts";
import { monthRange } from "../src/core/dates.ts";
import { cashbook, cashFigures, clientList, clientLookup, lowStock, payroll, periodSummary, saleSplit, staffEarnings, staffLines } from "../src/core/reports.ts";

const sqlReady = initSqlJs();

async function memoryStore(): Promise<Store> {
  const SQL = await sqlReady;
  const db = new SQL.Database();
  for (const s of schemaStatements()) db.run(s);
  const query = (sql: string, params: unknown[] = []) => {
    const stmt = db.prepare(sql);
    stmt.bind(params as never);
    const rows: Record<string, unknown>[] = [];
    while (stmt.step()) rows.push(stmt.getAsObject());
    stmt.free();
    return rows;
  };
  const base: Db = {
    all: async <T>(sql: string, p?: unknown[]) => query(sql, p) as T[],
    get: async <T>(sql: string, p?: unknown[]) => query(sql, p)[0] as T | undefined,
    run: async (sql: string, p: unknown[] = []) => void db.run(sql, p as never),
  };
  return {
    ...base,
    async tx(fn) {
      db.run("BEGIN");
      try {
        const r = await fn(base);
        db.run("COMMIT");
        return r;
      } catch (e) {
        db.run("ROLLBACK");
        throw e;
      }
    },
  };
}

const owner: Actor = { id: "u-owner", name: "Owner", role: "owner" };
const manager: Actor = { id: "u-man", name: "Manager", role: "manager" };
const cashier: Actor = { id: "u-cash", name: "Cashier", role: "cashier" };

let seq = 0;
async function exec<K extends CommandType>(store: Store, actor: Actor, type: K, payload: Payloads[K], at = "2026-10-15T10:00:00.000Z") {
  const cmd = { id: `cmd-${++seq}`, type, payload, actor_id: actor.id, device_id: "dev-A", at };
  await store.tx((db) => applyCommand({ db, actor, deviceId: "dev-A", rev: seq, cmd }));
}

const KES = (n: number) => n * 100; // shillings to cents

async function shop() {
  const store = await memoryStore();
  for (const [id, name, kind, sort] of [
    ["dept-barbering", "Barbering", "service", 1],
    ["dept-manicure", "Manicure", "service", 2],
    ["dept-pedicure", "Pedicure", "service", 3],
    ["dept-drinks", "Drinks & beverages", "product", 5],
  ] as const) {
    await upsert(store, "departments", { id, name, kind, sort, active: 1 }, 1);
  }
  await upsert(store, "settings", { id: "currency", value: "KES" }, 1);
  await exec(store, owner, "staff.upsert", {
    staff: { id: "st-ali", name: "Ali", commission_bp: 4000, base_salary: 0 },
  });
  await exec(store, owner, "staff.upsert", {
    staff: { id: "st-grace", name: "Grace", commission_bp: 5000, base_salary: 0 },
    rates: [{ department_id: "dept-pedicure", commission_bp: 6000 }],
  });
  await exec(store, owner, "service.upsert", { id: "sv-cut", department_id: "dept-barbering", name: "Haircut", price: KES(500) });
  await exec(store, owner, "service.upsert", { id: "sv-pedi", department_id: "dept-pedicure", name: "Pedicure", price: KES(1000) });
  await exec(store, owner, "service.upsert", { id: "sv-mani", department_id: "dept-manicure", name: "Manicure", price: KES(800) });
  await exec(store, owner, "product.upsert", { id: "pr-soda", department_id: "dept-drinks", name: "Soda", price: KES(100), cost: KES(60), track_stock: 1 });
  await exec(store, owner, "stock.move", { id: "mv-open", product_id: "pr-soda", qty: 24, reason: "purchase", unit_cost: KES(60), business_date: "2026-10-01" });
  return store;
}

function sale(id: string, lines: Payloads["sale.create"]["lines"], payments: Payloads["sale.create"]["payments"], date = "2026-10-15", tendered = 0): Payloads["sale.create"] {
  return {
    sale: { id: `sale-${id}-xxxx`, receipt_no: `A-${id}`, customer_name: null, customer_phone: null, note: null, business_date: date, created_at: `${date}T10:00:00Z`, tendered },
    lines,
    payments,
  };
}

const cut = (id: string, staff: string, price = KES(500), discount = 0, bp = 4000) => ({
  id, position: 0, kind: "service" as const, item_id: "sv-cut", name: "Haircut", department_id: "dept-barbering",
  staff_id: staff, qty: 1, list_price: KES(500), unit_price: price, discount, commission_bp: bp, unit_cost: 0,
});
const pedi = (id: string, staff: string, bp = 6000) => ({
  id, position: 1, kind: "service" as const, item_id: "sv-pedi", name: "Pedicure", department_id: "dept-pedicure",
  staff_id: staff, qty: 1, list_price: KES(1000), unit_price: KES(1000), discount: 0, commission_bp: bp, unit_cost: 0,
});
const soda = (id: string, qty: number) => ({
  id, position: 2, kind: "product" as const, item_id: "pr-soda", name: "Soda", department_id: "dept-drinks",
  staff_id: null, qty, list_price: KES(100), unit_price: KES(100), discount: 0, commission_bp: 0, unit_cost: KES(60),
});

test("one ticket: haircut + pedicure by different staff + drinks splits correctly", async () => {
  const store = await shop();
  await exec(store, cashier, "sale.create", sale("1", [cut("l1", "st-ali"), pedi("l2", "st-grace"), soda("l3", 2)], [{ id: "p1", method: "cash", amount: KES(1700), reference: null }], "2026-10-15", KES(2000)));

  const s = await store.get<{ total: number; change_due: number }>("SELECT total, change_due FROM sales");
  assert.equal(s?.total, KES(1700));
  assert.equal(s?.change_due, KES(300));

  const lines = await store.all<{ name: string; commission: number; cost_total: number }>("SELECT name, commission, cost_total FROM sale_lines ORDER BY position");
  assert.deepEqual(lines.map((l) => l.commission), [KES(200), KES(600), 0]); // 40% of 500, 60% of 1000, drinks none
  assert.equal(lines[2].cost_total, KES(120));

  const stock = await store.get<{ n: number }>("SELECT SUM(qty) AS n FROM stock_movements WHERE product_id = 'pr-soda'");
  assert.equal(stock?.n, 22);
});

test("profit by section and net profit after shared expenses", async () => {
  const store = await shop();
  await exec(store, cashier, "sale.create", sale("1", [cut("l1", "st-ali"), pedi("l2", "st-grace"), soda("l3", 2)], [{ id: "p1", method: "cash", amount: KES(1700), reference: null }]));
  await exec(store, manager, "expense.create", { id: "e1", category: "Rent", amount: KES(300), business_date: "2026-10-15", paid_from: "other" });
  await exec(store, manager, "expense.create", { id: "e2", category: "Supplies & consumables", department_id: "dept-pedicure", amount: KES(100), business_date: "2026-10-15", paid_from: "till" });
  await exec(store, manager, "stock.move", { id: "mv-sp", product_id: "pr-soda", qty: -1, reason: "spoilage", business_date: "2026-10-15" });

  const r = await periodSummary(store, "2026-10-01", "2026-10-31");
  const by = Object.fromEntries(r.departments.map((d) => [d.id, d.profit]));
  assert.equal(by["dept-barbering"], KES(300)); // 500 − 200 share
  assert.equal(by["dept-pedicure"], KES(300)); // 1000 − 600 share − 100 supplies
  assert.equal(by["dept-drinks"], KES(200 - 120 - 60)); // revenue − cost sold − one spoiled at cost
  assert.equal(r.revenue, KES(1700));
  assert.equal(r.netProfit, KES(300 + 300 + 20 - 300));
});

test("staff pay for the month: share earned minus advances", async () => {
  const store = await shop();
  await exec(store, cashier, "sale.create", sale("1", [cut("l1", "st-ali")], [{ id: "p1", method: "cash", amount: KES(500), reference: null }]));
  await exec(store, cashier, "sale.create", sale("2", [cut("l2", "st-ali")], [{ id: "p2", method: "mobile", amount: KES(500), reference: "QWE123" }]));
  await exec(store, manager, "adjustment.create", { id: "adj1", staff_id: "st-ali", month: "2026-10", kind: "advance", amount: KES(150), paid_from: "till", business_date: "2026-10-15" });

  const rows = await payroll(store, "2026-10");
  const ali = rows.find((r) => r.staff_id === "st-ali")!;
  assert.equal(ali.services, 2);
  assert.equal(ali.clients, 2);
  assert.equal(ali.revenue, KES(1000));
  assert.equal(ali.earned, KES(400));
  assert.equal(ali.shopShare, KES(600));
  assert.equal(ali.netPay, KES(250));
});

test("void removes a sale from totals, restores stock, and only managers can do it", async () => {
  const store = await shop();
  await exec(store, cashier, "sale.create", sale("1", [cut("l1", "st-ali"), soda("l3", 3)], [{ id: "p1", method: "cash", amount: KES(800), reference: null }]));
  await assert.rejects(exec(store, cashier, "sale.void", { id: "sale-1-xxxx", reason: "mistake" }), CommandError);
  await exec(store, manager, "sale.void", { id: "sale-1-xxxx", reason: "Entered twice", business_date: "2026-10-15" });

  const r = await periodSummary(store, "2026-10-01", "2026-10-31");
  assert.equal(r.revenue, 0);
  const stock = await store.get<{ n: number }>("SELECT SUM(qty) AS n FROM stock_movements WHERE product_id = 'pr-soda'");
  assert.equal(stock?.n, 24);
  assert.equal((await payroll(store, "2026-10")).find((p) => p.staff_id === "st-ali")?.earned ?? 0, 0);
  const saleRow = await store.get<{ status: string }>("SELECT status FROM sales");
  assert.equal(saleRow?.status, "voided"); // kept in history, not deleted
});

test("cashier cannot change a price unless the owner allows it; payments must add up", async () => {
  const store = await shop();
  await assert.rejects(
    exec(store, cashier, "sale.create", sale("1", [cut("l1", "st-ali", KES(300))], [{ id: "p1", method: "cash", amount: KES(300), reference: null }])),
    /permission/,
  );
  await exec(store, owner, "settings.update", { values: { cashier_can_edit_price: true } });
  await exec(store, cashier, "sale.create", sale("2", [cut("l2", "st-ali", KES(300))], [{ id: "p2", method: "cash", amount: KES(300), reference: null }]));
  const line = await store.get<{ commission: number }>("SELECT commission FROM sale_lines WHERE id = 'l2'");
  assert.equal(line?.commission, KES(120)); // share follows the price actually charged

  await assert.rejects(
    exec(store, cashier, "sale.create", sale("3", [cut("l3", "st-ali")], [{ id: "p3", method: "cash", amount: KES(400), reference: null }])),
    /add up/,
  );
});

test("discount reduces both the bill and the staff share", async () => {
  const store = await shop();
  await exec(store, manager, "sale.create", sale("1", [cut("l1", "st-ali", KES(500), KES(100))], [{ id: "p1", method: "card", amount: KES(400), reference: null }]));
  const line = await store.get<{ line_total: number; commission: number }>("SELECT line_total, commission FROM sale_lines");
  assert.equal(line?.line_total, KES(400));
  assert.equal(line?.commission, KES(160));
});

test("cash-up expected cash accounts for drawer expenses and advances", async () => {
  const store = await shop();
  await exec(store, cashier, "sale.create", sale("1", [cut("l1", "st-ali")], [{ id: "p1", method: "cash", amount: KES(500), reference: null }]));
  await exec(store, cashier, "sale.create", sale("2", [pedi("l2", "st-grace")], [
    { id: "p2a", method: "cash", amount: KES(400), reference: null },
    { id: "p2b", method: "mobile", amount: KES(600), reference: "ABC" },
  ]));
  await exec(store, manager, "expense.create", { id: "e1", category: "Supplies & consumables", amount: KES(50), business_date: "2026-10-15", paid_from: "till" });
  await exec(store, manager, "adjustment.create", { id: "a1", staff_id: "st-ali", month: "2026-10", kind: "advance", amount: KES(100), paid_from: "till", business_date: "2026-10-15" });

  const f = await cashFigures(store, "2026-10-15");
  assert.equal(f.cashSales, KES(900));
  assert.equal(f.cashOut, KES(150));
  assert.deepEqual(f.otherMethods, [{ method: "mobile", amount: KES(600) }]);
});

test("a day nobody counted closes on its own at 11:59 pm, once, and a later count replaces it", async () => {
  const store = await shop();
  await exec(store, cashier, "sale.create", sale("1", [cut("l1", "st-ali")], [{ id: "p1", method: "cash", amount: KES(500), reference: null }]));
  const f = await cashFigures(store, "2026-10-15");
  const auto = { business_date: "2026-10-15", opening_float: KES(200), cash_sales: f.cashSales, cash_out: f.cashOut, expected: KES(200) + f.cashSales - f.cashOut, auto: true, closed_at: "2026-10-15T22:59:00.000Z" };
  // The device runs it the next morning: still stamped 11:59 pm of that day.
  await exec(store, cashier, "day.close", auto, "2026-10-16T07:30:00.000Z");
  let row = await store.get<Record<string, unknown>>("SELECT * FROM day_closes WHERE business_date = '2026-10-15'");
  assert.equal(row?.closed_at, "2026-10-15T22:59:00.000Z");
  assert.equal(row?.note, AUTO_CLOSE_NOTE);
  assert.equal(row?.counted, row?.expected); // no count was made, so no made-up difference
  assert.equal(row?.variance, 0);

  // A second device closing the same day at midnight changes nothing (and isn't an error, even for a cashier).
  await exec(store, cashier, "day.close", { ...auto, expected: 1, closed_at: "2026-10-15T22:59:30.000Z" });
  row = await store.get<Record<string, unknown>>("SELECT * FROM day_closes WHERE business_date = '2026-10-15'");
  assert.equal(row?.expected, KES(700));

  // The manager counts the drawer later: the real count replaces the automatic close.
  await exec(store, manager, "day.close", { ...auto, auto: undefined, counted: KES(680), note: "" });
  row = await store.get<Record<string, unknown>>("SELECT * FROM day_closes WHERE business_date = '2026-10-15'");
  assert.equal(row?.counted, KES(680));
  assert.equal(row?.variance, KES(-20));
  assert.equal(row?.note, null);
});

test("fixed monthly costs post once per month even if triggered twice", async () => {
  const store = await shop();
  await exec(store, owner, "recurring.upsert", { id: "rent", category: "Rent", amount: KES(20000), description: "Shop rent", active: 1 });
  await exec(store, manager, "recurring.post", { month: "2026-10" });
  await exec(store, owner, "recurring.post", { month: "2026-10" });
  const rows = await store.all("SELECT id FROM expenses WHERE recurring_id = 'rent'");
  assert.equal(rows.length, 1);
});

test("manager cannot change a staff member's negotiated share", async () => {
  const store = await shop();
  await exec(store, manager, "staff.upsert", { staff: { id: "st-ali", name: "Ali K", commission_bp: 9000 } });
  const ali = await store.get<{ name: string; commission_bp: number }>("SELECT name, commission_bp FROM staff WHERE id = 'st-ali'");
  assert.equal(ali?.name, "Ali K");
  assert.equal(ali?.commission_bp, 4000);
});

const mani = (id: string, staff: string, bp: number, price = KES(800)) => ({
  id, position: 1, kind: "service" as const, item_id: "sv-mani", name: "Manicure", department_id: "dept-manicure",
  staff_id: staff, qty: 1, list_price: KES(800), unit_price: price, discount: 0, commission_bp: bp, unit_cost: 0,
});

test("one customer, many services: each worker's cut and the shop's cut add up exactly", async () => {
  const store = await shop();
  // Barber on 35%, manicurist on 40% (and 60% on pedicures), as agreed with the owner.
  await exec(store, owner, "staff.upsert", { staff: { id: "st-ali", name: "Ali", commission_bp: 3500 } });
  await exec(store, owner, "staff.upsert", { staff: { id: "st-grace", name: "Grace", commission_bp: 4000 } });
  await exec(store, cashier, "sale.create", sale("1", [
    cut("l1", "st-ali", KES(500), 0, await staffRate(store, "st-ali", "dept-barbering")),
    mani("l2", "st-grace", await staffRate(store, "st-grace", "dept-manicure")),
    pedi("l3", "st-grace", await staffRate(store, "st-grace", "dept-pedicure")),
  ], [{ id: "p1", method: "cash", amount: KES(2300), reference: null }]));

  const split = await saleSplit(store, "sale-1-xxxx");
  const per = Object.fromEntries(split.perStaff.map((p) => [p.staff_id, p.amount]));
  assert.equal(per["st-ali"], KES(175)); // 35% of 500
  assert.equal(per["st-grace"], KES(320 + 600)); // 40% of 800 + 60% of 1000
  assert.equal(split.shop, KES(2300 - 175 - 920));
  assert.equal(split.shop + KES(175) + KES(920), split.total);

  const live = await staffEarnings(store, "2026-10-15", "2026-10-15");
  assert.equal(live.find((r) => r.staff_id === "st-ali")?.staff_cut, KES(175));
  assert.equal(live.find((r) => r.staff_id === "st-grace")?.staff_cut, KES(920));
  assert.equal(live.find((r) => r.staff_id === "st-grace")?.services, 2);
  const lines = await staffLines(store, "st-grace", "2026-10-01", "2026-10-31");
  assert.deepEqual(lines.map((l) => l.staff_cut).sort((a, b) => a - b), [KES(320), KES(600)]);
});

test("odd amounts still split to the exact cent", async () => {
  const store = await shop();
  await exec(store, owner, "settings.update", { values: { cashier_can_edit_price: true } });
  await exec(store, cashier, "sale.create", sale("1", [
    cut("l1", "st-ali", 33333, 0, 3500), // 333.33 at 35% = 116.67 (rounded)
    mani("l2", "st-grace", 4000, 77777),
  ], [{ id: "p1", method: "cash", amount: 33333 + 77777, reference: null }]));
  const split = await saleSplit(store, "sale-1-xxxx");
  const staffTotal = split.perStaff.reduce((n, p) => n + p.amount, 0);
  assert.equal(staffTotal + split.shop, 33333 + 77777);
  for (const l of split.lines) assert.equal(l.staff_cut + l.shop_cut, l.line_total);
});

test("money in & out lists every movement and balances", async () => {
  const store = await shop();
  await exec(store, cashier, "sale.create", sale("1", [cut("l1", "st-ali"), soda("l3", 2)], [{ id: "p1", method: "cash", amount: KES(700), reference: null }]));
  await exec(store, cashier, "sale.create", sale("2", [pedi("l2", "st-grace")], [{ id: "p2", method: "mobile", amount: KES(1000), reference: "QX1" }]));
  await exec(store, manager, "sale.void", { id: "sale-2-xxxx", reason: "Customer changed mind" });
  await exec(store, manager, "expense.create", { id: "e1", category: "Rent", amount: KES(300), business_date: "2026-10-15", paid_from: "other" });
  await exec(store, manager, "adjustment.create", { id: "a1", staff_id: "st-ali", month: "2026-10", kind: "advance", amount: KES(50), paid_from: "till", business_date: "2026-10-15" });
  await exec(store, owner, "adjustment.create", { id: "b1", staff_id: "st-ali", month: "2026-10", kind: "bonus", amount: KES(20), paid_from: "till", business_date: "2026-10-15" });
  await exec(store, owner, "payout.create", { id: "po1", staff_id: "st-ali", month: "2026-10", amount: KES(100), method: "cash", paid_from: "till", business_date: "2026-10-15" });
  await exec(store, manager, "stock.move", { id: "mv2", product_id: "pr-soda", qty: 10, reason: "purchase", unit_cost: KES(60), paid_from: "till", business_date: "2026-10-15" });

  const book = await cashbook(store, "2026-10-15", "2026-10-15", () => "2026-10-15");
  assert.equal(book.byKind.sale, KES(1700));
  assert.equal(book.byKind.refund, KES(1000));
  assert.equal(book.byKind.expense, KES(300));
  assert.equal(book.byKind.advance, KES(50));
  assert.equal(book.byKind.staff_pay, KES(100));
  assert.equal(book.byKind.stock, KES(600));
  assert.equal(book.totalIn, KES(1700));
  assert.equal(book.totalOut, KES(1000 + 300 + 50 + 100 + 600));
  assert.equal(book.net, book.totalIn - book.totalOut);
  // A bonus is added to the month's pay, not handed over separately, so it is never counted as cash twice.
  const bonus = await store.get<{ paid_from: string | null }>("SELECT paid_from FROM staff_adjustments WHERE id = 'b1'");
  assert.equal(bonus?.paid_from, null);
  assert.equal((await cashFigures(store, "2026-10-15")).tillStaffMoney, KES(150));
});

test("manager can see profit; cashier cannot", () => {
  assert.equal(can("manager", "reports.profit"), true);
  assert.equal(can("cashier", "reports.profit"), false);
  assert.equal(can("manager", "staff.setPay"), false);
});

test("tips go 100% to the chosen staff member, are paid on top, and are not shop revenue", async () => {
  const store = await shop();
  const s1 = sale("t1", [cut("l1", "st-ali"), pedi("l2", "st-grace")], [{ id: "p1", method: "cash", amount: KES(1600), reference: null }]);
  s1.tips = [{ id: "tip-1-xxxxxx", staff_id: "st-ali", amount: KES(100) }];
  await exec(store, cashier, "sale.create", s1);

  // Payments without the tip don't add up.
  const bad = sale("t2", [cut("l3", "st-ali")], [{ id: "p2", method: "cash", amount: KES(500), reference: null }]);
  bad.tips = [{ id: "tip-2-xxxxxx", staff_id: "st-ali", amount: KES(50) }];
  await assert.rejects(exec(store, cashier, "sale.create", bad), /add up/);

  const split = await saleSplit(store, "sale-t1-xxxx");
  assert.equal(split.total, KES(1500));
  assert.equal(split.tipTotal, KES(100));
  assert.deepEqual(split.tips.map((t) => [t.staff, t.amount]), [["Ali", KES(100)]]);

  const r = await periodSummary(store, "2026-10-01", "2026-10-31");
  assert.equal(r.revenue, KES(1500)); // the tip is not revenue
  assert.equal(r.tips, KES(100));

  const ali = (await payroll(store, "2026-10")).find((p) => p.staff_id === "st-ali")!;
  assert.equal(ali.earned, KES(200));
  assert.equal(ali.tips, KES(100));
  assert.equal(ali.netPay, KES(300)); // share + tip

  const earn = await staffEarnings(store, "2026-10-01", "2026-10-31");
  assert.equal(earn.find((e) => e.staff_id === "st-ali")?.tips, KES(100));
  assert.equal(earn.find((e) => e.staff_id === "st-grace")?.tips, 0);

  // The cash drawer holds the tip until the staff member is paid.
  assert.equal((await cashFigures(store, "2026-10-15")).cashSales, KES(1600));

  // A voided sale takes its tip away too.
  await exec(store, manager, "sale.void", { id: "sale-t1-xxxx", reason: "Wrong customer", business_date: "2026-10-15" });
  assert.equal((await payroll(store, "2026-10")).find((p) => p.staff_id === "st-ali")?.tips ?? 0, 0);
});

test("client book groups visits by phone and remembers the usual barber", async () => {
  const store = await shop();
  const a = sale("c1", [cut("l1", "st-ali")], [{ id: "p1", method: "cash", amount: KES(500), reference: null }], "2026-10-01");
  a.sale.customer_name = "John"; a.sale.customer_phone = "0712 345 678";
  const b = sale("c2", [cut("l2", "st-ali"), pedi("l3", "st-grace")], [{ id: "p2", method: "cash", amount: KES(1500), reference: null }], "2026-10-15");
  b.sale.customer_name = "John K"; b.sale.customer_phone = "0712-345-678";
  const c = sale("c3", [cut("l4", "st-ali")], [{ id: "p3", method: "cash", amount: KES(500), reference: null }], "2026-10-15");
  c.sale.customer_name = "Mary";
  for (const x of [a, b, c]) await exec(store, cashier, "sale.create", x);

  const list = await clientList(store);
  assert.equal(list.length, 2);
  const john = list.find((x) => x.phone === "0712345678")!;
  assert.equal(john.visits, 2);
  assert.equal(john.spent, KES(2000));
  assert.equal(john.name, "John K"); // latest name used
  assert.equal(list.find((x) => x.name === "Mary")?.phone, null);

  const look = await clientLookup(store, "0712345678");
  assert.equal(look?.visits, 2);
  assert.equal(look?.usualStaff[0].name, "Ali");
  assert.equal(look?.favourites[0].name, "Haircut");
  assert.equal(await clientLookup(store, "0799999999"), null);
});

test("low stock lists tracked products at or below the threshold", async () => {
  const store = await shop();
  assert.equal((await lowStock(store)).length, 0);
  await exec(store, cashier, "sale.create", sale("s", [soda("l1", 20)], [{ id: "p1", method: "cash", amount: KES(2000), reference: null }]));
  assert.deepEqual(await lowStock(store), [{ id: "pr-soda", name: "Soda", on_hand: 4 }]);
});

test("CSV export: amounts in currency units, formulas neutralised, tips listed", async () => {
  const { buildExport, toCsv } = await import("../src/core/exports.ts");
  assert.equal(toCsv(["a", "b"], [["=SUM(A1)", 'say "hi", ok']]), 'a,b\r\n\'=SUM(A1),"say ""hi"", ok"\r\n');

  const store = await shop();
  const s1 = sale("x1", [cut("l1", "st-ali")], [{ id: "p1", method: "cash", amount: KES(550), reference: null }]);
  s1.tips = [{ id: "tip-x1-xxxxx", staff_id: "st-ali", amount: KES(50) }];
  await exec(store, cashier, "sale.create", s1);

  const local = (iso: string) => iso.slice(0, 10);
  const sales = await buildExport(store, "sales", "2026-10-01", "2026-10-31", "KES", local);
  const row = sales.split("\r\n")[1].split(",");
  assert.ok(row.includes("500") && row.includes("200") && row.includes("300") && row.includes("40")); // total, Ali's cut, shop cut, %
  const pays = await buildExport(store, "payments", "2026-10-01", "2026-10-31", "KES", local);
  assert.match(pays, /Tip,Ali,,50/);
  const pay = await buildExport(store, "payroll", "2026-10-01", "2026-10-31", "KES", local);
  assert.match(pay, /Ali,,40,1,1,500,200,50,0,0,0,0,250,0,250/);
});

test("server backups keep 14 days plus one per month for a year", async () => {
  const { backupsToDelete, backupName } = await import("../src/core/backup.ts");
  const names: string[] = [];
  for (let i = 0; i < 400; i++) {
    const d = new Date(Date.UTC(2025, 9, 1) + i * 86400000).toISOString().slice(0, 10);
    names.push(backupName(d));
  }
  names.push("notes.txt", "barbershop-2026-11-04.db.tmp");
  const del = new Set(backupsToDelete(names));
  const kept = names.filter((n) => n.endsWith(".db") && !del.has(n));
  assert.equal(kept.length, 14 + 12 - 1); // 1 Nov is both a recent day and a month start
  assert.ok(kept.includes(backupName("2026-11-04"))); // newest
  assert.ok(kept.includes(backupName("2026-01-01"))); // a month start
  assert.ok(!kept.includes(backupName("2026-01-02")));
  assert.ok(!del.has("notes.txt"));
});

test("restoring from a backup brings back every figure exactly, and skips unsynced rows", async () => {
  const { restorableRows } = await import("../src/core/backup.ts");
  const { TABLE_NAMES } = await import("../src/core/schema.ts");
  const a = await shop();
  const s1 = sale("r1", [cut("l1", "st-ali"), pedi("l2", "st-grace"), soda("l3", 2)], [{ id: "p1", method: "cash", amount: KES(1800), reference: null }]);
  s1.tips = [{ id: "tip-r1-xxxxx", staff_id: "st-grace", amount: KES(100) }];
  await exec(a, cashier, "sale.create", s1);
  await exec(a, manager, "expense.create", { id: "e1", category: "Rent", amount: KES(300), business_date: "2026-10-15", paid_from: "other" });
  await exec(a, manager, "adjustment.create", { id: "adj1", staff_id: "st-ali", month: "2026-10", kind: "advance", amount: KES(50), paid_from: "till", business_date: "2026-10-15" });
  // A row a device had only locally (rev 0) must not be copied as a row.
  await upsert(a, "expenses", { id: "local-only", category: "Rent", amount: KES(999), business_date: "2026-10-15" }, 0);

  const b = await memoryStore();
  for (const t of TABLE_NAMES) {
    const part = restorableRows(t, await a.all(`SELECT * FROM ${t}`));
    for (const row of part!.rows) await upsert(b, part!.table, row, Number(row.rev));
  }
  assert.equal(restorableRows("not_a_table", []), null);
  assert.equal(await b.get("SELECT id FROM expenses WHERE id = 'local-only'"), undefined);

  await a.run("DELETE FROM expenses WHERE id = 'local-only'");
  assert.deepEqual(await periodSummary(b, "2026-10-01", "2026-10-31"), await periodSummary(a, "2026-10-01", "2026-10-31"));
  assert.deepEqual(await payroll(b, "2026-10"), await payroll(a, "2026-10"));
  assert.deepEqual(await cashFigures(b, "2026-10-15"), await cashFigures(a, "2026-10-15"));
  assert.deepEqual(await saleSplit(b, "sale-r1-xxxx"), await saleSplit(a, "sale-r1-xxxx"));
});

// ---------- month-end ----------

const NOV_1 = "2026-11-01T06:00:00.000Z";

test("month close stores the month's results and staff pay, over its real number of days", async () => {
  const store = await shop();
  await exec(store, owner, "staff.upsert", { staff: { id: "st-clean", name: "Cleaner", commission_bp: 0, base_salary: KES(31000), joined_on: "2026-09-01" } });
  // October (31 days): one ticket with two workers; November: a sale that must not be counted.
  await exec(store, cashier, "sale.create", sale("1", [cut("l1", "st-ali"), pedi("l2", "st-grace")], [{ id: "p1", method: "cash", amount: KES(1500), reference: null }], "2026-10-20"));
  await exec(store, cashier, "sale.create", sale("2", [cut("l3", "st-ali")], [{ id: "p2", method: "cash", amount: KES(500), reference: null }], "2026-11-01"), NOV_1);

  await exec(store, manager, "month.close", { month: "2026-10" }, NOV_1);
  const row = await store.get<Record<string, number | string>>("SELECT * FROM month_closes WHERE id = 'month-2026-10'");
  assert.ok(row);
  assert.equal(row.days, 31);
  assert.equal(row.from_date, "2026-10-01");
  assert.equal(row.to_date, "2026-10-31");
  assert.equal(row.sales, 1);
  assert.equal(row.revenue, KES(1500)); // November's sale is not in October
  assert.equal(row.staff_share, KES(200 + 600));
  assert.equal(row.salaries, KES(31000)); // the full month: 31 of 31 days
  assert.equal(row.net_profit, KES(1500 - 800 - 31000));
  assert.equal(row.staff_pay, KES(200 + 600 + 31000));
  assert.equal(row.closes, 1);
  const snap = JSON.parse(String(row.snapshot));
  const pay = Object.fromEntries(snap.payroll.map((p: { staff_id: string; netPay: number }) => [p.staff_id, p.netPay]));
  assert.equal(pay["st-ali"], KES(200));
  assert.equal(pay["st-grace"], KES(600));

  // February 2026 has 28 days.
  await exec(store, owner, "month.close", { month: "2026-02" }, NOV_1);
  const feb = await store.get<{ days: number; to_date: string }>("SELECT days, to_date FROM month_closes WHERE id = 'month-2026-02'");
  assert.equal(feb?.days, 28);
  assert.equal(feb?.to_date, "2026-02-28");
});

test("a month can't be closed before it ends, and a cashier can't close one", async () => {
  const store = await shop();
  await assert.rejects(exec(store, owner, "month.close", { month: "2026-10" }, "2026-10-15T10:00:00.000Z"), CommandError);
  await assert.rejects(exec(store, cashier, "month.close", { month: "2026-09" }, NOV_1), CommandError);
});

test("closing again after a late void recalculates the stored month", async () => {
  const store = await shop();
  await exec(store, cashier, "sale.create", sale("1", [cut("l1", "st-ali")], [{ id: "p1", method: "cash", amount: KES(500), reference: null }], "2026-10-20"));
  await exec(store, cashier, "sale.create", sale("2", [cut("l2", "st-ali")], [{ id: "p2", method: "cash", amount: KES(500), reference: null }], "2026-10-21"));
  await exec(store, manager, "month.close", { month: "2026-10" }, NOV_1);
  await exec(store, manager, "sale.void", { id: "sale-2-xxxx", reason: "Entered twice" }, NOV_1);
  await exec(store, manager, "month.close", { month: "2026-10" }, NOV_1);
  const row = await store.get<{ revenue: number; staff_pay: number; closes: number }>("SELECT revenue, staff_pay, closes FROM month_closes WHERE id = 'month-2026-10'");
  assert.equal(row?.revenue, KES(500));
  assert.equal(row?.staff_pay, KES(200));
  assert.equal(row?.closes, 2);
});

// ---------- the demo shop: two months of realistic data, checked against its own ledger ----------

test("demo shop: every report, payslip, receipt split and cash count matches an independent ledger", async () => {
  const store = await memoryStore();
  for (const d of DEFAULT_DEPARTMENTS) await upsert(store, "departments", { ...d, active: 1 }, 1);
  await upsert(store, "settings", { id: "currency", value: "KES" }, 1);
  const today = "2026-11-17";
  const { commands, ledger } = demoShop(today);
  for (const c of commands) await exec(store, owner, c.type, c.payload as never, c.at);
  assert.ok(Object.keys(ledger.sales).length > 250, "the demo has a realistic number of tickets");

  // 1. Every receipt: each worker's cut is their rate × the line, the shop's cut is the rest, to the cent.
  let multiPerson = 0;
  for (const [id, want] of Object.entries(ledger.sales)) {
    const split = await saleSplit(store, id);
    assert.equal(split.total, want.total, `total of ${id}`);
    const got = Object.fromEntries(split.perStaff.map((p) => [p.staff_id, p.amount]));
    assert.deepEqual(got, want.cuts, `staff cuts of ${id}`);
    assert.equal(split.shop + split.perStaff.reduce((n, p) => n + p.amount, 0), split.total, `cuts add up on ${id}`);
    if (split.perStaff.length >= 3) multiPerson++;
  }
  assert.ok(multiPerson > 10, "plenty of one-receipt tickets shared by three or more workers");
  for (const id of ledger.voided) {
    assert.equal((await store.get<{ status: string }>("SELECT status FROM sales WHERE id = ?", [id]))?.status, "voided");
  }

  // 2. Every month: sales, revenue, discounts, tips and staff share.
  for (const [month, want] of Object.entries(ledger.months)) {
    const { from, to } = monthRange(month);
    const s = await periodSummary(store, from, to < today ? to : today);
    assert.equal(s.sales, want.sales, `${month} sales`);
    assert.equal(s.revenue, want.revenue, `${month} revenue`);
    assert.equal(s.discounts, want.discounts, `${month} discounts`);
    assert.equal(s.tips, want.tips, `${month} tips`);
    assert.equal(s.departments.reduce((n, d) => n + d.staffShare, 0), want.staffShare, `${month} staff share`);

    // Net profit worked out again from the raw records, without the report code.
    const lines = await store.all<{ line_total: number; commission: number; cost_total: number }>(
      `SELECT l.line_total, l.commission, l.cost_total FROM sale_lines l JOIN sales x ON x.id = l.sale_id
        WHERE x.status = 'completed' AND x.business_date BETWEEN ? AND ?`, [from, to]);
    const expenses = await store.all<{ amount: number }>("SELECT amount FROM expenses WHERE voided_at IS NULL AND business_date BETWEEN ? AND ?", [from, to]);
    const spoiled = await store.all<{ v: number }>("SELECT -qty * unit_cost AS v FROM stock_movements WHERE reason = 'spoilage' AND business_date BETWEEN ? AND ?", [from, to]);
    const adj = await store.all<{ kind: string; amount: number }>("SELECT kind, amount FROM staff_adjustments WHERE voided_at IS NULL AND month = ?", [month]);
    const sum = <T,>(xs: T[], f: (x: T) => number) => xs.reduce((n, x) => n + f(x), 0);
    const salaryDays = Math.min(Number((to < today ? to : today).slice(8, 10)), Number(to.slice(8, 10)));
    const salaries = Math.round((KES(15000) * salaryDays) / Number(to.slice(8, 10)));
    const net = sum(lines, (l) => l.line_total) - sum(lines, (l) => l.commission) - sum(lines, (l) => l.cost_total)
      - sum(spoiled, (x) => x.v) - sum(expenses, (e) => e.amount) - salaries
      - sum(adj.filter((a) => a.kind === "bonus"), (a) => a.amount) + sum(adj.filter((a) => a.kind === "deduction"), (a) => a.amount);
    assert.equal(s.netProfit, net, `${month} net profit`);
  }

  // 3. Every payslip, and last month paid off exactly.
  for (const [month, staff] of Object.entries(ledger.pay)) {
    const rows = await payroll(store, month);
    for (const [staffId, want] of Object.entries(staff)) {
      const row = rows.find((r) => r.staff_id === staffId)!;
      assert.ok(row, `${staffId} on the ${month} payroll`);
      assert.equal(row.earned, want.earned, `${staffId} ${month} earned`);
      assert.equal(row.tips, want.tips, `${staffId} ${month} tips`);
      assert.equal(row.baseSalary, want.salary, `${staffId} ${month} salary`);
      assert.equal(row.bonuses, want.bonuses, `${staffId} ${month} bonuses`);
      assert.equal(row.deductions, want.deductions, `${staffId} ${month} deductions`);
      assert.equal(row.advances, want.advances, `${staffId} ${month} advances`);
      assert.equal(row.netPay, want.earned + want.tips + want.salary + want.bonuses - want.deductions - want.advances, `${staffId} ${month} net pay`);
      assert.equal(row.paid, want.paid, `${staffId} ${month} paid`);
    }
  }
  for (const row of await payroll(store, "2026-10")) assert.equal(row.balance, 0, `${row.name} fully paid for October`);

  // 4. Every day's drawer: what the app expects equals the generator's cash ledger and the stored count.
  for (const [day, want] of Object.entries(ledger.cash)) {
    const c = await cashFigures(store, day);
    assert.equal(c.cashSales, want.cashSales, `${day} cash sales`);
    assert.equal(c.cashOut, want.cashOut, `${day} cash out`);
    const close = await store.get<{ expected: number }>("SELECT expected FROM day_closes WHERE business_date = ?", [day]);
    assert.equal(close?.expected, want.expected, `${day} stored expected cash`);
  }

  // 5. Month-end: October (31 days) closed and stored with the same figures.
  await exec(store, owner, "month.close", { month: "2026-10" }, "2026-11-01T06:00:00.000Z");
  const oct = await store.get<Record<string, number>>("SELECT * FROM month_closes WHERE id = 'month-2026-10'");
  assert.equal(oct?.days, 31);
  assert.equal(oct?.revenue, ledger.months["2026-10"].revenue);
  assert.equal(oct?.staff_share, ledger.months["2026-10"].staffShare);
  const octPay = Object.values(ledger.pay["2026-10"]).reduce((n, p) => n + p.earned + p.tips + p.salary + p.bonuses - p.deductions - p.advances, 0);
  assert.equal(oct?.staff_pay, octPay);

  // The statement adds up line by line: revenue − staff share − drinks cost (incl. spoilage)
  // − salaries − bonuses + deductions − expenses = net profit, to the cent.
  const snap = JSON.parse(String((oct as Record<string, unknown>).snapshot)) as { departments: { productCost: number; spoilage: number }[] };
  const drinksCost = snap.departments.reduce((n, d) => n + d.productCost + d.spoilage, 0);
  assert.ok(drinksCost > 0, "October sold drinks at a cost");
  assert.equal(oct!.revenue - oct!.staff_share - drinksCost - oct!.salaries - oct!.bonuses + oct!.deductions - oct!.expenses, oct!.net_profit);
});

// ---------- sorting ----------

test("multi-level sort: first rule decides, ties go to the next, blanks always last, otherwise stable", async () => {
  const { sortRows } = await import("../src/components/sort.tsx");
  type R = { id: string; amount: number; customer: string | null; time: string };
  const rows: R[] = [
    { id: "a", amount: 500, customer: "Mary", time: "10:00" },
    { id: "b", amount: 1500, customer: null, time: "09:00" },
    { id: "c", amount: 500, customer: "Ali", time: "11:00" },
    { id: "d", amount: 1500, customer: "Zed", time: "12:00" },
    { id: "e", amount: 500, customer: "Ali", time: "08:00" },
  ];
  const keys = [
    { id: "amount", label: "Amount", get: (r: R) => r.amount },
    { id: "customer", label: "Customer", get: (r: R) => r.customer },
    { id: "time", label: "Time", get: (r: R) => r.time },
  ];
  const ids = (rules: { id: string; dir: "asc" | "desc" }[]) => sortRows(rows, keys, rules).map((r) => r.id).join("");
  assert.equal(ids([{ id: "amount", dir: "desc" }, { id: "customer", dir: "asc" }]), "dbcea"); // b has no name: last of the 1500s
  assert.equal(ids([{ id: "amount", dir: "asc" }, { id: "customer", dir: "asc" }, { id: "time", dir: "desc" }]), "ceadb");
  assert.equal(ids([{ id: "customer", dir: "desc" }]), "daceb"); // Zed, Mary, Ali, Ali (original order), blank name last even when descending
  assert.equal(ids([]), "abcde"); // no rules: original order
});

// ---------- French ----------

test("French: every sentence the app shows in French has a translation", async () => {
  const { readdirSync, readFileSync, statSync } = await import("node:fs");
  const { join } = await import("node:path");
  const { FR } = await import("../src/i18n/fr/index.ts");
  const { PAYMENT_LABEL, ADJUSTMENT_LABEL, EXPENSE_CATEGORIES } = await import("../src/core/commands.ts");
  const { ROLE_LABEL } = await import("../src/core/permissions.ts");
  const { SUGGESTIONS } = await import("../src/core/seed.ts");

  const files: string[] = [];
  const walk = (d: string) => {
    for (const f of readdirSync(d)) {
      const p = join(d, f);
      if (statSync(p).isDirectory()) { if (f !== "i18n") walk(p); }
      else if (/\.(tsx?|ts)$/.test(f)) files.push(p);
    }
  };
  walk("src");

  const keys = new Set<string>();
  const lit = String.raw`"((?:[^"\\]|\\.)*)"`;
  for (const f of files) {
    // Ignore comments (they may mention t("…") as an example).
    const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
    for (const m of src.matchAll(new RegExp(String.raw`\bt[k]?\(\s*${lit}`, "g"))) keys.add(JSON.parse(`"${m[1]}"`));
    for (const m of src.matchAll(new RegExp(String.raw`\bplural\(\s*[^,]+,\s*${lit}\s*,\s*${lit}`, "g"))) {
      keys.add(JSON.parse(`"${m[1]}"`));
      keys.add(JSON.parse(`"${m[2]}"`));
    }
  }
  // Text picked at run time from lists (menu, labels, stored values).
  const shell = readFileSync("src/views/Shell.tsx", "utf8");
  for (const m of shell.matchAll(/(?:label|description): "([^"]+)"/g)) keys.add(m[1]);
  for (const v of [...Object.values(PAYMENT_LABEL), ...Object.values(ADJUSTMENT_LABEL), ...Object.values(ROLE_LABEL), ...EXPENSE_CATEGORIES]) keys.add(v);
  for (const list of Object.values(SUGGESTIONS)) for (const v of list) keys.add(v);

  const missing = [...keys].filter((k) => FR[k] === undefined).sort();
  assert.deepEqual(missing, [], `No French for:\n${missing.map((k) => `  ${JSON.stringify(k)}`).join("\n")}`);
  assert.ok(keys.size > 50, "found the app's sentences");
});

test("Cameroon phone numbers: every way of writing one number is the same client", async () => {
  const { normalizePhone } = await import("../src/core/commands.ts");
  for (const v of ["+237 6 77 12 34 56", "00237677123456", "677 12 34 56", "677-123-456", "237677123456"]) {
    assert.equal(normalizePhone(v), "677123456", v);
  }
  assert.equal(normalizePhone("+254 712 345 678"), "+254712345678"); // other countries unchanged
  assert.equal(normalizePhone("123"), null);
});

test("demo shop, Cameroon edition (FCFA, French names): splits, months and payroll match the ledger", async () => {
  const store = await memoryStore();
  for (const d of DEFAULT_DEPARTMENTS) await upsert(store, "departments", { ...d, active: 1 }, 1);
  await upsert(store, "settings", { id: "currency", value: "XAF" }, 1);
  const today = "2026-11-17";
  const { commands, ledger } = demoShop(today, 2026, { edition: "cameroon" });
  for (const c of commands) await exec(store, owner, c.type, c.payload as never, c.at);

  const names = await store.all<{ name: string }>("SELECT name FROM services ORDER BY name");
  assert.ok(names.some((n) => n.name === "Coupe") && names.some((n) => n.name === "Manucure gel"), "services named in French");
  const staff = await store.all<{ name: string }>("SELECT name FROM staff");
  assert.ok(staff.some((s) => s.name === "Brenda Ngono"), "Cameroonian staff names");
  const cut = await store.get<{ price: number }>("SELECT price FROM services WHERE id = 'demo-sv-cut'");
  assert.equal(cut?.price, 1500, "a haircut costs 1 500 FCFA");

  for (const [id, want] of Object.entries(ledger.sales)) {
    const split = await saleSplit(store, id);
    assert.equal(split.total, want.total, `total of ${id}`);
    assert.deepEqual(Object.fromEntries(split.perStaff.map((p) => [p.staff_id, p.amount])), want.cuts, `cuts of ${id}`);
  }
  for (const [month, want] of Object.entries(ledger.months)) {
    const { from, to } = monthRange(month);
    const s = await periodSummary(store, from, to < today ? to : today);
    assert.equal(s.revenue, want.revenue, `${month} revenue`);
    assert.equal(s.departments.reduce((n, d) => n + d.staffShare, 0), want.staffShare, `${month} staff share`);
  }
  for (const row of await payroll(store, "2026-10")) assert.equal(row.balance, 0, `${row.name} fully paid for October`);
});
