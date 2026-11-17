"use client";

// Dropdowns and date pickers drawn by the app itself, so they match its look
// on every device instead of falling back to the browser's grey system menus.
// Both keep the familiar call-site API: <Select value onChange={(e) => e.target.value}>
// with <option> children, and <Input type="date"> (see ui.tsx).

import {
  Children, isValidElement, useCallback, useEffect, useId, useLayoutEffect, useMemo, useRef, useState,
  type ChangeEvent, type ReactElement, type ReactNode, type SelectHTMLAttributes,
} from "react";
import { createPortal } from "react-dom";
import { CalendarDays, Check, ChevronDown, ChevronLeft, ChevronRight } from "lucide-react";
import { locale, t } from "@/core/i18n.ts";
import { addDays, formatDate, toBusinessDate } from "@/core/dates.ts";

function cx(...parts: (string | false | null | undefined)[]) {
  return parts.filter(Boolean).join(" ");
}

export const inputClass =
  "block w-full min-h-[52px] rounded-2xl border border-transparent bg-surface-2 px-4 text-base text-ink placeholder:text-ink-3 transition-[background-color,border-color,box-shadow] duration-200 hover:border-line-strong focus:border-primary focus:bg-surface focus:outline-none focus:ring-4 focus:ring-primary/15 disabled:opacity-50 lg:min-h-11 lg:rounded-xl lg:text-[15px]";

// ---------- floating panel ----------

type Place = { left: number; top?: number; bottom?: number; width: number; maxHeight: number };

/** Where to put a panel under (or, if there's no room, above) its button, kept on screen. */
function placeUnder(anchor: HTMLElement, minWidth: number, wanted: number): Place {
  const r = anchor.getBoundingClientRect();
  const vw = window.innerWidth, vh = window.innerHeight, gap = 6, edge = 8;
  const width = Math.min(Math.max(r.width, minWidth), vw - edge * 2);
  const left = Math.min(Math.max(edge, r.left), vw - width - edge);
  const below = vh - r.bottom - gap - edge, above = r.top - gap - edge;
  if (below >= Math.min(wanted, 220) || below >= above) return { left, top: r.bottom + gap, width, maxHeight: below };
  return { left, bottom: vh - r.top + gap, width, maxHeight: above };
}

/** Keeps a floating panel attached to its button while open; closes on outside press, Escape, resize. */
function usePopover(open: boolean, close: () => void, anchor: React.RefObject<HTMLElement | null>, panel: React.RefObject<HTMLElement | null>, minWidth: number, wanted: number) {
  const [place, setPlace] = useState<Place | null>(null);
  const closeRef = useRef(close);
  closeRef.current = close;

  useLayoutEffect(() => {
    if (!open || !anchor.current) return setPlace(null);
    const update = () => anchor.current && setPlace(placeUnder(anchor.current, minWidth, wanted));
    update();
    const onDown = (e: PointerEvent) => {
      const tgt = e.target as Node;
      if (panel.current?.contains(tgt) || anchor.current?.contains(tgt)) return;
      closeRef.current();
    };
    // Capture on window: runs before a sheet's own Escape handler, so Escape closes only the menu.
    const onKey = (e: KeyboardEvent) => {
      if (e.key !== "Escape") return;
      e.stopPropagation();
      e.preventDefault();
      closeRef.current();
      anchor.current?.focus();
    };
    const onResize = () => closeRef.current();
    window.addEventListener("pointerdown", onDown, true);
    window.addEventListener("keydown", onKey, true);
    window.addEventListener("scroll", update, true);
    window.addEventListener("resize", onResize);
    return () => {
      window.removeEventListener("pointerdown", onDown, true);
      window.removeEventListener("keydown", onKey, true);
      window.removeEventListener("scroll", update, true);
      window.removeEventListener("resize", onResize);
    };
  }, [open, anchor, panel, minWidth, wanted]);

  return place;
}

