"use client";

import { useEffect, useMemo, useState } from "react";
import { Check, HandHeart, Minus, Plus, Printer, Repeat, Scissors, Trash2, UserRound, X } from "lucide-react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { go } from "@/client/router.ts";
import {
  PAYMENT_LABEL, PAYMENT_METHODS, lineTotal, normalizePhone, saleTotals, staffRate,
  type PaymentMethod, type SaleLineInput, type SalePayload,
} from "@/core/commands.ts";
import { formatDate, toBusinessDate } from "@/core/dates.ts";
import { bpToPercent, currencyDecimals, share, toInputValue } from "@/core/money.ts";
import { clientLookup, saleSplit, stockLevels } from "@/core/reports.ts";
import { SplitCard } from "@/components/SplitCard.tsx";
import { loadReceipt, ReceiptDoc } from "@/components/Receipt.tsx";
import { printContent } from "@/components/print.tsx";
import { haptic, useMediaQuery } from "@/components/native.tsx";
import { itemImage, Photo, sectionImage } from "@/components/media.tsx";
import { Avatar } from "./Boot.tsx";
import {
  Badge, Button, Card, Chip, Empty, Field, IconButton, Input, Money, MoneyInput, PageHeader, Sheet, Spinner, cx, useMoney,
} from "@/components/ui.tsx";

type CartLine = Omit<SaleLineInput, "id" | "position" | "commission_bp"> & { key: string };

interface Catalog {
  depts: { id: string; name: string; kind: "service" | "product" }[];
  services: { id: string; department_id: string; name: string; price: number }[];
  products: { id: string; department_id: string; name: string; price: number; cost: number; track_stock: number; on_hand: number }[];
  staff: { id: string; name: string; specialty: string | null }[];
  usage: { staff_id: string; department_id: string; n: number }[];
}

const CART_KEY = "bms_cart";

function loadCart(): CartLine[] {
  try {
    return JSON.parse(sessionStorage.getItem(CART_KEY) ?? "[]");
  } catch {
    return [];
  }
}

