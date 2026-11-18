import { serverDb } from "@/server/db.ts";
import { currentDevice } from "@/server/auth.ts";

export const dynamic = "force-dynamic";

export async function GET() {
  const db = await serverDb();
  // Only which roles exist (never names): this endpoint is public, before anyone signs in.
  const rows = await db.all<{ role: string }>(
    "SELECT DISTINCT role FROM users WHERE active = 1 ORDER BY CASE role WHEN 'owner' THEN 0 WHEN 'manager' THEN 1 ELSE 2 END",
  );
  const roles = rows.map((r) => r.role);
  const shop = await db.get<{ value: string }>("SELECT value FROM settings WHERE id = 'shop_name'");
  return Response.json({
    setup: roles.length > 0,
    shopName: shop?.value ?? null,
    roles,
    device: await currentDevice(db),
  });
}
