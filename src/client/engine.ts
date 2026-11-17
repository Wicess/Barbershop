"use client";

import { applyCommand, type Actor, type Command, type CommandType, type Payloads } from "@/core/commands.ts";
import { upsert, type Row } from "@/core/db.ts";
import { TABLE_NAMES, type TableName } from "@/core/schema.ts";
import { getMeta, setMeta, type LocalStore } from "./localdb.ts";

export interface SyncState {
  status: "idle" | "syncing" | "offline" | "error";
  lastSyncAt: string | null;
  pending: number;
  rejected: number;
  error: string | null;
  /** When the oldest change still waiting to upload was made. */
  oldestPendingAt: string | null;
}

type Listener = (s: SyncState) => void;

const IDLE_AFTER_MS = 3 * 60_000;
const ACTIVE_SYNC_EVERY_MS = 60_000;

/**
 * Applies commands locally, queues them, and syncs with the server.
 *
 * Syncing only happens on events (a change, coming online, the tab being
 * focused) plus a one-minute heartbeat while someone is actually using the
 * screen. An idle or hidden tab never polls, so a dashboard left open all day
 * does not keep the server or its database awake.
 */
export class Engine {
  private state: SyncState = { status: "idle", lastSyncAt: null, pending: 0, rejected: 0, error: null, oldestPendingAt: null };
  private listeners = new Set<Listener>();
  private running: Promise<void> | null = null;
  private again = false;
  private debounce: ReturnType<typeof setTimeout> | null = null;
  private heartbeat: ReturnType<typeof setInterval> | null = null;
  private lastInteraction = Date.now();
  onDeviceRevoked: (() => void) | null = null;

  constructor(
    readonly store: LocalStore,
    readonly deviceId: string,
    readonly deviceCode: string,
  ) {}

  start(): () => void {
    const touch = () => {
      const wasIdle = Date.now() - this.lastInteraction > IDLE_AFTER_MS;
      this.lastInteraction = Date.now();
      if (wasIdle) void this.sync();
    };
    const onVisible = () => {
      if (document.visibilityState === "visible") touch();
    };
    const onOnline = () => void this.sync();
    const events = ["pointerdown", "keydown", "touchstart"] as const;
    events.forEach((e) => window.addEventListener(e, touch, { passive: true }));
    document.addEventListener("visibilitychange", onVisible);
    window.addEventListener("focus", touch);
    window.addEventListener("online", onOnline);
    window.addEventListener("offline", () => this.set({ status: "offline" }));
    this.heartbeat = setInterval(() => {
      const active = Date.now() - this.lastInteraction < IDLE_AFTER_MS;
      if (document.visibilityState === "visible" && active && navigator.onLine) void this.sync();
    }, ACTIVE_SYNC_EVERY_MS);
    void this.refreshCounts();
    void this.sync();
    return () => {
      events.forEach((e) => window.removeEventListener(e, touch));
      document.removeEventListener("visibilitychange", onVisible);
      window.removeEventListener("focus", touch);
      window.removeEventListener("online", onOnline);
      if (this.heartbeat) clearInterval(this.heartbeat);
    };
  }

  subscribe(fn: Listener): () => void {
    this.listeners.add(fn);
    fn(this.state);
    return () => this.listeners.delete(fn);
  }

  get snapshot(): SyncState {
    return this.state;
  }

  private set(patch: Partial<SyncState>) {
    this.state = { ...this.state, ...patch };
    this.listeners.forEach((fn) => fn(this.state));
  }

  /** Record a change on this device now; it reaches the server on the next sync. */
  async execute<K extends CommandType>(type: K, payload: Payloads[K], actor: Actor): Promise<Command> {
    const cmd: Command = {
      id: crypto.randomUUID(),
      type,
      payload,
      actor_id: actor.id,
      device_id: this.deviceId,
      at: new Date().toISOString(),
    };
    await this.store.tx(async (db) => {
      await applyCommand({ db, actor, deviceId: this.deviceId, rev: 0, cmd });
      await db.run("INSERT INTO outbox (id, body, created_at) VALUES (?, ?, ?)", [cmd.id, JSON.stringify(cmd), cmd.at]);
    });
    await this.store.flush();
    await this.refreshCounts();
    if (this.debounce) clearTimeout(this.debounce);
    this.debounce = setTimeout(() => void this.sync(), 1200);
    return cmd;
  }

  /** Next receipt number for this device, e.g. "A-00042". */
  async nextReceiptNo(): Promise<string> {
    const n = Number((await getMeta(this.store, "receipt_seq")) ?? 0) + 1;
    await setMeta(this.store, "receipt_seq", String(n));
    return `${this.deviceCode}-${String(n).padStart(5, "0")}`;
  }

  private async refreshCounts() {
    const rows = await this.store.all<{ status: string; n: number }>(
      "SELECT status, COUNT(*) AS n FROM outbox GROUP BY status",
    );
    const oldest = await this.store.get<{ at: string | null }>("SELECT MIN(created_at) AS at FROM outbox WHERE status = 'pending'");
    this.set({
      oldestPendingAt: oldest?.at ?? null,
      pending: Number(rows.find((r) => r.status === "pending")?.n ?? 0),
      rejected: Number(rows.find((r) => r.status === "rejected")?.n ?? 0),
    });
  }

  sync(): Promise<void> {
    if (this.running) {
      this.again = true;
      return this.running;
    }
    this.running = (async () => {
      do {
        this.again = false;
        await this.round();
      } while (this.again);
    })().finally(() => {
      this.running = null;
    });
    return this.running;
  }