function Floating({ place, panelRef, children, className, ...rest }: { place: Place; panelRef: React.RefObject<HTMLDivElement | null>; children: ReactNode; className?: string } & React.HTMLAttributes<HTMLDivElement>) {
  const fromAbove = place.bottom !== undefined;
  return createPortal(
    <div
      ref={panelRef}
      style={{ left: place.left, top: place.top, bottom: place.bottom, width: place.width, maxHeight: Math.max(160, place.maxHeight) }}
      className={cx(
        "no-print fixed z-[70] overflow-hidden rounded-2xl bg-surface p-1.5 shadow-float ring-1 ring-line-strong",
        fromAbove ? "origin-bottom animate-pop-up" : "origin-top animate-pop-down",
        className,
      )}
      {...rest}
    >
      {children}
    </div>,
    document.body,
  );
}

// ---------- Select ----------

type Opt = { value: string; label: ReactNode; text: string; disabled?: boolean };

function textOf(node: ReactNode): string {
  if (node == null || typeof node === "boolean") return "";
  if (typeof node === "string" || typeof node === "number") return String(node);
  if (Array.isArray(node)) return node.map(textOf).join("");
  if (isValidElement<{ children?: ReactNode }>(node)) return textOf(node.props.children);
  return "";
}

/** Reads <option> children (also inside fragments and arrays from .map). */
function readOptions(children: ReactNode): Opt[] {
  const out: Opt[] = [];
  Children.forEach(children, (c) => {
    if (!isValidElement(c)) return;
    const el = c as ReactElement<{ value?: string | number; children?: ReactNode; disabled?: boolean }>;
    if (el.type === "option") {
      const text = textOf(el.props.children);
      out.push({ value: String(el.props.value ?? text), label: el.props.children, text, disabled: el.props.disabled });
    } else if (el.props.children) {
      out.push(...readOptions(el.props.children));
    }
  });
  return out;
}

/**
 * A dropdown in the app's own style. Same props as a <select>: `value`,
 * `onChange={(e) => e.target.value}` and <option> children.
 */
