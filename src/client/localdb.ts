"use client";

// The device's own SQLite database (sql.js, compiled to WebAssembly). It holds
// a full copy of the shop's data so the app keeps working with no internet.
// The file is saved to IndexedDB after every change.

import type { Database, SqlJsStatic } from "sql.js";
import type { Db, Row, Store } from "@/core/db.ts";
import { TABLE_NAMES, columnsOf, missingColumnStatements, schemaStatements, type TableName } from "@/core/schema.ts";

declare global {
  interface Window {
    initSqlJs?: (config: { locateFile: (file: string) => string }) => Promise<SqlJsStatic>;
  }
}

const IDB_NAME = "barbershop-manager";
const IDB_STORE = "files";
const MAIN = "main.sqlite";
const SNAP = "snap:"; // snap:YYYY-MM-DD, one a day, the last KEEP_DAILY kept
const ARCHIVE = "archive:"; // archive:<iso>, made before this device's copy is ever erased
const BROKEN = "broken:"; // broken:<iso>, a damaged file kept for inspection
const KEEP_DAILY = 7;
const KEEP_ARCHIVES = 5;

function loadScript(src: string): Promise<void> {
  return new Promise((resolve, reject) => {
    if (typeof window.initSqlJs === "function") return resolve();
    const s = document.createElement("script");
    s.src = src;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error("Could not load the offline database engine."));
    document.head.appendChild(s);
  });
}

let idbPromise: Promise<IDBDatabase> | null = null;
function idb(): Promise<IDBDatabase> {
  idbPromise ??= new Promise((resolve, reject) => {
    const req = indexedDB.open(IDB_NAME, 1);
    req.onupgradeneeded = () => req.result.createObjectStore(IDB_STORE);
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => {
      idbPromise = null;
      reject(req.error);
    };
  });
  return idbPromise;
}

async function readFile(key: string): Promise<Uint8Array | null> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).get(key);
    req.onsuccess = () => resolve((req.result as Uint8Array | undefined) ?? null);
    req.onerror = () => reject(req.error);
  });
}

/** Write (or with null, delete) files in one IndexedDB transaction: all of it lands, or none. */
async function writeFiles(entries: [string, Uint8Array | null][]): Promise<void> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const tx = db.transaction(IDB_STORE, "readwrite", { durability: "strict" } as IDBTransactionOptions);
    const store = tx.objectStore(IDB_STORE);
    for (const [key, data] of entries) {
      if (data) store.put(data, key);
      else store.delete(key);
    }
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
    tx.onabort = () => reject(tx.error ?? new Error("Save was interrupted."));
  });
}

async function fileKeys(): Promise<string[]> {
  const db = await idb();
  return new Promise((resolve, reject) => {
    const req = db.transaction(IDB_STORE).objectStore(IDB_STORE).getAllKeys();
    req.onsuccess = () => resolve((req.result as IDBValidKey[]).map(String));
    req.onerror = () => reject(req.error);
  });
}

const today = () => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
};

export interface StorageHealth {
  /** Why the last save on this device failed, or null when saving works. */
  saveError: string | null;
  lastSavedAt: string | null;
  /** Whether the browser promised not to clear this app's data when space runs low. */
  persisted: boolean | null;
  /** Set when the saved file was damaged and an older copy was loaded instead. */
  recoveredFrom: string | null;
}

export interface SavedCopy {
  key: string;
  kind: "daily" | "archive";
  /** YYYY-MM-DD for daily copies, an ISO time for archives. */
  label: string;
  size: number;
}

export interface LocalStore extends Store {
  /** Save the database file now. Saves run one at a time and retry on failure. */
  flush(): Promise<void>;
  /** A copy of the whole database file, for a backup download. */
  exportFile(): Uint8Array;
  /** Keep a copy of this device's data as it is now, as an archive. */
  archiveNow(): Promise<void>;
  /** Erase this device's copy. An archive copy is kept first unless `archive` is false. */
  wipe(opts?: { archive?: boolean }): Promise<void>;
  /** Fires after any committed write. */
  onChange(fn: () => void): () => void;
  health(): StorageHealth;
  onHealth(fn: (h: StorageHealth) => void): () => void;
  /** Daily copies and archives kept on this device, newest first. */
  savedCopies(): Promise<SavedCopy[]>;
  readCopy(key: string): Promise<Uint8Array | null>;
  deleteCopy(key: string): Promise<void>;
}

