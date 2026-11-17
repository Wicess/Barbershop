"use client";

import {
  BarChart3, Boxes, CalendarCheck, ClipboardList, Cloud, CloudOff, Home, Lock, Menu, ReceiptText,
  RefreshCw, Settings as SettingsIcon, HandCoins, Contact, DatabaseBackup, ArrowLeftRight, ShoppingBag, Users, Wallet, Banknote, AlertTriangle,
  Scissors, CalendarRange,
} from "lucide-react";
import { useCallback, useEffect, type ComponentType } from "react";
import { haptic, PullToRefresh, setBackTarget, useCollapsedTitle } from "@/components/native.tsx";
import { addMonths, currentMonth, monthOf } from "@/core/dates.ts";
import { PrintHost } from "@/components/print.tsx";
import { DataSafetyBanner } from "@/components/DataSafety.tsx";
import { useApp } from "@/client/app-context.tsx";
import { go, useRoute } from "@/client/router.ts";
import type { Permission } from "@/core/permissions.ts";
import { ROLE_LABEL } from "@/core/permissions.ts";
import { cx } from "@/components/ui.tsx";
import { Avatar } from "./Boot.tsx";
import { HomeView } from "./Home.tsx";
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
  icon: ComponentType<{ className?: string }>;
  perm?: Permission;
  description?: string;
}

