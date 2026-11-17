"use client";

import { useCallback, useEffect, useState } from "react";
import {
  AlertTriangle, Archive, CheckCircle2, CloudUpload, DatabaseBackup, Download, FileSpreadsheet, HardDrive, Loader2, Server, Share2, ShieldCheck,
} from "lucide-react";
import { useApp } from "@/client/app-context.tsx";
import { inspectBackup, type SavedCopy } from "@/client/localdb.ts";
import { setParams } from "@/client/router.ts";
import { formatDate, formatDateTime, presetPeriod, toBusinessDate } from "@/core/dates.ts";
import { EXPORTS, buildExport, type ExportKind } from "@/core/exports.ts";
import { locale, plural, t, tk, tMessage } from "@/core/i18n.ts";
import {
  BACKUP_REMINDER_DAYS, canShareFiles, markBackedUp, saveFile, useLastBackup, useStorageHealth,
} from "@/components/DataSafety.tsx";
import { Button, Card, Chip, PinPad, PageHeader, SectionTitle, Sheet, cx } from "@/components/ui.tsx";

const PERIODS = [["today", tk("Today")], ["week", tk("This week")], ["month", tk("This month")], ["lastMonth", tk("Last month")]] as const;
type PeriodKey = (typeof PERIODS)[number][0];

interface ServerCopies {
  mode: "file" | "remote";
  copies: { name: string; size: number; at: string }[];
}

const kb = (n: number) =>
  n > 1024 * 1024
    ? t("{n} MB", { n: (n / 1024 / 1024).toLocaleString(locale(), { maximumFractionDigits: 1 }) })
    : t("{n} KB", { n: Math.max(1, Math.round(n / 1024)) });

/** Everything about keeping the shop's data safe, plus spreadsheet exports. */
export function BackupView({ params }: { params: URLSearchParams }) {
  const { store, settings, can, toast } = useApp();
  const owner = can("settings.manage");
  const key = (PERIODS.some(([k]) => k === params.get("p")) ? params.get("p") : "month") as PeriodKey;
  const period = presetPeriod(key);
  const [busy, setBusy] = useState<string | null>(null);
  const slug = settings.shop_name.toLowerCase().replace(/[^a-z0-9]+/g, "-").replace(/^-|-$/g, "") || "barbershop";
  const share = canShareFiles();

  const exportCsv = async (kind: ExportKind) => {
    setBusy(kind.id);
    try {
      const csv = await buildExport(store, kind.id, period.from, period.to, settings.currency, (iso) => toBusinessDate(new Date(iso)));
      const range = kind.id === "clients" ? toBusinessDate() : kind.id === "payroll" ? period.from.slice(0, 7) : `${period.from}_to_${period.to}`;
      // The byte-order mark makes Excel read the file as UTF-8.
      await saveFile(`${slug}-${kind.id}-${range}.csv`, "﻿" + csv, "text/csv;charset=utf-8");
      toast(t("{name} downloaded", { name: t(kind.label) }));
    } catch {
      toast(t("Could not create the file"), "error");
    } finally {
      setBusy(null);
    }
  };

  const backup = async (viaShare: boolean) => {
    setBusy(viaShare ? "share" : "backup");
    try {
      await store.flush();
      const result = await saveFile(`${slug}-backup-${toBusinessDate()}.sqlite`, store.exportFile() as BlobPart, "application/vnd.sqlite3", viaShare);
      if (result !== "cancelled") {
        markBackedUp();
        toast(result === "shared" ? t("Backup shared") : t("Backup downloaded"));
      }
    } finally {
      setBusy(null);
    }
  };

  return (
    <div className="mx-auto max-w-2xl lg:max-w-none">
      <PageHeader title={t("Backup & export")} subtitle={t("Where your data is kept, and how to take a copy")} />

      {/* Desktop: safety and your own copy on the left; spreadsheets and stored copies on the right. */}
      <div className="lg:grid lg:grid-cols-2 lg:grid-rows-[auto_1fr] lg:items-start lg:gap-x-8">
        <div className="lg:col-start-1 lg:row-start-1">
          <SafetyChecklist />
        </div>

        {owner && (
          <div className="lg:col-start-1 lg:row-start-2">
            <SectionTitle>{t("Your own copy")}</SectionTitle>
            <Card className="p-4">
              <div className="flex items-start gap-3">
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-accent-soft text-accent">
                  <DatabaseBackup className="size-5" />
                </span>
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">{t("Everything in one file")}</div>
                  <p className="mt-0.5 text-sm text-ink-3">
                    {t("Sales, staff, expenses, pay, clients and the activity log. Keep it off this phone, in Google Drive, email or on a USB stick. If the server is ever lost, this file rebuilds the whole shop.")}
                  </p>
                </div>
              </div>
              <div className={cx("mt-4 grid gap-2", share && "grid-cols-2")}>
                {share && (
                  <Button loading={busy === "share"} disabled={!!busy && busy !== "share"} onClick={() => backup(true)}>
                    <Share2 className="size-4" /> {t("Save to Drive / send")}
                  </Button>
                )}
                <Button variant={share ? "secondary" : "primary"} loading={busy === "backup"} disabled={!!busy && busy !== "backup"} onClick={() => backup(false)}>
                  <Download className="size-4" /> {t("Download")}
                </Button>
              </div>
            </Card>
          </div>
        )}

        <div className="lg:col-start-2 lg:row-span-2 lg:row-start-1 lg:[&>:first-child]:mt-0">
          <SectionTitle>{t("Spreadsheets (Excel, Google Sheets)")}</SectionTitle>
          <div className="chip-scroll -mx-4 mb-3 flex gap-2 overflow-x-auto px-4 pb-1 lg:mx-0 lg:flex-wrap lg:overflow-visible lg:px-0">
            {PERIODS.map(([k, label]) => (
              <Chip key={k} active={key === k} onClick={() => setParams({ p: k })}>{t(label)}</Chip>
            ))}
          </div>
          <Card className="divide-y divide-line">
            {EXPORTS.map((e) => (
              <button
                key={e.id}
                disabled={!!busy}
                onClick={() => exportCsv(e)}
                className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left transition-colors hover:bg-surface-2 disabled:cursor-wait"
              >
                <span className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2">
                  <FileSpreadsheet className="size-5" />
                </span>
                <span className="min-w-0 flex-1">
                  <span className="block font-semibold">{t(e.label)}</span>
                  <span className="block text-xs text-ink-3">
                    {t(e.description)}
                    {e.id === "payroll" ? ` · ${key === "lastMonth" ? period.label : t("this month")}` : e.id === "clients" ? ` · ${t("everyone")}` : ""}
                  </span>
                </span>
                {busy === e.id ? <Loader2 className="size-4 shrink-0 animate-spin text-ink-3" /> : <Download className="size-4 shrink-0 text-ink-3" />}
              </button>
            ))}
          </Card>
          <p className="mt-2 text-xs text-ink-3">{t("Amounts are in {currency}. Files are made on this device, so this works offline.", { currency: settings.currency })}</p>

          {owner && <DeviceCopies slug={slug} />}
          {owner && <ServerCopiesSection />}
        </div>
      </div>
    </div>
  );
}

