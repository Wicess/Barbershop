"use client";

import {
  AlertTriangle, ArrowRight, ArrowUpRight, Banknote, CalendarCheck, CheckCircle2, Contact, DatabaseBackup, HandCoins,
  PackageOpen, ReceiptText, ShoppingBag, TrendingDown, TrendingUp,
} from "lucide-react";
import { useEffect, useRef, useState, type ComponentType, type ReactNode } from "react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { go } from "@/client/router.ts";
import { AUTO_CLOSE_NOTE } from "@/core/commands.ts";
import { addDays, addMonths, currentMonth, dayCount, daysInMonth, formatDate, formatMonth, presetPeriod, toBusinessDate } from "@/core/dates.ts";
import { cashFigures, lowStock, periodSummary, revenueUntil, staffPerformance, topItems } from "@/core/reports.ts";
import { Bars } from "@/components/charts.tsx";
import { Emblem } from "@/components/motif.tsx";
import { InstallCard } from "@/components/native.tsx";
import { BACKUP_REMINDER_DAYS, useLastBackup } from "@/components/DataSafety.tsx";
import { itemImage, Photo, sectionImage } from "@/components/media.tsx";
import { Card, CountUp, Money, SectionTitle, Spinner, cx, useMoney } from "@/components/ui.tsx";
import { plural, t } from "@/core/i18n.ts";

function greeting() {
  const h = new Date().getHours();
  return h < 12 ? t("Good morning") : h < 17 ? t("Good afternoon") : t("Good evening");
}

