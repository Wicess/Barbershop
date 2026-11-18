"use client";

import {
  AlertTriangle, ArrowRightLeft, Banknote, BookUser, CalendarRange, ChartColumnBig, Cloud, CloudOff, HandCoins,
  HardDriveDownload, History, LayoutDashboard, Lock, Menu, ReceiptText, RefreshCw, Scissors, Settings2,
  ShoppingBag, Tags, UserRoundCog, Vault, WalletCards,
} from "lucide-react";
import { useCallback, useEffect, useRef, type ComponentType } from "react";
import { haptic, PullToRefresh, setBackTarget, useCollapsedTitle } from "@/components/native.tsx";
import { addDays, addMonths, currentMonth, monthOf, parseDate, toBusinessDate } from "@/core/dates.ts";
import { cashFigures } from "@/core/reports.ts";
import { PrintHost } from "@/components/print.tsx";
import { DataSafetyBanner } from "@/components/DataSafety.tsx";
import { useApp } from "@/client/app-context.tsx";
import { go, useRoute } from "@/client/router.ts";
import type { Permission } from "@/core/permissions.ts";
import { ROLE_LABEL } from "@/core/permissions.ts";
import { LogoMark, cx } from "@/components/ui.tsx";
import { MotifDivider } from "@/components/motif.tsx";
import { t } from "@/core/i18n.ts";
import { Avatar } from "./Boot.tsx";
import { HomeView } from "./Home.tsx";
import { PeopleView } from "./People.tsx";
import { SellView } from "./Sell.tsx";
import { SalesView } from "./Sales.tsx";
import { ReportsView } from "./Reports.tsx";
import { PayrollView } from "./Payroll.tsx";
import { EarningsView } from "./Earnings.tsx";
import { MoneyView } from "./Money.tsx";
import { ClientsView } from "./Clients.tsx";
import { BackupView } from "./Backup.tsx";
import { StaffView } from "./Staff.tsx";
import { ExpensesView } from "./Expenses.tsx";
import { CatalogView } from "./Catalog.tsx";
import { CloseDayView } from "./CloseDay.tsx";
import { MonthsView } from "./Months.tsx";
import { SettingsView } from "./Settings.tsx";
import { ActivityView } from "./Activity.tsx";
import { MoreView } from "./More.tsx";
import { SyncView } from "./SyncView.tsx";

export interface NavItem {
  path: string;
  label: string;
  icon: ComponentType<{ className?: string; strokeWidth?: number }>;
  perm?: Permission;
  description?: string;
}

export const NAV: NavItem[] = [
  { path: "/", label: "Home", icon: LayoutDashboard, perm: "reports.daily" },
  { path: "/sell", label: "Sell", icon: ShoppingBag, perm: "sale.create", description: "Record a service or drink" },
  { path: "/sales", label: "Sales", icon: ReceiptText, description: "Receipts, voids and reprints" },
  { path: "/reports", label: "Reports", icon: ChartColumnBig, perm: "reports.daily", description: "Profit & loss by section, staff, payment" },
  { path: "/earnings", label: "Earnings", icon: HandCoins, perm: "payroll.view", description: "What each employee has made, live" },
  { path: "/money", label: "Money in & out", icon: ArrowRightLeft, perm: "reports.profit", description: "Every payment in and every franc out" },
  { path: "/payroll", label: "Staff pay", icon: WalletCards, perm: "payroll.view", description: "Monthly earnings, advances, payments" },
  { path: "/clients", label: "Clients", icon: BookUser, perm: "reports.daily", description: "Regulars, visit history, who hasn't been back" },
  { path: "/staff", label: "Staff", icon: Scissors, perm: "staff.view", description: "Barbers, nail techs and their share" },
  { path: "/expenses", label: "Expenses", icon: Banknote, perm: "expense.view", description: "Rent, supplies, breakages, fixed costs" },
  { path: "/catalog", label: "Price list & stock", icon: Tags, perm: "catalog.manage", description: "Services, drinks, sections, stock" },
  { path: "/close", label: "Close day", icon: Vault, perm: "cash.close", description: "Count the cash drawer" },
  { path: "/months", label: "Month-end", icon: CalendarRange, perm: "reports.profit", description: "Each month closed and stored: results and staff pay" },
  { path: "/backup", label: "Backup & export", icon: HardDriveDownload, perm: "reports.profit", description: "Spreadsheets and a full backup file" },
  { path: "/activity", label: "Activity log", icon: History, perm: "audit.view", description: "Who did what, and when" },
  { path: "/people", label: "People", icon: UserRoundCog, perm: "users.manage", description: "Who signs in, their role, accounts on or off" },
  { path: "/settings", label: "Settings", icon: Settings2, perm: "settings.manage", description: "Shop details, who can do what, devices, receipts" },
];

