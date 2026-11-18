"use client";

// People who sign in: owners always, and managers when the owner allows it, can
// add as many people as they need, choose each one's role, and turn an account
// off when someone stops working here (their history stays). Owners' accounts
// are shown locked to anyone who isn't an owner.

import { useState } from "react";
import { Lock, Plus } from "lucide-react";
import { useApp, useQuery } from "@/client/app-context.tsx";
import { t } from "@/core/i18n.ts";
import { ROLE_LABEL } from "@/core/permissions.ts";
import { Badge, Button, Card, PageHeader, Spinner, cx } from "@/components/ui.tsx";
import { Avatar } from "./Boot.tsx";
import { UserSheet, type UserRow } from "./Settings.tsx";

export function PeopleView() {
  const { user: me } = useApp();
  const [editing, setEditing] = useState<UserRow | "new" | null>(null);
  const { data } = useQuery(async (db) =>
    db.all<UserRow>("SELECT id, name, role, active FROM users ORDER BY active DESC, CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, name"),
  );

  const isOwner = me.role === "owner";
  const groups: { title: string; rows: UserRow[] }[] = data
    ? [
        { title: t("Can sign in"), rows: data.filter((u) => u.active) },
        { title: t("Turned off"), rows: data.filter((u) => !u.active) },
      ].filter((g) => g.rows.length)
    : [];

  return (
    <div>
      <PageHeader
        title={t("People who sign in")}
        subtitle={t("Everyone has their own PIN. Add as many people as you need.")}
        actions={<Button size="sm" onClick={() => setEditing("new")}><Plus className="size-4" /> {t("Add a person")}</Button>}
      />
      {!data ? <Spinner /> : (
        <div className="space-y-6">
          {groups.map((g) => (
            <section key={g.title}>
              <h2 className="mb-2 text-[11px] font-semibold uppercase tracking-[0.14em] text-ink-3">{g.title} · {g.rows.length}</h2>
              <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
                {g.rows.map((u) => {
                  const locked = u.role === "owner" && !isOwner;
                  return (
                    <button
                      key={u.id}
                      disabled={locked}
                      onClick={() => setEditing(u)}
                      className={cx(
                        "press lift flex w-full items-center gap-3 rounded-3xl bg-surface p-4 text-left shadow-card ring-1 ring-line/70",
                        locked ? "cursor-default" : "cursor-pointer",
                        !u.active && "opacity-60",
                      )}
                    >
                      <Avatar name={u.name} />
                      <span className="min-w-0 flex-1">
                        <span className="block truncate font-semibold">
                          {u.name} {u.id === me.id && <Badge tone="accent">{t("You")}</Badge>}
                        </span>
                        <span className="block text-xs text-ink-3">{t(ROLE_LABEL[u.role])}</span>
                      </span>
                      {locked ? <Lock className="size-4 shrink-0 text-ink-3" aria-label={t("Only an owner can change an owner.")} /> : !u.active && <Badge>{t("Turned off")}</Badge>}
                    </button>
                  );
                })}
              </div>
            </section>
          ))}
          <Card className="p-4 text-sm text-ink-3">
            {isOwner
              ? t("What each role can do is set in Settings, under “Who can do what”.")
              : t("Only an owner can add or change an owner. What each role can do is set by the owner.")}
          </Card>
        </div>
      )}
      {editing && <UserSheet user={editing === "new" ? null : editing} onClose={() => setEditing(null)} />}
    </div>
  );
}
