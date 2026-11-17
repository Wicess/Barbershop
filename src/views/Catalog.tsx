"use client";

import { useEffect, useState } from "react";
import { PackagePlus, Pencil, Plus } from "lucide-react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { setParams } from "@/client/router.ts";
import { toBusinessDate } from "@/core/dates.ts";
import { formatMoney } from "@/core/money.ts";
import { stockLevels } from "@/core/reports.ts";
import { SUGGESTIONS } from "@/core/seed.ts";
import {
  Badge, Button, Card, Chip, Empty, Field, Input, Money, MoneyInput, PageHeader, Sheet, Spinner, Toggle, cx,
} from "@/components/ui.tsx";

interface Dept { id: string; name: string; kind: "service" | "product"; sort: number; active: number }
interface Service { id: string; department_id: string; name: string; price: number; active: number; sort: number }
type Product = Awaited<ReturnType<typeof stockLevels>>[number];

export function CatalogView({ params }: { params: URLSearchParams }) {
  const { settings } = useApp();
  const { data } = useQuery(async (db) => ({
    depts: await db.all<Dept>("SELECT * FROM departments ORDER BY sort, name"),
    services: await db.all<Service>("SELECT * FROM services ORDER BY sort, name"),
    products: await stockLevels(db),
  }));
  const [editService, setEditService] = useState<Service | "new" | null>(null);
  const [editProduct, setEditProduct] = useState<Product | "new" | null>(null);
  const [editDept, setEditDept] = useState<Dept | "new" | null>(null);
  const [stockFor, setStockFor] = useState<{ product: Product; mode: "purchase" | "spoilage" | "count" } | null>(null);

  if (!data) return <Spinner />;
  const dept = data.depts.find((d) => d.id === params.get("d")) ?? data.depts.find((d) => d.active) ?? data.depts[0];
  const isProduct = dept?.kind === "product";
  const services = data.services.filter((s) => s.department_id === dept?.id);
  const products = data.products.filter((p) => p.department_id === dept?.id);

  return (
    <div>
      <PageHeader title="Price list & stock" subtitle="What the shop sells, grouped into sections" />
      <div className="chip-scroll -mx-4 mb-4 flex gap-2 overflow-x-auto px-4 pb-1">
        {data.depts.map((d) => (
          <Chip key={d.id} active={d.id === dept?.id} onClick={() => setParams({ d: d.id })}>
            {d.name}{!d.active && " (hidden)"}
          </Chip>
        ))}
        <Chip onClick={() => setEditDept("new")}>+ Section</Chip>
      </div>

      {dept && (
        <div className="mb-3 flex items-center justify-between gap-2">
          <p className="text-sm text-ink-3">
            {isProduct ? "Products sold over the counter. Profit = selling price − cost price." : "Services. Each one is credited to the staff member who does it."}
          </p>
          <Button variant="ghost" size="sm" onClick={() => setEditDept(dept)}><Pencil className="size-4" /> Section</Button>
        </div>
      )}

      {dept && !isProduct && (
        <>
          {services.length === 0 ? (
            <Empty title={`No services in ${dept.name}`} action={<Button onClick={() => setEditService("new")}><Plus className="size-4" /> Add service</Button>}>
              Add each service with its normal price.
            </Empty>
          ) : (
            <Card className="divide-y divide-line">
              {services.map((s) => (
                <button key={s.id} onClick={() => setEditService(s)} className="flex w-full cursor-pointer items-center gap-3 px-4 py-3 text-left hover:bg-surface-2">
                  <span className={cx("flex-1 font-semibold", !s.active && "text-ink-3 line-through")}>{s.name}</span>
                  <Money value={s.price} className="font-semibold" />
                </button>
              ))}
            </Card>
          )}
          {services.length > 0 && <Button className="mt-3" variant="secondary" block onClick={() => setEditService("new")}><Plus className="size-4" /> Add service</Button>}
        </>
      )}

      {dept && isProduct && (
        <>
          {products.length === 0 ? (
            <Empty title={`No products in ${dept.name}`} action={<Button onClick={() => setEditProduct("new")}><Plus className="size-4" /> Add product</Button>}>
              Add drinks or other items with their selling price and what they cost you.
            </Empty>
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {products.map((p) => {
                const margin = p.price - p.cost;
                const low = p.track_stock && p.on_hand <= 5;
                return (
                  <Card key={p.id} className="p-4">
                    <div className="flex items-start justify-between gap-2">
                      <button onClick={() => setEditProduct(p)} className="cursor-pointer text-left">
                        <div className={cx("font-semibold", !p.active && "text-ink-3 line-through")}>{p.name}</div>
                        <div className="text-xs text-ink-3">
                          Sells <Money value={p.price} /> · costs <Money value={p.cost} /> · profit{" "}
                          <span className={margin < 0 ? "text-negative" : "text-positive"}>{formatMoney(margin, settings.currency)}</span>
                        </div>
                      </button>
                      {p.track_stock ? <Badge tone={p.on_hand <= 0 ? "negative" : low ? "warning" : "neutral"}>{p.on_hand} in stock</Badge> : <Badge>No stock count</Badge>}
                    </div>
                    {p.track_stock ? (
                      <div className="mt-3 grid grid-cols-3 gap-2">
                        <Button size="sm" variant="secondary" onClick={() => setStockFor({ product: p, mode: "purchase" })}><PackagePlus className="size-4" /> Restock</Button>
                        <Button size="sm" variant="secondary" onClick={() => setStockFor({ product: p, mode: "spoilage" })}>Spoiled</Button>
                        <Button size="sm" variant="secondary" onClick={() => setStockFor({ product: p, mode: "count" })}>Count</Button>
                      </div>
                    ) : null}
                  </Card>
                );
              })}
            </div>
          )}
          {products.length > 0 && <Button className="mt-3" variant="secondary" block onClick={() => setEditProduct("new")}><Plus className="size-4" /> Add product</Button>}
        </>
      )}

      {editService && dept && <ServiceSheet service={editService === "new" ? null : editService} dept={dept} onClose={() => setEditService(null)} />}
      {editProduct && dept && <ProductSheet product={editProduct === "new" ? null : editProduct} dept={dept} onClose={() => setEditProduct(null)} />}
      {editDept && <DeptSheet dept={editDept === "new" ? null : editDept} onClose={() => setEditDept(null)} onCreated={(id) => setParams({ d: id })} />}
      {stockFor && <StockSheet product={stockFor.product} mode={stockFor.mode} onClose={() => setStockFor(null)} />}
    </div>
  );
}