/** The sidebar's groups, in the order a shop works through its day. Home sits above them. */
const SIDE_GROUPS: { title: string; paths: string[] }[] = [
  { title: "Selling", paths: ["/sell", "/sales", "/clients", "/close"] },
  { title: "Money", paths: ["/reports", "/money", "/expenses", "/months", "/backup"] },
  { title: "Team", paths: ["/staff", "/earnings", "/payroll", "/people"] },
  { title: "Shop", paths: ["/catalog", "/activity", "/settings"] },
];

const BOTTOM: Record<string, string[]> = {
  owner: ["/", "/sell", "/sales", "/reports", "/more"],
  manager: ["/", "/sell", "/sales", "/expenses", "/more"],
  cashier: ["/sell", "/sales", "/close", "/more"],
};

export function Shell() {
  const { user, can, settings, store, run, sync, engine } = useApp();
  const refresh = useCallback(() => engine.sync(), [engine]);

  // Record this month's fixed costs (rent etc.) once, as soon as a manager or owner is in.
  useEffect(() => {
    if (!can("expense.create")) return;
    const month = currentMonth();
    void (async () => {
      const missing = await store.get(
        "SELECT r.id FROM recurring_expenses r WHERE r.active = 1 AND NOT EXISTS (SELECT 1 FROM expenses e WHERE e.id = 'rec-' || r.id || '-' || ?)",
        [month],
      );
      if (missing) await run("recurring.post", { month });
    })();
    // Re-check after each sync, in case another device changed the fixed costs.
  }, [can, store, run, sync.lastSyncAt]);

  // Month-end: once a month is over, close it — work out its results and staff
  // pay and store them — so the new month starts from zero. Waits for a first
  // sync, so a newly connected device never closes months from partial records
  // (and the server recalculates from the master records anyway).
  useEffect(() => {
    if (!can("reports.profit") || !sync.lastSyncAt) return;
    let stopped = false;
    void (async () => {
      const first = await store.get<{ d: string | null }>("SELECT MIN(business_date) AS d FROM sales");
      if (!first?.d) return;
      const now = currentMonth();
      for (let m = monthOf(first.d); m < now && !stopped; m = addMonths(m, 1)) {
        const closed = await store.get("SELECT 1 AS x FROM month_closes WHERE id = ?", [`month-${m}`]);
        if (!closed) await run("month.close", { month: m });
      }
    })();
    return () => {
      stopped = true;
    };
  }, [can, store, run, sync.lastSyncAt]);

  // Day-end: every business day closes on its own at 11:59 pm, by this device's
  // clock. If the app is open then, it closes on the spot; if not, the next time
  // someone opens it, each finished day that had any activity is closed and
  // stamped 11:59 pm of its own day. A day someone already closed by counting the
  // drawer is never touched. One timer per day; nothing runs in between.
  const floatRef = useRef(settings.opening_float);
  floatRef.current = settings.opening_float;
  useEffect(() => {
    if (!can("cash.close") || !sync.lastSyncAt) return;
    let stopped = false;
    let timer: ReturnType<typeof setTimeout> | undefined;
    const endOf = (date: string) => {
      const d = parseDate(date);
      d.setHours(23, 59, 0, 0);
      return d;
    };
    const closeDay = async (date: string) => {
      if (stopped) return;
      if (await store.get("SELECT 1 AS x FROM day_closes WHERE business_date = ?", [date])) return;
      const f = await cashFigures(store, date);
      const active = f.salesCount > 0 || f.cashSales > 0 || f.cashOut > 0 || f.otherMethods.length > 0;
      if (!active || stopped) return;
      const opening = Number(floatRef.current) || 0;
      await run("day.close", {
        business_date: date,
        opening_float: opening,
        cash_sales: f.cashSales,
        cash_out: f.cashOut,
        expected: opening + f.cashSales - f.cashOut,
        auto: true,
        closed_at: endOf(date).toISOString(),
      });
    };
    const catchUp = async () => {
      const today = toBusinessDate();
      // Finished days from the last 60, oldest first.
      for (let d = addDays(today, -60); d < today && !stopped; d = addDays(d, 1)) await closeDay(d);
      if (Date.now() >= endOf(today).getTime()) await closeDay(today);
    };
    const schedule = () => {
      const today = toBusinessDate();
      const at = endOf(today).getTime();
      const wait = at > Date.now() ? at - Date.now() : endOf(addDays(today, 1)).getTime() - Date.now();
      timer = setTimeout(async () => {
        await catchUp();
        if (!stopped) schedule();
      }, Math.min(wait, 2 ** 31 - 1));
    };
    // A phone that slept through 11:59 pm catches up when it's looked at again.
    const onVisible = () => document.visibilityState === "visible" && void catchUp();
    void catchUp().then(() => !stopped && schedule());
    document.addEventListener("visibilitychange", onVisible);
    return () => {
      stopped = true;
      clearTimeout(timer);
      document.removeEventListener("visibilitychange", onVisible);
    };
  }, [can, store, run, sync.lastSyncAt]);

  // A soft brass light follows the pointer across cards (mouse only; one listener, one update per frame).
  useEffect(() => {
    if (!window.matchMedia("(hover: hover) and (pointer: fine)").matches) return;
    let raf = 0;
    let last: PointerEvent | null = null;
    const onMove = (e: PointerEvent) => {
      last = e;
      if (raf) return;
      raf = requestAnimationFrame(() => {
        raf = 0;
        const el = (last?.target as Element | null)?.closest?.(".spot, .lift") as HTMLElement | null;
        if (!el || !last) return;
        const r = el.getBoundingClientRect();
        el.style.setProperty("--mx", `${last.clientX - r.left}px`);
        el.style.setProperty("--my", `${last.clientY - r.top}px`);
      });
    };
    document.addEventListener("pointermove", onMove, { passive: true });
    return () => {
      document.removeEventListener("pointermove", onMove);
      cancelAnimationFrame(raf);
    };
  }, []);

  const route = useRoute();
  const allowed = NAV.filter((n) => !n.perm || can(n.perm));
  const homePath = can("reports.daily") ? "/" : "/sell";
  const path = route.path === "/" && !can("reports.daily") ? "/sell" : route.path;
  const isTab = BOTTOM[user.role].includes(path);
  useEffect(() => setBackTarget(isTab ? null : "#/more"), [isTab]);
  const bottom = BOTTOM[user.role].map((p) =>
    p === "/more" ? { path: "/more", label: "More", icon: Menu } : NAV.find((n) => n.path === p)!,
  );
  // Screens not on the tab bar live under "More", so More stays lit for them.
  const activeTab = (() => {
    const i = bottom.findIndex((b) => b.path === path);
    return i >= 0 ? i : bottom.findIndex((b) => b.path === "/more");
  })();

  const view = (() => {
    const item = NAV.find((n) => n.path === path);
    if (item?.perm && !can(item.perm)) return <NoAccess />;
    switch (path) {
      case "/": return <HomeView />;
      case "/sell": return <SellView />;
      case "/sales": return <SalesView params={route.params} />;
      case "/reports": return <ReportsView params={route.params} />;
      case "/earnings": return <EarningsView params={route.params} />;
      case "/money": return <MoneyView params={route.params} />;
      case "/clients": return <ClientsView params={route.params} />;
      case "/backup": return <BackupView params={route.params} />;
      case "/payroll": return <PayrollView params={route.params} />;
      case "/staff": return <StaffView params={route.params} />;
      case "/expenses": return <ExpensesView params={route.params} />;
      case "/catalog": return <CatalogView params={route.params} />;
      case "/close": return <CloseDayView params={route.params} />;
      case "/months": return <MonthsView params={route.params} />;
      case "/settings": return <SettingsView />;
      case "/people": return <PeopleView />;
      case "/activity": return <ActivityView />;
      case "/more": return <MoreView items={allowed} />;
      case "/sync": return <SyncView />;
      default: return <NoAccess />;
    }
  })();

  const sideNav = allowed.filter((n) => n.path !== "/" || homePath === "/");
  const homeItem = sideNav.find((n) => n.path === "/");
  const sideGroups = SIDE_GROUPS.map((g) => ({ title: g.title, items: sideNav.filter((n) => g.paths.includes(n.path)) })).filter((g) => g.items.length);

  return (
    <div className="min-h-dvh lg:flex">
      {/* The Ndop lattice drifting behind every screen. */}
      <div aria-hidden className="ndop-field no-print" />
      {/* Desktop sidebar */}
      <aside className="no-print sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col border-r border-line bg-surface px-3 py-5 lg:flex [@media(max-height:680px)]:py-3">
        <div className="mb-4 flex items-center gap-3 px-3 [@media(max-height:760px)]:mb-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-[#1b1410] ring-1 ring-white/12 shadow-[0_8px_20px_-12px_rgb(0_0_0/0.6)] [@media(max-height:680px)]:size-9">
            <LogoMark className="size-7 [@media(max-height:680px)]:size-6" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">{t("Barbershop")}</p>
            <p className="line-clamp-2 font-display text-[14px] font-bold uppercase leading-[1.2] tracking-[0.02em]">{settings.shop_name}</p>
          </div>
        </div>
        {/* The brass emblem rule under the shop name (hidden on short windows so the menu still fits). */}
        <MotifDivider className="mx-3 mb-3 shrink-0 [@media(max-height:760px)]:hidden" />
        {/* Every item stays visible: rows shrink with the window's height instead of scrolling out of sight.
            Group titles take their own room (--nav-g of them) and are dropped on short windows. */}
        <nav
          className="nav-scroll -mr-2 flex-1 overflow-y-auto pr-2 [--nav-g:var(--groups)] [@media(max-height:760px)]:[--nav-g:0]"
          style={{ "--nav-n": sideNav.length, "--groups": sideGroups.length } as React.CSSProperties}
          aria-label={t("Main menu")}
        >
          {homeItem && <SideLink item={homeItem} active={path === "/"} />}
          {sideGroups.map((g) => (
            <div key={g.title} role="group" aria-label={t(g.title)}>
              <p className="mb-0.5 mt-2.5 h-4 px-3 text-[10px] font-semibold uppercase leading-4 tracking-[0.16em] text-ink-3 [@media(max-height:760px)]:hidden">
                {t(g.title)}
              </p>
              {g.items.map((n) => <SideLink key={n.path} item={n} active={path === n.path} />)}
            </div>
          ))}
        </nav>
        <UserBox />
      </aside>

      <div className="min-w-0 flex-1">
        <TopBar />
        <PullToRefresh onRefresh={refresh} />
        {/* Fills the window on desktop (up to a very wide 1760px) instead of a narrow centred column. */}
        <main key={path} className={cx(isTab ? "screen-tab" : "screen-push", "mx-auto w-full max-w-[1760px] px-4 pb-[calc(7.5rem+env(safe-area-inset-bottom))] pt-2 lg:px-10 lg:pb-14 lg:pt-8 2xl:px-14")}>

          <DataSafetyBanner />
          {view}
        </main>
      </div>

      <PrintHost />

      {/* Mobile tab bar: liquid glass. One orange pill glides (with a little
          spring) to whichever tab is active; tabs never change size. */}
      <nav
        aria-label={t("Tabs")}
        className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] lg:hidden"
      >
        <div className="glass pointer-events-auto relative mx-auto flex max-w-md animate-rise items-center rounded-full p-1.5">
          {activeTab >= 0 && (
            <span
              aria-hidden
              className="absolute bottom-1.5 left-1.5 top-1.5 rounded-full bg-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.18),var(--shadow-primary)] transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
              style={{ width: `calc((100% - 12px) / ${bottom.length})`, transform: `translateX(${activeTab * 100}%)` }}
            />
          )}
          {bottom.map((n, i) => {
            const active = i === activeTab;
            const badge = n.path === "/more" && (sync.pending > 0 || sync.rejected > 0);
            return (
              <a
                key={n.path}
                href={`#${n.path}`}
                onClick={() => {
                  if (!active) haptic();
                }}
                aria-current={active ? "page" : undefined}
                aria-label={t(n.label)}
                className={cx(
                  "relative flex h-[56px] min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold transition-[color,transform] duration-300 active:scale-90",
                  active ? "text-on-primary" : "text-on-panel/55 hover:text-on-panel/85",
                )}
              >
                <n.icon className={cx("size-[22px] transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]", active && "-translate-y-0.5 scale-110")} />
                <span className="max-w-full truncate px-1">{t(n.label)}</span>
                {badge && (
                  <span
                    className={cx("absolute right-[22%] top-2.5 size-2.5 rounded-full ring-2 ring-panel", sync.rejected > 0 ? "bg-negative" : "bg-warning")}
                    aria-label={sync.rejected > 0 ? t("Sync problem") : t("Changes waiting to upload")}
                  />
                )}
              </a>
            );
          })}
        </div>
      </nav>
    </div>
  );
}

