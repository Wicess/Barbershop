// List English sentences in the given files that have no French yet.
//   npx tsx scripts/i18n-missing.ts src/views/Sell.tsx src/components/Receipt.tsx
import { readFileSync } from "node:fs";
import { FR } from "../src/i18n/fr/index.ts";

const lit = String.raw`"((?:[^"\\]|\\.)*)"`;
const missing = new Set<string>();
let found = 0;
for (const f of process.argv.slice(2)) {
  const src = readFileSync(f, "utf8").replace(/\/\*[\s\S]*?\*\//g, "").replace(/^\s*\/\/.*$/gm, "");
  const keys: string[] = [];
  for (const m of src.matchAll(new RegExp(String.raw`\bt[k]?\(\s*${lit}`, "g"))) keys.push(JSON.parse(`"${m[1]}"`));
  for (const m of src.matchAll(new RegExp(String.raw`\bplural\(\s*[^,]+,\s*${lit}\s*,\s*${lit}`, "g"))) keys.push(JSON.parse(`"${m[1]}"`), JSON.parse(`"${m[2]}"`));
  found += keys.length;
  for (const k of keys) if (FR[k] === undefined) missing.add(k);
}
console.log(`${found} translated phrases found; ${missing.size} without French`);
for (const k of missing) console.log("  " + JSON.stringify(k));
process.exit(missing.size ? 1 : 0);
