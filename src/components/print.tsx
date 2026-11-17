"use client";

import { useEffect, useState, type ReactNode } from "react";

// Anything passed to printContent() is rendered off-screen and sent to the
// browser's print dialog, which reaches any printer the phone or computer
// knows about: USB/Bluetooth/network thermal receipt printers or a normal A4 printer.

let show: ((node: ReactNode | null) => void) | null = null;

export function printContent(node: ReactNode) {
  if (show) show(node);
  else window.print();
}

export function PrintHost() {
  const [node, setNode] = useState<ReactNode | null>(null);
  useEffect(() => {
    show = setNode;
    return () => {
      show = null;
    };
  }, []);
  useEffect(() => {
    if (!node) return;
    const done = () => setNode(null);
    window.addEventListener("afterprint", done, { once: true });
    const t = setTimeout(() => window.print(), 80);
    return () => {
      clearTimeout(t);
      window.removeEventListener("afterprint", done);
    };
  }, [node]);
  return node ? <div className="print-area print-only">{node}</div> : null;
}

export function PageSize({ size }: { size: "58" | "80" | "a4" | string }) {
  const css =
    size === "a4"
      ? "@page { size: A4; margin: 12mm; }"
      : `@page { size: ${size === "58" ? "58mm" : "80mm"} auto; margin: 3mm; }`;
  return <style>{css}</style>;
}
