// Languages. The app is used in Cameroon, so it speaks French and English.
//
// Text is written in English in the code and wrapped in t("…"); the English
// sentence is the key, and src/i18n/fr/*.ts hold the French for each one.
// Placeholders look like {name}. Stored data (payment methods, categories,
// section names a shop typed) is never translated in the database — only on
// screen — so records and reports stay consistent whichever language a phone uses.

import { FR } from "../i18n/fr/index.ts";

export type Lang = "fr" | "en";
export const LANGS: { id: Lang; label: string; short: string }[] = [
  { id: "fr", label: "Français", short: "FR" },
  { id: "en", label: "English", short: "EN" },
];

const STORAGE_KEY = "bms_lang";
// The server and the tests run in English; phones pick their language below.
let current: Lang = "en";
const listeners = new Set<() => void>();

/** Missing French keys seen while running (dev/test aid: window.__i18nMissing). */
const missing = new Set<string>();

function detect(): Lang {
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved === "fr" || saved === "en") return saved;
  } catch {
    /* storage blocked */
  }
  // French unless the phone itself is set to English.
  if (typeof navigator !== "undefined" && /^en\b/i.test(navigator.language ?? "")) return "en";
  return "fr";
}

if (typeof window !== "undefined") {
  current = detect();
  document.documentElement.lang = current;
  (window as unknown as { __i18nMissing: Set<string> }).__i18nMissing = missing;
}

export function getLang(): Lang {
  return current;
}

export function setLang(lang: Lang) {
  if (lang === current) return;
  current = lang;
  try {
    localStorage.setItem(STORAGE_KEY, lang);
  } catch {
    /* not remembered, still applied */
  }
  if (typeof document !== "undefined") document.documentElement.lang = lang;
  listeners.forEach((fn) => fn());
}

export function subscribeLang(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

/** The Intl locale for dates and money: Cameroon's French or English. */
export function locale(): string {
  return current === "fr" ? "fr-CM" : "en-GB";
}

function fill(s: string, vars?: Record<string, string | number>) {
  return vars ? s.replace(/\{(\w+)\}/g, (_, k: string) => (k in vars ? String(vars[k]) : `{${k}}`)) : s;
}

/** Translate an English sentence into the current language. */
export function t(key: string, vars?: Record<string, string | number>): string {
  if (current === "en") return fill(key, vars);
  const fr = FR[key];
  if (fr === undefined) {
    missing.add(key);
    return fill(key, vars);
  }
  return fill(fr, vars);
}

/**
 * Pick the singular or plural sentence for a count. French uses the singular
 * for 0 and 1 ("0 vente", "1 vente", "2 ventes"); English only for 1.
 * Both sentences can use {n}.
 */
export function plural(n: number, one: string, many: string, vars?: Record<string, string | number>): string {
  const single = current === "fr" ? Math.abs(n) < 2 : n === 1;
  return t(single ? one : many, { n, ...vars });
}

// Messages that arrive with values already filled in (from the server or a
// command), matched against French entries that have placeholders.
let patterns: { re: RegExp; names: string[]; key: string }[] | null = null;
function buildPatterns() {
  patterns = Object.keys(FR)
    .filter((k) => /\{\w+\}/.test(k))
    .map((key) => {
      const names: string[] = [];
      const src = key
        .split(/(\{\w+\})/)
        .map((part) => {
          const m = part.match(/^\{(\w+)\}$/);
          if (m) {
            names.push(m[1]);
            return "(.+?)";
          }
          return part.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
        })
        .join("");
      return { re: new RegExp(`^${src}$`), names, key };
    });
}

/** Translate a finished message, e.g. an error from the server: exact match first, then patterns. */
export function tMessage(message: string): string {
  if (current === "en" || !message) return message;
  if (FR[message] !== undefined) return FR[message];
  if (!patterns) buildPatterns();
  for (const p of patterns!) {
    const m = message.match(p.re);
    if (m) return t(p.key, Object.fromEntries(p.names.map((n, i) => [n, m[i + 1]])));
  }
  missing.add(message);
  return message;
}

/**
 * Mark English text that is stored in a list and translated later with t()
 * where it's shown (e.g. sort options). Returns it unchanged; the coverage
 * test and scripts/i18n-missing.ts look for tk("…") so it can't go untranslated.
 */
export const tk = (english: string): string => english;
