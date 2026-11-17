"use client";

import { useEffect, useState } from "react";
import { Plus, Smartphone } from "lucide-react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { formatDateTime } from "@/core/dates.ts";
import { bpToPercent, percentToBp } from "@/core/money.ts";
import { ROLE_LABEL, type Role } from "@/core/permissions.ts";
import { hashPin, isValidPin, newSalt } from "@/core/pin.ts";
import {
  Badge, Button, Card, Chip, Field, Input, MoneyInput, PageHeader, SectionTitle, Select, Sheet, Spinner, Toggle,
} from "@/components/ui.tsx";
import { Avatar } from "./Boot.tsx";

export function SettingsView() {
  const { settings, run, engine } = useApp();
  const [form, setForm] = useState(settings);
  const [share, setShare] = useState(bpToPercent(settings.default_commission_bp).replace("%", ""));
  const [busy, setBusy] = useState(false);
  const [editingUser, setEditingUser] = useState<UserRow | "new" | null>(null);
  useEffect(() => {
    setForm(settings);
    setShare(bpToPercent(settings.default_commission_bp).replace("%", ""));
  }, [settings]);

  const { data } = useQuery(async (db) => ({
    users: await db.all<UserRow>("SELECT id, name, role, active FROM users ORDER BY active DESC, CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, name"),
    devices: await db.all<{ id: string; code: string; name: string; created_at: string; revoked_at: string | null; by: string | null }>(
      "SELECT d.*, u.name AS by FROM devices d LEFT JOIN users u ON u.id = d.registered_by ORDER BY d.created_at",
    ),
  }));

  const set = <K extends keyof typeof form>(k: K, v: (typeof form)[K]) => setForm((f) => ({ ...f, [k]: v }));

  const save = async () => {
    const bp = percentToBp(share);
    if (bp == null) return;
    setBusy(true);
    const changed = Object.fromEntries(
      Object.entries({ ...form, default_commission_bp: bp }).filter(([k, v]) => settings[k as keyof typeof settings] !== v),
    );
    if (Object.keys(changed).length) await run("settings.update", { values: changed }, "Settings saved");
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Settings" />

      <SectionTitle>Shop</SectionTitle>
      <Card className="space-y-4 p-4">
        <Field label="Shop name" htmlFor="sname"><Input id="sname" value={form.shop_name} onChange={(e) => set("shop_name", e.target.value)} /></Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Address (on receipts)" htmlFor="saddr"><Input id="saddr" value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
          <Field label="Phone (on receipts)" htmlFor="sphone"><Input id="sphone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
        </div>
        <Field label="Receipt message" htmlFor="sfoot"><Input id="sfoot" value={form.receipt_footer} onChange={(e) => set("receipt_footer", e.target.value)} /></Field>
        <Field label="Receipt paper" hint="Pick the width of your receipt printer's paper roll, or A4 for a normal printer.">
          <div className="flex gap-2">
            {[["58", "58 mm"], ["80", "80 mm"], ["a4", "A4"]].map(([v, l]) => (
              <Chip key={v} active={form.paper_width === v} onClick={() => set("paper_width", v)}>{l}</Chip>
            ))}
          </div>
        </Field>
        <div className="grid gap-4 sm:grid-cols-2">
          <Field label="Default staff share for new staff (%)" htmlFor="sshare"><Input id="sshare" inputMode="decimal" className="num" value={share} onChange={(e) => setShare(e.target.value)} /></Field>
          <Field label="Usual opening float" htmlFor="sfloat" hint="Cash left in the drawer each morning."><MoneyInput id="sfloat" value={form.opening_float || null} onChange={(v) => set("opening_float", v ?? 0)} /></Field>
        </div>
        <Toggle
          checked={form.cashier_can_edit_price}
          onChange={(v) => set("cashier_can_edit_price", v)}
          label="Cashier can change prices at the till"
          description="Every changed price is recorded with the original price in the activity log."
        />
        <Field label="Currency" htmlFor="scur" hint="Changing this doesn't convert amounts already recorded.">
          <Input id="scur" value={form.currency} maxLength={3} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
        </Field>
        <Button block onClick={save} loading={busy}>Save shop settings</Button>
      </Card>

      <SectionTitle action={<button className="min-h-11 cursor-pointer text-sm font-semibold text-accent" onClick={() => setEditingUser("new")}><Plus className="inline size-4" /> Add user</button>}>
        People who can sign in
      </SectionTitle>
      {!data ? <Spinner /> : (
        <Card className="divide-y divide-line">
          {data.users.map((u) => (
            <button key={u.id} onClick={() => setEditingUser(u)} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
              <Avatar name={u.name} />
              <div className="flex-1">
                <div className="font-semibold">{u.name}</div>
                <div className="text-xs text-ink-3">{ROLE_LABEL[u.role]}</div>
              </div>
              {!u.active && <Badge>Disabled</Badge>}
            </button>
          ))}
        </Card>
      )}
      <p className="mt-2 text-xs text-ink-3">
        Owner: everything, including profit and settings. Shop manager: sales, voids, expenses, staff, stock and daily reports. Cashier: records sales and closes the day.
      </p>

      <SectionTitle>Connected devices</SectionTitle>
      {data && (
        <Card className="divide-y divide-line">
          {data.devices.map((d) => (
            <div key={d.id} className="flex items-center gap-3 px-4 py-3">
              <Smartphone className="size-5 shrink-0 text-ink-3" />
              <div className="min-w-0 flex-1">
                <div className="font-semibold">
                  {d.code} · {d.name} {d.id === engine.deviceId && <Badge tone="accent">This device</Badge>}
                </div>
                <div className="text-xs text-ink-3">
                  Connected {formatDateTime(d.created_at)}{d.by ? ` by ${d.by}` : ""}{d.revoked_at ? ` · signed out ${formatDateTime(d.revoked_at)}` : ""}
                </div>
              </div>
              {!d.revoked_at && d.id !== engine.deviceId && (
                <Button size="sm" variant="secondary" onClick={() => run("device.revoke", { id: d.id }, "Device signed out")}>Sign out</Button>
              )}
            </div>
          ))}
        </Card>
      )}
      <p className="mt-2 text-xs text-ink-3">Receipt numbers start with the device letter, so you can tell which phone or till made each sale. Sign out a lost or stolen phone here.</p>

      {editingUser && <UserSheet user={editingUser === "new" ? null : editingUser} onClose={() => setEditingUser(null)} />}
    </div>
  );
}