/**
 * Phone navigation bar. Shows the shop and user until the page's large title
 * scrolls under it, then cross-fades to a compact copy of that title.
 */
function TopBar() {
  const { settings, user, lock } = useApp();
  const { title, collapsed } = useCollapsedTitle();
  const showTitle = collapsed && !!title;
  return (
    <div
      className={cx(
        "no-print sticky top-0 z-30 border-b bg-bg/85 pt-[env(safe-area-inset-top)] backdrop-blur-xl backdrop-saturate-150 transition-colors duration-200 lg:hidden",
        showTitle ? "border-line" : "border-transparent",
      )}
    >
      {/* Outlined round buttons either side of a centred wordmark. */}
      <div className="relative flex h-16 items-center gap-2 px-4">
        <button
          onClick={() => go("/more")}
          aria-label={t("{name}, {role}. Open menu", { name: user.name, role: t(ROLE_LABEL[user.role]) })}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full ring-1 ring-line-strong transition-transform duration-150 active:scale-90"
        >
          <Avatar name={user.name} small />
        </button>
        <div className="flex-1" />
        {/* Centred on the whole bar (not the gap between uneven button groups); wraps to two lines before it truncates. */}
        <div className="pointer-events-none absolute inset-y-0 left-1/2 flex w-[calc(100%-216px)] -translate-x-1/2 items-center justify-center">
          <p
            className={cx(
              "line-clamp-2 text-center font-display text-[15px] font-bold uppercase leading-[1.15] tracking-[0.03em] transition-[opacity,transform] duration-200 ease-out",
              showTitle && "-translate-y-1 opacity-0",
            )}
          >
            {settings.shop_name}
          </p>
          <p
            aria-hidden={!showTitle}
            className={cx(
              "absolute inset-0 flex items-center justify-center truncate text-[17px] font-bold tracking-tight transition-[opacity,transform] duration-200 ease-out",
              showTitle ? "opacity-100" : "pointer-events-none translate-y-1 opacity-0",
            )}
          >
            {title}
          </p>
        </div>
        <SyncBadge compact />
        <button
          onClick={lock}
          aria-label={t("Lock screen")}
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink ring-1 ring-line-strong transition-transform duration-150 hover:bg-surface-2 active:scale-90"
        >
          <Lock className="size-5" />
        </button>
      </div>
    </div>
  );
}

