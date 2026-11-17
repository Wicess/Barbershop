"use client";

import { createContext, useCallback, useContext, useEffect, useRef, useState, type ReactNode } from "react";
import { CommandError, type Actor, type CommandType, type Payloads } from "@/core/commands.ts";
import { tMessage } from "@/core/i18n.ts";
import type { Db } from "@/core/db.ts";
import { can as canRole, roleOptions, type Permission } from "@/core/permissions.ts";
import { DEFAULT_SETTINGS, loadSettings, type Settings } from "@/core/settings.ts";
import type { Engine, SyncState } from "./engine.ts";
import { haptic } from "@/components/native.tsx";
import type { LocalStore } from "./localdb.ts";

export interface Toast {
  id: number;
  message: string;
  kind: "success" | "error" | "info";
}

interface AppValue {
  store: LocalStore;
  engine: Engine;
  user: Actor;
  settings: Settings;
  /** Increments whenever local data changes; queries re-run on it. */
  version: number;
  sync: SyncState;
  can(perm: Permission): boolean;
  /** Record a change. Returns true on success; shows an error toast otherwise. */
  run<K extends CommandType>(type: K, payload: Payloads[K], success?: string): Promise<boolean>;
  toast(message: string, kind?: Toast["kind"]): void;
  lock(): void;
}

const Ctx = createContext<AppValue | null>(null);

export function useApp(): AppValue {
  const v = useContext(Ctx);
  if (!v) throw new Error("useApp outside AppProvider");
  return v;
}

const LOCK_AFTER_MS = 15 * 60_000;

export function AppProvider(props: {
  store: LocalStore;
  engine: Engine;
  user: Actor;
  onLock: () => void;
  children: ReactNode;
}) {
  const { store, engine, user, onLock } = props;
  const [version, setVersion] = useState(0);
  const [settings, setSettings] = useState<Settings>(DEFAULT_SETTINGS);
  const [sync, setSync] = useState<SyncState>(engine.snapshot);
  const [toasts, setToasts] = useState<Toast[]>([]);
  const toastId = useRef(0);

  useEffect(() => store.onChange(() => setVersion((v) => v + 1)), [store]);
  useEffect(() => engine.subscribe(setSync), [engine]);
  useEffect(() => {
    void loadSettings(store).then(setSettings);
  }, [store, version]);

  // Lock the screen after a period without interaction.
  useEffect(() => {
    let timer = setTimeout(onLock, LOCK_AFTER_MS);
    const reset = () => {
      clearTimeout(timer);
      timer = setTimeout(onLock, LOCK_AFTER_MS);
    };
    const events = ["pointerdown", "keydown"] as const;
    events.forEach((e) => window.addEventListener(e, reset, { passive: true }));
    return () => {
      clearTimeout(timer);
      events.forEach((e) => window.removeEventListener(e, reset));
    };
  }, [onLock]);

  const toast = useCallback((message: string, kind: Toast["kind"] = "info") => {
    if (kind !== "info") haptic(kind);
    const id = ++toastId.current;
    setToasts((t) => [...t.slice(-2), { id, message, kind }]);
    setTimeout(() => setToasts((t) => t.filter((x) => x.id !== id)), kind === "error" ? 6000 : 3500);
  }, []);

  const can = useCallback(
    (perm: Permission) => canRole(user.role, perm, roleOptions(settings)),
    [user.role, settings],
  );

  const run = useCallback(
    async <K extends CommandType>(type: K, payload: Payloads[K], success?: string) => {
      try {
        await engine.execute(type, payload, user);
        if (success) toast(success, "success");
        return true;
      } catch (e) {
        // Errors arrive in English from the commands and the server; show them in the person's language.
        toast(tMessage(e instanceof CommandError ? e.message : "Something went wrong. Please try again."), "error");
        if (!(e instanceof CommandError)) console.error(e);
        return false;
      }
    },
    [engine, user, toast],
  );

  const value: AppValue = { store, engine, user, settings, version, sync, can, run, toast, lock: onLock };

  return (
    <Ctx.Provider value={value}>
      {props.children}
      <div
        className="no-print pointer-events-none fixed inset-x-0 top-[calc(env(safe-area-inset-top)+0.5rem)] z-[100] flex flex-col items-center gap-2 px-4"
        aria-live="polite"
      >
        {toasts.map((t) => (
          <div
            key={t.id}
            role={t.kind === "error" ? "alert" : "status"}
            className={`animate-toast-in pointer-events-auto max-w-md rounded-full px-5 py-3 text-sm font-semibold shadow-xl ${
              t.kind === "error"
                ? "bg-negative text-white dark:text-black"
                : t.kind === "success"
                  ? "bg-positive text-white dark:text-black"
                  : "bg-primary text-on-primary"
            }`}
          >
            {t.message}
          </div>
        ))}
      </div>
    </Ctx.Provider>
  );
}

/** Run a read against the local database, re-running whenever data changes. */
export function useQuery<T>(fn: (db: Db) => Promise<T>, deps: unknown[] = []): { data: T | undefined; loading: boolean } {
  const { store, version } = useApp();
  const [state, setState] = useState<{ data: T | undefined; loading: boolean }>({ data: undefined, loading: true });
  useEffect(() => {
    let alive = true;
    fn(store)
      .then((data) => alive && setState({ data, loading: false }))
      .catch((e) => {
        console.error(e);
        if (alive) setState((s) => ({ ...s, loading: false }));
      });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [store, version, ...deps]);
  return state;
}
