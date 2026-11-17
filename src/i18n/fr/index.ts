// All French text, merged. Each screen keeps its own file so screens can be
// translated independently; common.ts (the glossary) and core.ts win on clashes.

import { common } from "./common.ts";
import { core } from "./core.ts";
import { screens } from "./screens.ts";

export const FR: Record<string, string> = { ...screens, ...core, ...common };
