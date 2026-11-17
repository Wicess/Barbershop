import type { Db } from "./db.ts";

export interface Settings {
  shop_name: string;
  address: string;
  phone: string;
  currency: string;
  receipt_footer: string;
  /** "58" | "80" (mm thermal roll) or "a4" */
  paper_width: string;
  cashier_can_edit_price: boolean;
  /** Default staff share in basis points for new staff. */
  default_commission_bp: number;
  /** Cash left in the drawer at the start of each day. */
  opening_float: number;
}

export const DEFAULT_SETTINGS: Settings = {
  shop_name: "My Barbershop",
  address: "",
  phone: "",
  currency: "KES",
  receipt_footer: "Thank you. See you again!",
  paper_width: "80",
  cashier_can_edit_price: false,
  default_commission_bp: 4000,
  opening_float: 0,
};

export async function loadSettings(db: Db): Promise<Settings> {
  const rows = await db.all<{ id: string; value: string }>("SELECT id, value FROM settings");
  const out: Settings = { ...DEFAULT_SETTINGS };
  for (const { id, value } of rows) {
    if (!(id in out)) continue;
    const current = out[id as keyof Settings];
    (out as unknown as Record<string, unknown>)[id] =
      typeof current === "number" ? Number(value) : typeof current === "boolean" ? value === "1" : value;
  }
  return out;
}

export function serializeSetting(value: unknown): string {
  if (typeof value === "boolean") return value ? "1" : "0";
  return String(value ?? "");
}
