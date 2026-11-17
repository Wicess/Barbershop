"use client";

// Small pieces that make the web app behave like an installed phone app:
// haptics, the collapsing large title, pull-to-refresh and the install prompt.

import { useEffect, useRef, useState, useSyncExternalStore } from "react";
import { Download, RefreshCw, Share, X } from "lucide-react";
import { t } from "@/core/i18n.ts";

const cx = (...parts: (string | false | null | undefined)[]) => parts.filter(Boolean).join(" ");

// ---------- haptics ----------

/** A short vibration on devices that support it (Android). Silently does nothing elsewhere. */
export function haptic(kind: "tap" | "success" | "error" = "tap") {
  if (typeof navigator === "undefined" || !("vibrate" in navigator)) return;
  if (window.matchMedia?.("(prefers-reduced-motion: reduce)").matches) return;
  try {
    navigator.vibrate(kind === "tap" ? 8 : kind === "success" ? [10, 50, 14] : [30, 40, 30]);
  } catch {
    // ignore
  }
}

// ---------- collapsing title ----------

// The page's large title reports here when it scrolls under the top bar, and
// the top bar then shows a compact copy of it, like iOS navigation bars.
let titleState = { title: "", collapsed: false };
const titleListeners = new Set<() => void>();
function setTitleState(next: typeof titleState) {
  if (next.title === titleState.title && next.collapsed === titleState.collapsed) return;
  titleState = next;
  titleListeners.forEach((fn) => fn());
}

export function useCollapsedTitle() {
  return useSyncExternalStore(
    (fn) => {
      titleListeners.add(fn);
      return () => titleListeners.delete(fn);
    },
    () => titleState,
    () => titleState,
  );
}

/** Attach to a page's large title element. */
export function useLargeTitle(title: string) {
  const ref = useRef<HTMLHeadingElement>(null);
  useEffect(() => {
    const el = ref.current;
    if (!el) return;
    setTitleState({ title, collapsed: false });
    const io = new IntersectionObserver(
      ([entry]) => setTitleState({ title, collapsed: !entry.isIntersecting }),
      // The top bar is ~56px tall plus the safe area; treat the title as hidden once it slides under it.
      { rootMargin: "-64px 0px 0px 0px", threshold: 0 },
    );
    io.observe(el);
    return () => {
      io.disconnect();
      setTitleState({ title: "", collapsed: false });
    };
  }, [title]);
  return ref;
}

// ---------- back navigation ----------

// Screens reached from the More tab are sub-pages: on phones their header gets
// a back button, like a pushed screen in a native navigation stack.
let backTarget: string | null = null;
const backListeners = new Set<() => void>();
export function setBackTarget(target: string | null) {
  if (target === backTarget) return;
  backTarget = target;
  backListeners.forEach((fn) => fn());
}
export function useBackTarget() {
  return useSyncExternalStore(
    (fn) => {
      backListeners.add(fn);
      return () => backListeners.delete(fn);
    },
    () => backTarget,
    () => null,
  );
}

// ---------- media ----------

export function useMediaQuery(query: string) {
  return useSyncExternalStore(
    (fn) => {
      const mq = window.matchMedia(query);
      mq.addEventListener("change", fn);
      return () => mq.removeEventListener("change", fn);
    },
    () => window.matchMedia(query).matches,
    () => false,
  );
}

// ---------- pull to refresh ----------

const PULL_TRIGGER = 72;

/** Pull down at the top of a screen to sync. Only the indicator moves, never the page. */
export function PullToRefresh({ onRefresh }: { onRefresh: () => Promise<void> }) {
  const indicator = useRef<HTMLDivElement>(null);
  const icon = useRef<SVGSVGElement>(null);
  const [busy, setBusy] = useState(false);

  useEffect(() => {
    let startY = 0;
    let pulling = false;
    let distance = 0;
    const el = indicator.current!;

    const render = (d: number, animate: boolean) => {
      el.style.transition = animate ? "transform 260ms cubic-bezier(0.32, 0.72, 0, 1), opacity 200ms ease-out" : "none";
      el.style.transform = `translate(-50%, ${Math.min(d, PULL_TRIGGER * 1.4) - 48}px)`;
      el.style.opacity = d > 4 ? String(Math.min(1, d / PULL_TRIGGER)) : "0";
      if (icon.current) icon.current.style.transform = `rotate(${d * 3}deg)`;
    };

    const onStart = (e: TouchEvent) => {
      if (window.scrollY > 0 || e.touches.length !== 1 || document.body.style.overflow === "hidden") return;
      startY = e.touches[0].clientY;
      pulling = true;
      distance = 0;
    };
    const onMove = (e: TouchEvent) => {
      if (!pulling) return;
      const dy = e.touches[0].clientY - startY;
      if (dy <= 0 || window.scrollY > 0) {
        distance = 0;
        render(0, false);
        return;
      }
      // Rubber-band: the further you pull, the less it moves.
      distance = PULL_TRIGGER * 1.6 * (1 - Math.exp(-dy / (PULL_TRIGGER * 1.6)));
      render(distance, false);
    };
    const onEnd = async () => {
      if (!pulling) return;
      pulling = false;
      if (distance >= PULL_TRIGGER) {
        haptic("tap");
        render(PULL_TRIGGER, true);
        setBusy(true);
        try {
          await onRefresh();
        } finally {
          setBusy(false);
          render(0, true);
        }
      } else {
        render(0, true);
      }
    };
    render(0, false);
    window.addEventListener("touchstart", onStart, { passive: true });
    window.addEventListener("touchmove", onMove, { passive: true });
    window.addEventListener("touchend", onEnd);
    window.addEventListener("touchcancel", onEnd);
    return () => {
      window.removeEventListener("touchstart", onStart);
      window.removeEventListener("touchmove", onMove);
      window.removeEventListener("touchend", onEnd);
      window.removeEventListener("touchcancel", onEnd);
    };
  }, [onRefresh]);

  return (
    <div
      ref={indicator}
      aria-hidden={!busy}
      role="status"
      className="no-print pointer-events-none fixed left-1/2 top-[calc(env(safe-area-inset-top)+3.5rem)] z-30 flex size-10 items-center justify-center rounded-full border border-line bg-surface text-ink-2 shadow-md lg:hidden"
    >
      <RefreshCw ref={icon} className={cx("size-5", busy && "animate-spin")} />
      <span className="sr-only">{busy ? t("Syncing…") : ""}</span>
    </div>
  );
}