function ServiceSheet({ service, dept, onClose }: { service: Service | null; dept: Dept; onClose: () => void }) {
  const { run } = useApp();
  const [name, setName] = useState(service?.name ?? "");
  const [price, setPrice] = useState<number | null>(service?.price ?? null);
  const [active, setActive] = useState(service ? !!service.active : true);
  const [busy, setBusy] = useState(false);
  const suggestions = SUGGESTIONS[dept.id] ?? [];
  return (
    <Sheet
      open
      onClose={onClose}
      title={service ? "Edit service" : `New ${dept.name.toLowerCase()} service`}
      footer={
        <Button block size="lg" loading={busy} disabled={!name.trim() || price == null} onClick={async () => {
          setBusy(true);
          const ok = await run("service.upsert", { id: service?.id ?? crypto.randomUUID(), department_id: dept.id, name, price: price ?? 0, active: active ? 1 : 0, sort: service?.sort }, "Saved");
          setBusy(false);
          if (ok) onClose();
        }}>Save</Button>
      }
    >
      <div className="space-y-4">
        <Field label="Service name" htmlFor="svn">
          <Input id="svn" value={name} onChange={(e) => setName(e.target.value)} autoFocus />
        </Field>
        {!service && suggestions.length > 0 && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => <Chip key={s} active={name === s} onClick={() => setName(s)}>{s}</Chip>)}
          </div>
        )}
        <Field label="Price" htmlFor="svp" hint="The normal price. Staff share is worked out from what the customer actually pays.">
          <MoneyInput id="svp" value={price} onChange={setPrice} />
        </Field>
        {service && <Toggle checked={active} onChange={setActive} label="Available for sale" />}
      </div>
    </Sheet>
  );
}

