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
  /** Owner setting: may cashiers change a service price at the till? */
  cashierCanEditPrice?: boolean;
}

export function can(role: Role | undefined, perm: Permission, opts: RoleOptions = {}): boolean {
  if (!role) return false;
  if (role === "owner") return true;
  if (role === "manager") return MANAGER.includes(perm);
  if (perm === "sale.editPrice") return !!opts.cashierCanEditPrice;
  return CASHIER.includes(perm);
}
