// A realistic demo shop, generated deterministically from a seed.
//
// It produces the exact commands a real shop would send — staff, price list,
// two months of tickets (single services, multi-service "full packages" done
// by several people, drinks, discounts, tips, split payments, voids),
// expenses, fixed rent, advances, bonuses, deductions, month-end pay and daily
// cash counts — and, alongside, keeps its own plain ledger of what every
// figure should be. Tests replay the commands and check the app's reports
// against that ledger, so any calculation mistake shows up as a mismatch.

import type { CommandType, Payloads, SaleLineInput } from "./commands.ts";
import { addDays, addMonths, daysInMonth, monthOf } from "./dates.ts";
import { share } from "./money.ts";

/** Regular clients (name and phone), so the client book shows real repeat visits. */
const CLIENTS_CM: [string, string][] = [
  ["Serge Ndongo", "677 21 45 90"], ["Aïcha Bello", "699 08 33 12"], ["Paul Essomba", "655 47 10 28"],
  ["Clarisse Nkeng", "678 90 12 55"], ["Samuel Etoa", "690 33 72 41"], ["Ibrahim Moussa", "656 12 98 30"],
  ["Josiane Mballa", "677 64 05 19"], ["Hervé Tchinda", "691 50 27 84"], ["Linda Fokou", "654 81 36 07"],
  ["Boris Nana", "670 25 49 63"],
];
const CLIENTS_KE: [string, string][] = [
  ["Peter Otieno", "0712 345 678"], ["Mary Wambui", "0722 118 904"], ["Peter Kariuki", "0733 450 212"],
  ["Grace Achieng", "0701 776 345"], ["Sam Mutua", "0745 902 118"], ["Faith Njeri", "0711 205 667"],
  ["Brian Kiprop", "0726 334 090"], ["Janet Akinyi", "0798 561 230"], ["David Mwangi", "0720 447 812"],
  ["Lucy Chebet", "0704 913 556"],
];
const regular = (c: [string, string] | null) => ({ customer_name: c ? c[0] : null, customer_phone: c ? c[1] : null });

/** Staff names for the Cameroon edition. */
const CM_NAMES: Record<string, string> = {
  "demo-st-kevin": "Junior Mbarga",
  "demo-st-brian": "Arnaud Fotso",
  "demo-st-aisha": "Brenda Ngono",
  "demo-st-faith": "Sandrine Tchoua",
  "demo-st-joy": "Mireille Abena",
};

export interface DemoCommand<K extends CommandType = CommandType> {
  type: K;
  payload: Payloads[K];
  /** When it happened (ISO). */
  at: string;
}

/** What every figure should be, worked out by the generator itself (all money in minor units). */
export interface DemoLedger {
  months: Record<string, { sales: number; revenue: number; staffShare: number; tips: number; discounts: number }>;
  /** month → staff id → their pay parts. */
  pay: Record<string, Record<string, { earned: number; tips: number; salary: number; bonuses: number; deductions: number; advances: number; paid: number }>>;
  /** business date → expected cash in the drawer at closing. */
  cash: Record<string, { cashSales: number; cashOut: number; expected: number }>;
  /** sale id → { total, staff cut per person } for every completed sale. */
  sales: Record<string, { total: number; cuts: Record<string, number> }>;
  voided: string[];
}

const KES = (n: number) => n * 100;

export const DEMO_STAFF = [
  { id: "demo-st-kevin", name: "Kevin Mwangi", specialty: "Barber", bp: 4000, salary: 0, depts: ["dept-barbering"], rates: {} as Record<string, number> },
  { id: "demo-st-brian", name: "Brian Ochieng", specialty: "Senior barber", bp: 4500, salary: 0, depts: ["dept-barbering"], rates: { "dept-barbering": 5000 } },
  { id: "demo-st-aisha", name: "Aisha Njeri", specialty: "Nail technician", bp: 5000, salary: 0, depts: ["dept-manicure", "dept-pedicure"], rates: { "dept-pedicure": 5500 } },
  { id: "demo-st-faith", name: "Faith Wanjiru", specialty: "Beauty therapist", bp: 4500, salary: 0, depts: ["dept-other", "dept-manicure"], rates: {} },
  { id: "demo-st-joy", name: "Joy Akinyi", specialty: "Cleaner", bp: 0, salary: KES(15000), depts: [] as string[], rates: {} },
];