function ProductSheet({ product, dept, onClose }: { product: Product | null; dept: Dept; onClose: () => void }) {
  const { run } = useApp();
  const [name, setName] = useState(product?.name ?? "");
  const [price, setPrice] = useState<number | null>(product?.price ?? null);
  const [cost, setCost] = useState<number | null>(product?.cost ?? null);
  const [track, setTrack] = useState(product ? !!product.track_stock : true);
  const [active, setActive] = useState(product ? !!product.active : true);
  const [opening, setOpening] = useState("");
  const [busy, setBusy] = useState(false);
  const suggestions = SUGGESTIONS[dept.id] ?? SUGGESTIONS["dept-drinks"];
  return (
    <Sheet
      open
      onClose={onClose}
      title={product ? "Edit product" : `New product in ${dept.name}`}
      footer={
        <Button block size="lg" loading={busy} disabled={!name.trim() || price == null || cost == null} onClick={async () => {
          setBusy(true);
          const id = product?.id ?? crypto.randomUUID();
          let ok = await run("product.upsert", { id, department_id: dept.id, name, price: price ?? 0, cost: cost ?? 0, track_stock: track ? 1 : 0, active: active ? 1 : 0, sort: product?.sort });
          const qty = parseInt(opening, 10);
          if (ok && !product && track && qty > 0) {
            ok = await run("stock.move", { id: crypto.randomUUID(), product_id: id, qty, reason: "adjustment", unit_cost: cost ?? 0, note: "Opening stock", business_date: toBusinessDate() });
          }
          setBusy(false);
          if (ok) onClose();
        }}>Save</Button>
      }
    >
      <div className="space-y-4">
        <Field label="Name" htmlFor="pn"><Input id="pn" value={name} onChange={(e) => setName(e.target.value)} autoFocus /></Field>
        {!product && (
          <div className="flex flex-wrap gap-2">
            {suggestions.map((s) => <Chip key={s} active={name === s} onClick={() => setName(s)}>{s}</Chip>)}
          </div>
        )}
        <div className="grid grid-cols-2 gap-3">
          <Field label="Selling price" htmlFor="pp"><MoneyInput id="pp" value={price} onChange={setPrice} /></Field>
          <Field label="Cost price" htmlFor="pc" hint="What one costs you"><MoneyInput id="pc" value={cost} onChange={setCost} /></Field>
        </div>
        <Toggle checked={track} onChange={setTrack} label="Count stock" description="Each sale takes one out of stock; restocks add to it." />
        {!product && track && (
          <Field label="How many do you have now?" htmlFor="po">
            <Input id="po" inputMode="numeric" value={opening} onChange={(e) => setOpening(e.target.value.replace(/\D/g, ""))} placeholder="0" className="num" />
          </Field>
        )}
        {product && <Toggle checked={active} onChange={setActive} label="Available for sale" />}
      </div>
    </Sheet>
  );
}

