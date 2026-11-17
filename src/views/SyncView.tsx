"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { formatDateTime } from "@/core/dates.ts";
import { Button, Card, PageHeader, SectionTitle, Sheet } from "@/components/ui.tsx";
import { t, tk, tMessage } from "@/core/i18n.ts";

const TYPE_LABEL: Record<string, string> = {
  "sale.create": tk("Sale"), "sale.void": tk("Sale cancellation"), "expense.create": tk("Expense"), "expense.void": tk("Expense cancellation"),
  "staff.upsert": tk("Staff change"), "service.upsert": tk("Price change"), "product.upsert": tk("Product change"),
  "stock.move": tk("Stock change"), "day.close": tk("Day close"), "month.close": tk("Month close"), "user.upsert": tk("User change"), "settings.update": tk("Settings"),
  "adjustment.create": tk("Staff advance/bonus"), "payout.create": tk("Staff payment"),
};

export function SyncView() {
  const { sync, engine } = useApp();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: rejected } = useQuery(() => engine.rejected(), [sync.rejected]);

  return (
    <div className="mx-auto max-w-xl lg:max-w-none">
      <PageHeader title={t("Sync")} subtitle={t("This device: {code}", { code: engine.deviceCode })} />
      <div className="lg:grid lg:grid-cols-2 lg:items-start lg:gap-x-8">
        <div>
          <Card className="space-y-2 p-4 text-sm">
            <Row
              label={t("Status")}
              value={
                sync.status === "idle"
                  ? t("Up to date")
                  : sync.status === "syncing"
                    ? t("Syncing…")
                    : sync.status === "offline"
                      ? t("Offline — changes are saved on this device")
                      : t("Problem")
              }
            />
            <Row label={t("Waiting to upload")} value={String(sync.pending)} />
            <Row label={t("Last synced")} value={sync.lastSyncAt ? formatDateTime(sync.lastSyncAt) : t("Not yet this session")} />
            {sync.error && <p className="text-negative">{tMessage(sync.error)}</p>}
            <Button className="mt-2" block loading={busy} onClick={async () => { setBusy(true); await engine.sync(); setBusy(false); }}>
              <RefreshCw className="size-4" /> {t("Sync now")}
            </Button>
          </Card>
          <p className="mt-2 text-xs text-ink-3">
            {t("Everything is saved on this device first, so the shop keeps working without internet. Changes upload automatically when the connection is back.")}
          </p>
        </div>

        {rejected && rejected.length > 0 && (
          <div className="lg:[&>:first-child]:mt-0">
            <SectionTitle>{t("Changes the server refused")}</SectionTitle>
            <Card className="divide-y divide-line">
              {rejected.map((r) => (
                <div key={r.id} className="px-4 py-3 text-sm">
                  <div className="font-semibold">{TYPE_LABEL[r.type] ? t(TYPE_LABEL[r.type]) : r.type} · {formatDateTime(r.at)}</div>
                  <div className="text-negative">{tMessage(r.error)}</div>
                </div>
              ))}
            </Card>
            <p className="mt-2 text-xs text-ink-3">
              {t("Usually this means someone's access was changed while this device was offline. Re-download to make this device match the server, then redo anything that's still needed.")}
            </p>
            <Button className="mt-3" variant="secondary" block onClick={() => setConfirm(true)}>{t("Re-download shop data")}</Button>
          </div>
        )}
      </div>

      <Sheet open={confirm} onClose={() => setConfirm(false)} title={t("Re-download shop data?")}
        footer={<Button block loading={busy} onClick={async () => { setBusy(true); await engine.redownload(); setBusy(false); setConfirm(false); }}>{t("Re-download")}</Button>}>
        <p className="text-sm text-ink-2">{t("This device's copy is replaced with the server's. Changes still waiting to upload are kept and sent first. Refused changes are cleared.")}</p>
      </Sheet>
    </div>
  );
}

function Row({ label, value }: { label: string; value: string }) {
  return (
    <div className="flex justify-between gap-3">
      <span className="text-ink-3">{label}</span>
      <span className="text-right font-semibold">{value}</span>
    </div>
  );
}