export const DEMO_SERVICES = [
  { id: "demo-sv-cut", dept: "dept-barbering", name: "Haircut", price: KES(500) },
  { id: "demo-sv-beard", dept: "dept-barbering", name: "Beard trim", price: KES(200) },
  { id: "demo-sv-shave", dept: "dept-barbering", name: "Clean shave (head)", price: KES(400) },
  { id: "demo-sv-combo", dept: "dept-barbering", name: "Haircut + beard", price: KES(650) },
  { id: "demo-sv-kids", dept: "dept-barbering", name: "Kids haircut", price: KES(300) },
  { id: "demo-sv-lineup", dept: "dept-barbering", name: "Line-up / shape-up", price: KES(250) },
  { id: "demo-sv-dye", dept: "dept-barbering", name: "Hair dye", price: KES(800) },
  { id: "demo-sv-mani", dept: "dept-manicure", name: "Classic manicure", price: KES(800) },
  { id: "demo-sv-gel", dept: "dept-manicure", name: "Gel manicure", price: KES(1500) },
  { id: "demo-sv-art", dept: "dept-manicure", name: "Nail art (per nail)", price: KES(100) },
  { id: "demo-sv-pedi", dept: "dept-pedicure", name: "Classic pedicure", price: KES(1000) },
  { id: "demo-sv-spa", dept: "dept-pedicure", name: "Spa pedicure", price: KES(1800) },
  { id: "demo-sv-facial", dept: "dept-other", name: "Facial", price: KES(1500) },
  { id: "demo-sv-massage", dept: "dept-other", name: "Head massage", price: KES(700) },
  { id: "demo-sv-steam", dept: "dept-other", name: "Steam", price: KES(500) },
];

export const DEMO_PRODUCTS = [
  { id: "demo-pr-soda", name: "Soda", price: KES(80), cost: KES(50) },
  { id: "demo-pr-water", name: "Water 500ml", price: KES(60), cost: KES(30) },
  { id: "demo-pr-energy", name: "Energy drink", price: KES(250), cost: KES(180) },
  { id: "demo-pr-coffee", name: "Coffee", price: KES(150), cost: KES(60) },
];