export function Select({ id, value, onChange, children, className, disabled, ...rest }: SelectHTMLAttributes<HTMLSelectElement>) {
  const options = useMemo(() => readOptions(children), [children]);
  const current = String(value ?? "");
  const selectedIndex = Math.max(0, options.findIndex((o) => o.value === current));
  const [open, setOpen] = useState(false);
  const [active, setActive] = useState(selectedIndex);
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const list = useRef<HTMLDivElement>(null);
  const autoId = useId();
  const listId = `${id ?? autoId}-list`;
  const typed = useRef({ text: "", at: 0 });

  const close = useCallback(() => setOpen(false), []);
  const place = usePopover(open, close, button, panel, 200, Math.min(320, options.length * 44 + 12));

  const choose = (i: number) => {
    const o = options[i];
    if (!o || o.disabled) return;
    setOpen(false);
    button.current?.focus();
    if (o.value !== current) onChange?.({ target: { value: o.value }, currentTarget: { value: o.value } } as unknown as ChangeEvent<HTMLSelectElement>);
  };
  const openList = () => {
    if (disabled) return;
    setActive(selectedIndex);
    setOpen(true);
  };

  // Focus the list when it opens, and keep the active option in view.
  useEffect(() => {
    if (open && place) list.current?.focus({ preventScroll: true });
  }, [open, place]);
  useEffect(() => {
    if (!open) return;
    list.current?.querySelector<HTMLElement>(`[data-i="${active}"]`)?.scrollIntoView({ block: "nearest" });
  }, [open, active, place]);

  const move = (from: number, step: number) => {
    let i = from;
    for (let n = 0; n < options.length; n++) {
      i = (i + step + options.length) % options.length;
      if (!options[i].disabled) return i;
    }
    return from;
  };
  const onListKey = (e: React.KeyboardEvent) => {
    if (e.key === "ArrowDown") setActive((a) => move(a, 1));
    else if (e.key === "ArrowUp") setActive((a) => move(a, -1));
    else if (e.key === "Home") setActive(move(-1, 1));
    else if (e.key === "End") setActive(move(0, -1));
    else if (e.key === "Enter" || e.key === " ") choose(active);
    else if (e.key === "Tab") setOpen(false);
    else if (e.key.length === 1) {
      // Type to jump: "m" → Mobile money.
      const now = Date.now();
      typed.current = { text: (now - typed.current.at < 700 ? typed.current.text : "") + e.key.toLowerCase(), at: now };
      const hit = options.findIndex((o) => !o.disabled && o.text.toLowerCase().startsWith(typed.current.text));
      if (hit >= 0) setActive(hit);
      return;
    } else return;
    e.preventDefault();
  };
  const onButtonKey = (e: React.KeyboardEvent) => {
    if (["ArrowDown", "ArrowUp", "Enter", " "].includes(e.key)) {
      e.preventDefault();
      openList();
    }
  };

  const shown = options[selectedIndex];
  return (
    <>
      <button
        ref={button}
        id={id}
        type="button"
        disabled={disabled}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-controls={open ? listId : undefined}
        aria-label={rest["aria-label"]}
        onClick={() => (open ? setOpen(false) : openList())}
        onKeyDown={onButtonKey}
        className={cx(inputClass, "flex cursor-pointer items-center justify-between gap-2 text-left", open && "border-primary bg-surface ring-4 ring-primary/15", className)}
      >
        <span className="min-w-0 truncate">{shown?.label ?? ""}</span>
        <ChevronDown aria-hidden className={cx("size-4 shrink-0 text-ink-3 transition-transform duration-200", open && "rotate-180 text-primary")} />
      </button>
      {open && place && (
        <Floating place={place} panelRef={panel}>
          <div
            ref={list}
            id={listId}
            role="listbox"
            tabIndex={-1}
            aria-labelledby={id}
            aria-activedescendant={`${listId}-${active}`}
            onKeyDown={onListKey}
            style={{ maxHeight: Math.max(148, place.maxHeight - 12) }}
            className="overflow-y-auto overscroll-contain outline-none"
          >
            {options.map((o, i) => {
              const selected = i === selectedIndex;
              return (
                <div
                  key={o.value + i}
                  id={`${listId}-${i}`}
                  data-i={i}
                  role="option"
                  aria-selected={selected}
                  aria-disabled={o.disabled || undefined}
                  onPointerEnter={() => !o.disabled && setActive(i)}
                  onClick={() => choose(i)}
                  className={cx(
                    "flex min-h-11 cursor-pointer items-center justify-between gap-3 rounded-xl px-3 text-[15px] transition-colors duration-100 lg:min-h-10",
                    i === active && "bg-surface-2",
                    selected ? "font-semibold text-ink" : "text-ink-2",
                    o.disabled && "cursor-default opacity-40",
                  )}
                >
                  <span className="min-w-0 truncate">{o.label}</span>
                  {selected && <Check aria-hidden className="size-4 shrink-0 text-primary" />}
                </div>
              );
            })}
          </div>
        </Floating>
      )}
    </>
  );
}

// ---------- DateInput ----------

const pad = (n: number) => String(n).padStart(2, "0");
const ymd = (y: number, m: number, d: number) => `${y}-${pad(m + 1)}-${pad(d)}`;

/**
 * A date field with the app's own calendar. Value and min/max are YYYY-MM-DD.
 * `look`: "field" (a full input), "icon" (a round calendar button, e.g. in a page header),
 * or "compact" (a small pill showing the date).
 */
