"use client";

import dynamic from "next/dynamic";

// The whole app runs in the browser against its own offline database, so it is
// loaded client-side only.
const Boot = dynamic(() => import("@/views/Boot.tsx"), { ssr: false });

export default function Page() {
  return <Boot />;
}
