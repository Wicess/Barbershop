"use client";

import { useState } from "react";
import { useQuery } from "@/client/app-context.tsx";
import { formatDateTime } from "@/core/dates.ts";
import { t, tk, tMessage } from "@/core/i18n.ts";
import { Badge, Card, Chip, Empty, PageHeader, Spinner } from "@/components/ui.tsx";

const FILTERS = [
  ["all", tk("Everything")],
  ["risk", tk("Voids & money changes")],
  ["sale", tk("Sales")],
  ["setup", tk("Prices, staff & settings")],
] as const;

// The shapes of the summaries the commands and the server store (in English).
// Most specific first: the first template that fits the whole summary is used.
const AUDIT_TEMPLATES = [
  tk("Sale {receipt} · {n} item(s) · tip {tip}"),
  tk("Sale {receipt} · {n} item(s)"),
  tk("Voided sale {receipt}: {reason}"),
  tk("Voided expense: {reason}"),
  tk("Voided pay adjustment: {reason}"),
  tk("Voided staff payment: {reason}"),
  tk("Expense waiting for approval: {category}, {amount}"),
  tk("Approved expense: {category}, {amount}"),
  tk("Rejected expense: {category}, {amount} ({reason})"),
  tk("Expense: {category}"),
  tk("Fixed monthly cost: {category}"),
  tk("Posted {n} fixed cost(s) for {month}"),
  tk("Pay changed for {name} from {date}: share {share}, salary {salary} ({n} earlier services recalculated)"),
  tk("Pay changed for {name} from {date}: share {share}, salary {salary}"),
  tk("Hired: {name}, from {date}"),
  tk("Ended work: {name}, last day {date}"),
  tk("Rehired: {name}, from {date}"),
  tk("Added staff: {name}"),
  tk("Updated staff: {name}"),
  tk("Advance recorded"),
  tk("Bonus recorded"),
  tk("Deduction recorded"),
  tk("Staff pay recorded for {month}"),
  tk("Section: {name}"),
  tk("Service: {name} (price {from} → {to})"),
  tk("Service: {name}"),
  tk("Product: {name}"),
  tk("Stock purchase: {product} {qty}"),
  tk("Stock spoilage: {product} {qty}"),
  tk("Stock adjustment: {product} {qty}"),
  tk("Closed {date}: counted {counted}, expected {expected}"),
  tk("Closed {date} automatically at 11:59 pm: expected {expected}, not counted"),
  tk("Closed {month} ({days} days): revenue {revenue}, net profit {profit}, staff pay {pay}"),
  tk("Recalculated {month} ({days} days): revenue {revenue}, net profit {profit}, staff pay {pay}"),
  tk("Updated user {name} as {role} (PIN changed)"),
  tk("Added user {name} as {role}"),
  tk("Updated user {name} as {role}"),
  tk("Changed settings: {keys}"),
  tk("Signed out device {code} ({name})"),
  tk("Signed in new device {code} ({name})"),
  tk("Shop restored from a backup file ({label})"),
  tk("{receipt}: {name} price {from} → {to}, discount {discount}"),
  tk("{receipt}: {name} price {from} → {to}"),
  tk("{receipt}: {name} discount {discount}"),
].map((key) => {
  const names: string[] = [];
  const src = key
    .split(/(\{\w+\})/)
    .map((part) => {
      const m = part.match(/^\{(\w+)\}$/);
      if (!m) return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      names.push(m[1]);
      return "(.+?)";
    })
    .join("");
  return { key, names, re: new RegExp(`^${src}$`) };
});

const ROLE_NAMES: Record<string, string> = { owner: tk("Owner"), manager: tk("Shop manager"), cashier: tk("Cashier") };

/** A stored (English) summary in the phone's language. */
function summaryText(summary: string): string {
  for (const { key, names, re } of AUDIT_TEMPLATES) {
    const m = summary.match(re);
    if (!m) continue;
    const vars: Record<string, string> = Object.fromEntries(names.map((n, i) => [n, m[i + 1]]));
    if (vars.role) vars.role = t(ROLE_NAMES[vars.role] ?? vars.role);
    if (vars.category) vars.category = t(vars.category);
    return t(key, vars);
  }
  return tMessage(summary);
}

const RISKY = ["expense.review", "sale.void", "sale.priceChange", "sales.void", "expenses.void", "staff_adjustments.void", "payouts.void", "day.close", "stock.move", "payout.create", "adjustment.create"];
const SETUP = ["service.upsert", "product.upsert", "department.upsert", "staff.upsert", "user.upsert", "settings.update", "device.register", "device.revoke", "recurring.upsert"];

export function ActivityView() {
  const [filter, setFilter] = useState<(typeof FILTERS)[number][0]>("risk");
  const [limit, setLimit] = useState(100);
  const { data } = useQuery(async (db) => {
    const where =
      filter === "risk" ? `WHERE a.action IN (${RISKY.map(() => "?").join(",")})`
      : filter === "setup" ? `WHERE a.action IN (${SETUP.map(() => "?").join(",")})`
      : filter === "sale" ? "WHERE a.action = 'sale.create'"
      : "";
    const params = filter === "risk" ? RISKY : filter === "setup" ? SETUP : [];
    return db.all<{ id: string; action: string; summary: string; created_at: string; actor: string | null; device: string | null }>(
      `SELECT a.id, a.action, a.summary, a.created_at, u.name AS actor, d.code AS device
         FROM audit_log a LEFT JOIN users u ON u.id = a.actor_id LEFT JOIN devices d ON d.id = a.device_id
         ${where} ORDER BY a.created_at DESC LIMIT ?`,
      [...params, limit],
    );
  }, [filter, limit]);

  return (
    <div>
      <PageHeader title={t("Activity log")} subtitle={t("Every change, who made it and on which device. Entries can't be edited or deleted.")} />
      <div className="chip-scroll -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map(([k, l]) => <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>{t(l)}</Chip>)}
      </div>
      {!data ? <Spinner /> : data.length === 0 ? <Empty title={t("Nothing here yet")} /> : (
        <>
          <Card className="divide-y divide-line xl:columns-2 xl:gap-0 xl:[column-rule:1px_solid_var(--color-line)]">
            {data.map((a) => (
              <div key={a.id} className="px-4 py-3 lg:grid lg:grid-cols-[minmax(0,17rem)_minmax(0,1fr)_auto] lg:items-center lg:gap-x-5 lg:py-2 xl:block xl:break-inside-avoid">
                <div className="flex items-center justify-between gap-2 text-xs text-ink-3 lg:contents xl:flex">
                  <span className="lg:truncate xl:whitespace-normal">
                    {formatDateTime(a.created_at)} · {a.actor ?? t("Unknown")}
                    {a.device ? ` · ${t("device {code}", { code: a.device })}` : ""}
                  </span>
                  {a.action.includes("void") && <span className="lg:order-last"><Badge tone="negative">{t("Void")}</Badge></span>}
                </div>
                {/* Summaries are stored in English; shown in the phone's language. */}
                <p className="mt-0.5 text-sm lg:col-start-2 lg:row-start-1 lg:mt-0 xl:mt-0.5">{summaryText(a.summary)}</p>
              </div>
            ))}
          </Card>
          {data.length >= limit && (
            <button className="mt-3 min-h-11 w-full lg:mt-2 cursor-pointer text-sm font-semibold text-accent" onClick={() => setLimit((l) => l + 100)}>{t("Show more")}</button>
          )}
        </>
      )}
    </div>
  );
}