export function DateInput({
  id, value, min, max, onChange, look = "field", className, label,
}: { id?: string; value: string; min?: string; max?: string; onChange: (value: string) => void; look?: "field" | "icon" | "compact"; className?: string; label?: string }) {
  const [open, setOpen] = useState(false);
  const [view, setView] = useState(() => (value || toBusinessDate()).slice(0, 7));
  const [focusDay, setFocusDay] = useState(value || toBusinessDate());
  const button = useRef<HTMLButtonElement>(null);
  const panel = useRef<HTMLDivElement>(null);
  const grid = useRef<HTMLDivElement>(null);
  const close = useCallback(() => setOpen(false), []);
  const place = usePopover(open, close, button, panel, 300, 380);
  const today = toBusinessDate();

  const allowed = (d: string) => (!min || d >= min) && (!max || d <= max);
  const openCal = () => {
    const start = value || (max && today > max ? max : today);
    setView(start.slice(0, 7));
    setFocusDay(start);
    setOpen(true);
  };
  const pick = (d: string) => {
    if (!allowed(d)) return;
    setOpen(false);
    button.current?.focus();
    if (d !== value) onChange(d);
  };

  // Monday-first month grid (French and Cameroonian convention; fine in English too).
  const [vy, vm] = view.split("-").map(Number);
  const first = new Date(Date.UTC(vy, vm - 1, 1));
  const lead = (first.getUTCDay() + 6) % 7;
  const days = new Date(Date.UTC(vy, vm, 0)).getUTCDate();
  const cells: (string | null)[] = [...Array(lead).fill(null), ...Array.from({ length: days }, (_, i) => ymd(vy, vm - 1, i + 1))];
  while (cells.length % 7) cells.push(null);
  const weekdays = useMemo(() => {
    const f = new Intl.DateTimeFormat(locale(), { weekday: "narrow", timeZone: "UTC" });
    return Array.from({ length: 7 }, (_, i) => f.format(new Date(Date.UTC(2024, 0, 1 + i)))); // 1 Jan 2024 was a Monday
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [locale()]);
  const monthTitle = new Intl.DateTimeFormat(locale(), { month: "long", year: "numeric", timeZone: "UTC" }).format(first);
  const shiftMonth = (n: number) => {
    const d = new Date(Date.UTC(vy, vm - 1 + n, 1));
    setView(`${d.getUTCFullYear()}-${pad(d.getUTCMonth() + 1)}`);
  };
  const prevOk = !min || min.slice(0, 7) < view;
  const nextOk = !max || max.slice(0, 7) > view;

  // Arrow keys move day by day / week by week, like a native calendar.
  useEffect(() => {
    if (!open || !place) return;
    if (focusDay.slice(0, 7) !== view) setView(focusDay.slice(0, 7));
    requestAnimationFrame(() => grid.current?.querySelector<HTMLElement>(`[data-d="${focusDay}"]`)?.focus({ preventScroll: true }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open, place, focusDay]);
  const onGridKey = (e: React.KeyboardEvent) => {
    const step = { ArrowLeft: -1, ArrowRight: 1, ArrowUp: -7, ArrowDown: 7 }[e.key];
    if (step) {
      e.preventDefault();
      const next = addDays(focusDay, step);
      if (allowed(next)) setFocusDay(next);
    }
  };

  const shownLong = value ? formatDate(value, { weekday: "short", day: "numeric", month: "long", year: "numeric" }) : "";
  const shownShort = value ? formatDate(value, { day: "numeric", month: "short" }) : "";
  const name = label ?? t("Choose a date");

  return (
    <>
      {look === "icon" ? (
        <button
          ref={button} id={id} type="button" aria-label={name} title={name} aria-haspopup="dialog" aria-expanded={open}
          onClick={() => (open ? setOpen(false) : openCal())}
          className={cx("flex size-11 cursor-pointer items-center justify-center rounded-full text-ink ring-1 ring-line-strong transition-[transform,background-color] hover:bg-surface-2 active:scale-90", open && "bg-surface-2 ring-primary", className)}
        >
          <CalendarDays className="size-5" />
        </button>
      ) : (
        <button
          ref={button} id={id} type="button" aria-haspopup="dialog" aria-expanded={open}
          aria-label={look === "compact" ? `${name}: ${shownLong}` : undefined}
          onClick={() => (open ? setOpen(false) : openCal())}
          className={cx(
            look === "field"
              ? cx(inputClass, "flex cursor-pointer items-center justify-between gap-2 text-left")
              : "flex h-11 cursor-pointer items-center gap-2 rounded-xl bg-surface px-3 text-sm font-semibold text-ink ring-1 ring-line-strong transition-colors hover:bg-surface-2",
            open && (look === "field" ? "border-primary bg-surface ring-4 ring-primary/15" : "ring-primary"),
            className,
          )}
        >
          {look === "compact" && <CalendarDays aria-hidden className="size-4 text-ink-3" />}
          <span className="min-w-0 truncate first-letter:uppercase">{look === "compact" ? shownShort : shownLong}</span>
          {look === "field" && <CalendarDays aria-hidden className={cx("size-4 shrink-0 text-ink-3", open && "text-primary")} />}
        </button>
      )}
      {open && place && (
        <Floating place={{ ...place, width: Math.min(320, window.innerWidth - 16) }} panelRef={panel} role="dialog" aria-label={name} className="!p-3">
          <div className="mb-2 flex items-center justify-between gap-2">
            <button type="button" aria-label={t("Previous month")} disabled={!prevOk} onClick={() => shiftMonth(-1)} className="flex size-9 cursor-pointer items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 disabled:cursor-default disabled:opacity-30">
              <ChevronLeft className="size-5" />
            </button>
            <p className="text-[15px] font-bold capitalize tracking-[-0.01em]" aria-live="polite">{monthTitle}</p>
            <button type="button" aria-label={t("Next month")} disabled={!nextOk} onClick={() => shiftMonth(1)} className="flex size-9 cursor-pointer items-center justify-center rounded-full text-ink-2 hover:bg-surface-2 disabled:cursor-default disabled:opacity-30">
              <ChevronRight className="size-5" />
            </button>
          </div>
          <div className="grid grid-cols-7 pb-1 text-center text-[11px] font-semibold uppercase text-ink-3" aria-hidden>
            {weekdays.map((w, i) => <span key={i} className="py-1">{w}</span>)}
          </div>
          <div ref={grid} role="grid" onKeyDown={onGridKey} className="grid grid-cols-7 gap-0.5">
            {cells.map((d, i) => {
              if (!d) return <span key={i} />;
              const ok = allowed(d), sel = d === value, isToday = d === today;
              return (
                <button
                  key={d}
                  type="button"
                  data-d={d}
                  tabIndex={d === focusDay ? 0 : -1}
                  disabled={!ok}
                  aria-pressed={sel}
                  aria-label={formatDate(d, { weekday: "long", day: "numeric", month: "long", year: "numeric" })}
                  onClick={() => pick(d)}
                  className={cx(
                    "num relative flex aspect-square cursor-pointer items-center justify-center rounded-xl text-sm transition-[background-color,transform] duration-100 active:scale-90 focus-visible:outline-2 focus-visible:outline-primary",
                    sel ? "bg-primary font-bold text-on-primary shadow-[var(--shadow-primary)]" : ok ? "text-ink hover:bg-surface-2" : "cursor-default text-ink-3/40",
                    isToday && !sel && "font-bold text-primary ring-1 ring-primary/50",
                  )}
                >
                  {Number(d.slice(8))}
                </button>
              );
            })}
          </div>
          {allowed(today) && (
            <div className="mt-2 flex justify-end border-t border-line pt-2">
              <button type="button" onClick={() => pick(today)} className="min-h-9 cursor-pointer rounded-full px-3 text-sm font-semibold text-accent hover:bg-surface-2">
                {t("Today")}
              </button>
            </div>
          )}
        </Floating>
      )}
    </>
  );
}
