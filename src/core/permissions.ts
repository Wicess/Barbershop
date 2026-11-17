export type Role = "owner" | "manager" | "cashier";

export const ROLE_LABEL: Record<Role, string> = {
  owner: "Owner",
  manager: "Shop manager",
  cashier: "Cashier",
};

export type Permission =
  | "sale.create"
  | "sale.editPrice"
  | "sale.discount"
  | "sale.void"
  | "sales.viewAll"
  | "cash.close"
  | "cash.reclose"
  | "expense.view"
  | "expense.create"
  | "expense.void"
  | "catalog.manage"
  | "stock.manage"
  | "staff.view"
  | "staff.manage"
  | "staff.setPay"
  | "staff.adjust"
  | "payroll.view"
  | "payroll.pay"
  | "reports.daily"
  | "reports.profit"
  | "users.manage"
  | "settings.manage"
  | "audit.view";

const MANAGER: Permission[] = [
  "sale.create", "sale.editPrice", "sale.discount", "sale.void", "sales.viewAll",
  "cash.close", "cash.reclose", "expense.view", "expense.create", "expense.void",
  "catalog.manage", "stock.manage", "staff.view", "staff.manage", "staff.adjust",
  "payroll.view", "reports.daily", "reports.profit",
];

const CASHIER: Permission[] = ["sale.create", "cash.close"];

export interface RoleOptions {
  /** Owner setting (older shops): may cashiers change a service price at the till? */
  cashierCanEditPrice?: boolean;
  /** Owner's own choice of what managers and cashiers may do (JSON, see RoleAccess). */
  roleAccess?: string;
}

/** Only owners can add people, set their access, or change the shop's settings. */
export const OWNER_ONLY: Permission[] = ["users.manage", "settings.manage"];

/** The recommended starting point for each role. */
export const DEFAULT_ACCESS: Record<"manager" | "cashier", Permission[]> = { manager: MANAGER, cashier: CASHIER };

export type RoleAccess = Partial<Record<"manager" | "cashier", Permission[]>>;

/** Some rights only make sense with another (you can't pay staff without seeing their pay). */
export const REQUIRES: Partial<Record<Permission, Permission[]>> = {
  "cash.reclose": ["cash.close"],
  "expense.create": ["expense.view"],
  "expense.void": ["expense.view"],
  "staff.manage": ["staff.view"],
  "staff.setPay": ["staff.view"],
  "staff.adjust": ["staff.view"],
  "payroll.view": ["staff.view"],
  "payroll.pay": ["payroll.view", "staff.view"],
  "reports.profit": ["reports.daily"],
};

/** Everything the owner can hand out, grouped and worded for the access screen. */
export const ACCESS_GROUPS: { title: string; items: { perm: Permission; label: string; hint?: string }[] }[] = [
  {
    title: "Selling",
    items: [
      { perm: "sale.create", label: "Make sales", hint: "Use the till and print receipts." },
      { perm: "sale.discount", label: "Give discounts" },
      { perm: "sale.editPrice", label: "Change a price at the till", hint: "Every changed price is kept in the activity log." },
      { perm: "sale.void", label: "Cancel sales", hint: "The money is given back from the drawer." },
      { perm: "sales.viewAll", label: "See past sales", hint: "Not only today's." },
    ],
  },
  {
    title: "Cash and expenses",
    items: [
      { perm: "cash.close", label: "Close the day", hint: "Count the drawer at night." },
      { perm: "cash.reclose", label: "Re-count a closed day" },
      { perm: "expense.view", label: "See expenses" },
      { perm: "expense.create", label: "Record expenses" },
      { perm: "expense.void", label: "Cancel expenses" },
    ],
  },
  {
    title: "Staff and pay",
    items: [
      { perm: "staff.view", label: "See staff" },
      { perm: "staff.manage", label: "Add and edit staff" },
      { perm: "staff.setPay", label: "Set staff pay", hint: "Their share of each service and their salary." },
      { perm: "staff.adjust", label: "Record advances, bonuses and deductions" },
      { perm: "payroll.view", label: "See what staff are owed" },
      { perm: "payroll.pay", label: "Pay staff" },
    ],
  },
  {
    title: "Shop",
    items: [
      { perm: "catalog.manage", label: "Edit the price list" },
      { perm: "stock.manage", label: "Manage drink stock" },
      { perm: "reports.daily", label: "See reports", hint: "Takings by day, section and staff." },
      { perm: "reports.profit", label: "See profit", hint: "Profit, month-end and money in & out." },
      { perm: "audit.view", label: "See the activity log" },
    ],
  },
];

const GRANTABLE = new Set<Permission>(ACCESS_GROUPS.flatMap((g) => g.items.map((i) => i.perm)));

/** Reads the owner's saved choice; anything unknown or owner-only is dropped. */
export function parseRoleAccess(json?: string): RoleAccess {
  if (!json) return {};
  try {
    const raw = JSON.parse(json) as Record<string, unknown>;
    const out: RoleAccess = {};
    for (const role of ["manager", "cashier"] as const) {
      if (Array.isArray(raw[role])) out[role] = (raw[role] as unknown[]).filter((p): p is Permission => GRANTABLE.has(p as Permission));
    }
    return out;
  } catch {
    return {};
  }
}

/** What a role may do right now: the owner's choice, or the recommended set. */
export function accessOf(role: "manager" | "cashier", opts: RoleOptions = {}): Permission[] {
  const custom = parseRoleAccess(opts.roleAccess)[role];
  if (custom) return custom;
  if (role === "cashier" && opts.cashierCanEditPrice) return [...CASHIER, "sale.editPrice"];
  return DEFAULT_ACCESS[role];
}

/** Turn one right on or off, keeping the rights it depends on (or that depend on it) consistent. */
export function toggleAccess(list: Permission[], perm: Permission, on: boolean): Permission[] {
  const set = new Set(list);
  if (on) {
    const add = (p: Permission) => {
      set.add(p);
      (REQUIRES[p] ?? []).forEach(add);
    };
    add(perm);
  } else {
    const remove = (p: Permission) => {
      set.delete(p);
      for (const [other, needs] of Object.entries(REQUIRES) as [Permission, Permission[]][]) if (needs.includes(p) && set.has(other)) remove(other);
    };
    remove(perm);
  }
  return [...GRANTABLE].filter((p) => set.has(p));
}

export function can(role: Role | undefined, perm: Permission, opts: RoleOptions = {}): boolean {
  if (!role) return false;
  if (role === "owner") return true;
  if (OWNER_ONLY.includes(perm)) return false;
  return accessOf(role, opts).includes(perm);
}

/** The access options from the shop's settings. */
export function roleOptions(settings?: { cashier_can_edit_price?: boolean; role_access?: string }): RoleOptions {
  return { cashierCanEditPrice: settings?.cashier_can_edit_price, roleAccess: settings?.role_access };
}
