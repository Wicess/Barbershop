// Merges the French for each group of screens.
import { home } from "./home.ts";
import { money } from "./money.ts";
import { people } from "./people.ts";
import { sell } from "./sell.ts";
import { settings } from "./settings.ts";
import { signin } from "./signin.ts";

export const screens: Record<string, string> = { ...signin, ...sell, ...home, ...money, ...people, ...settings };
