"use client";

import { ChevronRight, Lock } from "lucide-react";
import { useApp } from "@/client/app-context.tsx";
import { ROLE_LABEL } from "@/core/permissions.ts";
import { PageHeader, Signature } from "@/components/ui.tsx";
import { t } from "@/core/i18n.ts";
import { InstallCard } from "@/components/native.tsx";
import { SyncBadge, type NavItem } from "./Shell.tsx";
import { Avatar } from "./Boot.tsx";

/** Screens grouped the way the shop thinks about them. Anything not listed lands in "Shop". */
const GROUPS: { title: string; paths: string[] }[] = [
  { title: "Selling", paths: ["/sell", "/sales", "/close", "/clients"] },
  { title: "Money", paths: ["/reports", "/months", "/money", "/expenses", "/backup"] },
  { title: "People", paths: ["/earnings", "/payroll", "/staff", "/people"] },
];

export function MoreView({ items }: { items: NavItem[] }) {
  const { lock, user, settings } = useApp();
  const listed = items.filter((i) => i.description);
  const grouped = GROUPS.map((g) => ({ title: g.title, items: listed.filter((i) => g.paths.includes(i.path)) }));
  const rest = listed.filter((i) => !GROUPS.some((g) => g.paths.includes(i.path)));
  if (rest.length) grouped.push({ title: "Shop", items: rest });

  return (
    <div className="mx-auto max-w-xl lg:max-w-none">
      <PageHeader title={t("More")} />
      <InstallCard />

      {/* Profile card */}
      <section className="theme-panel grain relative isolate animate-rise overflow-hidden rounded-[28px] bg-panel p-4 shadow-float ring-1 ring-white/10">
        <div aria-hidden className="rings absolute inset-0 -z-10 animate-float-slow" />
        <div className="flex items-center gap-3.5">
          <Avatar name={user.name} />
          <div className="min-w-0 flex-1">
            <p className="truncate text-[17px] font-bold tracking-tight">{user.name}</p>
            <p className="truncate text-xs text-ink-3">{t(ROLE_LABEL[user.role])}</p>
          </div>
          <button
            onClick={lock}
            className="press flex min-h-11 cursor-pointer items-center gap-2 rounded-full bg-white px-4 text-sm font-bold text-[#1f1814]"
          >
            <Lock className="size-4" /> {t("Lock")}
          </button>
        </div>
        <div className="mt-3 rounded-2xl bg-surface ring-1 ring-line">
          <SyncBadge wide />
        </div>
      </section>

      <div className="lg:grid lg:grid-cols-2 lg:gap-x-6 2xl:grid-cols-4">
        {grouped.filter((g) => g.items.length).map((g) => (
          <section key={t(g.title)} className="mt-7 lg:mt-6">
            <h2 className="mb-3 px-1 text-[13px] font-semibold uppercase tracking-[0.14em] text-ink-3">{t(g.title)}</h2>
            <ul className="stagger space-y-2">
              {g.items.map((i) => (
                <li key={i.path}>
                  <a
                    href={`#${i.path}`}
                    className="press group flex min-h-[72px] items-center gap-3.5 rounded-[22px] bg-surface p-3 pr-3 ring-1 ring-line transition-colors hover:bg-surface-2"
                  >
                    <span className="flex size-12 shrink-0 items-center justify-center rounded-2xl bg-accent-soft text-accent">
                      <i.icon className="size-[22px]" />
                    </span>
                    <span className="min-w-0 flex-1">
                      <span className="block font-semibold tracking-[-0.01em]">{t(i.label)}</span>
                      <span className="block truncate text-xs text-ink-3 2xl:line-clamp-2 2xl:whitespace-normal">{t(i.description ?? "")}</span>
                    </span>
                    <span className="flex size-9 shrink-0 items-center justify-center rounded-full bg-surface-2 text-ink 2xl:hidden transition-[background-color,color,transform] duration-200 group-hover:translate-x-0.5 group-hover:bg-primary group-hover:text-on-primary">
                      <ChevronRight className="size-4" />
                    </span>
                  </a>
                </li>
              ))}
            </ul>
          </section>
        ))}
      </div>

      <footer className="mt-12 flex flex-col items-center lg:mt-8 gap-2 pb-4 text-xs text-ink-3">
        <span>© {new Date().getFullYear()} {settings.shop_name}</span>
        <Signature />
      </footer>
    </div>
  );
}
