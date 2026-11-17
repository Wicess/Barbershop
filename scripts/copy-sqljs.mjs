// Copies the sql.js browser build into /public so the offline database loads
// without going through the bundler (sql.js references Node built-ins).
import { copyFileSync, mkdirSync } from "node:fs";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const dist = dirname(require.resolve("sql.js/dist/sql-wasm.js"));
mkdirSync("public/sqljs", { recursive: true });
for (const file of ["sql-wasm.js", "sql-wasm.wasm"]) {
  copyFileSync(join(dist, file), join("public/sqljs", file));
}
console.log("sql.js copied to public/sqljs");
