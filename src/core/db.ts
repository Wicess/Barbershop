import { columnsOf, type TableName } from "./schema.ts";

export type Row = Record<string, unknown>;

/** The small database surface shared by the browser (sql.js) and the server (libSQL). */
export interface Db {
  all<T = Row>(sql: string, params?: unknown[]): Promise<T[]>;
  get<T = Row>(sql: string, params?: unknown[]): Promise<T | undefined>;
  run(sql: string, params?: unknown[]): Promise<void>;
}

export interface Store extends Db {
  tx<T>(fn: (db: Db) => Promise<T>): Promise<T>;
}

/** Insert or replace a row by id. Columns missing from `row` are written as NULL. */
export async function upsert(db: Db, table: TableName, row: Row, rev: number): Promise<void> {
  const cols = columnsOf(table);
  const all = [...cols, "rev"];
  const values = [...cols.map((c) => normalize(row[c])), rev];
  const updates = all.filter((c) => c !== "id").map((c) => `${c}=excluded.${c}`).join(", ");
  await db.run(
    `INSERT INTO ${table} (${all.join(", ")}) VALUES (${all.map(() => "?").join(", ")})
     ON CONFLICT(id) DO UPDATE SET ${updates}`,
    values,
  );
}

function normalize(v: unknown): unknown {
  if (v === undefined) return null;
  if (typeof v === "boolean") return v ? 1 : 0;
  return v;
}

export async function scalar(db: Db, sql: string, params: unknown[] = []): Promise<number> {
  const row = await db.get<{ v: number | null }>(sql, params);
  return Number(row?.v ?? 0);
}
