// Fill a NEW, EMPTY shop server with the demo data (two months of realistic
// activity), through the same /api/setup and /api/sync endpoints a phone uses.
//
//   DATABASE_URL=file:data/demo.db npx next dev -p 3200      (a separate server + database)
//   npx tsx scripts/demo-shop.ts http://localhost:3200              (English shop, KES)
//   npx tsx scripts/demo-shop.ts http://localhost:3200 --cameroon   (French shop, FCFA)
//
// It refuses to run against a server that already has a shop, so it can never
// mix demo records into a real shop's data. Sign in with PIN 1234.

import { demoShop } from "../src/core/demo.ts";
import { toBusinessDate } from "../src/core/dates.ts";

const base = (process.argv.find((a) => a.startsWith("http")) ?? "http://localhost:3200").replace(/\/$/, "");
const cameroon = process.argv.includes("--cameroon");
const shop = cameroon
  ? { shopName: "Salon Élégance Douala", ownerName: "Christian Kamga", currency: "XAF", lang: "fr" }
  : { shopName: "Kings Cut Studio", ownerName: "Brian Otieno", currency: "KES", lang: "en" };
const PIN = "1234";

async function main() {
  const status = await (await fetch(`${base}/api/status`)).json();
  if (status.setup) {
    console.error(`Refusing: ${base} already has a shop (“${status.shopName}”). Use a new, empty database.`);
    process.exit(1);
  }

  const setup = await fetch(`${base}/api/setup`, {
    method: "POST",
    headers: { "content-type": "application/json" },
    body: JSON.stringify({ ...shop, pin: PIN, deviceName: "Demo loader" }),
  });
  if (!setup.ok) throw new Error(`Setup failed: ${setup.status} ${await setup.text()}`);
  const cookie = setup.headers.getSetCookie().map((c) => c.split(";")[0]).join("; ");
  const { userId, deviceId } = (await setup.json()) as { userId: string; deviceId: string };

  const { commands } = demoShop(toBusinessDate(), 2026, { edition: cameroon ? "cameroon" : "default" });
  let ok = 0;
  for (let i = 0; i < commands.length; i += 150) {
    const batch = commands.slice(i, i + 150).map((c, j) => ({
      id: `demo-cmd-${i + j}`, type: c.type, payload: c.payload, actor_id: userId, device_id: deviceId, at: c.at,
    }));
    const res = await fetch(`${base}/api/sync`, {
      method: "POST",
      headers: { "content-type": "application/json", cookie },
      // A cursor past the end: push only, don't download everything back.
      body: JSON.stringify({ commands: batch, cursor: Number.MAX_SAFE_INTEGER }),
    });
    if (!res.ok) throw new Error(`Sync failed: ${res.status} ${await res.text()}`);
    const { results } = (await res.json()) as { results: { id: string; ok: boolean; error?: string }[] };
    for (const r of results) {
      if (r.ok) ok++;
      else throw new Error(`Command ${r.id} was refused: ${r.error}`);
    }
  }
  console.log(`Demo shop “${shop.shopName}” ready at ${base}: ${ok} records loaded. Sign in as ${shop.ownerName}, PIN ${PIN}.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