export function SellView() {
  const { engine, run, can, settings, store } = useApp();
  const fmt = useMoney();
  const { data } = useQuery<Catalog>(async (db) => ({
    depts: await db.all("SELECT id, name, kind FROM departments WHERE active = 1 ORDER BY sort, name"),
    services: await db.all("SELECT id, department_id, name, price FROM services WHERE active = 1 ORDER BY sort, name"),
    products: (await stockLevels(db)).filter((p) => p.active),
    staff: await db.all("SELECT id, name, specialty FROM staff WHERE active = 1 ORDER BY name"),
    usage: await db.all(
      "SELECT staff_id, department_id, COUNT(*) AS n FROM sale_lines WHERE staff_id IS NOT NULL GROUP BY staff_id, department_id",
    ),
  }));

  const [dept, setDept] = useState<string | null>(null);
  const [cart, setCart] = useState<CartLine[]>(loadCart);
  const [pendingService, setPendingService] = useState<Catalog["services"][number] | null>(null);
  const [editing, setEditing] = useState<string | null>(null);
  const [customer, setCustomer] = useState("");
  const [phone, setPhone] = useState("");
  const [paying, setPaying] = useState(false);
  const [ticketOpen, setTicketOpen] = useState(false);
  const [done, setDone] = useState<string | null>(null);
  // The ticket shows in a side panel on wide screens and in a sheet on phones; only one is mounted.
  const wide = useMediaQuery("(min-width: 1024px)");

  useEffect(() => {
    sessionStorage.setItem(CART_KEY, JSON.stringify(cart));
  }, [cart]);

  // Each worker's share rate for what they did on this ticket, so the ticket can
  // show who gets what before charging (the same rates the sale will freeze).
  const [rates, setRates] = useState<Record<string, number>>({});
  useEffect(() => {
    let stop = false;
    void (async () => {
      const r: Record<string, number> = {};
      for (const l of cart) {
        if (!l.staff_id) continue;
        const k = `${l.staff_id}|${l.department_id}`;
        if (!(k in r)) r[k] = await staffRate(store, l.staff_id, l.department_id);
      }
      if (!stop) setRates(r);
    })();
    return () => {
      stop = true;
    };
  }, [cart, store]);

  const depts = data?.depts ?? [];
  const activeDept = depts.find((d) => d.id === dept) ?? depts[0];
  const totals = saleTotals(cart);

  const addProduct = (p: Catalog["products"][number]) => {
    setCart((c) => {
      const existing = c.find((l) => l.kind === "product" && l.item_id === p.id && l.discount === 0);
      if (existing) return c.map((l) => (l === existing ? { ...l, qty: l.qty + 1 } : l));
      return [
        ...c,
        {
          key: crypto.randomUUID(), kind: "product", item_id: p.id, name: p.name, department_id: p.department_id,
          staff_id: null, qty: 1, list_price: p.price, unit_price: p.price, discount: 0, unit_cost: p.cost,
        },
      ];
    });
  };

  const addService = (s: Catalog["services"][number], staffId: string) => {
    setCart((c) => [
      ...c,
      {
        key: crypto.randomUUID(), kind: "service", item_id: s.id, name: s.name, department_id: s.department_id,
        staff_id: staffId, qty: 1, list_price: s.price, unit_price: s.price, discount: 0, unit_cost: 0,
      },
    ]);
  };

  const staffFor = (departmentId: string) => {
    const staff = data?.staff ?? [];
    const used = (id: string) => data?.usage.find((u) => u.staff_id === id && u.department_id === departmentId)?.n ?? 0;
    return [...staff].sort((a, b) => used(b.id) - used(a.id) || a.name.localeCompare(b.name));
  };

  const complete = async (payments: SalePayload["payments"], tendered: number, tips: NonNullable<SalePayload["tips"]>) => {
    const lines: SaleLineInput[] = [];
    for (const [i, l] of cart.entries()) {
      const { key: _key, ...rest } = l;
      lines.push({
        ...rest,
        id: crypto.randomUUID(),
        position: i,
        commission_bp: l.staff_id ? await staffRate(store, l.staff_id, l.department_id) : 0,
      });
    }
    const saleId = crypto.randomUUID();
    const ok = await run("sale.create", {
      sale: {
        id: saleId,
        receipt_no: await engine.nextReceiptNo(),
        customer_name: customer.trim() || null,
        customer_phone: normalizePhone(phone),
        note: null,
        business_date: toBusinessDate(),
        created_at: new Date().toISOString(),
        tendered,
      },
      lines,
      payments,
      tips,
    });
    if (ok) {
      setCart([]);
      setCustomer("");
      setPhone("");
      setPaying(false);
      setDone(saleId);
    }
    return ok;
  };

  if (!data) return <Spinner />;

  if (done) return <SaleDone saleId={done} onNew={() => setDone(null)} />;

  const noCatalog = data.services.length === 0 && data.products.length === 0;
  type Tile = { id: string; name: string; price: number; product: Catalog["products"][number] | null; service: Catalog["services"][number] | null };
  const items: Tile[] =
    activeDept?.kind === "product"
      ? data.products.filter((p) => p.department_id === activeDept.id).map((p) => ({ id: p.id, name: p.name, price: p.price, product: p, service: null }))
      : data.services.filter((s) => s.department_id === activeDept?.id).map((s) => ({ id: s.id, name: s.name, price: s.price, product: null, service: s }));

  // Who can get a tip: the people on this ticket first, then everyone else.
  const ticketStaff = [...new Set(cart.map((l) => l.staff_id).filter(Boolean))] as string[];
  const tipStaff = [
    ...ticketStaff.map((id) => data.staff.find((s) => s.id === id)).filter((s): s is Catalog["staff"][number] => !!s),
    ...data.staff.filter((s) => !ticketStaff.includes(s.id)),
  ].map((s) => ({ id: s.id, name: s.name, onTicket: ticketStaff.includes(s.id) }));

  const inCart = (itemId: string) => cart.filter((l) => l.item_id === itemId).reduce((n, l) => n + l.qty, 0);
  const itemCount = cart.reduce((n, l) => n + l.qty, 0);
  // Who gets what on this ticket: every worker's cut, and what the shop keeps.
  const split = (() => {
    const by = new Map<string, number>();
    let staffTotal = 0;
    let ready = true;
    for (const l of cart) {
      if (!l.staff_id) continue;
      const bp = rates[`${l.staff_id}|${l.department_id}`];
      if (bp == null) {
        ready = false;
        continue;
      }
      const cut = share(lineTotal(l), bp);
      by.set(l.staff_id, (by.get(l.staff_id) ?? 0) + cut);
      staffTotal += cut;
    }
    return {
      ready,
      rows: [...by.entries()].map(([id, amount]) => ({ id, amount, name: data.staff.find((s) => s.id === id)?.name ?? "Staff" })),
      shop: totals.total - staffTotal,
    };
  })();
  const charge = () => {
    setTicketOpen(false);
    setPaying(true);
  };

  const ticketBody =
    cart.length === 0 ? (
      <p className="py-6 text-center text-sm text-ink-3">No items yet. Tap a service or drink.</p>
    ) : (
      <>
        <ul className="-mx-1 divide-y divide-line">
          {cart.map((l) => (
            <li key={l.key}>
              <button onClick={() => setEditing(l.key)} className="flex w-full cursor-pointer items-start gap-3 rounded-xl px-1 py-3 text-left hover:bg-surface-2">
                <div className="min-w-0 flex-1">
                  <div className="font-semibold">
                    {l.qty > 1 && <span className="num text-ink-3">{l.qty} × </span>}
                    {l.name}
                  </div>
                  <div className="text-xs text-ink-3">
                    {l.staff_id ? `by ${data.staff.find((s) => s.id === l.staff_id)?.name ?? "?"}` : depts.find((d) => d.id === l.department_id)?.name}
                    {l.unit_price !== l.list_price && " · price changed"}
                    {l.discount > 0 && ` · −${fmt(l.discount)}`}
                  </div>
                </div>
                <Money value={lineTotal(l)} className="font-semibold" />
              </button>
            </li>
          ))}
        </ul>
        {split.ready && split.rows.length > 0 && (
          <div className="mt-2 rounded-2xl bg-surface-2 p-3.5">
            <p className="mb-1.5 text-[11px] font-semibold uppercase tracking-[0.12em] text-ink-3">Who gets what</p>
            {split.rows.map((r) => (
              <div key={r.id} className="flex items-baseline justify-between gap-3 py-0.5 text-sm">
                <span className="truncate">{r.name}</span>
                <Money value={r.amount} className="shrink-0 font-semibold text-accent" />
              </div>
            ))}
            <div className="mt-1.5 flex items-baseline justify-between gap-3 border-t border-line pt-1.5 text-sm">
              <span className="text-ink-2">Shop keeps</span>
              <Money value={split.shop} className="shrink-0 font-semibold" />
            </div>
          </div>
        )}
        <div className="mt-2 space-y-3 border-t border-line pt-3">
          <div className="grid grid-cols-2 gap-2">
            <Field label="Customer phone" htmlFor="cphone">
              <Input id="cphone" type="tel" inputMode="tel" value={phone} onChange={(e) => setPhone(e.target.value)} placeholder="Optional" autoComplete="off" />
            </Field>
            <Field label="Name" htmlFor="cust">
              <Input id="cust" value={customer} onChange={(e) => setCustomer(e.target.value)} placeholder="Walk-in" autoComplete="off" />
            </Field>
          </div>
          <ReturningClient phone={phone} onName={(n) => setCustomer((c) => c || n)} />
          {totals.discount > 0 && (
            <div className="flex justify-between text-sm text-ink-3">
              <span>Discounts</span>
              <Money value={-totals.discount} />
            </div>
          )}
          <div className="flex items-baseline justify-between pt-1">
            <span className="font-semibold">Total</span>
            <Money value={totals.total} className="text-xl font-extrabold" />
          </div>
        </div>
      </>
    );

  return (
    <div className="lg:grid lg:grid-cols-[minmax(0,1fr)_360px] lg:gap-6">
      <div className="min-w-0">
        <PageHeader title="New sale" subtitle="Tap what the customer had. Services ask who did them." />
        {noCatalog ? (
          <Empty
            icon={<Scissors className="size-8" />}
            title="Your price list is empty"
            action={can("catalog.manage") ? <Button onClick={() => go("/catalog")}>Add services and drinks</Button> : undefined}
          >
            {can("catalog.manage") ? "Add your services (haircut, shave, pedicure…) and drinks first." : "Ask the manager or owner to add the price list."}
          </Empty>
        ) : data.staff.length === 0 ? (
          <Empty
            icon={<UserRound className="size-8" />}
            title="No staff added yet"
            action={can("staff.manage") ? <Button onClick={() => go("/staff")}>Add staff</Button> : undefined}
          >
            Each service is credited to the barber or technician who did it, so add your staff first.
          </Empty>
        ) : (
          <>
            {/* Section switcher stays pinned under the top bar while scrolling the items. */}
            <div className="sticky top-[calc(env(safe-area-inset-top)+3.5rem)] z-20 -mx-4 mb-3 bg-bg/85 py-2 backdrop-blur-xl lg:static lg:mx-0 lg:bg-transparent lg:py-0 lg:backdrop-blur-none">
              <div role="tablist" aria-label="Sections" className="chip-scroll flex scroll-px-4 gap-2 overflow-x-auto px-4 py-1 lg:scroll-px-0 lg:px-0">
                {depts.map((d) => {
                  const count = cart.filter((l) => l.department_id === d.id).reduce((n, l) => n + l.qty, 0);
                  return (
                    <button
                      key={d.id}
                      role="tab"
                      aria-selected={d.id === activeDept?.id}
                      onClick={() => {
                        if (d.id !== activeDept?.id) haptic();
                        setDept(d.id);
                      }}
                      className={cx(
                        "flex min-h-12 shrink-0 cursor-pointer items-center gap-2 whitespace-nowrap rounded-full py-1 pl-1 pr-4 text-sm font-semibold transition-[background-color,color,box-shadow,transform] duration-200 active:scale-95",
                        d.id === activeDept?.id
                          ? "bg-primary text-on-primary shadow-cta"
                          : "bg-surface text-ink-2 shadow-card ring-1 ring-line hover:bg-surface-2",
                      )}
                    >
                      <Photo src={sectionImage(d.name, d.kind)} alt="" className={cx("size-9 rounded-full ring-2", d.id === activeDept?.id ? "ring-white/40" : "ring-transparent")} />
                      {d.name}
                      {count > 0 && (
                        <span className={cx("num rounded-full px-1.5 text-[11px] leading-5", d.id === activeDept?.id ? "bg-on-primary/20" : "bg-accent-soft text-accent")}>
                          {count}
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
            {items.length === 0 ? (
              <p className="py-8 text-center text-sm text-ink-3">Nothing in {activeDept?.name} yet.</p>
            ) : (
              <div key={activeDept?.id} className="stagger grid grid-cols-2 gap-3 sm:grid-cols-3 xl:grid-cols-4 2xl:grid-cols-5">
                {items.map((item) => {
                  const product = item.product;
                  const out = !!product && !!product.track_stock && product.on_hand <= 0;
                  const qty = inCart(item.id);
                  return (
                    <button
                      key={item.id}
                      onClick={() => {
                        haptic();
                        if (product) addProduct(product);
                        else if (item.service) setPendingService(item.service);
                      }}
                      className={cx(
                        "press lift group relative flex cursor-pointer flex-col overflow-hidden rounded-[24px] bg-surface p-1.5 text-left shadow-card",
                        qty > 0 ? "ring-2 ring-primary" : "ring-1 ring-line/70",
                      )}
                    >
                      <span className="relative block">
                        <Photo
                          src={itemImage(item.name, activeDept?.name ?? "", activeDept?.kind)}
                          alt=""
                          className={cx("aspect-[4/3] w-full rounded-[19px]", out && "grayscale")}
                          imgClassName="transition-transform duration-500 ease-[var(--ease-out)] group-hover:scale-[1.04]"
                        />
                        {product?.track_stock ? (
                          <span
                            className={cx(
                              "absolute left-2 top-2 rounded-full px-2 py-0.5 text-[11px] font-bold backdrop-blur-md",
                              out ? "bg-negative text-white" : "bg-black/45 text-white",
                            )}
                          >
                            {out ? "Out of stock" : `${product.on_hand} left`}
                          </span>
                        ) : null}
                        {qty > 0 && (
                          <span key={qty} className="num animate-pop absolute right-2 top-2 flex h-7 min-w-7 items-center justify-center rounded-full bg-primary px-2 text-xs font-bold text-on-primary shadow-cta ring-2 ring-white/70" aria-label={`${qty} on ticket`}>
                            {qty}
                          </span>
                        )}
                      </span>
                      <span className="flex flex-1 flex-col px-2 pb-1.5 pt-2.5">
                        <span className="line-clamp-2 text-[15px] font-semibold leading-snug tracking-[-0.01em]">{item.name}</span>
                        <span className="mt-auto flex items-center justify-between gap-1 pt-2">
                          <Money value={item.price} className="text-[15px] font-extrabold text-accent" />
                          <span
                            aria-hidden
                            className={cx(
                              "flex size-8 items-center justify-center rounded-full transition-[background-color,transform] duration-200 group-active:scale-90",
                              qty > 0 ? "bg-primary text-on-primary" : "bg-surface-2 text-ink",
                            )}
                          >
                            <Plus className="size-4" />
                          </span>
                        </span>
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </>
        )}
      </div>

      {/* Desktop: ticket beside the items */}
      <div className="hidden lg:block">
        <div className="sticky top-6">
          <Card className="p-4">
            <div className="mb-2 flex items-center justify-between">
              <h2 className="font-bold">Ticket</h2>
              {cart.length > 0 && (
                <button className="min-h-11 cursor-pointer px-2 text-sm font-semibold text-negative" onClick={() => setCart([])}>
                  Clear
                </button>
              )}
            </div>
            {wide && ticketBody}
          </Card>
          <Button size="lg" block className="mt-3" disabled={cart.length === 0} onClick={charge}>
            {cart.length === 0 ? "Charge" : `Charge ${fmt(totals.total)}`}
          </Button>
        </div>
      </div>

      {/* Phones: floating cart bar above the tab bar */}
      {cart.length > 0 && (
        <>
          <div className="h-24 lg:hidden" />
          {/* Sits just above the floating tab bar (58px pill + 12px padding + gap). */}
          <div className="no-print animate-toast-in fixed inset-x-0 bottom-[calc(max(env(safe-area-inset-bottom),0.75rem)+80px)] z-30 px-4 lg:hidden">
            <div className="theme-panel mx-auto flex max-w-md items-center gap-2 rounded-[26px] bg-panel/95 p-2 shadow-float ring-1 ring-white/5 backdrop-blur-xl">
              <button
                onClick={() => setTicketOpen(true)}
                className="press flex min-h-12 min-w-0 flex-1 cursor-pointer items-center gap-3 rounded-[20px] px-2 text-left hover:bg-surface"
              >
                <span key={itemCount} className="num animate-pop flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-sm font-bold">
                  {itemCount}
                </span>
                <span className="min-w-0">
                  <span className="block text-sm font-semibold leading-tight">View ticket</span>
                  <Money value={totals.total} className="block text-xs text-ink-3" />
                </span>
              </button>
              <button
                onClick={charge}
                className="press flex min-h-12 shrink-0 cursor-pointer items-center justify-center rounded-[20px] bg-primary px-5 text-[15px] font-bold text-on-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.25),0_8px_20px_-8px_rgb(239_116_64/0.8)]"
              >
                Charge {fmt(totals.total)}
              </button>
            </div>
          </div>
        </>
      )}

      <Sheet
        open={ticketOpen}
        onClose={() => setTicketOpen(false)}
        title={`Ticket · ${itemCount} item${itemCount === 1 ? "" : "s"}`}
        footer={
          <div className="flex gap-2">
            <Button
              variant="secondary"
              className="text-negative"
              onClick={() => {
                setCart([]);
                setTicketOpen(false);
              }}
            >
              Clear
            </Button>
            <Button size="lg" block disabled={cart.length === 0} onClick={charge}>
              Charge {fmt(totals.total)}
            </Button>
          </div>
        }
      >
        {!wide && ticketBody}
      </Sheet>

      <StaffPicker
        service={pendingService}
        sectionName={depts.find((d) => d.id === pendingService?.department_id)?.name ?? ""}
        staff={pendingService ? staffFor(pendingService.department_id) : []}
        onPick={(staffId) => {
          if (pendingService) addService(pendingService, staffId);
          setPendingService(null);
        }}
        onClose={() => setPendingService(null)}
      />

      <LineEditor
        line={cart.find((l) => l.key === editing) ?? null}
        staff={data.staff}
        onClose={() => setEditing(null)}
        onChange={(next) => setCart((c) => c.map((l) => (l.key === next.key ? next : l)))}
        onRemove={(key) => {
          setCart((c) => c.filter((l) => l.key !== key));
          setEditing(null);
        }}
      />

      <PaySheet
        open={paying}
        total={totals.total}
        staff={tipStaff}
        onClose={() => setPaying(false)}
        onPay={complete}
        currency={settings.currency}
      />
    </div>
  );
}

function StaffPicker({
  service, sectionName, staff, onPick, onClose,
}: {
  service: { name: string; price: number; department_id: string } | null;
  sectionName: string;
  staff: Catalog["staff"];
  onPick: (id: string) => void;
  onClose: () => void;
}) {
  const { store } = useApp();
  const [rates, setRates] = useState<Record<string, number>>({});
  useEffect(() => {
    if (!service) return;
    void (async () => {
      const r: Record<string, number> = {};
      for (const s of staff) r[s.id] = await staffRate(store, s.id, service.department_id);
      setRates(r);
    })();
  }, [service, staff, store]);
  return (
    <Sheet open={!!service} onClose={onClose} title={service ? `Who did the ${service.name.toLowerCase()}?` : ""}>
      {service && (
        <>
          {/* Product-page header: the service's photo, its section and price. */}
          <div className="relative mb-5 overflow-hidden rounded-3xl ring-1 ring-line">
            <Photo src={itemImage(service.name, sectionName)} alt="" priority className="aspect-[16/8] w-full" />
            <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_40%,rgb(14_10_8/0.85))]" />
            <span className="absolute left-3 top-3 rounded-full bg-white/90 px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.08em] text-[#1c1612] backdrop-blur">
              {sectionName}
            </span>
            <span className="absolute inset-x-0 bottom-0 flex items-end justify-between gap-3 p-4 text-white">
              <span className="text-lg font-bold uppercase leading-tight tracking-[0.02em]">{service.name}</span>
              <Money value={service.price} className="shrink-0 rounded-full bg-primary px-3 py-1 text-sm font-extrabold text-white shadow-cta" />
            </span>
          </div>
          <p className="mb-3 text-[13px] font-semibold uppercase tracking-[0.12em] text-ink-3">Done by</p>
          {/* Tap a person to add it: one tap, like picking a size. */}
          <div className="stagger grid grid-cols-2 gap-2.5 sm:grid-cols-3">
            {staff.map((s) => (
              <button
                key={s.id}
                onClick={() => onPick(s.id)}
                className="press group flex cursor-pointer flex-col items-center gap-2 rounded-[22px] bg-surface px-3 pb-3.5 pt-4 text-center ring-1 ring-line-strong transition-[background-color,box-shadow] duration-200 hover:bg-surface-2 hover:ring-primary"
              >
                <Avatar name={s.name} />
                <span className="w-full truncate text-sm font-semibold">{s.name}</span>
                {rates[s.id] != null ? (
                  <span className="rounded-full bg-accent-soft px-2 py-0.5 text-[11px] font-bold text-accent">{bpToPercent(rates[s.id])} share</span>
                ) : (
                  <span className="h-[22px]" />
                )}
              </button>
            ))}
          </div>
        </>
      )}
    </Sheet>
  );
}

function LineEditor({
  line, staff, onClose, onChange, onRemove,
}: {
  line: CartLine | null;
  staff: Catalog["staff"];
  onClose: () => void;
  onChange: (l: CartLine) => void;
  onRemove: (key: string) => void;
}) {
  const { can } = useApp();
  if (!line) return null;
  return (
    <Sheet
      open
      onClose={onClose}
      title={line.name}
      footer={
        <div className="flex gap-2">
          <Button variant="secondary" onClick={() => onRemove(line.key)} className="text-negative">
            <Trash2 className="size-4" /> Remove
          </Button>
          <Button block onClick={onClose}>
            Done
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        {line.kind === "service" ? (
          <Field label="Done by" htmlFor="by">
            <div className="grid grid-cols-2 gap-2">
              {staff.map((s) => (
                <Chip key={s.id} active={line.staff_id === s.id} onClick={() => onChange({ ...line, staff_id: s.id })}>
                  {s.name}
                </Chip>
              ))}
            </div>
          </Field>
        ) : null}
        <Field label="Quantity">
          <div className="flex items-center gap-3">
            <IconButton label="One less" className="border border-line-strong" disabled={line.qty <= 1} onClick={() => onChange({ ...line, qty: line.qty - 1, discount: Math.min(line.discount, (line.qty - 1) * line.unit_price) })}>
              <Minus className="size-5" />
            </IconButton>
            <span className="num w-10 text-center text-xl font-bold">{line.qty}</span>
            <IconButton label="One more" className="border border-line-strong" onClick={() => onChange({ ...line, qty: line.qty + 1 })}>
              <Plus className="size-5" />
            </IconButton>
          </div>
        </Field>
        {can("sale.editPrice") && (
          <Field label="Price (each)" htmlFor="price" hint={line.unit_price !== line.list_price ? "Changed from the price list. This is recorded." : undefined}>
            <MoneyInput id="price" value={line.unit_price} onChange={(v) => onChange({ ...line, unit_price: v ?? 0, discount: Math.min(line.discount, line.qty * (v ?? 0)) })} />
          </Field>
        )}
        {can("sale.discount") && (
          <Field label="Discount" htmlFor="disc" hint="Taken off this item. Staff share is calculated after the discount.">
            <MoneyInput id="disc" value={line.discount || null} onChange={(v) => onChange({ ...line, discount: Math.min(v ?? 0, line.qty * line.unit_price) })} />
          </Field>
        )}
      </div>
    </Sheet>
  );
}

interface PayRow {
  id: string;
  method: PaymentMethod;
  amount: number | null;
  reference: string;
}

function PaySheet({
  open, total: itemsTotal, staff, onClose, onPay, currency,
}: {
  open: boolean;
  total: number;
  staff: { id: string; name: string; onTicket: boolean }[];
  onClose: () => void;
  onPay: (payments: SalePayload["payments"], tendered: number, tips: NonNullable<SalePayload["tips"]>) => Promise<boolean>;
  currency: string;
}) {
  const fmt = useMoney();
  const [rows, setRows] = useState<PayRow[]>([]);
  const [tendered, setTendered] = useState<number | null>(null);
  const [busy, setBusy] = useState(false);
  const [tipOpen, setTipOpen] = useState(false);
  const [tip, setTip] = useState<number | null>(null);
  const [tipTo, setTipTo] = useState<string | null>(null);

  const tipAmount = tipOpen ? tip ?? 0 : 0;
  const total = itemsTotal + tipAmount;

  useEffect(() => {
    if (open) {
      setRows([{ id: crypto.randomUUID(), method: "cash", amount: itemsTotal, reference: "" }]);
      setTendered(null);
      setTipOpen(false);
      setTip(null);
      setTipTo(null);
    }
  }, [open, itemsTotal]);

  // With one payment, it always covers the whole amount, tip included.
  useEffect(() => {
    setRows((rs) => (rs.length === 1 && rs[0].amount !== total ? [{ ...rs[0], amount: total }] : rs));
  }, [total]);

  const onTicket = staff.filter((s) => s.onTicket);
  const tipTarget = tipTo ?? (onTicket.length === 1 ? onTicket[0].id : null);
  const tipInvalid = tipAmount > 0 && !tipTarget;

  const split = rows.length > 1;
  const sum = rows.reduce((n, r) => n + (r.amount ?? 0), 0);
  const remaining = total - sum;
  const cash = rows.filter((r) => r.method === "cash").reduce((n, r) => n + (r.amount ?? 0), 0);
  const change = tendered != null && tendered > cash ? tendered - cash : 0;
  const shortCash = tendered != null && tendered < cash;
  const valid = remaining === 0 && rows.every((r) => (r.amount ?? 0) > 0) && !shortCash && !tipInvalid;

  const quick = useMemo(() => {
    if (cash <= 0) return [];
    const major = ["USD", "EUR", "GBP"].includes(currency) ? [1, 5, 10, 20, 50, 100] : [50, 100, 200, 500, 1000, 2000, 5000];
    const steps = major.map((s) => s * 10 ** currencyDecimals(currency));
    const out = new Set<number>([cash]);
    for (const s of steps) {
      const up = Math.ceil(cash / s) * s;
      if (up > cash) out.add(up);
      if (out.size >= 4) break;
    }
    return [...out];
  }, [cash, currency]);

  const setRow = (id: string, patch: Partial<PayRow>) => setRows((rs) => rs.map((r) => (r.id === id ? { ...r, ...patch } : r)));

  return (
    <Sheet
      open={open}
      onClose={onClose}
      title={`Charge ${fmt(total)}`}
      footer={
        <Button
          size="lg"
          block
          variant="positive"
          disabled={!valid}
          loading={busy}
          onClick={async () => {
            setBusy(true);
            await onPay(
              rows.map((r) => ({ id: r.id, method: r.method, amount: r.amount ?? 0, reference: r.reference.trim() || null })),
              tendered ?? cash,
              tipAmount > 0 && tipTarget ? [{ id: crypto.randomUUID(), staff_id: tipTarget, amount: tipAmount }] : [],
            );
            setBusy(false);
          }}
        >
          <Check className="size-5" /> Complete sale
        </Button>
      }
    >
      <div className="space-y-5">
        {staff.length > 0 && (
          tipOpen ? (
            <div className="rounded-2xl border border-line p-3">
              <div className="mb-2 flex items-center justify-between">
                <span className="flex items-center gap-2 text-sm font-semibold"><HandHeart className="size-4 text-accent" /> Tip</span>
                <button className="flex min-h-11 cursor-pointer items-center gap-1 px-2 text-sm font-semibold text-ink-3" onClick={() => { setTipOpen(false); setTip(null); }}>
                  <X className="size-4" /> No tip
                </button>
              </div>
              <Field label="Tip amount" htmlFor="tip" hint="Goes 100% to the person you pick, on top of the bill. It is added to their pay, not to the shop's sales.">
                <MoneyInput id="tip" value={tip} onChange={setTip} />
              </Field>
              <div className="mt-3">
                <div className="mb-1.5 text-sm font-medium text-ink-2">Who gets it</div>
                <div className="flex flex-wrap gap-2">
                  {(onTicket.length ? onTicket : staff).map((s) => (
                    <Chip key={s.id} active={tipTarget === s.id} onClick={() => setTipTo(s.id)}>{s.name}</Chip>
                  ))}
                </div>
                {tipInvalid && <p className="mt-1.5 text-xs text-negative">Pick who gets the tip.</p>}
              </div>
            </div>
          ) : (
            <Button variant="secondary" block onClick={() => setTipOpen(true)}>
              <HandHeart className="size-4" /> Add a tip
            </Button>
          )
        )}
        {tipAmount > 0 && (
          <div className="flex justify-between rounded-xl bg-surface-2 px-4 py-2.5 text-sm">
            <span className="text-ink-2">Bill <Money value={itemsTotal} /> + tip <Money value={tipAmount} /></span>
            <Money value={total} className="font-bold" />
          </div>
        )}
        {rows.map((r, i) => (
          <div key={r.id} className={cx(split && "rounded-2xl border border-line p-3")}>
            {split && (
              <div className="mb-2 flex items-center justify-between">
                <span className="text-sm font-semibold text-ink-3">Payment {i + 1}</span>
                <button className="min-h-11 cursor-pointer px-2 text-sm font-semibold text-negative" onClick={() => setRows((rs) => rs.filter((x) => x.id !== r.id))}>
                  Remove
                </button>
              </div>
            )}
            <div role="radiogroup" aria-label="Payment method" className="grid grid-cols-2 gap-2">
              {PAYMENT_METHODS.map((m) => (
                <Chip key={m} active={r.method === m} onClick={() => setRow(r.id, { method: m })}>
                  {PAYMENT_LABEL[m]}
                </Chip>
              ))}
            </div>
            {split && (
              <div className="mt-3">
                <Field label="Amount" htmlFor={`amt-${r.id}`}>
                  <MoneyInput id={`amt-${r.id}`} value={r.amount} onChange={(v) => setRow(r.id, { amount: v })} />
                </Field>
              </div>
            )}
            {r.method !== "cash" && (
              <div className="mt-3">
                <Field label={r.method === "mobile" ? "Transaction code" : "Reference (optional)"} htmlFor={`ref-${r.id}`} hint={r.method === "mobile" ? "Check it on the shop's till statement, not the customer's SMS." : undefined}>
                  <Input id={`ref-${r.id}`} value={r.reference} onChange={(e) => setRow(r.id, { reference: e.target.value.toUpperCase() })} autoCapitalize="characters" />
                </Field>
              </div>
            )}
          </div>
        ))}

        {split ? (
          <div className="flex items-center justify-between rounded-xl bg-surface-2 px-4 py-3 text-sm font-semibold">
            <span>{remaining === 0 ? "Fully covered" : remaining > 0 ? "Still to pay" : "Too much"}</span>
            <Money value={remaining} className={cx(remaining !== 0 && "text-negative")} />
          </div>
        ) : null}

        <Button
          variant="secondary"
          block
          onClick={() =>
            setRows((rs) => {
              const first = rs.length === 1 ? [{ ...rs[0], amount: rs[0].amount }] : rs;
              return [...first, { id: crypto.randomUUID(), method: "mobile", amount: Math.max(remaining, 0) || null, reference: "" }];
            })
          }
        >
          <Plus className="size-4" /> Split payment
        </Button>

        {cash > 0 && (
          <div className="space-y-2 border-t border-line pt-4">
            <Field label="Cash received" htmlFor="tendered" error={shortCash ? "Less than the cash due." : null}>
              <MoneyInput id="tendered" value={tendered} onChange={setTendered} placeholder={toInputValue(cash, currency)} />
            </Field>
            <div className="flex flex-wrap gap-2">
              {quick.map((q) => (
                <Chip key={q} active={tendered === q} onClick={() => setTendered(q)}>
                  {q === cash ? "Exact" : fmt(q)}
                </Chip>
              ))}
            </div>
            {change > 0 && (
              <div className="flex items-center justify-between rounded-xl bg-accent-soft px-4 py-3 text-accent">
                <span className="font-semibold">Give change</span>
                <Money value={change} className="text-2xl font-bold" />
              </div>
            )}
          </div>
        )}
      </div>
    </Sheet>
  );
}

/** Shows who this customer is, from their phone number, so the till can greet them properly. */
function ReturningClient({ phone, onName }: { phone: string; onName: (name: string) => void }) {
  const normalized = normalizePhone(phone);
  const { data } = useQuery(async (db) => (normalized && normalized.replace("+", "").length >= 9 ? clientLookup(db, normalized) : null), [normalized]);
  useEffect(() => {
    if (data?.name) onName(data.name);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data?.name]);
  if (!data) return null;
  return (
    <div className="flex items-start gap-2.5 rounded-xl bg-accent-soft px-3 py-2.5 text-sm text-accent">
      <Repeat className="mt-0.5 size-4 shrink-0" />
      <div className="min-w-0">
        <div className="font-semibold">
          {data.name ?? "Returning client"} · visit {data.visits + 1}
        </div>
        <div className="text-xs opacity-90">
          {[
            data.last_date && `Last came ${formatDate(data.last_date, { day: "numeric", month: "short" })}`,
            // "Usually" only means something after a couple of visits; before that, say what happened last time.
            data.usualStaff[0]?.n >= 2 ? `usually ${data.usualStaff[0].name}` : data.lastStaff && `last served by ${data.lastStaff.replace(/,/g, " & ")}`,
            data.favourites[0]?.n >= 2 ? `likes ${data.favourites.filter((f) => f.n >= 2).map((f) => f.name).join(", ")}` : data.lastItems && `last had ${data.lastItems}`,
          ].filter(Boolean).join(" · ")}
        </div>
      </div>
    </div>
  );
}

function SaleDone({ saleId, onNew }: { saleId: string; onNew: () => void }) {
  const { settings, can } = useApp();
  const { data } = useQuery(async (db) => {
    const receipt = await loadReceipt(db, saleId);
    return receipt ? { ...receipt, split: await saleSplit(db, saleId) } : null;
  }, [saleId]);
  useEffect(() => haptic("success"), []);
  if (!data) return <Spinner />;
  return (
    <div className="animate-page-in mx-auto max-w-md">
      {/* Celebration card: the check lands, rings ripple out once. */}
      <section className="theme-panel grain relative isolate mb-4 overflow-hidden rounded-[30px] bg-panel px-6 pb-7 pt-9 text-center shadow-float ring-1 ring-white/10">
        <div aria-hidden className="absolute -top-24 left-1/2 -z-10 size-80 -translate-x-1/2 animate-glow rounded-full bg-[radial-gradient(circle,rgb(79_209_139/0.35),transparent_65%)] blur-2xl" />
        <div className="relative mx-auto mb-5 flex size-20 items-center justify-center">
          <span aria-hidden className="absolute inset-0 animate-[ripple_1.6s_var(--ease-out)_both] rounded-full ring-2 ring-[#4fd18b]/50" />
          <span aria-hidden className="absolute inset-0 animate-[ripple_1.6s_var(--ease-out)_0.25s_both] rounded-full ring-2 ring-[#4fd18b]/30" />
          <span className="animate-pop flex size-20 items-center justify-center rounded-full bg-[#18a35f] text-white shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_14px_32px_-10px_rgb(24_163_95/0.8)]">
            <Check className="size-9 stroke-[2.5]" />
          </span>
        </div>
        <p className="text-[13px] font-semibold uppercase tracking-[0.18em] text-ink-3">Sale recorded · {data.sale.receipt_no}</p>
        <Money value={data.sale.total} className="mt-2 block font-display text-[40px] font-bold leading-none tracking-[-0.04em]" />
        {data.sale.change_due > 0 && (
          <p className="mx-auto mt-5 flex w-fit items-center gap-2 rounded-2xl bg-primary px-4 py-2.5 font-semibold text-on-primary shadow-cta">
            Change to give <Money value={data.sale.change_due} className="font-extrabold" />
          </p>
        )}
      </section>
      <div className="mb-6 grid grid-cols-[auto_1fr] gap-2">
        <Button variant="secondary" size="lg" onClick={() => printContent(<ReceiptDoc data={data} settings={settings} />)} aria-label="Print receipt">
          <Printer className="size-5" />
        </Button>
        <Button size="lg" onClick={onNew}>
          Next customer
        </Button>
      </div>
      {can("payroll.view") && (
        <div className="mb-5">
          <h2 className="mb-2 text-xs font-semibold uppercase tracking-[0.08em] text-ink-3">Who gets what</h2>
          <SplitCard split={data.split} />
        </div>
      )}
      <Card className="overflow-hidden p-4">
        <div className="rounded-lg bg-white p-2">
          <ReceiptDoc data={data} settings={{ ...settings, paper_width: "a4" }} />
        </div>
      </Card>
    </div>
  );
}
