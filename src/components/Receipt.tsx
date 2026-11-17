"use client";

import type { Db } from "@/core/db.ts";
import { PAYMENT_LABEL } from "@/core/commands.ts";
import { locale, t } from "@/core/i18n.ts";
import { formatMoney } from "@/core/money.ts";
import type { Settings } from "@/core/settings.ts";
import { PageSize } from "./print.tsx";

export interface ReceiptData {
  sale: {
    id: string; receipt_no: string; created_at: string; customer_name: string | null; subtotal: number;
    discount: number; total: number; tendered: number; change_due: number; status: string; void_reason: string | null;
    cashier: string | null;
  };
  lines: { name: string; staff: string | null; qty: number; unit_price: number; discount: number; line_total: number; department: string | null }[];
  payments: { method: string; amount: number; reference: string | null }[];
  tips: { staff: string | null; amount: number }[];
}

export async function loadReceipt(db: Db, saleId: string): Promise<ReceiptData | null> {
  const sale = await db.get<ReceiptData["sale"]>(
    `SELECT s.*, u.name AS cashier FROM sales s LEFT JOIN users u ON u.id = s.created_by WHERE s.id = ?`,
    [saleId],
  );
  if (!sale) return null;
  const lines = await db.all<ReceiptData["lines"][number]>(
    `SELECT l.name, st.name AS staff, l.qty, l.unit_price, l.discount, l.line_total, d.name AS department
       FROM sale_lines l LEFT JOIN staff st ON st.id = l.staff_id LEFT JOIN departments d ON d.id = l.department_id
      WHERE l.sale_id = ? ORDER BY l.position`,
    [saleId],
  );
  const payments = await db.all<ReceiptData["payments"][number]>(
    "SELECT method, amount, reference FROM payments WHERE sale_id = ? ORDER BY created_at",
    [saleId],
  );
  const tips = await db.all<ReceiptData["tips"][number]>(
    "SELECT st.name AS staff, t.amount FROM tips t LEFT JOIN staff st ON st.id = t.staff_id WHERE t.sale_id = ?",
    [saleId],
  );
  return { sale, lines, payments, tips };
}

/** Receipt laid out for a thermal roll (58/80mm) or A4, depending on settings. */
export function ReceiptDoc({ data, settings }: { data: ReceiptData; settings: Settings }) {
  const m = (v: number) => formatMoney(v, settings.currency);
  const { sale, lines, payments } = data;
  const tips = data.tips ?? [];
  const rule = <div className="my-1.5 border-t border-dashed border-black" />;
  return (
    <div className="receipt mx-auto p-1" data-width={settings.paper_width}>
      <PageSize size={settings.paper_width} />
      <div className="text-center">
        <div className="text-[15px] font-bold">{settings.shop_name}</div>
        {settings.address && <div>{settings.address}</div>}
        {settings.phone && <div>{t("Tel: {phone}", { phone: settings.phone })}</div>}
      </div>
      {rule}
      <div className="flex justify-between"><span>{t("Receipt")}</span><span>{sale.receipt_no}</span></div>
      <div className="flex justify-between"><span>{t("Date")}</span><span>{new Date(sale.created_at).toLocaleString(locale())}</span></div>
      {sale.cashier && <div className="flex justify-between"><span>{t("Cashier")}</span><span>{sale.cashier}</span></div>}
      {sale.customer_name && <div className="flex justify-between"><span>{t("Customer")}</span><span>{sale.customer_name}</span></div>}
      {sale.status === "voided" && <div className="mt-1 text-center font-bold">{t("*** VOIDED: {reason} ***", { reason: sale.void_reason ?? "" })}</div>}
      {rule}
      {lines.map((l, i) => (
        <div key={i} className="mb-1">
          <div className="flex justify-between gap-2">
            <span>{l.qty > 1 ? `${l.qty} × ` : ""}{t(l.name)}</span>
            <span className="shrink-0">{m(l.qty * l.unit_price)}</span>
          </div>
          {l.staff && <div className="pl-2 text-[11px]">{t("by {name}", { name: l.staff })}</div>}
          {l.discount > 0 && (
            <div className="flex justify-between pl-2 text-[11px]"><span>{t("Discount")}</span><span>−{m(l.discount)}</span></div>
          )}
        </div>
      ))}
      {rule}
      {sale.discount > 0 && (
        <>
          <div className="flex justify-between"><span>{t("Subtotal")}</span><span>{m(sale.subtotal)}</span></div>
          <div className="flex justify-between"><span>{t("Discount")}</span><span>−{m(sale.discount)}</span></div>
        </>
      )}
      <div className="flex justify-between text-[15px] font-bold"><span>{t("TOTAL")}</span><span>{m(sale.total)}</span></div>
      {tips.map((tip, i) => (
        <div key={i} className="flex justify-between"><span>{tip.staff ? t("Tip for {name}", { name: tip.staff }) : t("Tip")}</span><span>{m(tip.amount)}</span></div>
      ))}
      {tips.length > 0 && (
        <div className="flex justify-between font-bold">
          <span>{t("PAID")}</span><span>{m(sale.total + tips.reduce((n, tip) => n + tip.amount, 0))}</span>
        </div>
      )}
      {payments.map((p, i) => (
        <div key={i} className="flex justify-between">
          <span>{t(PAYMENT_LABEL[p.method] ?? p.method)}{p.reference ? ` (${p.reference})` : ""}</span>
          <span>{m(p.amount)}</span>
        </div>
      ))}
      {sale.tendered > 0 && (
        <>
          <div className="flex justify-between"><span>{t("Cash received")}</span><span>{m(sale.tendered)}</span></div>
          <div className="flex justify-between"><span>{t("Change")}</span><span>{m(sale.change_due)}</span></div>
        </>
      )}
      {rule}
      {settings.receipt_footer && <div className="text-center">{settings.receipt_footer}</div>}
    </div>
  );
}