/** Open a database file and check it is intact. Returns null for a damaged or unreadable file. */
function tryOpen(SQL: SqlJsStatic, bytes: Uint8Array): Database | null {
  try {
    const db = new SQL.Database(bytes);
    const r = db.exec("PRAGMA quick_check");
    if (r[0]?.values[0]?.[0] === "ok") return db;
    db.close();
  } catch {
    /* damaged */
  }
  return null;
}

/** Which daily copies to delete: everything but the newest `keep`. */
export function staleDailyCopies(keys: string[], keep = KEEP_DAILY): string[] {
  return keys.filter((k) => k.startsWith(SNAP)).sort().reverse().slice(keep);
}

let sqlModule: Promise<SqlJsStatic> | null = null;
/** The SQLite engine (WebAssembly), loaded once. */
export function sqlEngine(): Promise<SqlJsStatic> {
  sqlModule ??= loadScript("/sqljs/sql-wasm.js").then(() => window.initSqlJs!({ locateFile: (f) => `/sqljs/${f}` }));
  return sqlModule;
}

export interface BackupSummary {
  shopName: string | null;
  currency: string | null;
  sales: number;
  lastSaleDate: string | null;
  staff: number;
  owners: { id: string; name: string; pin_hash: string; pin_salt: string }[];
  /** Changes that were made on that device but never reached the server. */
  unsent: { id: string; body: string; created_at: string }[];
  /** The server change number this copy had caught up to. */
  syncedUpTo: number;
}

function rowsOf(d: Database, sql: string, params: unknown[] = []): Record<string, unknown>[] {
  const stmt = d.prepare(sql);
  try {
    stmt.bind(params as never);
    const out: Record<string, unknown>[] = [];
    while (stmt.step()) out.push(stmt.getAsObject());
    return out;
  } finally {
    stmt.free();
  }
}

/** Open a backup file (or a saved copy) and describe it. Throws if it isn't a readable shop backup. */
export async function inspectBackup(bytes: Uint8Array): Promise<BackupSummary> {
  const SQL = await sqlEngine();
  const d = tryOpen(SQL, bytes);
  if (!d) throw new Error("This file is damaged or is not a backup from this app.");
  try {
    const has = (t: string) => rowsOf(d, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [t]).length > 0;
    if (!has("sales") || !has("users") || !has("settings")) throw new Error("This file is not a backup from this app.");
    const setting = (k: string) => {
      const v = rowsOf(d, "SELECT value FROM settings WHERE id = ?", [k])[0]?.value;
      try {
        return v == null ? null : String(JSON.parse(String(v)));
      } catch {
        return v == null ? null : String(v);
      }
    };
    const sales = rowsOf(d, "SELECT COUNT(*) AS n, MAX(business_date) AS last FROM sales WHERE status = 'completed'")[0];
    return {
      shopName: setting("shop_name"),
      currency: setting("currency"),
      sales: Number(sales?.n ?? 0),
      lastSaleDate: (sales?.last as string | null) ?? null,
      staff: Number(rowsOf(d, "SELECT COUNT(*) AS n FROM staff")[0]?.n ?? 0),
      owners: rowsOf(d, "SELECT id, name, pin_hash, pin_salt FROM users WHERE role = 'owner' AND active = 1") as BackupSummary["owners"],
      unsent: has("outbox")
        ? (rowsOf(d, "SELECT id, body, created_at FROM outbox WHERE status = 'pending' ORDER BY seq") as BackupSummary["unsent"])
        : [],
      syncedUpTo: has("meta") ? Number(rowsOf(d, "SELECT value FROM meta WHERE key = 'cursor'")[0]?.value ?? 0) : 0,
    };
  } finally {
    d.close();
  }
}

/** Every synced row in a backup file, table by table (only known columns). */
export async function backupTables(bytes: Uint8Array): Promise<Record<TableName, Row[]>> {
  const SQL = await sqlEngine();
  const d = tryOpen(SQL, bytes);
  if (!d) throw new Error("This file is damaged.");
  try {
    const out = {} as Record<TableName, Row[]>;
    for (const t of TABLE_NAMES) {
      const exists = rowsOf(d, "SELECT name FROM sqlite_master WHERE type = 'table' AND name = ?", [t]).length > 0;
      if (!exists) {
        out[t] = [];
        continue;
      }
      const have = new Set(rowsOf(d, `PRAGMA table_info(${t})`).map((c) => String(c.name)));
      const cols = [...columnsOf(t), "rev"].filter((c) => have.has(c));
      out[t] = rowsOf(d, `SELECT ${cols.join(", ")} FROM ${t}`) as Row[];
    }
    return out;
  } finally {
    d.close();
  }
}