  private async round() {
    if (typeof navigator !== "undefined" && !navigator.onLine) {
      this.set({ status: "offline" });
      return;
    }
    this.set({ status: "syncing", error: null });
    try {
      for (let guard = 0; guard < 50; guard++) {
        const outbox = await this.store.all<{ id: string; body: string }>(
          "SELECT id, body FROM outbox WHERE status = 'pending' ORDER BY seq LIMIT 100",
        );
        const cursor = Number((await getMeta(this.store, "cursor")) ?? 0);
        const res = await fetch("/api/sync", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          credentials: "same-origin",
          body: JSON.stringify({ cursor, commands: outbox.map((o) => JSON.parse(o.body)) }),
        });
        if (res.status === 401) {
          this.set({ status: "error", error: "This device was signed out." });
          this.onDeviceRevoked?.();
          return;
        }
        if (!res.ok) throw new Error(`Server error (${res.status})`);
        const data: {
          epoch: string | null;
          results: { id: string; ok: boolean; error?: string }[];
          changes: Partial<Record<TableName, Row[]>>;
          cursor: number;
          more: boolean;
        } = await res.json();

        let retryLater = false;

        // The server was restored from a backup: its data is a new generation.
        // Keep an archive of this device's copy, then download everything again.
        // Changes still waiting here stay queued and are sent as normal.
        const known = await getMeta(this.store, "epoch");
        if (data.epoch && known && known !== data.epoch) {
          await this.store.tx(async (db) => {
            for (const r of data.results) if (r.ok) await db.run("DELETE FROM outbox WHERE id = ?", [r.id]);
          });
          await this.store.archiveNow();
          await this.store.tx(async (db) => {
            for (const t of TABLE_NAMES) await db.run(`DELETE FROM ${t}`);
            await setMeta(db, "cursor", "0");
            await setMeta(db, "epoch", data.epoch);
            await setMeta(db, "reset_at", new Date().toISOString());
          });
          await this.store.flush();
          continue;
        }
        if (data.epoch && !known) await setMeta(this.store, "epoch", data.epoch);

        await this.store.tx(async (db) => {
          for (const r of data.results) {
            if (r.ok) await db.run("DELETE FROM outbox WHERE id = ?", [r.id]);
            else if (r.error === "RETRY") retryLater = true;
            else await db.run("UPDATE outbox SET status = 'rejected', error = ? WHERE id = ?", [r.error ?? "Rejected", r.id]);
          }
          for (const table of TABLE_NAMES) {
            for (const row of data.changes[table] ?? []) await upsert(db, table, row, Number(row.rev));
          }
          await setMeta(db, "cursor", String(data.cursor));
        });
        await this.store.flush();

        const pendingLeft = outbox.length === 100;
        if (retryLater) throw new Error("The server could not save some changes. Will retry.");
        if (!data.more && !pendingLeft) break;
      }
      await this.refreshCounts();
      this.set({ status: "idle", lastSyncAt: new Date().toISOString() });
    } catch (e) {
      await this.refreshCounts();
      // fetch() throws a TypeError when the server can't be reached at all
      // (e.g. Wi-Fi is up but there's no internet): that's "offline", not an error.
      const offline = (typeof navigator !== "undefined" && !navigator.onLine) || e instanceof TypeError;
      this.set({
        status: offline ? "offline" : "error",
        error: offline ? null : e instanceof Error ? e.message : "Sync failed",
      });
    }
  }

  /**
   * Queue changes recovered from an archive or a backup file so they are sent
   * to the server. The server applies each one at most once (by id) and checks
   * it like any other change.
   */
  async requeue(items: { id: string; body: string; created_at: string }[]): Promise<number> {
    let added = 0;
    await this.store.tx(async (db) => {
      for (const it of items) {
        const exists = await db.get("SELECT 1 AS x FROM outbox WHERE id = ?", [it.id]);
        if (exists) continue;
        await db.run("INSERT INTO outbox (id, body, created_at) VALUES (?, ?, ?)", [it.id, it.body, it.created_at]);
        added++;
      }
    });
    await this.store.flush();
    await this.refreshCounts();
    void this.sync();
    return added;
  }

  /** Changes the server refused, with the reason. */
  async rejected(): Promise<{ id: string; type: string; at: string; error: string }[]> {
    const rows = await this.store.all<{ id: string; body: string; error: string }>(
      "SELECT id, body, error FROM outbox WHERE status = 'rejected' ORDER BY seq",
    );
    return rows.map((r) => {
      const cmd = JSON.parse(r.body) as Command;
      return { id: r.id, type: cmd.type, at: cmd.at, error: r.error };
    });
  }

  /**
   * Throw away this device's copy and download everything again from the
   * server. Used to recover after the server refused a change.
   */
  async redownload(): Promise<void> {
    await this.store.archiveNow();
    await this.store.tx(async (db) => {
      for (const t of TABLE_NAMES) await db.run(`DELETE FROM ${t}`);
      await db.run("DELETE FROM outbox WHERE status = 'rejected'");
      await setMeta(db, "cursor", "0");
    });
    await this.store.flush();
    await this.sync();
  }

  static readDevice = async (store: LocalStore) => {
    const id = await getMeta(store, "device_id");
    const code = await getMeta(store, "device_code");
    return id && code ? { id, code } : null;
  };
}
