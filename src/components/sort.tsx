"use client";

// Multi-level sorting for any list: "Amount, high to low, then Customer A–Z,
// then Time, newest first". Each screen declares what can be sorted; the
// person builds the order in a sheet; their choice is remembered per screen.

import { ArrowDown, ArrowUp, ArrowUpDown, ChevronDown, ChevronUp, Plus, RotateCcw, X } from "lucide-react";
import { useCallback, useEffect, useState } from "react";
import { locale, t, tk } from "@/core/i18n.ts";
import { haptic } from "./native.tsx";
import { Button, Sheet, cx } from "./ui.tsx";

export interface SortKey<T> {
  id: string;
  label: string;
  get: (row: T) => string | number | null | undefined;
  /** Words for each direction, e.g. [tk("Low to high"), tk("High to low")]. Shown through t(). */
  words?: [asc: string, desc: string];
}

export interface SortRule {
  id: string;
  dir: "asc" | "desc";
}

// One collator per language, so names sort the way the phone's language expects.
const collators = new Map<string, Intl.Collator>();
function getCollator(): Intl.Collator | null {
  if (typeof Intl === "undefined") return null;
  const loc = locale();
  let c = collators.get(loc);
  if (!c) {
    c = new Intl.Collator(loc, { numeric: true, sensitivity: "base" });
    collators.set(loc, c);
  }
  return c;
}

/** Stable sort by each rule in turn. Empty values always go last, whatever the direction. */
export function sortRows<T>(rows: readonly T[], keys: SortKey<T>[], rules: SortRule[]): T[] {
  const active = rules.map((r) => ({ rule: r, key: keys.find((k) => k.id === r.id) })).filter((x): x is { rule: SortRule; key: SortKey<T> } => !!x.key);
  if (active.length === 0) return [...rows];
  const collator = getCollator();
  return rows
    .map((row, i) => ({ row, i }))
    .sort((a, b) => {
      for (const { rule, key } of active) {
        const x = key.get(a.row);
        const y = key.get(b.row);
        const xEmpty = x == null || x === "";
        const yEmpty = y == null || y === "";
        if (xEmpty || yEmpty) {
          if (xEmpty && yEmpty) continue;
          return xEmpty ? 1 : -1;
        }
        const c = typeof x === "number" && typeof y === "number" ? x - y : collator ? collator.compare(String(x), String(y)) : String(x).localeCompare(String(y));
        if (c !== 0) return rule.dir === "asc" ? c : -c;
      }
      return a.i - b.i;
    })
    .map((x) => x.row);
}