interface UserRow {
  id: string;
  name: string;
  role: Role;
  active: number;
}

function UserSheet({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const { run } = useApp();
  const [name, setName] = useState(user?.name ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "cashier");
  const [pin, setPin] = useState("");
  const [active, setActive] = useState(user ? !!user.active : true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError("Enter a name.");
    if (!user && !isValidPin(pin)) return setError("Set a PIN of 4 to 6 digits.");
    if (pin && !isValidPin(pin)) return setError("PIN must be 4 to 6 digits.");
    setBusy(true);
    let pinFields = {};
    if (pin) {
      const salt = newSalt();
      pinFields = { pin_salt: salt, pin_hash: await hashPin(pin, salt) };
    }
    const ok = await run("user.upsert", { id: user?.id ?? crypto.randomUUID(), name, role, active: active ? 1 : 0, ...pinFields }, user ? "Saved" : `${name.trim()} can now sign in`);
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet open onClose={onClose} title={user ? user.name : "Add a user"} footer={<Button block size="lg" loading={busy} onClick={save}>Save</Button>}>
      <div className="space-y-4">
        <Field label="Name" htmlFor="un"><Input id="un" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></Field>
        <Field label="Role" htmlFor="ur">
          <Select id="ur" value={role} onChange={(e) => setRole(e.target.value as Role)}>
            <option value="cashier">Cashier — records sales, closes the day</option>
            <option value="manager">Shop manager — runs the shop day to day</option>
            <option value="owner">Owner — everything, including profit</option>
          </Select>
        </Field>
        <Field label={user ? "New PIN (leave blank to keep)" : "PIN"} htmlFor="up" hint="4–6 digits. They use it to sign in on any shop device.">
          <Input id="up" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        </Field>
        {user && <Toggle checked={active} onChange={setActive} label="Can sign in" description="Disable instead of deleting, so their history stays." />}
        {error && <p className="text-sm text-negative" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}
