"use client";

import { useEffect, useState } from "react";
import { ChevronRight, Smartphone, UserCog } from "lucide-react";
import { go } from "@/client/router.ts";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { formatDateTime } from "@/core/dates.ts";
import { t } from "@/core/i18n.ts";
import { bpToPercent, percentToBp } from "@/core/money.ts";
import { ROLE_LABEL, type Role } from "@/core/permissions.ts";
import { hashPin, isValidPin, newSalt } from "@/core/pin.ts";
import {
  Badge, Button, Card, Chip, Field, Input, MoneyInput, PageHeader, SectionTitle, Select, Sheet, Spinner, Toggle,
} from "@/components/ui.tsx";
import { LanguageSwitch } from "@/components/i18n.tsx";
import { ThemeSwitch } from "@/components/theme.tsx";
import { Avatar } from "./Boot.tsx";
import { AccessEditor, RolePicker } from "./Access.tsx";

export function SettingsView() {
  const { settings, run, engine } = useApp();
  const [form, setForm] = useState(settings);
  const [share, setShare] = useState(bpToPercent(settings.default_commission_bp).replace("%", ""));
  const [busy, setBusy] = useState(false);
  useEffect(() => {
    setForm(settings);
    setShare(bpToPercent(settings.default_commission_bp).replace("%", ""));
  }, [settings]);

  const { data } = useQuery(async (db) => ({
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
    if (Object.keys(changed).length) await run("settings.update", { values: changed }, t("Settings saved"));
    setBusy(false);
  };

  return (
    <div className="mx-auto max-w-2xl lg:max-w-none">
      <PageHeader title={t("Settings")} />

      {/* Desktop: shop form on the left; language, sign-ins and devices on the right. */}
      <div className="lg:grid lg:grid-cols-2 lg:grid-rows-[auto_auto_1fr] lg:items-start lg:gap-x-8">
        <div className="lg:col-start-2 lg:row-start-1">
          <Card className="flex items-center justify-between gap-4 p-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink">{t("Language")}</div>
              <div className="text-xs text-ink-3">{t("This phone's language. Receipts and spreadsheets follow it.")}</div>
            </div>
            <LanguageSwitch className="shrink-0" />
          </Card>
          <Card className="mt-3 flex flex-wrap items-center justify-between gap-x-4 gap-y-3 p-4">
            <div className="min-w-0">
              <div className="text-sm font-medium text-ink">{t("Appearance")}</div>
              <div className="text-xs text-ink-3">{t("Light or dark, for this phone. Auto follows the phone's own setting.")}</div>
            </div>
            <ThemeSwitch className="shrink-0" />
          </Card>
        </div>

        <div className="lg:col-start-1 lg:row-span-3 lg:row-start-1 lg:[&>:first-child]:mt-0">
          <SectionTitle>{t("Shop")}</SectionTitle>
          <Card className="space-y-4 p-4">
            <Field label={t("Shop name")} htmlFor="sname"><Input id="sname" value={form.shop_name} onChange={(e) => set("shop_name", e.target.value)} /></Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Address (on receipts)")} htmlFor="saddr"><Input id="saddr" value={form.address} onChange={(e) => set("address", e.target.value)} /></Field>
              <Field label={t("Phone (on receipts)")} htmlFor="sphone"><Input id="sphone" type="tel" value={form.phone} onChange={(e) => set("phone", e.target.value)} /></Field>
            </div>
            <Field label={t("Receipt message")} htmlFor="sfoot"><Input id="sfoot" value={form.receipt_footer} onChange={(e) => set("receipt_footer", e.target.value)} /></Field>
            <Field label={t("Receipt paper")} hint={t("Pick the width of your receipt printer's paper roll, or A4 for a normal printer.")}>
              <div className="flex gap-2">
                {[["58", "58 mm"], ["80", "80 mm"], ["a4", "A4"]].map(([v, l]) => (
                  <Chip key={v} active={form.paper_width === v} onClick={() => set("paper_width", v)}>{l}</Chip>
                ))}
              </div>
            </Field>
            <div className="grid gap-4 sm:grid-cols-2">
              <Field label={t("Default staff share for new staff (%)")} htmlFor="sshare"><Input id="sshare" inputMode="decimal" className="num" value={share} onChange={(e) => setShare(e.target.value)} /></Field>
              <Field label={t("Usual opening float")} htmlFor="sfloat" hint={t("Cash left in the drawer each morning.")}><MoneyInput id="sfloat" value={form.opening_float || null} onChange={(v) => set("opening_float", v ?? 0)} /></Field>
            </div>
            <Field label={t("Currency")} htmlFor="scur" hint={t("Changing this doesn't convert amounts already recorded.")}>
              <Input id="scur" value={form.currency} maxLength={3} onChange={(e) => set("currency", e.target.value.toUpperCase())} />
            </Field>
            <Button block onClick={save} loading={busy}>{t("Save shop settings")}</Button>
          </Card>
        </div>

        <div className="lg:col-start-2 lg:row-start-2">
          <button onClick={() => go("/people")} className="press lift mt-3 flex w-full cursor-pointer items-center gap-3 rounded-3xl bg-surface p-4 text-left shadow-card ring-1 ring-line/70">
            <span className="flex size-10 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent"><UserCog className="size-5" /></span>
            <span className="min-w-0 flex-1">
              <span className="block font-semibold">{t("People who sign in")}</span>
              <span className="block text-xs text-ink-3">{t("Add people, choose their role, turn accounts off.")}</span>
            </span>
            <ChevronRight className="size-4 shrink-0 text-ink-3" />
          </button>
          <SectionTitle>{t("Who can do what")}</SectionTitle>
          <AccessEditor />
        </div>

        <div className="lg:col-start-2 lg:row-start-3">
          <SectionTitle>{t("Connected devices")}</SectionTitle>
          {data && (
            <Card className="divide-y divide-line">
              {data.devices.map((d) => (
                <div key={d.id} className="flex items-center gap-3 px-4 py-3">
                  <Smartphone className="size-5 shrink-0 text-ink-3" />
                  <div className="min-w-0 flex-1">
                    <div className="font-semibold">
                      {d.code} · {d.name} {d.id === engine.deviceId && <Badge tone="accent">{t("This device")}</Badge>}
                    </div>
                    <div className="text-xs text-ink-3">
                      {d.by
                        ? t("Connected {when} by {name}", { when: formatDateTime(d.created_at), name: d.by })
                        : t("Connected {when}", { when: formatDateTime(d.created_at) })}
                      {d.revoked_at ? ` · ${t("signed out {when}", { when: formatDateTime(d.revoked_at) })}` : ""}
                    </div>
                  </div>
                  {!d.revoked_at && d.id !== engine.deviceId && (
                    <Button size="sm" variant="secondary" onClick={() => run("device.revoke", { id: d.id }, t("Device signed out"))}>{t("Sign out")}</Button>
                  )}
                </div>
              ))}
            </Card>
          )}
          <p className="mt-2 text-xs text-ink-3">{t("Receipt numbers start with the device letter, so you can tell which phone or till made each sale. Sign out a lost or stolen phone here.")}</p>
        </div>
      </div>

    </div>
  );
}

export interface UserRow {
  id: string;
  name: string;
  role: Role;
  active: number;
}

export function UserSheet({ user, onClose }: { user: UserRow | null; onClose: () => void }) {
  const { run, user: me } = useApp();
  const isOwner = me.role === "owner";
  const [name, setName] = useState(user?.name ?? "");
  const [role, setRole] = useState<Role>(user?.role ?? "cashier");
  const [pin, setPin] = useState("");
  const [active, setActive] = useState(user ? !!user.active : true);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const save = async () => {
    setError(null);
    if (!name.trim()) return setError(t("Enter a name."));
    if (!user && !isValidPin(pin)) return setError(t("Set a PIN of 4 to 6 digits."));
    if (pin && !isValidPin(pin)) return setError(t("PIN must be 4 to 6 digits."));
    setBusy(true);
    let pinFields = {};
    if (pin) {
      const salt = newSalt();
      pinFields = { pin_salt: salt, pin_hash: await hashPin(pin, salt) };
    }
    const ok = await run("user.upsert", { id: user?.id ?? crypto.randomUUID(), name, role, active: active ? 1 : 0, ...pinFields }, user ? t("Saved") : t("{name} can now sign in", { name: name.trim() }));
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet open onClose={onClose} title={user ? user.name : t("Add a user")} footer={<Button block size="lg" loading={busy} onClick={save}>{t("Save")}</Button>}>
      <div className="space-y-4">
        <Field label={t("Name")} htmlFor="un"><Input id="un" value={name} onChange={(e) => setName(e.target.value)} autoComplete="off" /></Field>
        <Field label={t("Role")}>
          <RolePicker value={role} onChange={setRole} allowOwner={isOwner} />
        </Field>
        <Field label={user ? t("New PIN (leave blank to keep)") : t("PIN")} htmlFor="up" hint={t("4–6 digits. They use it to sign in on any shop device.")}>
          <Input id="up" type="password" inputMode="numeric" autoComplete="new-password" value={pin} onChange={(e) => setPin(e.target.value.replace(/\D/g, "").slice(0, 6))} />
        </Field>
        {user && user.id !== me.id && (
          <Toggle checked={active} onChange={setActive} label={t("Can sign in")} description={t("Turn off when someone stops working here. Their history stays, and you can turn it back on.")} />
        )}
        {error && <p className="text-sm text-negative" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}
