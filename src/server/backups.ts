import "server-only";
import { mkdir, readdir, rename, rm, stat } from "node:fs/promises";
import path from "node:path";
import { backupName, backupsToDelete } from "@/core/backup.ts";
import { isFileDatabase, serial, serverClient } from "./db.ts";

// Automatic copies of the server database, for a self-hosted (file) database.
// A copy is made at most once a day, the first time a device syncs that day,
// so nothing runs on a timer. Remote (Turso) databases are backed up by the
// provider instead (point-in-time restore).

export const BACKUP_DIR = process.env.BACKUP_DIR || path.join("data", "backups");

const localDay = (d = new Date()) =>
  `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;

let doneFor: string | null = null;
let running: Promise<void> | null = null;

async function writeCopy(day: string): Promise<void> {
  const client = await serverClient();
  const users = await client.execute("SELECT COUNT(*) AS n FROM users");
  if (!Number(users.rows[0]?.n ?? 0)) return; // nothing to keep yet
  await mkdir(/*turbopackIgnore: true*/ BACKUP_DIR, { recursive: true });
  const target = path.join(/*turbopackIgnore: true*/ BACKUP_DIR, backupName(day));
  const tmp = `${target}.tmp`;
  await rm(/*turbopackIgnore: true*/ tmp, { force: true });
  // VACUUM INTO writes a consistent, compact copy without stopping the shop.
  // It runs in the write queue so no change lands half-way through.
  await serial(() => client.execute(`VACUUM INTO '${tmp.replace(/'/g, "''")}'`));
  await rename(/*turbopackIgnore: true*/ tmp, target); // a copy is either complete or absent
  const names = await readdir(/*turbopackIgnore: true*/ BACKUP_DIR);
  for (const old of backupsToDelete(names)) await rm(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ BACKUP_DIR, old), { force: true });
}

/** Make today's copy if it hasn't been made yet. Cheap to call on every sync. */
export function backupIfDue(): Promise<void> {
  if (!isFileDatabase()) return Promise.resolve();
  const day = localDay();
  if (doneFor === day) return Promise.resolve();
  running ??= (async () => {
    try {
      const names = await readdir(/*turbopackIgnore: true*/ BACKUP_DIR).catch(() => [] as string[]);
      if (!names.includes(backupName(day))) await writeCopy(day);
      doneFor = day;
    } catch (e) {
      console.error("server backup failed", e);
    } finally {
      running = null;
    }
  })();
  return running;
}

/** Make (or refresh) today's copy right now. */
export async function backupNow(): Promise<void> {
  if (!isFileDatabase()) return;
  await writeCopy(localDay());
  doneFor = localDay();
}

export interface ServerBackupStatus {
  mode: "file" | "remote";
  copies: { name: string; size: number; at: string }[];
}

export async function backupStatus(): Promise<ServerBackupStatus> {
  if (!isFileDatabase()) return { mode: "remote", copies: [] };
  const names = (await readdir(/*turbopackIgnore: true*/ BACKUP_DIR).catch(() => [] as string[])).filter((n) => /^barbershop-\d{4}-\d{2}-\d{2}\.db$/.test(n));
  const copies = await Promise.all(
    names.map(async (name) => {
      const s = await stat(/*turbopackIgnore: true*/ path.join(/*turbopackIgnore: true*/ BACKUP_DIR, name));
      return { name, size: s.size, at: s.mtime.toISOString() };
    }),
  );
  return { mode: "file", copies: copies.sort((a, b) => b.name.localeCompare(a.name)) };
}

/** Path of a named copy, or null if the name isn't one of ours. */
export function backupPath(name: string): string | null {
  return /^barbershop-\d{4}-\d{2}-\d{2}\.db$/.test(name) ? path.join(/*turbopackIgnore: true*/ BACKUP_DIR, name) : null;
}