export function HomeView() {
  const { user, can } = useApp();
  const fmt = useMoney();
  const today = toBusinessDate();
  const month = presetPeriod("month");
  const week = presetPeriod("week");
  const { data } = useQuery(async (db) => {
    const close = await db.get<{ counted: number; variance: number; note: string | null }>("SELECT counted, variance, note FROM day_closes WHERE business_date = ?", [today]);
    const yesterday = addDays(today, -1);
    // Same weekday last week, up to this time of day: a fair comparison mid-day.
    const lastWeekDate = addDays(today, -7);
    const lastWeekNow = new Date(Date.now() - 7 * 86400000).toISOString();
    const unclosed = await db.get<{ business_date: string }>(
      `SELECT s.business_date FROM sales s WHERE s.status = 'completed' AND s.business_date BETWEEN ? AND ?
          AND NOT EXISTS (SELECT 1 FROM day_closes c WHERE c.business_date = s.business_date)
        ORDER BY s.business_date DESC LIMIT 1`,
      [addDays(today, -7), yesterday],
    );
    return {
      lastWeek: await revenueUntil(db, lastWeekDate, lastWeekNow),
      lowStock: can("stock.manage") ? await lowStock(db) : [],
      unclosed: unclosed?.business_date ?? null,
      anySales: !!(await db.get("SELECT 1 AS x FROM sales LIMIT 1")),
      today: await periodSummary(db, today, today),
      week: await periodSummary(db, week.from, today),
      month: can("reports.profit") ? await periodSummary(db, month.from, month.to) : null,
      top: await topItems(db, month.from, today, 10),
      staff: await staffPerformance(db, today, today),
      cash: await cashFigures(db, today),
      close,
      openingFloat: Number((await db.get<{ value: string }>("SELECT value FROM settings WHERE id = 'opening_float'"))?.value ?? 0),
      // Last month's stored close, shown during the first week of the new month.
      lastClose:
        can("reports.profit") && Number(today.slice(8, 10)) <= 7
          ? await db.get<{ month: string; days: number; revenue: number; net_profit: number; staff_pay: number }>(
              "SELECT month, days, revenue, net_profit, staff_pay FROM month_closes WHERE id = ?",
              [`month-${addMonths(currentMonth(), -1)}`],
            )
          : undefined,
    };
  }, [today]);

  const lastBackup = useLastBackup();
  if (!data) return <Spinner />;
  const needBackup =
    can("settings.manage") && data.anySales && (!lastBackup || Date.now() - Date.parse(lastBackup) > BACKUP_REMINDER_DAYS * 86400000);
  const td = data.today;
  const change = data.lastWeek > 0 ? Math.round(((td.revenue - data.lastWeek) / data.lastWeek) * 100) : null;
  const weekday = formatDate(addDays(today, -7), { weekday: "short" });
  const maxSection = Math.max(1, ...td.departments.map((d) => d.revenue));
  const expectedCash = data.openingFloat + data.cash.cashSales - data.cash.cashOut;

  return (
    // Big computer screens: the whole dashboard fits the window (main's padding is 5.5rem); panels scroll inside.
    <div className="dash:flex dash:h-[calc(100dvh-5.5rem)] dash:flex-col">
      <h1 className="sr-only">{t("Home")}</h1>
      <InstallCard />

      {/* Wide screens: hero on the left, the three figures stacked beside it. */}
      <div className="xl:grid xl:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)] xl:gap-4 dash:shrink-0">
      {/* Hero carousel: Today / This week / This month. Swipe, tap a dot, or let it glide on its own. */}
      <HeroCarousel
        greeting={t("{greeting},", { greeting: greeting() })}
        name={user.name.split(" ")[0]}
        date={formatDate(today, { weekday: "short", day: "numeric", month: "short" })}
        slides={[
          {
            key: "today",
            photo: "/img/hero-shop.webp",
            label: t("Sales today"),
            amount: td.revenue,
            badge:
              change != null ? (
                <span
                  className={cx(
                    "mb-1 inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-xs font-bold",
                    change >= 0 ? "bg-[#4fd18b]/15 text-[#7be2a9]" : "bg-[#ff8a80]/15 text-[#ffb0a8]",
                  )}
                >
                  {change >= 0 ? <TrendingUp className="size-3.5" /> : <TrendingDown className="size-3.5" />}
                  {t("{change}% vs last {weekday}", { change: `${change >= 0 ? "+" : ""}${change}`, weekday })}
                </span>
              ) : null,
            sub: data.close ? plural(td.sales, "{n} receipt · day closed", "{n} receipts · day closed") : plural(td.sales, "{n} receipt", "{n} receipts"),
          },
          {
            key: "week",
            photo: "/img/barber-cut.webp",
            label: t("This week"),
            amount: data.week.revenue,
            sub: plural(data.week.sales, "{n} receipt · about {amount} a day", "{n} receipts · about {amount} a day", {
              amount: fmt(Math.round(data.week.revenue / dayCount(week.from, today))),
            }),
          },
          ...(data.month
            ? [{
                key: "month",
                photo: "/img/salon.webp",
                label: t("{month} so far", { month: formatMonth(currentMonth()) }),
                amount: data.month.revenue,
                sub: t("Net profit {amount}", { amount: fmt(data.month.netProfit) }),
                progress: { day: Number(today.slice(8, 10)), of: daysInMonth(currentMonth()) },
              }]
            : []),
        ]}
      >
        <div className="mt-5 flex gap-2 dash:mt-3">
          <button
            onClick={() => go("/sell")}
            className="press flex min-h-12 flex-1 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-white px-4 text-sm font-bold text-[#1f1814] shadow-[0_10px_24px_-12px_rgb(0_0_0/0.6)] sm:flex-none"
          >
            <ShoppingBag className="size-4 text-primary" /> {t("New sale")}
          </button>
          <button
            onClick={() => go("/close")}
            className="press flex min-h-12 cursor-pointer items-center justify-center gap-2 rounded-2xl bg-surface px-4 text-sm font-semibold text-ink ring-1 ring-line backdrop-blur hover:bg-surface-2"
          >
            <CalendarCheck className="size-4" /> {t("Close day")}
          </button>
        </div>
      </HeroCarousel>

      {/* Figures: tap a tile to open the full screen. */}
      <div className="stagger mt-3 grid grid-cols-2 gap-3 sm:grid-cols-3 xl:mt-0 xl:grid-cols-1 xl:grid-rows-3">
        <Tile label={t("Cash in drawer")} hint={data.close ? (data.close.note === AUTO_CLOSE_NOTE ? t("Closed automatically") : t("Counted & closed")) : t("Expected now")} onClick={() => go("/close")}>
          <CountUp value={expectedCash} format={fmt} />
        </Tile>
        {data.month ? (
          <>
            <Tile label={t("This month")} hint={t("Revenue")} onClick={() => go("/reports")}>
              <CountUp value={data.month.revenue} format={fmt} />
            </Tile>
            <Tile
              label={t("Net profit")}
              hint={t("After pay & expenses")}
              tone={data.month.netProfit >= 0 ? "positive" : "negative"}
              onClick={() => go("/reports")}
              className="col-span-2 sm:col-span-1"
            >
              <CountUp value={data.month.netProfit} format={fmt} />
            </Tile>
          </>
        ) : (
          <Tile label={t("Receipts today")} hint={t("Completed sales")} onClick={() => go("/sales")}>
            {td.sales}
          </Tile>
        )}
      </div>
      </div>

      <div className="dash:mt-3 dash-short:mt-2 dash:grid dash:shrink-0 dash:auto-cols-fr dash:grid-flow-col dash:gap-3 dash:empty:hidden">
      {data.lastClose && (
        <button
          onClick={() => go("/months", { m: data.lastClose!.month })}
          className="press mt-3 flex w-full cursor-pointer items-center gap-3.5 rounded-[22px] bg-surface p-3 pr-4 text-left ring-1 ring-line hover:bg-surface-2 dash:mt-0"
        >
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-positive-soft text-positive">
            <CheckCircle2 className="size-5" />
          </span>
          <span className="min-w-0 flex-1">
            <span className="block font-semibold">
              {plural(data.lastClose.days, "{month} is closed · {n} day", "{month} is closed · {n} days", { month: formatMonth(data.lastClose.month) })}
            </span>
            <span className="block truncate text-xs text-ink-3">
              {t("Revenue {revenue} · net profit {profit} · staff pay {pay}", {
                revenue: fmt(data.lastClose.revenue),
                profit: fmt(data.lastClose.net_profit),
                pay: fmt(data.lastClose.staff_pay),
              })}
            </span>
          </span>
          <ArrowRight className="size-4 shrink-0 text-ink-3" />
        </button>
      )}

      {(data.unclosed || data.lowStock.length > 0 || needBackup) && (
        <div className="stagger mt-3 space-y-2 dash:contents">
          {needBackup && (
            <Nudge
              icon={DatabaseBackup}
              tone="accent"
              title={
                lastBackup
                  ? plural(Math.floor((Date.now() - Date.parse(lastBackup)) / 86400000), "No backup for {n} day", "No backup for {n} days")
                  : t("Take your first backup")
              }
              onClick={() => go("/backup")}
            >
              {t("Save a copy to Google Drive or email. It takes a few seconds.")}
            </Nudge>
          )}
          {data.unclosed && (
            <Nudge
              icon={AlertTriangle}
              tone="warning"
              title={t("{date} was not closed", { date: formatDate(data.unclosed, { weekday: "long", day: "numeric", month: "short" }) })}
              onClick={() => go("/close", { date: data.unclosed! })}
            >
              {t("Count that day's cash so the drawer is checked.")}
            </Nudge>
          )}
          {data.lowStock.length > 0 && (
            <Nudge
              icon={PackageOpen}
              tone="warning"
              title={plural(data.lowStock.length, "Running low on {n} item", "Running low on {n} items")}
              onClick={() => go("/catalog")}
            >
              {data.lowStock.slice(0, 4).map((p) => `${t(p.name)} (${p.on_hand})`).join(", ")}
            </Nudge>
          )}
        </div>
      )}

      </div>

      {/* Quick actions */}
      <div className="chip-scroll flat-lg qa -mx-4 mt-6 flex scroll-px-4 gap-3 overflow-x-auto px-4 pb-2 pt-1 lg:mx-0 lg:grid lg:auto-cols-fr lg:grid-flow-col lg:gap-4 lg:overflow-visible lg:px-0 dash:mt-4 dash-short:mt-3 dash:shrink-0 dash:pb-0">
        <Action icon={ShoppingBag} label={t("Sell")} onClick={() => go("/sell")} primary />
        {can("expense.create") && <Action icon={Banknote} label={t("Expense")} onClick={() => go("/expenses", { add: "1" })} />}
        <Action icon={ReceiptText} label={t("Receipts")} onClick={() => go("/sales")} />
        {can("payroll.view") && <Action icon={HandCoins} label={t("Earnings")} onClick={() => go("/earnings")} />}
        <Action icon={Contact} label={t("Clients")} onClick={() => go("/clients")} />
        <Action icon={CalendarCheck} label={t("Close day")} onClick={() => go("/close")} />
      </div>

      {/* Best sellers this month: a swipeable shelf of photo cards. */}
      {data.top.length > 0 && (
        <section className="reveal dash:hidden">
          <SectionTitle action={can("reports.daily") && <SeeAll onClick={() => go("/reports")}>{t("See all")}</SeeAll>}>{t("Best sellers this month")}</SectionTitle>
          <div className="snap-x-row -mx-4 flex gap-3 overflow-x-auto scroll-px-4 px-4 pb-2">
            {data.top.map((it, i) => (
              <button
                key={it.name + i}
                onClick={() => go("/sell")}
                className="press group relative w-[46%] max-w-[230px] shrink-0 cursor-pointer overflow-hidden rounded-[22px] text-left ring-1 ring-line sm:w-[210px]"
              >
                <Photo src={itemImage(it.name, it.department ?? "")} alt="" className="aspect-[3/4] w-full lg:aspect-[4/5]" imgClassName="transition-transform duration-700 group-hover:scale-[1.06]" />
                <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_35%,rgb(14_10_8/0.88))]" />
                <span className="absolute left-2.5 top-2.5 rounded-full bg-white/90 px-2 py-0.5 text-[11px] font-bold text-[#1c1612] backdrop-blur">#{i + 1}</span>
                <span className="absolute inset-x-0 bottom-0 p-3 text-white">
                  <span className="block truncate text-[15px] font-bold leading-tight">{t(it.name)}</span>
                  <span className="mt-0.5 flex items-center justify-between gap-2 text-xs text-white/80">
                    <span>{t("{n} sold", { n: it.qty })}</span>
                    <Money value={it.revenue} className="font-bold text-white" />
                  </span>
                </span>
              </button>
            ))}
          </div>
        </section>
      )}

      <div className="reveal grid gap-x-6 lg:grid-cols-2 xl:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] dash:hidden">
        <section>
          <SectionTitle action={can("reports.daily") && <SeeAll onClick={() => go("/reports")}>{t("See report")}</SeeAll>}>{t("Today by section")}</SectionTitle>
          {/* Photo cards: name and takings over a dark fade, like a shop window. */}
          <ul className="stagger grid grid-cols-2 gap-3 xl:grid-cols-3">
            {td.departments.map((d, i) => {
              const top = d.revenue > 0 && d.revenue === maxSection;
              return (
                <li key={d.id} className={cx(td.departments.length % 2 === 1 && i === 0 && "col-span-2")}>
                  <button
                    onClick={() => go("/sell")}
                    className="press group relative block w-full cursor-pointer overflow-hidden rounded-[22px] text-left ring-1 ring-line"
                  >
                    <Photo
                      src={sectionImage(d.name, d.kind)}
                      alt=""
                      className={cx("w-full", td.departments.length % 2 === 1 && i === 0 ? "aspect-[16/9] lg:aspect-[21/8] xl:aspect-[31/10]" : "aspect-[4/5] sm:aspect-[4/3] xl:aspect-[3/2]")}
                      imgClassName="transition-transform duration-700 ease-[var(--ease-out)] group-hover:scale-[1.05]"
                    />
                    <span aria-hidden className="absolute inset-0 bg-[linear-gradient(180deg,transparent_38%,rgb(14_10_8/0.35)_58%,rgb(14_10_8/0.88)_100%)]" />
                    <span
                      className={cx(
                        "absolute left-2.5 top-2.5 rounded-full px-2.5 py-1 text-[11px] font-bold uppercase tracking-[0.06em] backdrop-blur-md",
                        top ? "bg-primary text-white" : d.items ? "bg-white/90 text-[#1c1612]" : "bg-black/40 text-white/85",
                      )}
                    >
                      {top ? t("Top today") : d.items ? t("{n} sold", { n: d.items }) : t("No sales yet")}
                    </span>
                    <span className="absolute inset-x-0 bottom-0 p-3.5 text-white">
                      <Money value={d.revenue} className="block text-[17px] font-extrabold leading-tight tracking-tight" />
                      <span className="mt-0.5 block truncate text-[12px] font-semibold uppercase tracking-[0.08em] text-white/80">{t(d.name)}</span>
                      <span className="mt-2 block h-[3px] overflow-hidden rounded-full bg-white/20" aria-hidden>
                        <span
                          className="block h-full origin-left animate-[grow_900ms_var(--ease-out)_both] rounded-full bg-primary-2"
                          style={{ width: `${(d.revenue / maxSection) * 100}%` }}
                        />
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </section>
        <div>
        <section>
          <SectionTitle action={can("payroll.view") && <SeeAll onClick={() => go("/earnings")}>{t("Earnings")}</SeeAll>}>{t("Today by staff")}</SectionTitle>
          <Card className="animate-rise p-5">
            {data.staff.length === 0 ? (
              <p className="py-4 text-center text-sm text-ink-3">{t("No services recorded yet today.")}</p>
            ) : (
              <Bars rows={data.staff.map((s) => ({ label: s.name, value: s.revenue, sub: plural(s.services, "{n} service", "{n} services") }))} />
            )}
          </Card>
        </section>

      {data.month && (
        <section className="reveal">
          <SectionTitle action={<SeeAll onClick={() => go("/reports")}>{t("Full report")}</SeeAll>}>{t("Profit by section this month")}</SectionTitle>
          <Card className="animate-rise p-5">
            <Bars signed rows={data.month.departments.filter((d) => d.revenue || d.profit).map((d) => ({ label: t(d.name), value: d.profit }))} />
            {data.month.departments.every((d) => !d.revenue && !d.profit) && (
              <p className="py-4 text-center text-sm text-ink-3">{t("No sales this month yet.")}</p>
            )}
          </Card>
        </section>
      )}
        </div>
      </div>

      {/* Big screens: three panels fill the rest of the window; long lists scroll inside them. */}
      <div className="hidden dash:mt-4 dash-short:mt-2 dash:grid dash:min-h-0 dash:flex-1 dash:grid-cols-3 dash:gap-4">
        <Panel title={t("Best sellers this month")} action={can("reports.daily") && <SeeAll onClick={() => go("/reports")}>{t("See all")}</SeeAll>}>
          {data.top.length === 0 ? (
            <p className="py-6 text-center text-sm text-ink-3">{t("No sales this month yet.")}</p>
          ) : (
            <ol className="divide-y divide-line">
              {data.top.map((it, i) => (
                <li key={it.name + i} className="flex items-center gap-3 py-2">
                  <span className="num w-4 shrink-0 text-xs font-bold text-ink-3">{i + 1}</span>
                  <Photo src={itemImage(it.name, it.department ?? "")} alt="" className="size-10 shrink-0 overflow-hidden rounded-xl ring-1 ring-line" />
                  <span className="min-w-0 flex-1">
                    <span className="block truncate text-sm font-semibold">{t(it.name)}</span>
                    <span className="block text-xs text-ink-3">{t("{n} sold", { n: it.qty })}</span>
                  </span>
                  <Money value={it.revenue} className="shrink-0 text-sm font-bold" />
                </li>
              ))}
            </ol>
          )}
        </Panel>

        <Panel title={t("Today by section")} action={can("reports.daily") && <SeeAll onClick={() => go("/reports")}>{t("See report")}</SeeAll>}>
          <ul className="divide-y divide-line">
            {td.departments.map((d) => {
              const top = d.revenue > 0 && d.revenue === maxSection;
              return (
                <li key={d.id}>
                  <button onClick={() => go("/sell")} className="flex w-full cursor-pointer items-center gap-3 py-2 text-left">
                    <Photo src={sectionImage(d.name, d.kind)} alt="" className="size-10 shrink-0 overflow-hidden rounded-xl ring-1 ring-line" />
                    <span className="min-w-0 flex-1">
                      <span className="flex items-baseline justify-between gap-2">
                        <span className="truncate text-sm font-semibold">{t(d.name)}</span>
                        <Money value={d.revenue} className="shrink-0 text-sm font-bold" />
                      </span>
                      <span className="mt-1 flex items-center gap-2">
                        <span className="h-1 flex-1 overflow-hidden rounded-full bg-surface-2" aria-hidden>
                          <span className="block h-full rounded-full bg-accent" style={{ width: `${(d.revenue / maxSection) * 100}%` }} />
                        </span>
                        <span className={cx("shrink-0 text-[11px]", top ? "font-semibold text-accent" : "text-ink-3")}>
                          {top ? t("Top today") : d.items ? t("{n} sold", { n: d.items }) : t("No sales yet")}
                        </span>
                      </span>
                    </span>
                  </button>
                </li>
              );
            })}
          </ul>
        </Panel>

        <Panel title={t("Today by staff")} action={can("payroll.view") && <SeeAll onClick={() => go("/earnings")}>{t("Earnings")}</SeeAll>}>
          {data.staff.length === 0 ? (
            <p className="py-4 text-center text-sm text-ink-3">{t("No services recorded yet today.")}</p>
          ) : (
            <Bars rows={data.staff.map((s) => ({ label: s.name, value: s.revenue, sub: plural(s.services, "{n} service", "{n} services") }))} />
          )}
          {data.month && (
            <>
              <div className="mb-3 mt-5 flex items-center justify-between gap-2 border-t border-line pt-4">
                <h3 className="text-[15px] font-bold tracking-[-0.01em]">{t("Profit by section this month")}</h3>
                <SeeAll onClick={() => go("/reports")}>{t("Full report")}</SeeAll>
              </div>
              {data.month.departments.every((d) => !d.revenue && !d.profit) ? (
                <p className="py-2 text-center text-sm text-ink-3">{t("No sales this month yet.")}</p>
              ) : (
                <Bars signed rows={data.month.departments.filter((d) => d.revenue || d.profit).map((d) => ({ label: t(d.name), value: d.profit }))} />
              )}
            </>
          )}
        </Panel>
      </div>
    </div>
  );
}

/** A dashboard panel: a title row, then content that scrolls inside if it's long. */
function Panel({ title, action, children }: { title: string; action?: ReactNode; children: ReactNode }) {
  return (
    <section className="spot flex min-h-0 flex-col rounded-3xl bg-surface shadow-card ring-1 ring-line/70">
      <div className="flex shrink-0 items-center justify-between gap-2 px-5 pb-1 pt-4 dash-short:pt-3">
        <h2 className="text-[15px] font-bold tracking-[-0.01em]">{title}</h2>
        {action}
      </div>
      <div className="nav-scroll min-h-0 flex-1 overflow-y-auto px-5 pb-3">{children}</div>
    </section>
  );
}

interface HeroSlide {
  key: string;
  photo: string;
  label: string;
  amount: number;
  badge?: ReactNode;
  sub: string;
  progress?: { day: number; of: number };
}

/**
 * The hero: an espresso card whose figures swipe between Today, This week and
 * This month. The photo behind cross-fades with the slide. It glides to the
 * next slide on its own every few seconds, but never while someone is touching
 * it, shortly after they did, when the tab is hidden, or with reduced motion.
 */
function HeroCarousel({ greeting: hello, name, date, slides, children }: { greeting: string; name: string; date: string; slides: HeroSlide[]; children: ReactNode }) {
  const fmt = useMoney();
  const track = useRef<HTMLDivElement>(null);
  const [index, setIndex] = useState(0);
  const touched = useRef(0);

  useEffect(() => {
    const el = track.current;
    if (!el) return;
    const onScroll = () => setIndex(Math.round(el.scrollLeft / Math.max(1, el.clientWidth)));
    el.addEventListener("scroll", onScroll, { passive: true });
    return () => el.removeEventListener("scroll", onScroll);
  }, []);

  useEffect(() => {
    if (slides.length < 2 || window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
    const id = setInterval(() => {
      const el = track.current;
      if (!el || document.hidden || Date.now() - touched.current < 9000) return;
      const next = (Math.round(el.scrollLeft / el.clientWidth) + 1) % slides.length;
      el.scrollTo({ left: next * el.clientWidth, behavior: "smooth" });
    }, 6500);
    return () => clearInterval(id);
  }, [slides.length]);

  const show = (i: number) => {
    touched.current = Date.now();
    track.current?.scrollTo({ left: i * track.current.clientWidth, behavior: "smooth" });
  };

  return (
    <section
      onPointerDown={() => (touched.current = Date.now())}
      className="theme-panel grain shine relative isolate flex animate-rise flex-col overflow-hidden rounded-[30px] bg-panel py-5 shadow-float ring-1 ring-white/10 sm:py-7 xl:py-9 dash:py-6 dash-short:py-4"
    >
      {slides.map((s, i) => (
        <Photo
          key={s.key}
          src={s.photo}
          alt=""
          priority={i === 0}
          className={cx(
            "absolute inset-0 -z-20 transition-[opacity,transform] duration-[1200ms] ease-[var(--ease-out)] [mask-image:linear-gradient(105deg,transparent_22%,#000_92%)]",
            i === index ? "scale-100 opacity-35 dark:opacity-50" : "scale-[1.06] opacity-0",
          )}
        />
      ))}
      <div aria-hidden className="absolute -right-16 -top-20 -z-10 size-72 animate-glow rounded-full bg-[radial-gradient(circle,rgb(200_164_106/0.22),transparent_65%)] blur-2xl" />
      <div aria-hidden className="rings absolute inset-0 -z-10 animate-float-slow" />
      {/* The Ndop emblem as a watermark, turning very slowly. */}
      <div aria-hidden className="pointer-events-none absolute -bottom-24 -right-12 -z-10 opacity-[0.32]">
        <Emblem size={300} className="emblem-turn" />
      </div>

      <div className="flex items-start justify-between gap-3 px-5 sm:px-7 xl:px-9">
        <div>
          <p className="text-sm font-medium text-ink-2">{hello}</p>
          <p className="text-xl font-bold tracking-tight">{name}</p>
        </div>
        <p className="rounded-full bg-surface px-3 py-1.5 text-xs font-semibold text-ink-2 ring-1 ring-line backdrop-blur">{date}</p>
      </div>

      <div ref={track} className="snap-x-row mt-6 flex overflow-x-auto xl:mt-auto xl:pt-8 dash:pt-3 dash-short:pt-1" aria-roledescription="carousel" aria-label={t("Takings")}>
        {slides.map((s, i) => (
          <div key={s.key} className="w-full shrink-0 px-5 sm:px-7 xl:px-9" role="group" aria-roledescription="slide" aria-label={t("{i} of {total}: {label}", { i: i + 1, total: slides.length, label: s.label })}>
            <p className="text-sm font-medium text-ink-2">{s.label}</p>
            <div className="mt-1 flex flex-wrap items-end gap-x-3 gap-y-1">
              <CountUp value={s.amount} format={fmt} className="font-display text-[34px] font-bold leading-none tracking-[-0.04em] sm:text-[44px] xl:text-[56px]" />
              {s.badge}
            </div>
            <p className="mt-1.5 text-sm text-ink-3">{s.sub}</p>
            {s.progress && (
              <div className="mt-3 flex items-center gap-3">
                <span className="h-1.5 flex-1 overflow-hidden rounded-full bg-surface">
                  <span className="block h-full rounded-full bg-linear-to-r from-primary-2 to-primary" style={{ width: `${(s.progress.day / s.progress.of) * 100}%` }} />
                </span>
                <span className="shrink-0 text-xs font-semibold text-ink-2">{t("Day {day} of {total}", { day: s.progress.day, total: s.progress.of })}</span>
              </div>
            )}
          </div>
        ))}
      </div>

      <div className="px-5 sm:px-7 xl:px-9">
        {slides.length > 1 && (
          <div className="mt-4 flex items-center gap-1.5 dash:mt-2" role="tablist" aria-label={t("Choose a period")}>
            {slides.map((s, i) => (
              <button
                key={s.key}
                role="tab"
                aria-selected={i === index}
                aria-label={s.label}
                onClick={() => show(i)}
                className="flex h-6 cursor-pointer items-center"
              >
                <span className={cx("block h-1.5 rounded-full transition-[width,background-color] duration-500 ease-[var(--ease-out)]", i === index ? "w-6 bg-primary" : "w-1.5 bg-white/30")} />
              </button>
            ))}
          </div>
        )}
        {children}
      </div>
    </section>
  );
}

function Tile({
  label, hint, tone, onClick, className, children,
}: { label: string; hint?: string; tone?: "positive" | "negative"; onClick: () => void; className?: string; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "press lift @container flex min-h-[116px] min-w-0 cursor-pointer flex-col rounded-3xl bg-surface p-4 text-left shadow-card ring-1 ring-line/70 dash:min-h-0 dash:px-4 dash:py-3 dash-short:rounded-2xl dash-short:py-2.5",
        className,
      )}
    >
      <span className="flex w-full items-start justify-between gap-2">
        <span className="text-[13px] font-semibold text-ink-2">{label}</span>
        <ArrowUpRight className="size-4 shrink-0 text-ink-3" />
      </span>
      <span className="mt-auto flex flex-col dash:flex-row dash:items-baseline dash:justify-between dash:gap-3">
        <span
          className={cx(
            "num whitespace-nowrap pt-3 text-[clamp(15px,12.5cqi,26px)] font-extrabold leading-none tracking-[-0.03em] dash:pt-2 dash-short:pt-1 dash-short:text-[22px]",
            tone === "positive" && "text-positive",
            tone === "negative" && "text-negative",
          )}
        >
          {children}
        </span>
        {hint && <span className="mt-1.5 truncate text-xs text-ink-3 dash:mt-0">{hint}</span>}
      </span>
    </button>
  );
}

function Action({
  icon: Icon, label, onClick, primary,
}: { icon: ComponentType<{ className?: string }>; label: string; onClick: () => void; primary?: boolean }) {
  return (
    <button
      onClick={onClick}
      className={cx(
        "qa-btn flex h-[96px] w-[92px] shrink-0 cursor-pointer flex-col items-center justify-center gap-2.5 rounded-[22px] lg:h-[76px] lg:w-auto lg:flex-row lg:gap-3.5 dash:h-14 dash:rounded-2xl dash-short:h-12",
        primary
          ? "qa-primary bg-[linear-gradient(135deg,var(--primary-2),var(--primary))] text-on-primary shadow-[var(--shadow-primary)]"
          : "bg-surface text-ink shadow-card ring-1 ring-line hover:bg-surface-2",
      )}
    >
      <span
        className={cx(
          "qa-icon flex size-10 items-center justify-center rounded-full dash:size-9 dash-short:size-8",
          primary ? "bg-white/20 ring-1 ring-white/25" : "bg-surface-2 text-primary ring-1 ring-line",
        )}
      >
        <Icon className="size-5 stroke-[1.7] dash-short:size-[18px]" />
      </span>
      <span className={cx("text-[13px] font-semibold tracking-[-0.01em]", primary ? "text-on-primary" : "text-ink-2")}>{label}</span>
    </button>
  );
}

function Nudge({
  icon: Icon, tone, title, onClick, children,
}: { icon: ComponentType<{ className?: string }>; tone: "accent" | "warning"; title: string; onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="press flex w-full cursor-pointer items-center gap-3 rounded-[22px] bg-surface p-3 pr-4 text-left text-sm shadow-card ring-1 ring-line/70 hover:bg-surface-2 dash-short:py-2"
    >
      <span className={cx("flex size-11 shrink-0 items-center justify-center rounded-2xl", tone === "accent" ? "bg-accent-soft text-accent" : "bg-warning-soft text-warning")}>
        <Icon className="size-5" />
      </span>
      <span className="min-w-0 flex-1">
        <span className="block font-semibold">{title}</span>
        <span className="block truncate text-xs text-ink-3">{children}</span>
      </span>
      <ArrowRight className="size-4 shrink-0 text-ink-3" />
    </button>
  );
}

function SeeAll({ onClick, children }: { onClick: () => void; children: ReactNode }) {
  return (
    <button
      onClick={onClick}
      className="min-h-11 cursor-pointer px-1 text-sm font-medium text-ink-2 underline decoration-line-strong decoration-1 underline-offset-[5px] transition-colors hover:text-ink hover:decoration-ink"
    >
      {children}
    </button>
  );
}