// ---------- the checklist ----------

type Check = { ok: boolean | null; icon: React.ReactNode; title: string; detail: React.ReactNode; action?: React.ReactNode };

function useServerCopies() {
  const [state, setState] = useState<ServerCopies | "offline" | null>(null);
  const load = useCallback(async () => {
    try {
      const res = await fetch("/api/backup", { credentials: "same-origin" });
      setState(res.ok ? await res.json() : "offline");
    } catch {
      setState("offline");
    }
  }, []);
  useEffect(() => {
    void load();
  }, [load]);
  return { state, reload: load, setState };
}

function SafetyChecklist() {
  const { sync, can, engine } = useApp();
  const health = useStorageHealth();
  const last = useLastBackup();
  const { state: server, setState } = useServerCopies();
  const [busy, setBusy] = useState(false);
  const owner = can("settings.manage");
  const backupDays = last ? (Date.now() - Date.parse(last)) / 86400000 : Infinity;

  const checks: Check[] = [
    {
      ok: !health.saveError,
      icon: <HardDrive className="size-5" />,
      title: t("Saved on this device"),
      detail: health.saveError
        ? tMessage(health.saveError)
        : health.lastSavedAt
          ? t("Last saved {when}. Works with no internet.", { when: formatDateTime(health.lastSavedAt) })
          : t("Every change is saved here first, even offline."),
    },
    {
      ok: health.persisted,
      icon: <ShieldCheck className="size-5" />,
      title: health.persisted ? t("Protected from clean-up") : t("Not yet protected from clean-up"),
      detail: health.persisted
        ? t("The browser has promised not to delete this app's data when space runs low.")
        : t("The browser could clear this app's data if the phone runs very low on space. Add the app to the home screen (Install), then tap Protect."),
      action: !health.persisted && (
        <Button size="sm" variant="secondary" onClick={async () => {
          const ok = await navigator.storage?.persist?.().catch(() => false);
          if (ok) location.reload();
        }}>{t("Protect")}</Button>
      ),
    },
    {
      ok: sync.pending === 0 && sync.rejected === 0,
      icon: <CloudUpload className="size-5" />,
      title: sync.pending === 0 ? t("Everything is on the server") : plural(sync.pending, "{n} change waiting to upload", "{n} changes waiting to upload"),
      detail:
        sync.rejected > 0
          ? plural(sync.rejected, "{n} change was refused by the server. See Sync status.", "{n} changes were refused by the server. See Sync status.")
          : sync.pending === 0
            ? t("Each phone also keeps a full copy. Last synced {when}.", { when: sync.lastSyncAt ? formatDateTime(sync.lastSyncAt) : "—" })
            : t("They are safe on this device and upload as soon as there is internet."),
      action: sync.pending > 0 && <Button size="sm" variant="secondary" onClick={() => void engine.sync()}>{t("Upload now")}</Button>,
    },
    {
      ok: server === "offline" || server === null ? null : server.mode === "remote" || server.copies.length > 0,
      icon: <Server className="size-5" />,
      title: t("Server's own copies"),
      detail:
        server === null
          ? t("Checking…")
          : server === "offline"
            ? t("Can't check while offline.")
            : server.mode === "remote"
              ? t("Your database provider keeps continuous backups (point-in-time restore).")
              : server.copies.length
                ? plural(
                    server.copies.length,
                    "{n} automatic daily copy on the server, newest {date}. Kept: 14 days plus one a month for a year.",
                    "{n} automatic daily copies on the server, newest {date}. Kept: 14 days plus one a month for a year.",
                    { date: formatDate(server.copies[0].name.slice(11, 21)) },
                  )
                : t("No copy yet. One is made automatically each day."),
      action: server !== "offline" && server?.mode === "file" && (
        <Button size="sm" variant="secondary" loading={busy} onClick={async () => {
          setBusy(true);
          try {
            const res = await fetch("/api/backup", { method: "POST", headers: { "Content-Type": "application/json" }, body: JSON.stringify({ action: "now" }) });
            if (res.ok) setState(await res.json());
          } finally {
            setBusy(false);
          }
        }}>{t("Copy now")}</Button>
      ),
    },
  ];
  if (owner) {
    checks.push({
      ok: backupDays <= BACKUP_REMINDER_DAYS,
      icon: <DatabaseBackup className="size-5" />,
      title: t("Your own copy, off this phone"),
      detail: last
        ? backupDays > BACKUP_REMINDER_DAYS
          ? t("Last taken {when}. Take one at least every {days} days.", { when: formatDateTime(last), days: BACKUP_REMINDER_DAYS })
          : t("Last taken {when}.", { when: formatDateTime(last) })
        : t("Not taken on this device yet. Take one below and keep it somewhere safe."),
    });
  }

  return (
    <Card className="divide-y divide-line">
      {checks.map((c) => (
        <div key={c.title} className="flex items-start gap-3 px-4 py-3">
          <span className={cx("mt-0.5 shrink-0", c.ok === true ? "text-positive" : c.ok === false ? "text-warning" : "text-ink-3")}>
            {c.ok === true ? <CheckCircle2 className="size-5" /> : c.ok === false ? <AlertTriangle className="size-5" /> : c.icon}
          </span>
          <div className="min-w-0 flex-1">
            <div className="font-semibold">{c.title}</div>
            <div className="text-xs text-ink-3">{c.detail}</div>
          </div>
          {c.action && <div className="shrink-0">{c.action}</div>}
        </div>
      ))}
    </Card>
  );
}