export const NAV: NavItem[] = [
  { path: "/", label: "Home", icon: Home, perm: "reports.daily" },
  { path: "/sell", label: "Sell", icon: ShoppingBag, perm: "sale.create", description: "Record a service or drink" },
  { path: "/sales", label: "Sales", icon: ReceiptText, description: "Receipts, voids and reprints" },
  { path: "/reports", label: "Reports", icon: BarChart3, perm: "reports.daily", description: "Profit & loss by section, staff, payment" },
  { path: "/earnings", label: "Earnings", icon: HandCoins, perm: "payroll.view", description: "What each employee has made, live" },
  { path: "/money", label: "Money in & out", icon: ArrowLeftRight, perm: "reports.profit", description: "Every payment in and every shilling out" },
  { path: "/payroll", label: "Staff pay", icon: Wallet, perm: "payroll.view", description: "Monthly earnings, advances, payments" },
  { path: "/clients", label: "Clients", icon: Contact, perm: "reports.daily", description: "Regulars, visit history, who hasn't been back" },
  { path: "/staff", label: "Staff", icon: Users, perm: "staff.view", description: "Barbers, nail techs and their share" },
  { path: "/expenses", label: "Expenses", icon: Banknote, perm: "expense.view", description: "Rent, supplies, breakages, fixed costs" },
  { path: "/catalog", label: "Price list & stock", icon: Boxes, perm: "catalog.manage", description: "Services, drinks, sections, stock" },
  { path: "/close", label: "Close day", icon: CalendarCheck, perm: "cash.close", description: "Count the cash drawer" },
  { path: "/months", label: "Month-end", icon: CalendarRange, perm: "reports.profit", description: "Each month closed and stored: results and staff pay" },
  { path: "/backup", label: "Backup & export", icon: DatabaseBackup, perm: "reports.profit", description: "Spreadsheets and a full backup file" },
  { path: "/activity", label: "Activity log", icon: ClipboardList, perm: "audit.view", description: "Who did what, and when" },
  { path: "/settings", label: "Settings", icon: SettingsIcon, perm: "settings.manage", description: "Shop details, users, devices, receipts" },
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
      case "/activity": return <ActivityView />;
      case "/more": return <MoreView items={allowed} />;
      case "/sync": return <SyncView />;
      default: return <NoAccess />;
    }
  })();

  return (
    <div className="min-h-dvh lg:flex">
      {/* Desktop sidebar */}
      <aside className="no-print theme-panel sticky top-0 hidden h-dvh w-[272px] shrink-0 flex-col bg-panel px-3 py-5 lg:flex">
        <div className="mb-6 flex items-center gap-3 px-3">
          <span className="flex size-11 shrink-0 items-center justify-center rounded-2xl bg-primary text-on-primary shadow-cta">
            <Scissors className="size-5" />
          </span>
          <div className="min-w-0">
            <p className="text-[10px] font-semibold uppercase tracking-[0.22em] text-ink-3">Barbershop</p>
            <p className="line-clamp-2 font-display text-[14px] font-bold uppercase leading-[1.2] tracking-[0.02em]">{settings.shop_name}</p>
          </div>
        </div>
        <nav className="nav-scroll -mr-2 flex-1 space-y-0.5 overflow-y-auto pr-2" aria-label="Main">
          {allowed.filter((n) => n.path !== "/" || homePath === "/").map((n) => (
            <a
              key={n.path}
              href={`#${n.path}`}
              aria-current={path === n.path ? "page" : undefined}
              className={cx(
                "flex min-h-11 items-center gap-3 rounded-2xl px-3 text-sm font-semibold transition-[background-color,color,transform] duration-200 active:scale-[0.98] [@media(max-height:900px)]:min-h-10",
                path === n.path ? "bg-primary text-on-primary shadow-cta" : "text-ink-2 hover:bg-surface hover:text-ink",
              )}
            >
              <n.icon className="size-5" />
              {n.label}
            </a>
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
        aria-label="Tabs"
        className="no-print pointer-events-none fixed inset-x-0 bottom-0 z-40 px-4 pb-[max(env(safe-area-inset-bottom),0.75rem)] lg:hidden"
      >
        <div className="glass pointer-events-auto relative mx-auto flex max-w-md animate-rise items-center rounded-full p-1.5">
          {activeTab >= 0 && (
            <span
              aria-hidden
              className="absolute bottom-1.5 left-1.5 top-1.5 rounded-full bg-primary shadow-[inset_0_1px_0_rgb(255_255_255/0.3),0_10px_24px_-8px_rgb(239_116_64/0.85)] transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
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
                aria-label={n.label}
                className={cx(
                  "relative flex h-[56px] min-w-0 flex-1 cursor-pointer flex-col items-center justify-center gap-0.5 rounded-full text-[11px] font-semibold transition-[color,transform] duration-300 active:scale-90",
                  active ? "text-on-primary" : "text-on-panel/55 hover:text-on-panel/85",
                )}
              >
                <n.icon className={cx("size-[22px] transition-transform duration-500 ease-[cubic-bezier(0.34,1.4,0.64,1)]", active && "-translate-y-0.5 scale-110")} />
                <span className="max-w-full truncate px-1">{n.label}</span>
                {badge && (
                  <span
                    className={cx("absolute right-[22%] top-2.5 size-2.5 rounded-full ring-2 ring-panel", sync.rejected > 0 ? "bg-negative" : "bg-warning")}
                    aria-label={sync.rejected > 0 ? "Sync problem" : "Changes waiting to upload"}
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
          aria-label={`${user.name}, ${ROLE_LABEL[user.role]}. Open menu`}
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
          aria-label="Lock screen"
          className="flex size-11 shrink-0 cursor-pointer items-center justify-center rounded-full text-ink ring-1 ring-line-strong transition-transform duration-150 hover:bg-surface-2 active:scale-90"
        >
          <Lock className="size-5" />
        </button>
      </div>
    </div>
  );
}

function UserBox() {
  const { user, lock } = useApp();
  return (
    <div className="mt-3 border-t border-line pt-3">
      <SyncBadge wide />
      <div className="mt-2 flex items-center gap-3 px-2">
        <Avatar name={user.name} />
        <div className="min-w-0 flex-1">
          <p className="truncate text-sm font-semibold">{user.name}</p>
          <p className="text-xs text-ink-3">{ROLE_LABEL[user.role]}</p>
        </div>
        <button onClick={lock} aria-label="Lock screen" className="flex size-11 cursor-pointer items-center justify-center rounded-xl text-ink-2 hover:bg-surface-2">
          <Lock className="size-5" />
        </button>
      </div>
    </div>
  );
}

export function SyncBadge({ wide, compact }: { wide?: boolean; compact?: boolean }) {
  const { sync } = useApp();
  const problem = sync.rejected > 0 || sync.status === "error";
  const Icon = problem ? AlertTriangle : sync.status === "offline" ? CloudOff : sync.status === "syncing" ? RefreshCw : Cloud;
  const label = problem
    ? sync.rejected > 0 ? `${sync.rejected} change(s) refused` : "Sync problem"
    : sync.status === "offline"
      ? sync.pending ? `Offline · ${sync.pending} waiting` : "Offline"
      : sync.status === "syncing"
        ? "Syncing…"
        : sync.pending ? `${sync.pending} waiting` : "Saved";
  return (
    <button
      onClick={() => go("/sync")}
      className={cx(
        "flex min-h-11 min-w-11 cursor-pointer items-center justify-center gap-1.5 rounded-full px-2.5 text-xs font-semibold transition-[background-color,transform] duration-150 hover:bg-surface-2 active:scale-95",
        problem ? "text-negative" : sync.status === "offline" ? "text-warning" : "text-ink-3",
        wide && "w-full",
      )}
      aria-label={`Sync status: ${label}`}
    >
      <Icon className={cx("size-4", sync.status === "syncing" && "animate-spin")} />
      <span className={wide ? "" : compact ? "sr-only" : "hidden sm:inline"}>{label}</span>
    </button>
  );
}

function NoAccess() {
  return (
    <div className="py-16 text-center">
      <p className="font-semibold">This page isn't available for your role.</p>
      <p className="mt-1 text-sm text-ink-3">Ask the owner if you need access.</p>
    </div>
  );
}
