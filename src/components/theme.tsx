"use client";

// Light / dark appearance, chosen per device (like the language). "auto" follows
// the phone's own setting. The choice is applied before first paint by the small
// script in app/layout.tsx (THEME_BOOT), so the page never flashes the wrong theme.

import { useSyncExternalStore } from "react";
import { t } from "@/core/i18n.ts";
import { haptic } from "./native.tsx";

export type Theme = "auto" | "light" | "dark";
const KEY = "bms_theme";
const BAR = { light: "#f6f2ec", dark: "#0b0a09" }; // phone status-bar colours, match --bg

/** Runs in <head> before the page paints. Keep it tiny and dependency-free. */
export const THEME_BOOT = `try{var t=localStorage.getItem("${KEY}");if(t==="light"||t==="dark")document.documentElement.dataset.theme=t}catch(e){}`;

const listeners = new Set<() => void>();

export function getTheme(): Theme {
  try {
    const v = localStorage.getItem(KEY);
    return v === "light" || v === "dark" ? v : "auto";
  } catch {
    return "auto";
  }
}

export function setTheme(theme: Theme) {
  try {
    if (theme === "auto") localStorage.removeItem(KEY);
    else localStorage.setItem(KEY, theme);
  } catch { /* private mode: still applies for this visit */ }
  const root = document.documentElement;
  if (theme === "auto") delete root.dataset.theme;
  else root.dataset.theme = theme;
  // The phone's status bar: a forced theme wins over the device setting.
  document.querySelectorAll<HTMLMetaElement>('meta[name="theme-color"]').forEach((m) => {
    const media = m.getAttribute("media") ?? "";
    m.content = theme === "auto" ? (media.includes("dark") ? BAR.dark : BAR.light) : BAR[theme];
  });
  listeners.forEach((fn) => fn());
}

/** Re-applies the stored choice to the status bar after load (the boot script only sets the page). */
export function applyStoredTheme() {
  const theme = getTheme();
  if (theme !== "auto") setTheme(theme);
}

function subscribe(fn: () => void) {
  listeners.add(fn);
  return () => listeners.delete(fn);
}

export function useTheme(): Theme {
  return useSyncExternalStore(subscribe, getTheme, () => "auto");
}

/** Auto / Light / Dark: a sliding pill like the language switch. */
export function ThemeSwitch({ className }: { className?: string }) {
  const theme = useTheme();
  const options: { id: Theme; label: string }[] = [
    { id: "auto", label: t("Auto") },
    { id: "light", label: t("Light") },
    { id: "dark", label: t("Dark") },
  ];
  const index = options.findIndex((o) => o.id === theme);
  return (
    <div role="radiogroup" aria-label={t("Appearance")} className={["relative inline-grid grid-cols-3 rounded-full bg-surface-2 p-1 ring-1 ring-line", className].filter(Boolean).join(" ")}>
      <span
        aria-hidden
        className="absolute bottom-1 left-1 top-1 w-[calc((100%-8px)/3)] rounded-full bg-primary shadow-cta transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
        style={{ transform: `translateX(${index * 100}%)` }}
      />
      {options.map((o) => (
        <button
          key={o.id}
          type="button"
          role="radio"
          aria-checked={theme === o.id}
          onClick={() => {
            if (theme !== o.id) haptic();
            setTheme(o.id);
          }}
          className={[
            "relative z-10 flex h-9 min-w-16 cursor-pointer items-center justify-center rounded-full px-3 text-xs font-bold tracking-wide transition-colors duration-200",
            theme === o.id ? "text-on-primary" : "text-ink-2 hover:text-ink",
          ].join(" ")}
        >
          {o.label}
        </button>
      ))}
    </div>
  );
}