/** One menu row: the icon sits in a small tile that fills with copper on the page you're on. */
function SideLink({ item, active }: { item: NavItem; active: boolean }) {
  const Icon = item.icon;
  return (
    <a
      href={`#${item.path}`}
      aria-current={active ? "page" : undefined}
      className={cx(
        "group flex h-[clamp(26px,calc((100dvh-15rem-var(--nav-g)*1.5rem)/var(--nav-n)),40px)] items-center gap-2.5 rounded-xl px-2 text-[13.5px] font-medium transition-[background-color,color] duration-200",
        active ? "bg-surface-2 font-semibold text-ink ring-1 ring-line" : "text-ink-2 hover:bg-surface-2/70 hover:text-ink",
      )}
    >
      <span
        className={cx(
          "flex size-6 shrink-0 items-center justify-center rounded-lg transition-[background-color,color,transform] duration-200 group-hover:scale-105 [@media(max-height:680px)]:size-5",
          active ? "bg-primary text-on-primary shadow-[var(--shadow-primary)]" : "bg-surface-2 text-ink-3 ring-1 ring-line group-hover:text-primary",
        )}
      >
        <Icon className="size-[15px] [@media(max-height:680px)]:size-3.5" strokeWidth={active ? 2.2 : 1.9} />
      </span>
      <span className="truncate">{t(item.label)}</span>
    </a>
  );
}

