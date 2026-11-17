"use client";

import { useSyncExternalStore } from "react";
import { getLang, LANGS, setLang, subscribeLang, type Lang } from "@/core/i18n.ts";
import { haptic } from "./native.tsx";
import { cx } from "./ui.tsx";

/** The current language; components that call it re-render when it changes. */
export function useLang(): Lang {
  return useSyncExternalStore(subscribeLang, getLang, () => "fr" as Lang);
}

/** FR | EN pill switch, for the sign-in screen and Settings. */
export function LanguageSwitch({ className }: { className?: string }) {
  const lang = useLang();
  return (
    <div role="radiogroup" aria-label="Language / Langue" className={cx("relative inline-flex rounded-full bg-surface p-1 ring-1 ring-line backdrop-blur-md", className)}>
      <span
        aria-hidden
        className="absolute bottom-1 top-1 w-[calc(50%-4px)] rounded-full bg-primary shadow-cta transition-transform duration-300 ease-[cubic-bezier(0.34,1.4,0.64,1)]"
        style={{ transform: `translateX(${lang === "fr" ? 0 : 100}%)` }}
      />
      {LANGS.map((l) => (
        <button
          key={l.id}
          role="radio"
          aria-checked={lang === l.id}
          aria-label={l.label}
          onClick={() => {
            if (lang !== l.id) haptic();
            setLang(l.id);
          }}
          className={cx(
            "relative z-10 flex h-9 min-w-12 cursor-pointer items-center justify-center rounded-full px-3 text-xs font-bold tracking-wide transition-colors duration-200",
            lang === l.id ? "text-on-primary" : "text-ink-2 hover:text-ink",
          )}
        >
          {l.short}
        </button>
      ))}
    </div>
  );
}
