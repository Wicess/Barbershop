"use client";

import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { formatDateTime } from "@/core/dates.ts";
import { Button, Card, PageHeader, SectionTitle, Sheet } from "@/components/ui.tsx";

const TYPE_LABEL: Record<string, string> = {
  "sale.create": "Sale", "sale.void": "Void sale", "expense.create": "Expense", "expense.void": "Void expense",
  "staff.upsert": "Staff change", "service.upsert": "Price change", "product.upsert": "Product change",
  "stock.move": "Stock change", "day.close": "Day close", "month.close": "Month close", "user.upsert": "User change", "settings.update": "Settings",
  "adjustment.create": "Staff advance/bonus", "payout.create": "Staff payment",
};

export function SyncView() {
  const { sync, engine } = useApp();
  const [confirm, setConfirm] = useState(false);
  const [busy, setBusy] = useState(false);
  const { data: rejected } = useQuery(() => engine.rejected(), [sync.rejected]);

  return (
    <div className="mx-auto max-w-xl">
      <PageHeader title="Sync" subtitle={`This device: ${engine.deviceCode}`} />
      <Card className="space-y-2 p-4 text-sm">
        <Row label="Status" value={sync.status === "idle" ? "Up to date" : sync.status === "syncing" ? "Syncing…" : sync.status === "offline" ? "Offline — changes are saved on this device" : "Problem"} />
        <Row label="Waiting to upload" value={String(sync.pending)} />
        <Row label="Last synced" value={sync.lastSyncAt ? formatDateTime(sync.lastSyncAt) : "Not yet this session"} />
        {sync.error && <p className="text-negative">{sync.error}</p>}
        <Button className="mt-2" block loading={busy} onClick={async () => { setBusy(true); await engine.sync(); setBusy(false); }}>
          <RefreshCw className="size-4" /> Sync now
        </Button>
      </Card>
      <p className="mt-2 text-xs text-ink-3">
        Everything is saved on this device first, so the shop keeps working without internet. Changes upload automatically when the connection is back.
      </p>

      {rejected && rejected.length > 0 && (
        <>
          <SectionTitle>Changes the server refused</SectionTitle>
          <Card className="divide-y divide-line">
            {rejected.map((r) => (
              <div key={r.id} className="px-4 py-3 text-sm">
                <div className="font-semibold">{TYPE_LABEL[r.type] ?? r.type} · {formatDateTime(r.at)}</div>
                <div className="text-negative">{r.error}</div>
              </div>
            ))}
          </Card>
          <p className="mt-2 text-xs text-ink-3">
            Usually this means someone's access was changed while this device was offline. Re-download to make this device match the server, then redo anything that's still needed.
          </p>
          <Button className="mt-3" variant="secondary" block onClick={() => setConfirm(true)}>Re-download shop data</Button>
        </>
      )}

      <Sheet open={confirm} onClose={() => setConfirm(false)} title="Re-download shop data?"
        footer={<Button block loading={busy} onClick={async () => { setBusy(true); await engine.redownload(); setBusy(false); setConfirm(false); }}>Re-download</Button>}>
        <p className="text-sm text-ink-2">This device's copy is replaced with the server's. Changes still waiting to upload are kept and sent first. Refused changes are cleared.</p>
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
