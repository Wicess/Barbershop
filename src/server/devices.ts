import "server-only";
import { upsert, type Db } from "@/core/db.ts";
import { nextRev } from "./db.ts";

/** Devices get a short code (A, B, ... Z, AA ...) that prefixes their receipt numbers. */
function codeFor(n: number): string {
  let s = "";
  for (let x = n; x >= 0; x = Math.floor(x / 26) - 1) s = String.fromCharCode(65 + (x % 26)) + s;
  return s;
}

export async function registerDevice(db: Db, name: string, userId: string) {
  const count = await db.get<{ n: number }>("SELECT COUNT(*) AS n FROM devices");
  const device = {
    id: crypto.randomUUID(),
    code: codeFor(Number(count?.n ?? 0)),
    name: name.slice(0, 60) || "Device",
    registered_by: userId,
    created_at: new Date().toISOString(),
    revoked_at: null,
  };
  const rev = await nextRev(db);
  await upsert(db, "devices", device, rev);
  await upsert(
    db,
    "audit_log",
    {
      id: `dev-${device.id}`,
      actor_id: userId,
      action: "device.register",
      entity: "devices",
      entity_id: device.id,
      summary: `Signed in new device ${device.code} (${device.name})`,
      device_id: device.id,
      created_at: device.created_at,
    },
    rev,
  );
  return device;
}
