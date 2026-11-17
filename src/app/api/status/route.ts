import { serverDb } from "@/server/db.ts";
import { currentDevice } from "@/server/auth.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await serverDb();
  const users = await db.all<{ id: string; name: string; role: string }>(
    "SELECT id, name, role FROM users WHERE active = 1 ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END, name",
  );
  const shop = await db.get<{ value: string }>("SELECT value FROM settings WHERE id = 'shop_name'");
  return Response.json({
    setup: users.length > 0,
    shopName: shop?.value ?? null,
    users,
    device: await currentDevice(db),
  });
}
