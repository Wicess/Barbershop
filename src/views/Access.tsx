"use client";

// "Who can do what": the owner chooses, per role, exactly what shop managers
// and cashiers may do. Rights are grouped and worded plainly; rights that need
// another (paying staff needs seeing their pay) switch together; and the two
// owner-only rights are shown locked so nobody wonders where they went.
// Saving applies on every device at the next sync, and the server enforces it.

import { useEffect, useMemo, useState } from "react";
import { Check, Lock, RotateCcw } from "lucide-react";
import { useApp } from "@/client/app-context.tsx";
import { t } from "@/core/i18n.ts";
import {
  ACCESS_GROUPS, DEFAULT_ACCESS, accessOf, roleOptions, toggleAccess, type Role,
} from "@/core/permissions.ts";
import { Button, Card, Toggle, cx } from "@/components/ui.tsx";

type Editable = "manager" | "cashier";
const TOTAL = ACCESS_GROUPS.reduce((n, g) => n + g.items.length, 0);

export function AccessEditor() {
  const { settings, run } = useApp();
  const saved = useMemo(
    () => ({ manager: accessOf("manager", roleOptions(settings)), cashier: accessOf("cashier", roleOptions(settings)) }),
    [settings],
  );
  const [draft, setDraft] = useState(saved);
  const [role, setRole] = useState<Editable>("cashier");
  const [busy, setBusy] = useState(false);
  useEffect(() => setDraft(saved), [saved]);

  const list = draft[role];
  const dirty = (["manager", "cashier"] as const).some((r) => [...draft[r]].sort().join() !== [...saved[r]].sort().join());
  const isRecommended = [...list].sort().join() === [...DEFAULT_ACCESS[role]].sort().join();

  const save = async () => {
    setBusy(true);
    await run("settings.update", { values: { role_access: JSON.stringify(draft) } }, t("Access saved"));
    setBusy(false);
  };

  return (
    <Card className="overflow-hidden">
      <div className="p-4 pb-3">
        <p className="text-sm text-ink-3">{t("Choose what managers and cashiers can do. It applies on every phone straight away.")}</p>
        <div role="tablist" aria-label={t("Role")} className="mt-3 grid grid-cols-2 gap-1 rounded-2xl bg-surface-2 p-1">
          {(["cashier", "manager"] as const).map((r) => (
            <button
              key={r}
              role="tab"
              aria-selected={role === r}
              onClick={() => setRole(r)}
              className={cx(
                "flex min-h-11 cursor-pointer flex-col items-center justify-center rounded-xl px-3 py-1.5 text-sm font-semibold transition-[background-color,color,box-shadow] duration-200",
                role === r ? "bg-surface text-ink shadow-card" : "text-ink-3 hover:text-ink",
              )}
            >
              {t(r === "cashier" ? "Cashier" : "Shop manager")}
              <span className="text-[11px] font-medium text-ink-3">{t("{n} of {total} allowed", { n: draft[r].length, total: TOTAL })}</span>
            </button>
          ))}
        </div>
      </div>

      <div className="divide-y divide-line border-t border-line">
        {ACCESS_GROUPS.map((g) => (
          <section key={g.title} className="px-4 py-2">
            <h3 className="pt-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{t(g.title)}</h3>
            {g.items.map((it) => (
              <Toggle
                key={it.perm}
                checked={list.includes(it.perm)}
                onChange={(on) => setDraft((d) => ({ ...d, [role]: toggleAccess(d[role], it.perm, on) }))}
                label={t(it.label)}
                description={it.hint ? t(it.hint) : undefined}
              />
            ))}
          </section>
        ))}
        <section className="px-4 py-3">
          <div className="flex items-start gap-3 text-sm text-ink-3">
            <Lock className="mt-0.5 size-4 shrink-0" />
            <p>{t("Owners can do everything. Only owners change the shop's settings and who can do what.")}</p>
          </div>
        </section>
      </div>

      <div className="flex flex-wrap items-center gap-2 border-t border-line bg-surface-2/50 p-3">
        <Button
          variant="ghost"
          size="sm"
          disabled={isRecommended}
          onClick={() => setDraft((d) => ({ ...d, [role]: DEFAULT_ACCESS[role] }))}
        >
          <RotateCcw className="size-4" /> {t("Use recommended")}
        </Button>
        <Button className="ml-auto" size="sm" disabled={!dirty} loading={busy} onClick={save}>
          <Check className="size-4" /> {t("Save access")}
        </Button>
      </div>
    </Card>
  );
}

/** A role picker that says, in plain words, what each role will be able to do. */
export function RolePicker({ value, onChange, allowOwner = true }: { value: Role; onChange: (r: Role) => void; allowOwner?: boolean }) {
  const { settings } = useApp();
  // Only an owner can make someone an owner.
  const roles: Role[] = allowOwner ? ["cashier", "manager", "owner"] : ["cashier", "manager"];
  return (
    <div role="radiogroup" aria-label={t("Role")} className="grid gap-2">
      {roles.map((r) => {
        const on = value === r;
        return (
          <button
            key={r}
            type="button"
            role="radio"
            aria-checked={on}
            onClick={() => onChange(r)}
            className={cx(
              "flex cursor-pointer items-start gap-3 rounded-2xl p-3.5 text-left ring-1 transition-[background-color,box-shadow] duration-200",
              on ? "bg-accent-soft ring-2 ring-primary" : "bg-surface ring-line hover:bg-surface-2",
            )}
          >
            <span className={cx("mt-0.5 flex size-5 shrink-0 items-center justify-center rounded-full ring-2", on ? "bg-primary ring-primary" : "ring-line-strong")}>
              {on && <Check className="size-3 text-on-primary" strokeWidth={3} />}
            </span>
            <span className="min-w-0">
              <span className="block font-semibold">{t(r === "owner" ? "Owner" : r === "manager" ? "Shop manager" : "Cashier")}</span>
              <span className="mt-0.5 block text-xs leading-relaxed text-ink-3">{summary(r, settings)}</span>
            </span>
          </button>
        );
      })}
    </div>
  );
}

function summary(role: Role, settings: Parameters<typeof roleOptions>[0]): string {
  if (role === "owner") return t("Everything, including profit, people and settings.");
  const allowed = accessOf(role, roleOptions(settings));
  // One sentence: "Make sales, close the day, see expenses…"
  const labels = ACCESS_GROUPS.flatMap((g) => g.items)
    .filter((i) => allowed.includes(i.perm))
    .map((i, n) => (n === 0 ? t(i.label) : t(i.label).charAt(0).toLocaleLowerCase() + t(i.label).slice(1)));
  if (!labels.length) return t("Nothing yet. Choose under “Who can do what”.");
  const shown = labels.slice(0, 4).join(", ");
  return labels.length > 4 ? t("{list} and {n} more", { list: shown, n: labels.length - 4 }) : shown;
}
