"use client";

import { useState } from "react";
import { Contact, Phone, Search, Star } from "lucide-react";
import { useQuery } from "@/client/app-context.tsx";
import { go, setParams } from "@/client/router.ts";
import { addDays, formatDate, toBusinessDate } from "@/core/dates.ts";
import { clientList, clientProfile, type ClientRow } from "@/core/reports.ts";
import { Card, Chip, Empty, Input, Money, PageHeader, Sheet, Spinner, Stat } from "@/components/ui.tsx";
import { SortButton, SortSheet, SortSummary, sortRows, useSortRules, type SortKey } from "@/components/sort.tsx";
import { Avatar } from "./Boot.tsx";

const FILTERS = [
  ["all", "All"],
  ["regulars", "Regulars (3+ visits)"],
  ["away", "Not seen in 30 days"],
  ["new", "New this month"],
] as const;
type Filter = (typeof FILTERS)[number][0];

const plural = (n: number, word: string) => `${n} ${word}${n === 1 ? "" : "s"}`;

const CLIENT_SORT: SortKey<ClientRow>[] = [
  { id: "last", label: "Last visit", get: (c) => c.last_date, words: ["Longest ago first", "Most recent first"] },
  { id: "spent", label: "Total spent", get: (c) => c.spent, words: ["Low to high", "High to low"] },
  { id: "visits", label: "Visits", get: (c) => c.visits, words: ["Fewest first", "Most first"] },
  { id: "name", label: "Name", get: (c) => c.name, words: ["A to Z", "Z to A"] },
  { id: "first", label: "First visit", get: (c) => c.first_date, words: ["Oldest client first", "Newest client first"] },
  { id: "average", label: "Average per visit", get: (c) => (c.visits ? Math.round(c.spent / c.visits) : 0), words: ["Low to high", "High to low"] },
];

/**
 * The client book: built from the name and phone number typed at the till.
 * No separate sign-up, so it is always in step with the sales.
 */
export function ClientsView({ params }: { params: URLSearchParams }) {
  const [search, setSearch] = useState("");
  const filter = (FILTERS.some(([k]) => k === params.get("f")) ? params.get("f") : "all") as Filter;
  const openKey = params.get("c");
  const { data } = useQuery((db) => clientList(db));

  const today = toBusinessDate();
  const awayBefore = addDays(today, -30);
  const monthStart = `${today.slice(0, 7)}-01`;
  const q = search.trim().toLowerCase();
  const digits = q.replace(/\D/g, "");

  const sort = useSortRules("clients", [{ id: "last", dir: "desc" }]);
  const [sorting, setSorting] = useState(false);
  const rows = sortRows(
    (data ?? []).filter((c) => {
      if (filter === "regulars" && c.visits < 3) return false;
      if (filter === "away" && c.last_date >= awayBefore) return false;
      if (filter === "new" && c.first_date < monthStart) return false;
      if (!q) return true;
      return (c.name ?? "").toLowerCase().includes(q) || (digits.length >= 3 && (c.phone ?? "").includes(digits));
    }),
    CLIENT_SORT,
    sort.rules,
  );

  const all = data ?? [];
  const returning = all.filter((c) => c.visits > 1).length;

  return (
    <div>
      <PageHeader
        title="Clients"
        subtitle="Built from the name and phone number taken at the till"
        actions={(data?.length ?? 0) > 1 && <SortButton count={sort.rules.length} onClick={() => setSorting(true)} />}
      />
      <SortSheet open={sorting} onClose={() => setSorting(false)} keys={CLIENT_SORT} rules={sort.rules} onChange={sort.setRules} onReset={sort.reset} />
      {!data ? (
        <Spinner />
      ) : all.length === 0 ? (
        <Empty icon={<Contact className="size-8" />} title="No clients recorded yet">
          Type the customer&apos;s phone number on the ticket when you sell. Their visits, favourite services and usual barber then build up here,
          and the till recognises them next time.
        </Empty>
      ) : (
        <>
          <div className="grid grid-cols-3 gap-2 sm:gap-3">
            <Stat label="Clients" value={all.length} />
            <Stat label="Came back" value={`${Math.round((returning / all.length) * 100)}%`} hint={`${returning} of ${all.length}`} tone="accent" />
            <Stat label="New this month" value={all.filter((c) => c.first_date >= monthStart).length} />
          </div>

          <div className="relative mt-4">
            <Search className="pointer-events-none absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-ink-3" />
            <Input className="pl-10" placeholder="Search name or phone" value={search} onChange={(e) => setSearch(e.target.value)} aria-label="Search clients" />
          </div>
          <div className="chip-scroll -mx-4 mt-3 flex gap-2 overflow-x-auto px-4 pb-1">
            {FILTERS.map(([k, label]) => (
              <Chip key={k} active={filter === k} onClick={() => setParams({ f: k === "all" ? null : k })}>{label}</Chip>
            ))}
          </div>

          {rows.length > 1 && (
            <div className="mt-3">
              <SortSummary keys={CLIENT_SORT} rules={sort.rules} onOpen={() => setSorting(true)} />
            </div>
          )}
          {rows.length === 0 ? (
            <p className="py-10 text-center text-sm text-ink-3">No clients match.</p>
          ) : (
            <Card className="divide-y divide-line">
              {rows.slice(0, 300).map((c) => (
                <ClientItem key={c.key} c={c} onOpen={() => setParams({ c: c.key })} />
              ))}
            </Card>
          )}
          {filter === "away" && rows.length > 0 && (
            <p className="mt-2 text-xs text-ink-3">These clients used to come but haven&apos;t been in for a month. A call or message often brings them back.</p>
          )}
        </>
      )}

      <ClientSheet row={data?.find((c) => c.key === openKey) ?? null} onClose={() => setParams({ c: null })} />
    </div>
  );
}