/** The sort order for one screen, remembered on this device. */
export function useSortRules(screen: string, initial: SortRule[]) {
  const storageKey = `bms_sort:${screen}`;
  const [rules, setRulesState] = useState<SortRule[]>(initial);
  useEffect(() => {
    try {
      const saved = localStorage.getItem(storageKey);
      if (saved) setRulesState(JSON.parse(saved) as SortRule[]);
    } catch {
      /* private mode or blocked storage: keep the default */
    }
  }, [storageKey]);
  const setRules = useCallback(
    (next: SortRule[]) => {
      setRulesState(next);
      try {
        localStorage.setItem(storageKey, JSON.stringify(next));
      } catch {
        /* not remembered, still applied */
      }
    },
    [storageKey],
  );
  const reset = useCallback(() => {
    setRulesState(initial);
    try {
      localStorage.removeItem(storageKey);
    } catch {
      /* ignore */
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [storageKey]);
  return { rules, setRules, reset };
}

/** The two direction words for a key, already translated. */
function dirWords<T>(key: SortKey<T>): [string, string] {
  const [asc, desc] = key.words ?? [tk("A to Z"), tk("Z to A")];
  return [t(asc), t(desc)];
}

/** "High to low" → "high to low", but "A to Z" stays as it is. */
const lowerFirst = (s: string) => (/^\p{Lu}\p{Ll}/u.test(s) ? s[0].toLowerCase() + s.slice(1) : s);

/** One line describing the current order, e.g. "Amount ↓ · then Customer A–Z". */
export function SortSummary<T>({ keys, rules, onOpen }: { keys: SortKey<T>[]; rules: SortRule[]; onOpen: () => void }) {
  const parts = rules
    .map((r) => ({ r, k: keys.find((k) => k.id === r.id) }))
    .filter((x) => x.k)
    .map(({ r, k }) => `${t(k!.label)} · ${lowerFirst(dirWords(k!)[r.dir === "asc" ? 0 : 1])}`);
  if (!parts.length) return null;
  const line = [t("Sorted by {first}", { first: parts[0] }), ...parts.slice(1).map((label) => t("then {label}", { label }))].join(", ");
  return (
    <button
      onClick={onOpen}
      className="mb-3 flex max-w-full cursor-pointer items-center gap-2 rounded-full bg-surface px-3 py-1.5 text-xs font-medium text-ink-2 ring-1 ring-line transition-colors hover:bg-surface-2"
    >
      <ArrowUpDown className="size-3.5 shrink-0 text-accent" />
      <span className="truncate">
        {line}
      </span>
    </button>
  );
}

/** Round header button that opens the sort sheet. */
export function SortButton({ count, onClick }: { count: number; onClick: () => void }) {
  return (
    <button
      onClick={onClick}
      aria-label={t("Sort")}
      title={t("Sort")}
      className="relative flex size-11 cursor-pointer items-center justify-center rounded-full text-ink ring-1 ring-line-strong transition-transform duration-150 hover:bg-surface-2 active:scale-90"
    >
      <ArrowUpDown className="size-5" />
      {count > 1 && (
        <span className="num absolute -right-1 -top-1 flex size-5 items-center justify-center rounded-full bg-primary text-[11px] font-bold text-on-primary ring-2 ring-bg">
          {count}
        </span>
      )}
    </button>
  );
}

/** The sheet where the order is built: an ordered list of rules, each flippable, movable and removable. */
export function SortSheet<T>({
  open, onClose, keys, rules, onChange, onReset,
}: { open: boolean; onClose: () => void; keys: SortKey<T>[]; rules: SortRule[]; onChange: (r: SortRule[]) => void; onReset: () => void }) {
  const unused = keys.filter((k) => !rules.some((r) => r.id === k.id));
  const update = (next: SortRule[]) => {
    haptic();
    onChange(next);
  };
  const move = (i: number, by: -1 | 1) => {
    const next = [...rules];
    [next[i], next[i + by]] = [next[i + by], next[i]];
    update(next);
  };
  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={t("Sort")}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={onReset}>
            <RotateCcw className="size-4" /> {t("Reset")}
          </Button>
          <Button block size="lg" onClick={onClose}>
            {t("Done")}
          </Button>
        </div>
      }
    >
      <p className="mb-3 text-sm text-ink-3">{t("The list is ordered by the first rule; ties are settled by the next one down.")}</p>
      <ol className="space-y-2">
        {rules.map((r, i) => {
          const key = keys.find((k) => k.id === r.id);
          if (!key) return null;
          const [asc, desc] = dirWords(key);
          const label = t(key.label);
          return (
            <li key={r.id} className="animate-rise flex items-center gap-2 rounded-[20px] bg-surface p-2 pl-3 ring-1 ring-line">
              <span className="num flex size-7 shrink-0 items-center justify-center rounded-full bg-primary text-xs font-bold text-on-primary">{i + 1}</span>
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-semibold">{i === 0 ? label : t("then {label}", { label })}</span>
                <span className="block text-xs text-ink-3">{r.dir === "asc" ? asc : desc}</span>
              </span>
              <button
                onClick={() => update(rules.map((x) => (x.id === r.id ? { ...x, dir: x.dir === "asc" ? "desc" : "asc" } : x)))}
                aria-label={t("{label}: switch to {direction}", { label, direction: r.dir === "asc" ? desc : asc })}
                className="flex h-10 cursor-pointer items-center gap-1 rounded-full bg-surface-2 px-3 text-xs font-semibold transition-transform active:scale-95"
              >
                {r.dir === "asc" ? <ArrowUp className="size-3.5" /> : <ArrowDown className="size-3.5" />}
                {t("Flip")}
              </button>
              <div className="flex flex-col">
                <button disabled={i === 0} onClick={() => move(i, -1)} aria-label={t("Move {label} up", { label })} className="flex h-5 w-8 cursor-pointer items-center justify-center rounded text-ink-3 disabled:opacity-25">
                  <ChevronUp className="size-4" />
                </button>
                <button disabled={i === rules.length - 1} onClick={() => move(i, 1)} aria-label={t("Move {label} down", { label })} className="flex h-5 w-8 cursor-pointer items-center justify-center rounded text-ink-3 disabled:opacity-25">
                  <ChevronDown className="size-4" />
                </button>
              </div>
              <button
                disabled={rules.length === 1}
                onClick={() => update(rules.filter((x) => x.id !== r.id))}
                aria-label={t("Remove {label}", { label })}
                className="flex size-10 cursor-pointer items-center justify-center rounded-full text-ink-3 transition-colors hover:bg-surface-2 hover:text-negative disabled:opacity-25"
              >
                <X className="size-4" />
              </button>
            </li>
          );
        })}
      </ol>
      {unused.length > 0 && (
        <>
          <p className="mb-2 mt-5 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">{rules.length ? t("Then by") : t("Sort by")}</p>
          <div className="flex flex-wrap gap-2">
            {unused.map((k) => (
              <button
                key={k.id}
                onClick={() => update([...rules, { id: k.id, dir: "desc" }])}
                className={cx("flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full bg-surface px-3.5 text-sm font-semibold ring-1 ring-line-strong transition-[transform,background-color] hover:bg-surface-2 active:scale-95")}
              >
                <Plus className="size-4 text-accent" /> {t(k.label)}
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}
