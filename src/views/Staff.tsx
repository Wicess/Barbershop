"use client";

import { useEffect, useState } from "react";
import { Plus, UserRound } from "lucide-react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { go, setParams } from "@/client/router.ts";
import { currentMonth } from "@/core/dates.ts";
import { bpToPercent, percentToBp } from "@/core/money.ts";
import { plural, t, tk } from "@/core/i18n.ts";
import { payroll } from "@/core/reports.ts";
import {
  Badge, Button, Card, Empty, Field, Input, Money, MoneyInput, PageHeader, SectionTitle, Sheet, Spinner, Textarea, Toggle, cx,
} from "@/components/ui.tsx";
import { SortButton, SortSheet, SortSummary, sortRows, useSortRules, type SortKey } from "@/components/sort.tsx";
import { Avatar } from "./Boot.tsx";

interface StaffRow {
  id: string;
  name: string;
  phone: string | null;
  specialty: string | null;
  commission_bp: number;
  base_salary: number;
  active: number;
  joined_on: string | null;
  notes: string | null;
}

export function StaffView({ params }: { params: URLSearchParams }) {
  const { can } = useApp();
  const month = currentMonth();
  const { data } = useQuery(async (db) => ({
    staff: await db.all<StaffRow>("SELECT * FROM staff ORDER BY active DESC, name"),
    rates: await db.all<{ staff_id: string; department_id: string; commission_bp: number | null }>(
      "SELECT staff_id, department_id, commission_bp FROM staff_rates WHERE commission_bp IS NOT NULL",
    ),
    depts: await db.all<{ id: string; name: string }>("SELECT id, name FROM departments WHERE active = 1 AND kind = 'service' ORDER BY sort, name"),
    pay: can("payroll.view") ? await payroll(db, month) : [],
  }));
  const editing = params.get("id");
  const sort = useSortRules("staff", [{ id: "active", dir: "desc" }, { id: "name", dir: "asc" }]);
  const [sorting, setSorting] = useState(false);
  const payOf = (id: string) => data?.pay.find((p) => p.staff_id === id);
  const STAFF_SORT: SortKey<StaffRow>[] = [
    { id: "active", label: tk("Active"), get: (s) => s.active, words: [tk("Inactive first"), tk("Active first")] },
    { id: "name", label: tk("Name"), get: (s) => s.name, words: [tk("A to Z"), tk("Z to A")] },
    { id: "earned", label: tk("Earned this month"), get: (s) => payOf(s.id)?.earned ?? 0, words: [tk("Low to high"), tk("High to low")] },
    { id: "services", label: tk("Services this month"), get: (s) => payOf(s.id)?.services ?? 0, words: [tk("Fewest first"), tk("Most first")] },
    { id: "revenue", label: tk("Sales brought in"), get: (s) => payOf(s.id)?.revenue ?? 0, words: [tk("Low to high"), tk("High to low")] },
    { id: "share", label: tk("Share %"), get: (s) => s.commission_bp, words: [tk("Low to high"), tk("High to low")] },
    { id: "role", label: tk("Role"), get: (s) => s.specialty, words: [tk("A to Z"), tk("Z to A")] },
  ];
  const staff = sortRows(data?.staff ?? [], STAFF_SORT, sort.rules);

  return (
    <div>
      <PageHeader
        title={t("Staff")}
        subtitle={t("Barbers, nail technicians and other workers")}
        actions={
          <>
            {(data?.staff.length ?? 0) > 1 && <SortButton count={sort.rules.length} onClick={() => setSorting(true)} />}
            {can("staff.manage") && <Button size="sm" onClick={() => setParams({ id: "new" })}><Plus className="size-4" /> {t("Add")}</Button>}
          </>
        }
      />
      <SortSheet open={sorting} onClose={() => setSorting(false)} keys={STAFF_SORT} rules={sort.rules} onChange={sort.setRules} onReset={sort.reset} />
      {staff.length > 1 && <SortSummary keys={STAFF_SORT} rules={sort.rules} onOpen={() => setSorting(true)} />}
      {!data ? (
        <Spinner />
      ) : data.staff.length === 0 ? (
        <Empty
          icon={<UserRound className="size-8" />}
          title={t("No staff yet")}
          action={can("staff.manage") && <Button onClick={() => setParams({ id: "new" })}>{t("Add your first barber")}</Button>}
        >
          {t("Add everyone who serves customers. Each sale is credited to the person who did the work, and their pay is worked out from their share.")}
        </Empty>
      ) : (
        <ul className="stagger grid gap-3 sm:grid-cols-2 2xl:grid-cols-3">
          {staff.map((s) => {
            const pay = data.pay.find((p) => p.staff_id === s.id);
            const overrides = data.rates.filter((r) => r.staff_id === s.id);
            return (
              <li key={s.id}>
                <button
                  onClick={() => setParams({ id: s.id })}
                  className={cx(
                    "press lift flex w-full cursor-pointer flex-col rounded-[24px] bg-surface text-left ring-1 ring-line transition-colors hover:bg-surface-2",
                    !s.active && "opacity-60",
                  )}
                >
                  <span className="flex items-center gap-3.5 p-4">
                    <Avatar name={s.name} />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-center gap-2 font-semibold tracking-[-0.01em]">
                        <span className="truncate">{s.name}</span>
                        {!s.active && <Badge>{t("Inactive")}</Badge>}
                      </span>
                      <span className="block truncate text-xs text-ink-3">
                        {s.specialty ?? t("Staff")}
                        {overrides.length > 0 && ` · ${plural(overrides.length, "{n} section rate", "{n} section rates")}`}
                        {s.base_salary > 0 && ` · ${t("salaried")}`}
                      </span>
                    </span>
                    <span className="shrink-0 rounded-full bg-accent-soft px-2.5 py-1 text-xs font-bold text-accent">{bpToPercent(s.commission_bp)}</span>
                  </span>
                  <span className="flex items-end justify-between gap-3 border-t border-line px-4 py-3">
                    <span>
                      <span className="block text-[11px] font-semibold uppercase tracking-[0.1em] text-ink-3">{t("This month")}</span>
                      <Money value={pay?.earned ?? 0} className="text-lg font-extrabold tracking-tight" />
                    </span>
                    <span className="text-right text-xs text-ink-3">
                      <span className="num block text-base font-bold text-ink">{pay?.services ?? 0}</span>
                      {plural(pay?.services ?? 0, "service", "services")}
                    </span>
                  </span>
                </button>
              </li>
            );
          })}
        </ul>
      )}

      {data && data.staff.some((s) => s.active) && data.depts.length > 0 && (
        <>
          <SectionTitle>{t("Who gets what")}</SectionTitle>
          <Card className="overflow-x-auto">
            <table className="num w-full text-sm">
              <thead>
                <tr className="border-b border-line text-left text-xs text-ink-3">
                  <th className="sticky left-0 bg-surface px-4 py-2.5 font-semibold">{t("Staff")}</th>
                  {data.depts.map((d) => (
                    <th key={d.id} className="whitespace-nowrap px-3 py-2.5 text-right font-semibold">{t(d.name)}</th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {data.staff.filter((s) => s.active).map((s) => (
                  <tr key={s.id} className="border-b border-line last:border-0">
                    <td className="sticky left-0 whitespace-nowrap bg-surface px-4 py-2.5 font-semibold">{s.name}</td>
                    {data.depts.map((d) => {
                      const o = data.rates.find((r) => r.staff_id === s.id && r.department_id === d.id);
                      return (
                        <td key={d.id} className={cx("px-3 py-2.5 text-right", o ? "font-bold text-accent" : "text-ink-2")}>
                          {bpToPercent(o?.commission_bp ?? s.commission_bp)}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </Card>
          <p className="mt-2 text-xs text-ink-3">
            {t("The employee's percentage of each service they do; the shop keeps the rest. Highlighted figures are a special rate for that section. Each sale records the rate used, so changing a rate never changes past sales.")}
          </p>
        </>
      )}

      {data && editing && (
        <StaffEditor
          staff={editing === "new" ? null : data.staff.find((s) => s.id === editing) ?? null}
          rates={data.rates.filter((r) => r.staff_id === editing)}
          depts={data.depts}
          onClose={() => setParams({ id: null })}
        />
      )}
    </div>
  );
}

function StaffEditor({
  staff, rates, depts, onClose,
}: {
  staff: StaffRow | null;
  rates: { department_id: string; commission_bp: number | null }[];
  depts: { id: string; name: string }[];
  onClose: () => void;
}) {
  const { can, run, settings } = useApp();
  const canPay = can("staff.setPay");
  const canEdit = can("staff.manage");
  const [name, setName] = useState(staff?.name ?? "");
  const [phone, setPhone] = useState(staff?.phone ?? "");
  const [specialty, setSpecialty] = useState(staff?.specialty ?? t("Barber"));
  const [share, setShare] = useState(bpToPercent(staff?.commission_bp ?? settings.default_commission_bp).replace("%", ""));
  const [salary, setSalary] = useState<number | null>(staff?.base_salary || null);
  const [active, setActive] = useState(staff ? !!staff.active : true);
  const [notes, setNotes] = useState(staff?.notes ?? "");
  const [overrides, setOverrides] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    const o: Record<string, string> = {};
    for (const r of rates) if (r.commission_bp != null) o[r.department_id] = bpToPercent(r.commission_bp).replace("%", "");
    setOverrides(o);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [staff?.id]);

  const save = async () => {
    setError(null);
    const bp = percentToBp(share);
    if (!name.trim()) return setError(t("Enter a name."));
    if (bp == null) return setError(t("Share must be a number from 0 to 100."));
    const rateRows = [];
    for (const d of depts) {
      const v = (overrides[d.id] ?? "").trim();
      const obp = v === "" ? null : percentToBp(v);
      if (v !== "" && obp == null) return setError(t("The {section} share must be 0 to 100.", { section: t(d.name) }));
      rateRows.push({ department_id: d.id, commission_bp: obp });
    }
    setBusy(true);
    const ok = await run(
      "staff.upsert",
      {
        staff: {
          id: staff?.id ?? crypto.randomUUID(),
          name, phone, specialty, notes,
          commission_bp: bp,
          base_salary: salary ?? 0,
          active: active ? 1 : 0,
          joined_on: staff?.joined_on,
        },
        rates: canPay ? rateRows : undefined,
      },
      staff ? t("Saved") : t("{name} added", { name: name.trim() }),
    );
    setBusy(false);
    if (ok) onClose();
  };

  return (
    <Sheet
      open
      onClose={onClose}
      title={staff ? staff.name : t("Add staff member")}
      footer={
        canEdit ? (
          <div className="flex gap-2">
            {staff && can("payroll.view") && (
              <Button variant="secondary" onClick={() => go("/payroll", { id: staff.id })}>{t("Pay & stats")}</Button>
            )}
            <Button block size="lg" loading={busy} onClick={save}>{t("Save")}</Button>
          </div>
        ) : undefined
      }
    >
      <div className="space-y-4">
        <Field label={t("Full name")} htmlFor="sn">
          <Input id="sn" value={name} onChange={(e) => setName(e.target.value)} disabled={!canEdit} autoComplete="off" />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label={t("Role / skill")} htmlFor="sp">
            <Input id="sp" list="specialties" value={specialty} onChange={(e) => setSpecialty(e.target.value)} disabled={!canEdit} />
            <datalist id="specialties">
              {[tk("Barber"), tk("Nail technician"), tk("Barber & nails"), tk("Pedicurist"), tk("Manicurist"), tk("Assistant"), tk("Cleaner")].map((s) => <option key={s} value={t(s)} />)}
            </datalist>
          </Field>
          <Field label={t("Phone")} htmlFor="ph">
            <Input id="ph" type="tel" value={phone} onChange={(e) => setPhone(e.target.value)} disabled={!canEdit} autoComplete="off" />
          </Field>
        </div>

        <div className="rounded-2xl border border-line p-4">
          <h3 className="font-semibold">{t("Pay agreement")}</h3>
          <p className="mb-3 text-xs text-ink-3">
            {canPay ? t("Set what you agreed with this person.") : t("Only the owner can change pay. New staff start on the default share.")}
          </p>
          <Field label={t("Staff share of each service (%)")} htmlFor="share" hint={t("The part of every service price this person takes home. The rest stays with the shop.")}>
            <Input id="share" inputMode="decimal" value={share} onChange={(e) => setShare(e.target.value)} disabled={!canPay} className="num" />
          </Field>
          {canPay && depts.length > 1 && (
            <details className="mt-3">
              <summary className="min-h-11 cursor-pointer py-2 text-sm font-semibold text-accent">{t("Different share per section (optional)")}</summary>
              <div className="mt-2 grid grid-cols-2 gap-3">
                {depts.map((d) => (
                  <Field key={d.id} label={`${t(d.name)} %`} htmlFor={`o-${d.id}`}>
                    <Input
                      id={`o-${d.id}`}
                      inputMode="decimal"
                      placeholder={share || "—"}
                      value={overrides[d.id] ?? ""}
                      onChange={(e) => setOverrides((o) => ({ ...o, [d.id]: e.target.value }))}
                      className="num"
                    />
                  </Field>
                ))}
              </div>
              <p className="mt-2 text-xs text-ink-3">{t("Leave blank to use the main share.")}</p>
            </details>
          )}
          <div className="mt-3">
            <Field label={t("Fixed monthly salary (optional)")} htmlFor="sal" hint={t("Paid on top of the share. Use this for salaried workers like a cleaner (with 0% share).")}>
              <MoneyInput id="sal" value={salary} onChange={setSalary} disabled={!canPay} />
            </Field>
          </div>
        </div>

        <Field label={t("Notes")} htmlFor="notes">
          <Textarea id="notes" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={!canEdit} />
        </Field>
        {staff && canEdit && (
          <Toggle checked={active} onChange={setActive} label={t("Active")} description={t("Inactive staff can't be picked for new sales. Their history stays.")} />
        )}
        {error && <p className="text-sm text-negative" role="alert">{error}</p>}
      </div>
    </Sheet>
  );
}
