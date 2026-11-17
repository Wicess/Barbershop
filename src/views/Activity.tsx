"use client";

import { useState } from "react";
import { useQuery } from "@/client/app-context.tsx";
import { formatDateTime } from "@/core/dates.ts";
import { Badge, Card, Chip, Empty, PageHeader, Spinner } from "@/components/ui.tsx";

const FILTERS = [
  ["all", "Everything"],
  ["risk", "Voids & money changes"],
  ["sale", "Sales"],
  ["setup", "Prices, staff & settings"],
] as const;

const RISKY = ["sale.void", "sale.priceChange", "sales.void", "expenses.void", "staff_adjustments.void", "payouts.void", "day.close", "stock.move", "payout.create", "adjustment.create"];
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
      <PageHeader title="Activity log" subtitle="Every change, who made it and on which device. Entries can't be edited or deleted." />
      <div className="chip-scroll -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {FILTERS.map(([k, l]) => <Chip key={k} active={filter === k} onClick={() => setFilter(k)}>{l}</Chip>)}
      </div>
      {!data ? <Spinner /> : data.length === 0 ? <Empty title="Nothing here yet" /> : (
        <>
          <Card className="divide-y divide-line">
            {data.map((a) => (
              <div key={a.id} className="px-4 py-3">
                <div className="flex items-center justify-between gap-2 text-xs text-ink-3">
                  <span>{formatDateTime(a.created_at)} · {a.actor ?? "Unknown"}{a.device ? ` · device ${a.device}` : ""}</span>
                  {a.action.includes("void") && <Badge tone="negative">Void</Badge>}
                </div>
                <p className="mt-0.5 text-sm">{a.summary}</p>
              </div>
            ))}
          </Card>
          {data.length >= limit && (
            <button className="mt-3 min-h-11 w-full cursor-pointer text-sm font-semibold text-accent" onClick={() => setLimit((l) => l + 100)}>Show more</button>
          )}
        </>
      )}
    </div>
  );
}