export async function openLocalStore(): Promise<LocalStore> {
  const SQL = await sqlEngine();

  const health: StorageHealth = { saveError: null, lastSavedAt: null, persisted: null, recoveredFrom: null };
  const healthListeners = new Set<(h: StorageHealth) => void>();
  const setHealth = (patch: Partial<StorageHealth>) => {
    Object.assign(health, patch);
    healthListeners.forEach((fn) => fn({ ...health }));
  };

  // Ask the browser not to clear our data when the phone runs low on space.
  void (async () => {
    try {
      const persisted = (await navigator.storage?.persisted?.()) || (await navigator.storage?.persist?.()) || false;
      setHealth({ persisted });
    } catch {
      setHealth({ persisted: false });
    }
  })();

  // Load the saved file; if it is damaged, fall back to the newest good daily copy.
  // Anything newer than that copy comes back from the server on the next sync.
  const saved = await readFile(MAIN).catch(() => null);
  let sqlite: Database | null = saved ? tryOpen(SQL, saved) : new SQL.Database();
  if (!sqlite) {
    const copies = (await fileKeys().catch(() => [] as string[])).filter((k) => k.startsWith(SNAP)).sort().reverse();
    for (const key of copies) {
      const bytes = await readFile(key).catch(() => null);
      sqlite = bytes ? tryOpen(SQL, bytes) : null;
      if (sqlite) {
        health.recoveredFrom = key.slice(SNAP.length);
        break;
      }
    }
    await writeFiles([[`${BROKEN}${new Date().toISOString()}`, saved]]).catch(() => undefined);
    if (!sqlite) {
      sqlite = new SQL.Database();
      health.recoveredFrom = "server";
    }
  }
  let db: Database = sqlite;
  migrate(db);

  const listeners = new Set<() => void>();
  let dirty = !!health.recoveredFrom;
  let saveTimer: ReturnType<typeof setTimeout> | null = null;
  let retryTimer: ReturnType<typeof setTimeout> | null = null;
  let txDepth = 0;
  let lock: Promise<unknown> = Promise.resolve();
  let saving: Promise<void> = Promise.resolve();
  let snapDay: string | null = null;

  const save = async () => {
    if (!dirty) return;
    dirty = false;
    const bytes = db.export();
    try {
      const entries: [string, Uint8Array | null][] = [[MAIN, bytes]];
      // Once a day, the same bytes also go into a dated copy (same transaction).
      const day = today();
      if (snapDay !== day) {
        const keys = await fileKeys();
        if (!keys.includes(`${SNAP}${day}`)) {
          entries.push([`${SNAP}${day}`, bytes]);
          for (const k of staleDailyCopies([...keys, `${SNAP}${day}`])) entries.push([k, null]);
        }
      }
      await writeFiles(entries);
      snapDay = day;
      if (retryTimer) clearTimeout(retryTimer);
      retryTimer = null;
      setHealth({ saveError: null, lastSavedAt: new Date().toISOString() });
    } catch (e) {
      dirty = true;
      const quota = e instanceof DOMException && e.name === "QuotaExceededError";
      setHealth({
        saveError: quota
          ? "This device is out of storage space. Free up space; until then, changes are only kept while the app stays open."
          : "Saving on this device failed. Keep the app open; it will try again.",
      });
      retryTimer ??= setTimeout(() => {
        retryTimer = null;
        void flush();
      }, 5000);
    }
  };

  // Saves never overlap: each waits for the one before. A caller that awaits
  // flush() knows everything written before the call is on disk (or that
  // saving failed, which `health` reports).
  const flush = () => {
    saving = saving.then(save, save);
    return saving;
  };

  const changed = () => {
    dirty = true;
    if (saveTimer) clearTimeout(saveTimer);
    saveTimer = setTimeout(() => void flush(), 250);
    if (txDepth === 0) listeners.forEach((fn) => fn());
  };

  const query = <T>(sql: string, params: unknown[] = []): T[] => {
    const stmt = db.prepare(sql);
    try {
      stmt.bind(params as never);
      const rows: T[] = [];
      while (stmt.step()) rows.push(stmt.getAsObject() as T);
      return rows;
    } finally {
      stmt.free();
    }
  };

  const base: Db = {
    async all<T = Row>(sql: string, params?: unknown[]) {
      return query<T>(sql, params);
    },
    async get<T = Row>(sql: string, params?: unknown[]) {
      return query<T>(sql, params)[0];
    },
    async run(sql: string, params: unknown[] = []) {
      db.run(sql, params as never);
      if (txDepth === 0) changed();
    },
  };

  document.addEventListener("visibilitychange", () => {
    if (document.visibilityState === "hidden") void flush();
  });
  window.addEventListener("pagehide", () => void flush());
  if (health.recoveredFrom) void flush();

  return {
    ...base,
    tx<T>(fn: (db: Db) => Promise<T>): Promise<T> {
      const run = async () => {
        db.run("BEGIN");
        txDepth++;
        try {
          const result = await fn(base);
          db.run("COMMIT");
          return result;
        } catch (e) {
          db.run("ROLLBACK");
          throw e;
        } finally {
          txDepth--;
          changed();
        }
      };
      const next = lock.then(run, run);
      lock = next.catch(() => undefined);
      return next;
    },
    flush,
    exportFile() {
      return db.export();
    },
    async archiveNow() {
      await flush();
      const keys = await fileKeys().catch(() => [] as string[]);
      const entries: [string, Uint8Array | null][] = [[`${ARCHIVE}${new Date().toISOString()}`, db.export()]];
      for (const k of keys.filter((k) => k.startsWith(ARCHIVE)).sort().reverse().slice(KEEP_ARCHIVES - 1)) entries.push([k, null]);
      await writeFiles(entries);
    },
    async wipe(opts = {}) {
      await flush();
      const keys = await fileKeys().catch(() => [] as string[]);
      const entries: [string, Uint8Array | null][] = [[MAIN, null]];
      if (opts.archive !== false) {
        entries.push([`${ARCHIVE}${new Date().toISOString()}`, db.export()]);
        const archives = keys.filter((k) => k.startsWith(ARCHIVE)).sort().reverse();
        for (const k of archives.slice(KEEP_ARCHIVES - 1)) entries.push([k, null]);
      }
      // Daily copies belong to the old data; drop them so they can't be mistaken for this shop's later.
      for (const k of keys.filter((k) => k.startsWith(SNAP))) entries.push([k, null]);
      await writeFiles(entries);
      db.close();
      db = new SQL.Database();
      migrate(db);
      dirty = false;
      snapDay = null;
      listeners.forEach((fn) => fn());
    },
    onChange(fn) {
      listeners.add(fn);
      return () => listeners.delete(fn);
    },
    health: () => ({ ...health }),
    onHealth(fn) {
      healthListeners.add(fn);
      fn({ ...health });
      return () => healthListeners.delete(fn);
    },
    async savedCopies() {
      const keys = await fileKeys();
      const out: SavedCopy[] = [];
      for (const key of keys) {
        const kind = key.startsWith(SNAP) ? "daily" : key.startsWith(ARCHIVE) ? "archive" : null;
        if (!kind) continue;
        const bytes = await readFile(key);
        out.push({ key, kind, label: key.slice(kind === "daily" ? SNAP.length : ARCHIVE.length), size: bytes?.byteLength ?? 0 });
      }
      return out.sort((a, b) => b.label.localeCompare(a.label));
    },
    readCopy: (key) => readFile(key),
    async deleteCopy(key) {
      await writeFiles([[key, null]]);
    },
  };
}

export function migrate(db: Database) {
  for (const sql of schemaStatements()) db.run(sql);
  // Columns added in later versions.
  for (const t of TABLE_NAMES) {
    const have = new Set(rowsOf(db, `PRAGMA table_info(${t})`).map((c) => String(c.name)));
    for (const sql of missingColumnStatements(t, have)) db.run(sql);
  }
  db.run("CREATE TABLE IF NOT EXISTS meta (key TEXT PRIMARY KEY, value TEXT)");
  db.run(
    "CREATE TABLE IF NOT EXISTS outbox (seq INTEGER PRIMARY KEY AUTOINCREMENT, id TEXT UNIQUE, body TEXT, status TEXT DEFAULT 'pending', error TEXT, created_at TEXT)",
  );
}

export async function getMeta(db: Db, key: string): Promise<string | null> {
  const row = await db.get<{ value: string }>("SELECT value FROM meta WHERE key = ?", [key]);
  return row?.value ?? null;
}

export async function setMeta(db: Db, key: string, value: string | null): Promise<void> {
  if (value == null) await db.run("DELETE FROM meta WHERE key = ?", [key]);
  else await db.run("INSERT INTO meta (key, value) VALUES (?, ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [key, value]);
}