function DeptSheet({ dept, onClose, onCreated }: { dept: Dept | null; onClose: () => void; onCreated: (id: string) => void }) {
  const { run } = useApp();
  const [name, setName] = useState(dept?.name ?? "");
  const [kind, setKind] = useState<"service" | "product">(dept?.kind ?? "service");
  const [active, setActive] = useState(dept ? !!dept.active : true);
  const [busy, setBusy] = useState(false);
  return (
    <Sheet
      open
      onClose={onClose}
      title={dept ? "Edit section" : "New section"}
      footer={
        <Button block size="lg" loading={busy} disabled={!name.trim()} onClick={async () => {
          setBusy(true);
          const id = dept?.id ?? `dept-${crypto.randomUUID()}`;
          const ok = await run("department.upsert", { id, name, kind, active: active ? 1 : 0, sort: dept?.sort }, "Saved");
          setBusy(false);
          if (ok) {
            onClose();
            if (!dept) onCreated(id);
          }
        }}>Save</Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-3">Sections are how the reports split your money, e.g. Barbering, Manicure, Pedicure, Drinks. Each section gets its own profit figure.</p>
        <Field label="Section name" htmlFor="dn"><Input id="dn" value={name} onChange={(e) => setName(e.target.value)} placeholder="e.g. Facials, Snacks" /></Field>
        {!dept && (
          <Field label="It sells">
            <div className="flex gap-2">
              <Chip active={kind === "service"} onClick={() => setKind("service")}>Services (done by staff)</Chip>
              <Chip active={kind === "product"} onClick={() => setKind("product")}>Products (drinks, items)</Chip>
            </div>
          </Field>
        )}
        {dept && <Toggle checked={active} onChange={setActive} label="Show at the till" description="Hidden sections keep their history in reports." />}
      </div>
    </Sheet>
  );
}

function StockSheet({ product, mode, onClose }: { product: Product; mode: "purchase" | "spoilage" | "count"; onClose: () => void }) {
  const { run } = useApp();
  const [qty, setQty] = useState("");
  const [unitCost, setUnitCost] = useState<number | null>(product.cost);
  const [paidFrom, setPaidFrom] = useState<"till" | "other">("other");
  const [note, setNote] = useState("");
  const [busy, setBusy] = useState(false);
  useEffect(() => setQty(mode === "count" ? String(product.on_hand) : ""), [mode, product.on_hand]);
  const n = parseInt(qty, 10);
  const diff = mode === "count" ? n - product.on_hand : 0;
  const valid = Number.isFinite(n) && (mode === "count" ? diff !== 0 : n > 0);
  const titles = { purchase: "Restock", spoilage: "Spoiled or damaged", count: "Stock count" };
  return (
    <Sheet
      open
      onClose={onClose}
      title={`${titles[mode]} · ${product.name}`}
      footer={
        <Button block size="lg" loading={busy} disabled={!valid} onClick={async () => {
          setBusy(true);
          const ok = await run("stock.move", {
            id: crypto.randomUUID(),
            product_id: product.id,
            qty: mode === "purchase" ? n : mode === "spoilage" ? -n : diff,
            reason: mode === "count" ? "adjustment" : mode,
            unit_cost: mode === "purchase" ? unitCost ?? product.cost : product.cost,
            paid_from: paidFrom,
            note: note || (mode === "count" ? `Counted ${n}, system had ${product.on_hand}` : null),
            business_date: toBusinessDate(),
          }, "Stock updated");
          setBusy(false);
          if (ok) onClose();
        }}>Save</Button>
      }
    >
      <div className="space-y-4">
        <p className="text-sm text-ink-3">In stock now: <span className="num font-semibold text-ink">{product.on_hand}</span></p>
        <Field label={mode === "count" ? "How many are actually on the shelf?" : "How many?"} htmlFor="sq">
          <Input id="sq" inputMode="numeric" value={qty} onChange={(e) => setQty(e.target.value.replace(/\D/g, ""))} className="num text-lg" autoFocus />
        </Field>
        {mode === "count" && valid && (
          <p className={cx("text-sm font-semibold", diff < 0 ? "text-negative" : "text-positive")}>
            {diff < 0 ? `${-diff} missing — counted as a loss at cost price.` : `${diff} extra — the stock level will be corrected.`}
          </p>
        )}
        {mode === "purchase" && (
          <>
            <Field label="Cost per item" htmlFor="suc" hint="Updates the product's cost price."><MoneyInput id="suc" value={unitCost} onChange={setUnitCost} /></Field>
            <Field label="Paid from">
              <div className="flex gap-2">
                <Chip active={paidFrom === "till"} onClick={() => setPaidFrom("till")}>Cash drawer</Chip>
                <Chip active={paidFrom === "other"} onClick={() => setPaidFrom("other")}>Elsewhere</Chip>
              </div>
            </Field>
          </>
        )}
        {mode === "spoilage" && <p className="text-xs text-ink-3">Counted as a loss at cost price in this section's profit.</p>}
        <Field label="Note (optional)" htmlFor="sn2"><Input id="sn2" value={note} onChange={(e) => setNote(e.target.value)} /></Field>
      </div>
    </Sheet>
  );
}
