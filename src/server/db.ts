import "server-only";
import { createClient, type Client, type InArgs, type Transaction } from "@libsql/client";
import { mkdirSync } from "node:fs";
import type { Db, Store } from "@/core/db.ts";
import { TABLE_NAMES, missingColumnStatements, schemaStatements } from "@/core/schema.ts";

type Executor = Client | Transaction;

function adapter(exec: Executor): Db {
  return {
    async all<T>(sql: string, params: unknown[] = []) {
      const res = await exec.execute({ sql, args: params as InArgs });
      return res.rows.map((r) => ({ ...r })) as T[];
    },
    async get<T>(sql: string, params: unknown[] = []) {
      const res = await exec.execute({ sql, args: params as InArgs });
      return (res.rows[0] ? { ...res.rows[0] } : undefined) as T | undefined;
    },
    async run(sql: string, params: unknown[] = []) {
      await exec.execute({ sql, args: params as InArgs });
    },
  };
}

// Writes are serialised in-process so the rev counter always increases in commit order.
let queue: Promise<unknown> = Promise.resolve();
export function serial<T>(fn: () => Promise<T>): Promise<T> {
  const next = queue.then(fn, fn);
  queue = next.catch(() => undefined);
  return next;
}

let ready: Promise<Store> | null = null;
let rawClient: Client | null = null;

export const databaseUrl = () => process.env.DATABASE_URL || "file:data/barbershop.db";
/** True when the database is a file on this server (self-hosted), false for a remote libSQL/Turso database. */
export const isFileDatabase = () => databaseUrl().startsWith("file:");

/** The underlying client, for maintenance statements (backups) that can't run in a transaction. */
export async function serverClient(): Promise<Client> {
  await serverDb();
  return rawClient!;
}

export function serverDb(): Promise<Store> {
  ready ??= init();
  return ready;
}

async function init(): Promise<Store> {
  const url = databaseUrl();
  if (url.startsWith("file:")) mkdirSync("data", { recursive: true });
  const client = createClient({ url, authToken: process.env.DATABASE_AUTH_TOKEN });
  if (url.startsWith("file:")) await client.execute("PRAGMA journal_mode = WAL");
  await client.batch(
    [
      ...schemaStatements(),
      "CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)",
      "CREATE TABLE IF NOT EXISTS applied_commands (id TEXT PRIMARY KEY, type TEXT, device_id TEXT, actor_id TEXT, ok INTEGER, error TEXT, applied_at TEXT)",
    ],
    "write",
  );
  // Columns added in later versions: add any this database doesn't have yet.
  for (const t of TABLE_NAMES) {
    const have = new Set((await client.execute(`PRAGMA table_info(${t})`)).rows.map((r) => String(r.name)));
    for (const sql of missingColumnStatements(t, have)) await client.execute(sql);
  }
  // The data generation: a new one is made when the shop is restored from a
  // backup, which tells every device to download everything again.
  await client.execute({ sql: "INSERT OR IGNORE INTO meta (key, value) VALUES ('epoch', ?)", args: [crypto.randomUUID()] });
  rawClient = client;
  const base = adapter(client);
  return {
    ...base,
    tx<T>(fn: (db: Db) => Promise<T>) {
      return serial(async () => {
        const tx = await client.transaction("write");
        try {
          const result = await fn(adapter(tx));
          await tx.commit();
          return result;
        } catch (e) {
          await tx.rollback();
          throw e;
        } finally {
          tx.close();
        }
      });
    },
  };
}

/** Next value of the global change counter. Call inside a write transaction. */
export async function nextRev(db: Db): Promise<number> {
  const row = await db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'rev'");
  const rev = Number(row?.value ?? 0) + 1;
  await db.run("INSERT INTO meta (key, value) VALUES ('rev', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [String(rev)]);
  return rev;
}