function ClientItem({ c, onOpen }: { c: ClientRow; onOpen: () => void }) {
  return (
    <button onClick={onOpen} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2">
      <Avatar name={c.name ?? c.phone ?? "?"} />
      <div className="min-w-0 flex-1">
        <div className="flex items-center gap-1.5 truncate font-semibold">
          {c.name ?? "No name"}
          {c.visits >= 3 && <Star className="size-3.5 shrink-0 fill-current text-accent" aria-label="Regular" />}
        </div>
        <div className="truncate text-xs text-ink-3">
          {[c.phone, plural(c.visits, "visit"), `last ${formatDate(c.last_date, { day: "numeric", month: "short" })}`].filter(Boolean).join(" · ")}
        </div>
      </div>
      <Money value={c.spent} className="shrink-0 font-semibold" />
    </button>
  );
}

function ClientSheet({ row, onClose }: { row: ClientRow | null; onClose: () => void }) {
  const { data } = useQuery(async (db) => (row ? clientProfile(db, row.key) : null), [row?.key]);
  if (!row) return null;
  return (
    <Sheet open onClose={onClose} title={row.name ?? row.phone ?? "Client"} wide>
      {row.phone && (
        <a href={`tel:${row.phone}`} className="mb-4 flex min-h-11 items-center gap-2 font-semibold text-accent">
          <Phone className="size-4" /> {row.phone}
        </a>
      )}
      <div className="grid grid-cols-3 gap-2">
        <Stat label="Visits" value={row.visits} hint={`since ${formatDate(row.first_date, { day: "numeric", month: "short", year: "numeric" })}`} />
        <Stat label="Spent" value={<Money value={row.spent} />} />
        <Stat label="Per visit" value={<Money value={Math.round(row.spent / row.visits)} />} />
      </div>
      {!data ? (
        <Spinner />
      ) : (
        <>
          {(data.usualStaff.length > 0 || data.favourites.length > 0) && (
            <div className="mt-4 grid gap-2 sm:grid-cols-2">
              {data.usualStaff.length > 0 && (
                <Card className="p-3">
                  <div className="text-xs font-medium text-ink-3">Usually served by</div>
                  <div className="mt-1 text-sm font-semibold">{data.usualStaff.map((s) => `${s.name} (${s.n})`).join(", ")}</div>
                </Card>
              )}
              {data.favourites.length > 0 && (
                <Card className="p-3">
                  <div className="text-xs font-medium text-ink-3">Favourite services</div>
                  <div className="mt-1 text-sm font-semibold">{data.favourites.map((f) => `${f.name} ×${f.n}`).join(", ")}</div>
                </Card>
              )}
            </div>
          )}
          <h3 className="mb-2 mt-5 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Visits</h3>
          <Card className="divide-y divide-line">
            {data.visits.map((v) => (
              <button
                key={v.sale_id}
                onClick={() => go("/sales", { date: v.business_date, id: v.sale_id })}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-surface-2"
              >
                <div className="min-w-0 flex-1">
                  <div className="truncate font-semibold">{v.items}</div>
                  <div className="truncate text-xs text-ink-3">
                    {formatDate(v.business_date, { weekday: "short", day: "numeric", month: "short" })} · {v.receipt_no}
                    {v.staff ? ` · ${v.staff.replace(/,/g, ", ")}` : ""}
                  </div>
                </div>
                <Money value={v.total} className="shrink-0 font-semibold" />
              </button>
            ))}
          </Card>
        </>
      )}
    </Sheet>
  );
}