// ---------- copies kept on this device ----------

function DeviceCopies({ slug }: { slug: string }) {
  const { store, engine, toast } = useApp();
  const [copies, setCopies] = useState<(SavedCopy & { unsent?: number })[] | null>(null);

  const load = useCallback(async () => {
    const list = await store.savedCopies();
    const withUnsent = await Promise.all(
      list.map(async (c) => {
        if (c.kind !== "archive") return c;
        const bytes = await store.readCopy(c.key);
        const unsent = bytes ? (await inspectBackup(bytes).catch(() => null))?.unsent.length ?? 0 : 0;
        return { ...c, unsent };
      }),
    );
    setCopies(withUnsent);
  }, [store]);
  useEffect(() => {
    void load();
  }, [load]);

  if (!copies || copies.length === 0) return null;
  return (
    <>
      <SectionTitle>{t("Copies kept on this device")}</SectionTitle>
      <Card className="divide-y divide-line">
        {copies.map((c) => (
          <div key={c.key} className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2">
              {c.kind === "daily" ? <HardDrive className="size-4" /> : <Archive className="size-4" />}
            </span>
            <div className="min-w-0 flex-1">
              <div className="truncate text-sm font-semibold">
                {c.kind === "daily"
                  ? t("Daily copy · {date}", { date: formatDate(c.label, { weekday: "short", day: "numeric", month: "short" }) })
                  : t("Archive · {date}", { date: formatDateTime(c.label) })}
              </div>
              <div className="text-xs text-ink-3">
                {kb(c.size)}
                {c.kind === "archive" && ` · ${t("kept before this device's data was replaced")}`}
                {!!c.unsent && <span className="font-semibold text-warning"> · {plural(c.unsent, "{n} change never uploaded", "{n} changes never uploaded")}</span>}
              </div>
            </div>
            {!!c.unsent && (
              <Button size="sm" onClick={async () => {
                const bytes = await store.readCopy(c.key);
                if (!bytes) return;
                const info = await inspectBackup(bytes);
                const added = await engine.requeue(info.unsent);
                toast(added ? plural(added, "{n} change queued to upload", "{n} changes queued to upload") : t("Already queued"));
              }}>
                {t("Send")}
              </Button>
            )}
            <button
              aria-label={t("Download this copy")}
              className="flex size-10 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink-3 hover:bg-surface-2"
              onClick={async () => {
                const bytes = await store.readCopy(c.key);
                if (bytes) await saveFile(`${slug}-${c.kind}-${c.label.replace(/[:.]/g, "-")}.sqlite`, bytes as BlobPart, "application/vnd.sqlite3");
              }}
            >
              <Download className="size-4" />
            </button>
          </div>
        ))}
      </Card>
      <p className="mt-2 text-xs text-ink-3">
        {t("A copy is kept each day for the last 7 days, so a damaged file repairs itself. Archives are kept whenever this device's data is replaced. Changes that never uploaded can be sent from here; the server accepts each one only once.")}
      </p>
    </>
  );
}

