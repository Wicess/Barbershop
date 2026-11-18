import { upsert } from "@/core/db.ts";
import { hashPin, isValidPin, newSalt } from "@/core/pin.ts";
import { DEFAULT_DEPARTMENTS } from "@/core/seed.ts";
import { DEFAULT_SETTINGS, serializeSetting } from "@/core/settings.ts";
import { issueDeviceToken } from "@/server/auth.ts";
import { nextRev, serverDb } from "@/server/db.ts";
import { registerDevice } from "@/server/devices.ts";

export const dynamic = "force-dynamic";

/** First run: create the shop, its sections and the owner account. Only works while there are no users. */
export async function POST(req: Request) {
  const body = await req.json().catch(() => ({}));
  const shopName = String(body.shopName ?? "").trim();
  const ownerName = String(body.ownerName ?? "").trim();
  const currency = String(body.currency ?? "").trim().toUpperCase();
  const pin = String(body.pin ?? "");
  const lang = body.lang === "en" ? "en" : "fr";
  if (!shopName || !ownerName) return Response.json({ error: "Enter the shop name and your name." }, { status: 400 });
  if (!/^[A-Z]{3}$/.test(currency)) return Response.json({ error: "Choose a currency." }, { status: 400 });
  if (!isValidPin(pin)) return Response.json({ error: "PIN must be 4 to 6 digits." }, { status: 400 });

  const db = await serverDb();
  const salt = newSalt();
  const pinHash = await hashPin(pin, salt);
  try {
    const result = await db.tx(async (tx) => {
      const existing = await tx.get("SELECT id FROM users LIMIT 1");
      if (existing) throw new Error("ALREADY_SETUP");
      const restoring = await tx.get<{ value: string }>("SELECT value FROM meta WHERE key = 'restore_started'");
      if (restoring && Date.now() - Date.parse(restoring.value) < 30 * 60_000) throw new Error("RESTORING");
      const rev = await nextRev(tx);
      const now = new Date().toISOString();
      const settings = { ...DEFAULT_SETTINGS, shop_name: shopName, currency };
      for (const [key, value] of Object.entries(settings)) {
        await upsert(tx, "settings", { id: key, value: serializeSetting(value), updated_at: now }, rev);
      }
      // A shop set up in French gets its sections named in French ("Coiffure", "Boissons"…).
      for (const d of DEFAULT_DEPARTMENTS) {
        // English names in the data; each phone shows them in its own language.
        const name = d.name;
        await upsert(tx, "departments", { ...d, name, active: 1, created_at: now, updated_at: now }, rev);
      }
      const ownerId = crypto.randomUUID();
      await upsert(tx, "users", {
        id: ownerId, name: ownerName, role: "owner", pin_hash: pinHash, pin_salt: salt, active: 1,
        created_at: now, updated_at: now,
      }, rev);
      const device = await registerDevice(tx, String(body.deviceName ?? "Owner device"), ownerId);
      return { ownerId, device };
    });
    await issueDeviceToken(result.device.id);
    return Response.json({ userId: result.ownerId, deviceId: result.device.id, deviceCode: result.device.code });
  } catch (e) {
    if (e instanceof Error && e.message === "RESTORING") {
      return Response.json({ error: "A restore from backup is in progress on this server. Wait for it to finish." }, { status: 409 });
    }
    if (e instanceof Error && e.message === "ALREADY_SETUP") {
      return Response.json({ error: "This shop is already set up. Sign in instead." }, { status: 409 });
    }
    throw e;
  }
}
