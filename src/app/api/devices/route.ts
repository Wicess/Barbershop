import { verifyPin } from "@/core/pin.ts";
import { issueDeviceToken, recordAttempt, tooManyAttempts } from "@/server/auth.ts";
import { serverDb } from "@/server/db.ts";
import { registerDevice } from "@/server/devices.ts";

export const dynamic = "force-dynamic";

/** Connect a new phone, tablet or PC to the shop. Any active user's PIN unlocks it. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const userId = String(body.userId ?? "");
  const pin = String(body.pin ?? "");
  const ip = req.headers.get("x-forwarded-for")?.split(",")[0]?.trim() || "local";
  const key = `${ip}:${userId}`;
  if (tooManyAttempts(key)) {
    return Response.json({ error: "Too many wrong PINs. Wait 5 minutes and try again." }, { status: 429 });
  }

  const db = await serverDb();
  const user = await db.get<{ id: string; pin_hash: string; pin_salt: string }>(
    "SELECT id, pin_hash, pin_salt FROM users WHERE id = ? AND active = 1",
    [userId],
  );
  const ok = !!user && (await verifyPin(pin, user.pin_salt, user.pin_hash));
  recordAttempt(key, ok);
  if (!ok) return Response.json({ error: "Wrong PIN." }, { status: 401 });

  const device = await db.tx((tx) => registerDevice(tx, String(body.deviceName ?? "Shop device"), userId));
  await issueDeviceToken(device.id);
  return Response.json({ deviceId: device.id, deviceCode: device.code });
}
