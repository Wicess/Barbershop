"use client";

import { useEffect, useState, useSyncExternalStore } from "react";

// Hash routing (#/sales?date=...) keeps the whole app on one cached page, so
// every screen opens offline.
//
// Back: the app keeps its own trail of the screens opened and how far each was
// scrolled, so Back returns to the previous screen exactly where it was left.
// Opening a new screen starts at the top.

function read() {
  const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1) || "/";
  const [path, search = ""] = hash.split("?");
  return { path: path || "/", params: new URLSearchParams(search) };
}

const here = () => window.location.hash || "#/";
const pathOf = (hash: string) => hash.replace(/^#/, "").split("?")[0] || "/";

const trail: string[] = [];
const scrollAt = new Map<string, number>();
const trailListeners = new Set<() => void>();
let replacing = false;
/** Where the next screen should scroll to: null = stay, 0 = top, n = restore. */
let pendingScroll: number | null = null;

if (typeof window !== "undefined") {
  history.scrollRestoration = "manual";
  trail.push(here());
  window.addEventListener("scroll", () => scrollAt.set(here(), window.scrollY), { passive: true });
  // Registered when this module loads, so it runs before any screen reacts to the change.
  window.addEventListener("hashchange", (e) => {
    const next = here();
    const prev = trail[trail.length - 1];
    const prevPath = pathOf(e.oldURL.includes("#") ? `#${e.oldURL.split("#")[1]}` : prev ?? "#/");
    if (replacing) {
      // Same screen, new filters (setParams): swap the entry, keep the scroll.
      trail[trail.length - 1] = next;
      replacing = false;
      pendingScroll = null;
    } else if (trail.length > 1 && trail[trail.length - 2] === next) {
      trail.pop(); // Back
      pendingScroll = scrollAt.get(next) ?? 0;
    } else if (prev !== next) {
      trail.push(next);
      scrollAt.delete(next);
      pendingScroll = pathOf(next) === prevPath ? null : 0;
    }
    trailListeners.forEach((fn) => fn());
  });
}

// Jumps between screens are instant: the page's smooth scrolling would otherwise animate them.
const jump = (y: number) => window.scrollTo({ top: y, left: 0, behavior: "instant" });

/** Scroll to `y` once the screen is tall enough (its data loads a moment later); give up if the person scrolls. */
function restoreScroll(y: number) {
  if (y <= 0) return jump(0);
  let tries = 0;
  let cancelled = false;
  const cancel = () => (cancelled = true);
  const opts = { once: true, passive: true } as const;
  window.addEventListener("wheel", cancel, opts);
  window.addEventListener("touchstart", cancel, opts);
  window.addEventListener("keydown", cancel, opts);
  const step = () => {
    if (cancelled) return;
    jump(y);
    if (Math.abs(window.scrollY - y) < 2 || ++tries > 120) {
      window.removeEventListener("wheel", cancel);
      window.removeEventListener("touchstart", cancel);
      window.removeEventListener("keydown", cancel);
      return;
    }
    requestAnimationFrame(step);
  };
  requestAnimationFrame(step);
}

export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      setRoute(read());
      const target = pendingScroll;
      pendingScroll = null;
      if (target !== null) restoreScroll(target);
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
}

/** True when there is an earlier screen in this visit to go back to. */
export function useCanGoBack() {
  return useSyncExternalStore(
    (fn) => {
      trailListeners.add(fn);
      return () => trailListeners.delete(fn);
    },
    () => trail.length > 1,
    () => false,
  );
}

/** Back to the previous screen, at the scroll position it was left at. */
export function goBack() {
  if (trail.length > 1) history.back();
  else go("/");
}

export function go(path: string, params?: Record<string, string | null | undefined>) {
  const qs = new URLSearchParams();
  for (const [k, v] of Object.entries(params ?? {})) if (v != null && v !== "") qs.set(k, v);
  const q = qs.toString();
  window.location.hash = q ? `${path}?${q}` : path;
}

/** Update query params of the current screen without adding a history entry. */
export function setParams(params: Record<string, string | null | undefined>) {
  const { path, params: current } = read();
  for (const [k, v] of Object.entries(params)) {
    if (v == null || v === "") current.delete(k);
    else current.set(k, v);
  }
  const q = current.toString();
  history.replaceState(null, "", `#${q ? `${path}?${q}` : path}`);
  replacing = true;
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
