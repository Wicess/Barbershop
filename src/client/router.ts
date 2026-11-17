"use client";

import { useEffect, useState } from "react";

// Hash routing (#/sales?date=...) keeps the whole app on one cached page, so
// every screen opens offline.

function read() {
  const hash = typeof window === "undefined" ? "" : window.location.hash.slice(1) || "/";
  const [path, search = ""] = hash.split("?");
  return { path: path || "/", params: new URLSearchParams(search) };
}

export function useRoute() {
  const [route, setRoute] = useState(read);
  useEffect(() => {
    const onChange = () => {
      const next = read();
      setRoute((prev) => {
        if (prev.path !== next.path) window.scrollTo(0, 0);
        return next;
      });
    };
    window.addEventListener("hashchange", onChange);
    return () => window.removeEventListener("hashchange", onChange);
  }, []);
  return route;
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
  window.dispatchEvent(new HashChangeEvent("hashchange"));
}
