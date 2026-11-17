// Rules shared by the server's automatic backups and restoring a shop from a
// backup file. Kept free of I/O so they can be tested.

import type { Row } from "./db.ts";
import { columnsOf, TABLE_NAMES, type TableName } from "./schema.ts";

/** Server backup file name for a day: barbershop-2026-11-13.db */
export const backupName = (day: string) => `barbershop-${day}.db`;
const DAY = /^barbershop-(\d{4}-\d{2}-\d{2})\.db$/;

/**
 * Which server backups to delete. Keeps the newest `daily` days, plus the
 * first backup of each month for the last `monthly` months.
 */
export function backupsToDelete(names: string[], daily = 14, monthly = 12): string[] {
  const days = names.map((n) => DAY.exec(n)?.[1]).filter((d): d is string => !!d).sort().reverse();
  const keep = new Set(days.slice(0, daily));
  const months = new Map<string, string>();
  for (const d of [...days].reverse()) if (!months.has(d.slice(0, 7))) months.set(d.slice(0, 7), d);
  for (const d of [...months.values()].sort().reverse().slice(0, monthly)) keep.add(d);
  return days.filter((d) => !keep.has(d)).map(backupName);
}

/**
 * Rows from a backup that may be put back on the server: only known tables
 * and columns, and only rows the server had already accepted (rev > 0).
 * Rows with rev 0 were changes still waiting on that device; they are not
 * copied as rows but sent again as commands, so they go through the normal
 * checks exactly once.
 */
export function restorableRows(table: string, rows: unknown): { table: TableName; rows: Row[] } | null {
  if (!(TABLE_NAMES as string[]).includes(table) || !Array.isArray(rows)) return null;
  const t = table as TableName;
  const cols = columnsOf(t);
  const out: Row[] = [];
  for (const r of rows) {
    if (!r || typeof r !== "object") continue;
    const src = r as Row;
    const rev = Number(src.rev);
    if (!Number.isInteger(rev) || rev <= 0 || typeof src.id !== "string") continue;
    const row: Row = { rev };
    for (const c of cols) if (c in src) row[c] = src[c];
    out.push(row);
  }
  return { table: t, rows: out };
}
