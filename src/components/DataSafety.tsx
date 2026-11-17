"use client";

import { useEffect, useState, useSyncExternalStore } from "react";
import { AlertTriangle, CloudUpload, HardDriveDownload, X } from "lucide-react";
import { useApp } from "@/client/app-context.tsx";
import { getMeta, setMeta, type StorageHealth } from "@/client/localdb.ts";
import { go } from "@/client/router.ts";
import { formatDate, formatDateTime } from "@/core/dates.ts";

const LAST_BACKUP = "bms_last_backup";
/** Changes waiting this long to upload get a visible warning. */
const STALE_PENDING_MS = 6 * 60 * 60_000;
/** Owners are reminded to keep their own copy this often. */
export const BACKUP_REMINDER_DAYS = 7;

export function useStorageHealth(): StorageHealth {
  const { store } = useApp();
  const [h, setH] = useState<StorageHealth>(() => store.health());
  useEffect(() => store.onHealth(setH), [store]);
  return h;
}

// When this device last downloaded a backup file (kept per browser).
const backupListeners = new Set<() => void>();
export function lastBackupAt(): string | null {
  try {
    return localStorage.getItem(LAST_BACKUP);
  } catch {
    return null;
  }
}
export function markBackedUp() {
  try {
    localStorage.setItem(LAST_BACKUP, new Date().toISOString());
  } catch {
    /* private mode */
  }
  backupListeners.forEach((fn) => fn());
}
export function useLastBackup(): string | null {
  return useSyncExternalStore(
    (fn) => {
      backupListeners.add(fn);
      return () => backupListeners.delete(fn);
    },
    lastBackupAt,
    () => null,
  );
}

/** Save a file: on phones, offer the share sheet (Drive, email, WhatsApp…); otherwise download it. */
export async function saveFile(name: string, data: BlobPart, type: string, preferShare = false): Promise<"shared" | "downloaded" | "cancelled"> {
  const blob = new Blob([data], { type });
  if (preferShare) {
    try {
      const file = new File([blob], name, { type });
      if (navigator.canShare?.({ files: [file] })) {
        await navigator.share({ files: [file], title: name });
        return "shared";
      }
    } catch (e) {
      if (e instanceof DOMException && e.name === "AbortError") return "cancelled";
    }
  }
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 5000);
  return "downloaded";
}

export function canShareFiles(): boolean {
  try {
    return typeof navigator !== "undefined" && !!navigator.canShare?.({ files: [new File([""], "x.sqlite")] });
  } catch {
    return false;
  }
}

/**
 * Warnings that must not be missed: saving on this device failed, the saved
 * copy was damaged and recovered, or changes have been waiting a long time to
 * reach the server.
 */
export function DataSafetyBanner() {
  const { sync, store, user } = useApp();
  const health = useStorageHealth();
  const [resetAt, setResetAt] = useState<string | null>(null);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    void getMeta(store, "reset_at").then(setResetAt);
  }, [store, sync.lastSyncAt]);

  const stale = sync.pending > 0 && sync.oldestPendingAt && Date.now() - Date.parse(sync.oldestPendingAt) > STALE_PENDING_MS;

  if (health.saveError) {
    return (
      <Banner tone="negative" icon={<AlertTriangle className="size-5" />} title="Not saved on this device">
        {health.saveError}
        {sync.status === "idle" && sync.pending === 0 && " Everything has reached the server, so nothing is lost."}
      </Banner>
    );
  }
  if (stale) {
    return (
      <Banner tone="warning" icon={<CloudUpload className="size-5" />} title={`${sync.pending} change${sync.pending === 1 ? "" : "s"} only on this device`}>
        Waiting since {formatDateTime(sync.oldestPendingAt!)}. They are saved here, but connect to the internet soon so they are also kept safely on the
        server. Don&apos;t clear this browser&apos;s data or uninstall the app until they upload.
      </Banner>
    );
  }
  if (!dismissed && (health.recoveredFrom || resetAt)) {
    return (
      <Banner
        tone="warning"
        icon={<HardDriveDownload className="size-5" />}
        title={health.recoveredFrom ? "This device's copy was repaired" : "The shop was restored from a backup"}
        onClose={async () => {
          setDismissed(true);
          if (resetAt) await setMeta(store, "reset_at", null);
        }}
        action={user.role === "owner" ? { label: "See backups", onClick: () => go("/backup") } : undefined}
      >
        {health.recoveredFrom
          ? health.recoveredFrom === "server"
            ? "The saved file was damaged, so everything is being downloaded again from the server."
            : `The saved file was damaged, so the copy from ${formatDate(health.recoveredFrom, { weekday: "long", day: "numeric", month: "short" })} was loaded and newer changes are coming back from the server.`
          : "This device downloaded the restored data. Its previous copy was kept as an archive under Backup & export."}
      </Banner>
    );
  }
  return null;
}

function Banner({
  tone, icon, title, children, onClose, action,
}: {
  tone: "negative" | "warning";
  icon: React.ReactNode;
  title: string;
  children: React.ReactNode;
  onClose?: () => void;
  action?: { label: string; onClick: () => void };
}) {
  return (
    <div
      role={tone === "negative" ? "alert" : "status"}
      className={
        tone === "negative"
          ? "mb-4 flex gap-3 rounded-2xl border border-negative/40 bg-negative-soft p-4 text-sm"
          : "mb-4 flex gap-3 rounded-2xl border border-warning/40 bg-warning-soft p-4 text-sm"
      }
    >
      <span className={tone === "negative" ? "text-negative" : "text-warning"}>{icon}</span>
      <div className="min-w-0 flex-1">
        <div className="font-semibold">{title}</div>
        <div className="mt-0.5 text-ink-2">{children}</div>
        {action && (
          <button onClick={action.onClick} className="mt-2 min-h-9 cursor-pointer font-semibold text-accent">
            {action.label}
          </button>
        )}
      </div>
      {onClose && (
        <button onClick={onClose} aria-label="Dismiss" className="-m-2 flex size-10 shrink-0 cursor-pointer items-center justify-center text-ink-3">
          <X className="size-4" />
        </button>
      )}
    </div>
  );
}
