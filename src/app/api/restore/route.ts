import { restorableRows } from "@/core/backup.ts";
import { upsert } from "@/core/db.ts";
import { verifyPin } from "@/core/pin.ts";
import { TABLE_NAMES } from "@/core/schema.ts";
import { recordAttempt, tooManyAttempts } from "@/server/auth.ts";
import { serverDb } from "@/server/db.ts";

export const dynamic = "force-dynamic";

/**
 * Rebuild a shop on an EMPTY server from a backup file (read in the browser).
 * Steps: begin → rows (many) → finish. Only works while the server has no
 * users, so it can never overwrite a running shop. People and the owner's PIN
 * check arrive in the last step, so a half-finished restore is never "set up".
 *
 *   { step: "begin" }                          → { token }
 *   { step: "rows", token, table, rows }       → { saved }
 *   { step: "finish", token, users, ownerId, pin }
 */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const db = await serverDb();
  const meta = async (k: string) => (await db.get<{ value: string }>("SELECT value FROM meta WHERE key = ?", [k]))?.value ?? null;
  const hasUsers = !!(await db.get("SELECT id FROM users LIMIT 1"));
  if (hasUsers) return Response.json({ error: "This server already has a shop. Restoring only works on an empty server." }, { status: 409 });

  if (body.step === "begin") {
    const token = crypto.randomUUID();
    await db.tx(async (tx) => {
      // Clear what an abandoned restore may have left behind (there is no shop yet).
      for (const t of TABLE_NAMES) await tx.run(`DELETE FROM ${t}`);
      await tx.run("DELETE FROM applied_commands");
      await tx.run("INSERT INTO meta (key, value) VALUES ('restore_token', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [token]);
      await tx.run("INSERT INTO meta (key, value) VALUES ('restore_started', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [new Date().toISOString()]);
    });
    return Response.json({ token });
  }

  if (!body.token || body.token !== (await meta("restore_token"))) {
    return Response.json({ error: "The restore was interrupted. Start again." }, { status: 409 });
  }

  if (body.step === "rows") {
    if (body.table === "users") return Response.json({ error: "People are restored in the last step." }, { status: 400 });
    const part = restorableRows(String(body.table), body.rows);
    if (!part) return Response.json({ error: "Unknown table." }, { status: 400 });
    await db.tx(async (tx) => {
      for (const row of part.rows) await upsert(tx, part.table, row, Number(row.rev));
    });
    return Response.json({ saved: part.rows.length });
  }

  if (body.step === "finish") {
    const users = restorableRows("users", body.users);
    if (!users || users.rows.length === 0) return Response.json({ error: "The backup has no people in it." }, { status: 400 });
    const owner = users.rows.find((u) => u.id === body.ownerId && u.role === "owner" && Number(u.active) === 1);
    const key = "restore";
    if (tooManyAttempts(key)) return Response.json({ error: "Too many wrong PINs. Wait 5 minutes." }, { status: 429 });
    const ok = !!owner && (await verifyPin(String(body.pin ?? ""), String(owner.pin_salt), String(owner.pin_hash)));
    recordAttempt(key, ok);
    if (!ok) return Response.json({ error: "Wrong owner PIN for this backup." }, { status: 403 });

    await db.tx(async (tx) => {
      for (const row of users.rows) await upsert(tx, "users", row, Number(row.rev));
      // Carry on numbering changes after the newest one in the backup.
      const parts = TABLE_NAMES.map((t) => `SELECT MAX(rev) AS r FROM ${t}`).join(" UNION ALL ");
      const max = Number((await tx.get<{ m: number }>(`SELECT MAX(r) AS m FROM (${parts})`))?.m ?? 0);
      const now = new Date().toISOString();
      await tx.run("INSERT INTO meta (key, value) VALUES ('rev', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [String(max + 1)]);
      // New data generation: every device downloads everything again.
      await tx.run("INSERT INTO meta (key, value) VALUES ('epoch', ?) ON CONFLICT(key) DO UPDATE SET value = excluded.value", [crypto.randomUUID()]);
      await tx.run("DELETE FROM meta WHERE key IN ('restore_token', 'restore_started')");
      await upsert(tx, "audit_log", {
        id: `restore-${now}`, actor_id: String(body.ownerId), action: "shop.restore", entity: "shop", entity_id: "shop",
        summary: `Shop restored from a backup file (${String(body.label ?? "backup").slice(0, 80)})`, device_id: null, created_at: now,
      }, max + 1);
    });
    return Response.json({ ok: true });
  }

  return Response.json({ error: "Unknown step." }, { status: 400 });
}
