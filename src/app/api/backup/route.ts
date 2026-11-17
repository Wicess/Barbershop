import { readFile } from "node:fs/promises";
import { verifyPin } from "@/core/pin.ts";
import { currentDevice, recordAttempt, tooManyAttempts } from "@/server/auth.ts";
import { backupNow, backupPath, backupStatus } from "@/server/backups.ts";
import { serverDb } from "@/server/db.ts";

export const dynamic = "force-dynamic";

/** The server's own automatic copies: list them (any connected device). */
export async function GET() {
  const db = await serverDb();
  if (!(await currentDevice(db))) return Response.json({ error: "DEVICE_NOT_REGISTERED" }, { status: 401 });
  return Response.json(await backupStatus());
}

/**
 * { action: "now" }: make today's server copy now (any connected device).
 * { action: "download", name, userId, pin }: download a server copy. Owner PIN required.
 */
export async function POST(req: Request) {
  const db = await serverDb();
  const device = await currentDevice(db);
  if (!device) return Response.json({ error: "DEVICE_NOT_REGISTERED" }, { status: 401 });
  const body = await req.json().catch(() => ({}));

  if (body.action === "now") {
    await backupNow();
    return Response.json(await backupStatus());
  }

  if (body.action === "download") {
    const file = backupPath(String(body.name ?? ""));
    if (!file) return Response.json({ error: "Unknown backup." }, { status: 400 });
    const key = `backup:${device.id}`;
    if (tooManyAttempts(key)) return Response.json({ error: "Too many wrong PINs. Wait 5 minutes." }, { status: 429 });
    const owner = await db.get<{ pin_hash: string; pin_salt: string }>(
      "SELECT pin_hash, pin_salt FROM users WHERE id = ? AND role = 'owner' AND active = 1",
      [String(body.userId ?? "")],
    );
    const ok = !!owner && (await verifyPin(String(body.pin ?? ""), owner.pin_salt, owner.pin_hash));
    recordAttempt(key, ok);
    if (!ok) return Response.json({ error: "Only the owner can download server backups. Wrong PIN." }, { status: 403 });
    const bytes = await readFile(/*turbopackIgnore: true*/ file).catch(() => null);
    if (!bytes) return Response.json({ error: "That backup is gone." }, { status: 404 });
    return new Response(new Uint8Array(bytes), {
      headers: {
        "Content-Type": "application/vnd.sqlite3",
        "Content-Disposition": `attachment; filename="${String(body.name)}"`,
        "Cache-Control": "no-store",
      },
    });
  }

  return Response.json({ error: "Unknown action." }, { status: 400 });
}