// ---------- server copies (self-hosted) ----------

function ServerCopiesSection() {
  const { state } = useServerCopies();
  const [pick, setPick] = useState<string | null>(null);
  if (!state || state === "offline" || state.mode !== "file" || state.copies.length === 0) return null;
  return (
    <>
      <SectionTitle>{t("Copies on the server")}</SectionTitle>
      <Card className="divide-y divide-line">
        {state.copies.map((c) => (
          <div key={c.name} className="flex items-center gap-3 px-4 py-3">
            <span className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-surface-2 text-ink-2"><Server className="size-4" /></span>
            <div className="min-w-0 flex-1">
              <div className="text-sm font-semibold">{formatDate(c.name.slice(11, 21), { weekday: "short", day: "numeric", month: "short", year: "numeric" })}</div>
              <div className="text-xs text-ink-3">{kb(c.size)}</div>
            </div>
            <button aria-label={t("Download")} onClick={() => setPick(c.name)} className="flex size-10 cursor-pointer items-center justify-center rounded-full text-ink-3 hover:bg-surface-2">
              <Download className="size-4" />
            </button>
          </div>
        ))}
      </Card>
      {pick && <ServerDownloadSheet name={pick} onClose={() => setPick(null)} />}
    </>
  );
}

function ServerDownloadSheet({ name, onClose }: { name: string; onClose: () => void }) {
  const { user, toast } = useApp();
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet open onClose={onClose} title={t("Download server copy")}>
      <p className="mb-4 text-sm text-ink-3">{t("Enter your owner PIN to download {name}.", { name })}</p>
      <PinPad
          busy={busy}
          error={error}
          onSubmit={async (pin) => {
            setBusy(true);
            setError(null);
            try {
              const res = await fetch("/api/backup", {
                method: "POST",
                headers: { "Content-Type": "application/json" },
                body: JSON.stringify({ action: "download", name, userId: user.id, pin }),
              });
              if (!res.ok) {
                setError((await res.json().catch(() => ({}))).error ?? t("Download failed."));
                return;
              }
              await saveFile(name, await res.blob(), "application/vnd.sqlite3");
              toast(t("Server copy downloaded"));
              onClose();
            } catch {
              setError(t("Can't reach the server."));
            } finally {
              setBusy(false);
            }
          }}
        />
    </Sheet>
  );
}