/** Small fast deterministic PRNG. */
function rng(seed: number) {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

const lineAmount = (l: Pick<SaleLineInput, "qty" | "unit_price" | "discount">) => l.qty * l.unit_price - l.discount;

/**
 * Generate the demo shop from the first day of the month before `today`
 * up to `today` (which gets a few tickets and no cash count yet).
 */
export function demoShop(
  today: string,
  seed = 2026,
  opts: { edition?: "default" | "cameroon" } = {},
): { commands: DemoCommand[]; ledger: DemoLedger } {
  // Cameroon edition: prices in FCFA (no decimals; base price × 3 ≈ local prices),
  // French service names and Cameroonian staff and customer names.
  const cm = opts.edition === "cameroon";
  const conv = (minor: number) => (cm ? (minor / 100) * 3 : minor);
  const M = (n: number) => conv(KES(n));
  // Stored in English in both editions: each phone shows them in its own language
  // (a French phone translates "Haircut" to "Coupe"), so the English side never shows French.
  const label = (english: string) => english;
  const staffName = (id: string, name: string) => (cm ? (CM_NAMES[id] ?? name) : name);
  const r = rng(seed);
  const pick = <T,>(xs: readonly T[]) => xs[Math.floor(r() * xs.length)];
  const commands: DemoCommand[] = [];
  const push = <K extends CommandType>(type: K, payload: Payloads[K], at: string) => commands.push({ type, payload, at } as DemoCommand);

  const start = `${addMonths(monthOf(today), -1)}-01`;
  const ledger: DemoLedger = { months: {}, pay: {}, cash: {}, sales: {}, voided: [] };
  const monthLedger = (m: string) => (ledger.months[m] ??= { sales: 0, revenue: 0, staffShare: 0, tips: 0, discounts: 0 });
  const payOf = (m: string, staff: string) =>
    ((ledger.pay[m] ??= {})[staff] ??= { earned: 0, tips: 0, salary: 0, bonuses: 0, deductions: 0, advances: 0, paid: 0 });
  const rate = (staffId: string, dept: string) => {
    const s = DEMO_STAFF.find((x) => x.id === staffId)!;
    return s.rates[dept] ?? s.bp;
  };

  // ---- the shop: staff, price list, stock, fixed rent ----
  const t0 = `${start}T05:00:00.000Z`;
  for (const s of DEMO_STAFF) {
    push("staff.upsert", {
      staff: { id: s.id, name: staffName(s.id, s.name), specialty: label(s.specialty), commission_bp: s.bp, base_salary: conv(s.salary), joined_on: start, active: 1 },
      rates: Object.entries(s.rates).map(([department_id, commission_bp]) => ({ department_id, commission_bp })),
    }, t0);
  }
  DEMO_SERVICES.forEach((sv, i) => push("service.upsert", { id: sv.id, department_id: sv.dept, name: label(sv.name), price: conv(sv.price), active: 1, sort: i }, t0));
  DEMO_PRODUCTS.forEach((p, i) => {
    push("product.upsert", { id: p.id, department_id: "dept-drinks", name: label(p.name), price: conv(p.price), cost: conv(p.cost), track_stock: 1, active: 1, sort: i }, t0);
    push("stock.move", { id: `demo-mv-open-${p.id}`, product_id: p.id, qty: 400, reason: "purchase", unit_cost: conv(p.cost), paid_from: "other", business_date: start }, t0);
  });
  push("recurring.upsert", { id: "demo-rec-rent", category: "Rent", amount: M(25000), description: label("Shop rent"), active: 1 }, t0);

  let receipt = 0;
  for (let day = start; day <= today; day = addDays(day, 1)) {
    const month = monthOf(day);
    const dom = Number(day.slice(8, 10));
    const isToday = day === today;
    let minute = 0;
    const at = () => {
      minute += 7 + Math.floor(r() * 25);
      const h = 6 + Math.floor(minute / 60); // shop opens 09:00 in UTC+3
      return `${day}T${String(Math.min(h, 17)).padStart(2, "0")}:${String(minute % 60).padStart(2, "0")}:00.000Z`;
    };
    const cash = { cashSales: 0, cashOut: 0 };

    // Salaried staff earn the full month (they joined on the 1st of the first month).
    if (dom === 1) {
      for (const s of DEMO_STAFF) if (conv(s.salary)) payOf(month, s.id).salary = conv(s.salary);
      push("recurring.post", { month }, `${day}T05:30:00.000Z`);
    }

    // ---- money out ----
    if (dom === 5) push("expense.create", { id: `demo-ex-power-${month}`, category: "Electricity", amount: M(4500), description: label("Power bill"), paid_from: "other", business_date: day }, at());
    if (new Date(`${day}T12:00:00Z`).getUTCDay() === 1) {
      const dept = pick(["dept-barbering", "dept-manicure", "dept-pedicure"]);
      const amount = M(300 + Math.floor(r() * 6) * 50);
      push("expense.create", { id: `demo-ex-sup-${day}`, category: "Supplies & consumables", department_id: dept, amount, description: label("Weekly supplies"), paid_from: "till", business_date: day }, at());
      cash.cashOut += amount;
    }
    if (dom === 15) {
      for (const p of DEMO_PRODUCTS) {
        push("stock.move", { id: `demo-mv-${p.id}-${day}`, product_id: p.id, qty: 48, reason: "purchase", unit_cost: conv(p.cost), paid_from: "till", business_date: day }, at());
        cash.cashOut += 48 * conv(p.cost);
      }
    }
    if (dom === 10) {
      for (const id of ["demo-st-kevin", "demo-st-brian"]) {
        const amount = M(2000);
        push("adjustment.create", { id: `demo-adv-${id}-${month}`, staff_id: id, month, kind: "advance", amount, note: label("Advance"), paid_from: "till", business_date: day }, at());
        payOf(month, id).advances += amount;
        cash.cashOut += amount;
      }
    }
    if (dom === 20) {
      push("adjustment.create", { id: `demo-ded-${month}`, staff_id: "demo-st-kevin", month, kind: "deduction", amount: M(500), note: label("Late twice"), business_date: day }, at());
      payOf(month, "demo-st-kevin").deductions += M(500);
    }
    if (dom === daysInMonth(month) && !isToday) {
      push("adjustment.create", { id: `demo-bonus-${month}`, staff_id: "demo-st-aisha", month, kind: "bonus", amount: M(1000), note: label("Top rated"), business_date: day }, at());
      payOf(month, "demo-st-aisha").bonuses += M(1000);
    }

    // ---- tickets ----
    const weekday = new Date(`${day}T12:00:00Z`).getUTCDay();
    const tickets = isToday ? 3 : 4 + Math.floor(r() * 6) + (weekday === 5 || weekday === 6 ? 3 : 0);
    for (let t = 0; t < tickets; t++) {
      const saleId = `demo-sale-${day}-${t}-xxxxxxxx`;
      const lines: SaleLineInput[] = [];
      const addService = (dept: string) => {
        const sv = pick(DEMO_SERVICES.filter((s) => s.dept === dept));
        const staff = pick(DEMO_STAFF.filter((s) => s.depts.includes(dept)));
        lines.push({
          id: `${saleId}-l${lines.length}`, position: lines.length, kind: "service", item_id: sv.id, name: label(sv.name),
          department_id: dept, staff_id: staff.id, qty: 1, list_price: conv(sv.price), unit_price: conv(sv.price), discount: 0,
          commission_bp: rate(staff.id, dept), unit_cost: 0,
        });
      };
      const addDrink = () => {
        const p = pick(DEMO_PRODUCTS);
        const qty = 1 + Math.floor(r() * 2);
        lines.push({
          id: `${saleId}-l${lines.length}`, position: lines.length, kind: "product", item_id: p.id, name: label(p.name),
          department_id: "dept-drinks", staff_id: null, qty, list_price: conv(p.price), unit_price: conv(p.price), discount: 0,
          commission_bp: 0, unit_cost: conv(p.cost),
        });
      };
      const kind = r();
      if (kind < 0.42) addService("dept-barbering");
      else if (kind < 0.62) { addService("dept-barbering"); addDrink(); }
      else if (kind < 0.78) { addService("dept-manicure"); addService("dept-pedicure"); }
      else if (kind < 0.92) {
        // The full package: shave, manicure, pedicure and a massage, by up to four people, on one receipt.
        addService("dept-barbering"); addService("dept-manicure"); addService("dept-pedicure"); addService("dept-other");
        if (r() < 0.5) addDrink();
      } else addDrink();

      // Occasional discount on the first line (owner can always discount).
      if (r() < 0.07) lines[0].discount = Math.min(M(50), lines[0].qty * lines[0].unit_price);

      const total = lines.reduce((n, l) => n + lineAmount(l), 0);
      const serviceStaff = lines.filter((l) => l.staff_id).map((l) => l.staff_id!);
      const tips: NonNullable<Payloads["sale.create"]["tips"]> = [];
      if (serviceStaff.length && r() < 0.15) tips.push({ id: `${saleId}-tip`, staff_id: pick(serviceStaff), amount: M(50 * (1 + Math.floor(r() * 4))) });
      const due = total + tips.reduce((n, x) => n + x.amount, 0);

      const payments: Payloads["sale.create"]["payments"] = [];
      let tendered = 0;
      const m = r();
      if (m < 0.55) {
        payments.push({ id: `${saleId}-p0`, method: "cash", amount: due, reference: null });
        tendered = Math.ceil(due / M(100)) * M(100);
      } else if (m < 0.9 || due < M(200)) {
        payments.push({ id: `${saleId}-p0`, method: "mobile", amount: due, reference: `QX${day.replace(/-/g, "")}${t}` });
      } else {
        const cashPart = Math.floor(due / 2 / M(100)) * M(100);
        payments.push({ id: `${saleId}-p0`, method: "cash", amount: cashPart, reference: null });
        payments.push({ id: `${saleId}-p1`, method: "mobile", amount: due - cashPart, reference: `QS${day.replace(/-/g, "")}${t}` });
        tendered = cashPart;
      }

      receipt++;
      const created = at();
      push("sale.create", {
        sale: { id: saleId, receipt_no: `D-${String(receipt).padStart(5, "0")}`, ...regular(r() < 0.3 ? pick(cm ? CLIENTS_CM : CLIENTS_KE) : null), note: null, business_date: day, created_at: created, tendered },
        lines, payments, tips,
      }, created);

      // About one ticket in 45 is voided the same day.
      if (r() < 0.022) {
        push("sale.void", { id: saleId, reason: label("Entered twice by mistake") }, at());
        ledger.voided.push(saleId);
        continue;
      }

      const ml = monthLedger(month);
      ml.sales += 1;
      ml.revenue += total;
      ml.discounts += lines.reduce((n, l) => n + l.discount, 0);
      const cuts: Record<string, number> = {};
      for (const l of lines) {
        if (!l.staff_id) continue;
        const cut = share(lineAmount(l), l.commission_bp);
        cuts[l.staff_id] = (cuts[l.staff_id] ?? 0) + cut;
        ml.staffShare += cut;
        payOf(month, l.staff_id).earned += cut;
      }
      for (const tip of tips) {
        ml.tips += tip.amount;
        payOf(month, tip.staff_id).tips += tip.amount;
      }
      ledger.sales[saleId] = { total, cuts };
      cash.cashSales += payments.filter((p) => p.method === "cash").reduce((n, p) => n + p.amount, 0);
    }

    // ---- pay last month's staff in full on the 3rd ----
    if (dom === 3) {
      const prev = addMonths(month, -1);
      for (const [staffId, p] of Object.entries(ledger.pay[prev] ?? {})) {
        const balance = p.earned + p.tips + p.salary + p.bonuses - p.deductions - p.advances - p.paid;
        if (balance <= 0) continue;
        push("payout.create", { id: `demo-pay-${staffId}-${prev}`, staff_id: staffId, month: prev, amount: balance, method: "bank", paid_from: "other", note: label("Monthly pay"), business_date: day }, at());
        p.paid += balance;
      }
    }

    // ---- count the drawer (not today: the day isn't over) ----
    if (!isToday) {
      const expected = cash.cashSales - cash.cashOut; // opening float is 0 in a new shop
      const variance = r() < 0.15 ? M(pick([-100, -50, 50])) : 0;
      ledger.cash[day] = { ...cash, expected };
      push("day.close", { business_date: day, opening_float: 0, cash_sales: cash.cashSales, cash_out: cash.cashOut, expected, counted: expected + variance, note: variance ? label("Small difference") : null }, `${day}T18:30:00.000Z`);
    }
  }

  return { commands, ledger };
}