function UserBox() {
  const { user, lock } = useApp();
  return (
    <div className="mt-3 flex items-center gap-2.5 rounded-2xl bg-surface-2/70 p-2 ring-1 ring-line">
      <Avatar name={user.name} small />
      <div className="min-w-0 flex-1">
        <p className="truncate text-[13px] font-semibold leading-tight">{user.name}</p>
        <p className="flex items-center gap-1.5 text-[11px] text-ink-3">
          <span className="truncate">{t(ROLE_LABEL[user.role])}</span> <span aria-hidden>·</span> <SyncBadge tiny />
        </p>
      </div>
      <button onClick={lock} aria-label={t("Lock screen")} title={t("Lock screen")} className="flex size-9 shrink-0 cursor-pointer items-center justify-center rounded-xl text-ink-2 transition-colors hover:bg-surface hover:text-ink">
        <Lock className="size-4" />
      </button>
    </div>
  );
}

export function SyncBadge({ wide, compact, tiny }: { wide?: boolean; compact?: boolean; tiny?: boolean }) {
  const { sync } = useApp();
  const problem = sync.rejected > 0 || sync.status === "error";
  const Icon = problem ? AlertTriangle : sync.status === "offline" ? CloudOff : sync.status === "syncing" ? RefreshCw : Cloud;
  const label = problem
    ? sync.rejected > 0 ? t("{n} change(s) refused", { n: sync.rejected }) : t("Sync problem")
    : sync.status === "offline"
      ? sync.pending ? t("Offline · {n} waiting", { n: sync.pending }) : t("Offline")
      : sync.status === "syncing"
        ? t("Syncing…")
        : sync.pending ? t("{n} waiting", { n: sync.pending }) : t("Saved");
  if (tiny) {
    // Inline, inside a line of small text (the sidebar's user card).
    return (
      <button
        onClick={() => go("/sync")}
        aria-label={t("Sync status: {label}", { label })}
        className={cx("inline-flex cursor-pointer items-center gap-1 rounded hover:text-ink", problem ? "text-negative" : sync.status === "offline" ? "text-warning" : "text-ink-3")}
      >
        <Icon className={cx("size-3", sync.status === "syncing" && "animate-spin")} />
        <span className="truncate">{label}</span>
      </button>
    );
  }
  return (
    <button
      onClick={() => go("/sync")}
      className={cx(
        "flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-[background-color,transform] duration-150 hover:bg-surface-2 active:scale-95",
        problem ? "text-negative" : sync.status === "offline" ? "text-warning" : "text-ink-3",
        wide && "w-full",
      )}
      aria-label={t("Sync status: {label}", { label })}
    >
      <Icon className={cx("size-4", sync.status === "syncing" && "animate-spin")} />
      <span className={wide ? "" : compact ? "sr-only" : "hidden sm:inline"}>{label}</span>
    </button>
  );
}

function NoAccess() {
  return (
    <div className="py-16 text-center">
      <p className="font-semibold">{t("This page isn't available for your role.")}</p>
      <p className="mt-1 text-sm text-ink-3">{t("Ask the owner if you need access.")}</p>
    </div>
  );
}
