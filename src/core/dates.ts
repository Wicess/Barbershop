import { locale } from "./i18n.ts";

// Business dates are the shop's local calendar day as "YYYY-MM-DD"; months are "YYYY-MM".

const pad = (n: number) => String(n).padStart(2, "0");

export function toBusinessDate(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

export function monthOf(date: string): string {
  return date.slice(0, 7);
}

export function currentMonth(): string {
  return monthOf(toBusinessDate());
}

export function parseDate(date: string): Date {
  const [y, m, d] = date.split("-").map(Number);
  return new Date(y, (m ?? 1) - 1, d ?? 1);
}

export function addDays(date: string, days: number): string {
  const d = parseDate(date);
  d.setDate(d.getDate() + days);
  return toBusinessDate(d);
}

export function daysInMonth(month: string): number {
  const [y, m] = month.split("-").map(Number);
  return new Date(y, m, 0).getDate();
}

export function monthRange(month: string): { from: string; to: string } {
  return { from: `${month}-01`, to: `${month}-${pad(daysInMonth(month))}` };
}

export function addMonths(month: string, n: number): string {
  const [y, m] = month.split("-").map(Number);
  const d = new Date(y, m - 1 + n, 1);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}`;
}

/** Inclusive day count between two business dates. */
export function dayCount(from: string, to: string): number {
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / 86400000) + 1;
}

export function formatDate(date: string, opts: Intl.DateTimeFormatOptions = { day: "numeric", month: "short", year: "numeric" }): string {
  return parseDate(date).toLocaleDateString(locale(), opts);
}

export function formatMonth(month: string): string {
  return parseDate(`${month}-01`).toLocaleDateString(locale(), { month: "long", year: "numeric" });
}

export function formatTime(iso: string): string {
  return new Date(iso).toLocaleTimeString(locale(), { hour: "2-digit", minute: "2-digit" });
}

export function formatDateTime(iso: string): string {
  return new Date(iso).toLocaleString(locale(), {
    day: "numeric", month: "short", hour: "2-digit", minute: "2-digit",
  });
}

export type Period = { from: string; to: string; label: string };

export function presetPeriod(kind: "today" | "yesterday" | "week" | "month" | "lastMonth"): Period {
  const today = toBusinessDate();
  switch (kind) {
    case "today":
      return { from: today, to: today, label: "Today" };
    case "yesterday": {
      const y = addDays(today, -1);
      return { from: y, to: y, label: "Yesterday" };
    }
    case "week": {
      const d = parseDate(today);
      const mondayOffset = (d.getDay() + 6) % 7;
      return { from: addDays(today, -mondayOffset), to: today, label: "This week" };
    }
    case "month":
      return { from: `${monthOf(today)}-01`, to: today, label: "This month" };
    case "lastMonth": {
      const m = addMonths(monthOf(today), -1);
      return { ...monthRange(m), label: formatMonth(m) };
    }
  }
}
