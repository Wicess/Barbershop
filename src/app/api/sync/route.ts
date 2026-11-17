import { applyCommand, CommandError, type Command } from "@/core/commands.ts";
import type { Row } from "@/core/db.ts";
import type { Role } from "@/core/permissions.ts";
import { TABLE_NAMES, type TableName } from "@/core/schema.ts";
import { currentDevice } from "@/server/auth.ts";
import { nextRev, serverDb } from "@/server/db.ts";
import { backupIfDue } from "@/server/backups.ts";

export const dynamic = "force-dynamic";

const PAGE = 2000;

/**
 * One round trip: the device pushes its queued commands, then pulls every row
 * that changed since its cursor. Commands are applied at most once (by id).
 */
export async function POST(req: Request) {
  const db = await serverDb();
  const device = await currentDevice(db);
  if (!device) return Response.json({ error: "DEVICE_NOT_REGISTERED" }, { status: 401 });

  const body = await req.json().catch(() => ({}));
  const commands: Command[] = Array.isArray(body.commands) ? body.commands.slice(0, 200) : [];
  const cursor = Number.isInteger(body.cursor) ? Number(body.cursor) : 0;

  const results: { id: string; ok: boolean; error?: string }[] = [];
  for (const cmd of commands) {
    if (typeof cmd?.id !== "string") continue;
    const previous = await db.get<{ ok: number; error: string | null }>(
      "SELECT ok, error FROM applied_commands WHERE id = ?",
      [cmd.id],
    );
    if (previous) {
      results.push({ id: cmd.id, ok: !!previous.ok, error: previous.error ?? undefined });
      continue;
    }
    try {
      await db.tx(async (tx) => {
        const actor = await tx.get<{ id: string; name: string; role: Role }>(
          "SELECT id, name, role FROM users WHERE id = ? AND active = 1",
          [cmd.actor_id],
        );
        if (!actor) throw new CommandError("This user is no longer active.");
        const rev = await nextRev(tx);
        await applyCommand({ db: tx, actor, deviceId: device.id, rev, cmd: { ...cmd, device_id: device.id } });
        await tx.run(
          "INSERT INTO applied_commands (id, type, device_id, actor_id, ok, applied_at) VALUES (?, ?, ?, ?, 1, ?)",
          [cmd.id, cmd.type, device.id, cmd.actor_id, new Date().toISOString()],
        );
      });
      results.push({ id: cmd.id, ok: true });
    } catch (e) {
      if (!(e instanceof CommandError)) {
        console.error("sync command failed", cmd.type, e);
        // Unexpected server problem: leave it unrecorded so the device retries later.
        results.push({ id: cmd.id, ok: false, error: "RETRY" });
        break;
      }
      await db.run(
        "INSERT INTO applied_commands (id, type, device_id, actor_id, ok, error, applied_at) VALUES (?, ?, ?, ?, 0, ?, ?)",
        [cmd.id, cmd.type, device.id, cmd.actor_id, e.message, new Date().toISOString()],
      );
      results.push({ id: cmd.id, ok: false, error: e.message });
    }
  }

  // Pull: rows changed after the cursor, oldest first, a page at a time.
  const head = Number((await db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'rev'"))?.value ?? 0);
  let upTo = head;
  const window = await db.get<{ r: number | null }>(
    `SELECT MAX(rev) AS r FROM (SELECT rev FROM (${TABLE_NAMES.map((t) => `SELECT rev FROM ${t} WHERE rev > ?`).join(" UNION ALL ")}) ORDER BY rev LIMIT ${PAGE})`,
    TABLE_NAMES.map(() => cursor),
  );
  if (window?.r != null) upTo = Math.min(head, Number(window.r));

  const changes: Partial<Record<TableName, Row[]>> = {};
  for (const table of TABLE_NAMES) {
    const rows = await db.all<Row>(`SELECT * FROM ${table} WHERE rev > ? AND rev <= ?`, [cursor, upTo]);
    if (rows.length) changes[table] = rows;
  }

  // Self-hosted: the first sync of the day also makes the server's daily copy.
  void backupIfDue();
  const epoch = (await db.get<{ value: string }>("SELECT value FROM meta WHERE key = 'epoch'"))?.value ?? null;

  return Response.json({
    epoch,
    results,
    changes,
    cursor: Math.max(cursor, upTo),
    more: upTo < head,
    device,
    serverTime: new Date().toISOString(),
  });
}