// ---------- install prompt ----------

interface BeforeInstallPromptEvent extends Event {
  prompt(): Promise<void>;
  userChoice: Promise<{ outcome: "accepted" | "dismissed" }>;
}

let deferredPrompt: BeforeInstallPromptEvent | null = null;
const installListeners = new Set<() => void>();
if (typeof window !== "undefined") {
  window.addEventListener("beforeinstallprompt", (e) => {
    e.preventDefault();
    deferredPrompt = e as BeforeInstallPromptEvent;
    installListeners.forEach((fn) => fn());
  });
  window.addEventListener("appinstalled", () => {
    deferredPrompt = null;
    installListeners.forEach((fn) => fn());
  });
}

const DISMISS_KEY = "bms_install_dismissed";

function isStandalone() {
  return window.matchMedia("(display-mode: standalone)").matches || (navigator as { standalone?: boolean }).standalone === true;
}

/** "Install the app" card: Android/desktop Chrome get a real install button, iPhone gets the Share-sheet steps. */
export function InstallCard() {
  const [, force] = useState(0);
  const [hidden, setHidden] = useState(true);
  useEffect(() => {
    const update = () => force((n) => n + 1);
    installListeners.add(update);
    let dismissed = false;
    try {
      dismissed = localStorage.getItem(DISMISS_KEY) === "1";
    } catch {
      // storage blocked: just show it
    }
    setHidden(dismissed || isStandalone());
    return () => {
      installListeners.delete(update);
    };
  }, []);

  if (hidden) return null;
  const ios = /iPhone|iPad|iPod/.test(navigator.userAgent);
  if (!deferredPrompt && !ios) return null;

  const dismiss = () => {
    try {
      localStorage.setItem(DISMISS_KEY, "1");
    } catch {
      // ignore
    }
    setHidden(true);
  };

  return (
    <div className="animate-fade-in relative mb-4 flex items-center gap-3 rounded-2xl border border-line bg-surface p-4 lg:hidden">
      <img src="/icons/icon-192.png" alt="" width={44} height={44} className="size-11 rounded-xl" />
      <div className="min-w-0 flex-1">
        <p className="font-semibold">{t("Install the app")}</p>
        {ios ? (
          <p className="text-xs text-ink-3">
            {/* The icon sits between two halves of one sentence; both halves are translated as a pair. */}
            {t("Tap")} <Share className="inline size-3.5 align-[-2px]" aria-label={t("Share button")} /> {t("then “Add to Home Screen”.")}
          </p>
        ) : (
          <p className="text-xs text-ink-3">{t("Opens full screen from your home screen, even offline.")}</p>
        )}
      </div>
      {!ios && deferredPrompt && (
        <button
          onClick={async () => {
            haptic();
            await deferredPrompt?.prompt();
            const choice = await deferredPrompt?.userChoice;
            if (choice?.outcome === "accepted") setHidden(true);
            deferredPrompt = null;
          }}
          className="flex min-h-10 cursor-pointer items-center gap-1.5 rounded-full bg-primary px-4 text-sm font-semibold text-on-primary transition-transform active:scale-95"
        >
          <Download className="size-4" /> {t("Install")}
        </button>
      )}
      <button onClick={dismiss} aria-label={t("Dismiss")} className="-mr-1 flex size-9 cursor-pointer items-center justify-center rounded-full text-ink-3">
        <X className="size-4" />
      </button>
    </div>
  );
}
