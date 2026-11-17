"use client";

import { useState } from "react";
import { cx } from "./ui.tsx";

/**
 * Photos for services, drinks and sections. They live in /public/img, so they
 * work offline (the service worker caches them with the app shell). Photos are
 * from Unsplash, free to use under the Unsplash License.
 *
 * Services are named by each shop, so they're matched by keywords in the name,
 * then by section, then by a generic shop photo.
 */
const KEYWORDS: [RegExp, string][] = [
  [/kid|child|boy|junior/i, "kids-cut"],
  [/beard\s*shave|shave.*beard/i, "beard-shave"],
  [/beard|moustache|mustache|goatee/i, "beard-trim"],
  [/head\s*shave|clean\s*shave|bald|shave/i, "head-shave"],
  [/line.?up|shape.?up|edge.?up|razor|hair\s*design/i, "lineup"],
  [/wash|shampoo|rinse/i, "hair-wash"],
  [/dye|colou?r|tint|bleach|relax|treatment|scalp|style/i, "salon"],
  [/haircut|hair\s*cut|cut|fade|trim|taper/i, "haircut"],
  // Pedicure before nails, so "Gel pedicure" and "Callus removal" land here.
  [/callus|spa\s*pedi|foot\s*spa/i, "pedicure"],
  [/pedi|toe|foot|feet/i, "pedicure-polish"],
  [/remov|soak.?off/i, "nail-tools"],
  [/art|design|gel|acrylic|polish/i, "nail-art"],
  [/repair|file|buff|men'?s\s*mani/i, "nails-natural"],
  [/mani|nail/i, "manicure"],
  [/massage/i, "massage"],
  [/steam|sauna/i, "steam"],
  [/facial|face|mask|brow|wax|eyebrow|skin/i, "facial"],
  [/coffee|latte|espresso|cappuccino|americano/i, "coffee"],
  [/tea|chai/i, "tea"],
  [/juice|smoothie|lemonade/i, "juice"],
  [/energy|red\s*bull|monster|power/i, "energy"],
  [/water|h2o/i, "water"],
  [/soda|coke|cola|fanta|sprite|pepsi|soft|drink|beer|malt|can|bottle/i, "soda"],
];

const SECTIONS: [RegExp, string][] = [
  [/barb|hair|cut/i, "haircut"],
  [/mani|nail/i, "manicure"],
  [/pedi|foot/i, "pedicure"],
  [/drink|bever|bar|cafe|café|refresh/i, "soda"],
  [/spa|facial|massage|beauty|other/i, "facial"],
];

const src = (key: string) => `/img/${key}.webp`;

export function sectionImage(name: string, kind?: string): string {
  for (const [re, key] of SECTIONS) if (re.test(name)) return src(key);
  return src(kind === "product" ? "soda" : "barber-cut");
}

export function itemImage(name: string, sectionName: string, kind?: string): string {
  for (const [re, key] of KEYWORDS) if (re.test(name)) return src(key);
  return sectionImage(sectionName, kind);
}

/** Every bundled photo, for the service worker's offline cache. */
export const ALL_PHOTOS = [
  "haircut", "lineup", "beard-trim", "beard-shave", "head-shave", "kids-cut", "barber-cut", "hair-wash", "salon",
  "manicure", "nail-art", "nails-natural", "nail-tools", "pedicure", "pedicure-polish", "facial", "steam", "massage",
  "coffee", "tea", "juice", "soda", "energy", "water", "hero-shop", "hero-dark",
].map(src);

/** An image that fades in once loaded, over a warm placeholder. */
export function Photo({
  src: url, alt, className, imgClassName, priority,
}: { src: string; alt: string; className?: string; imgClassName?: string; priority?: boolean }) {
  const [loaded, setLoaded] = useState(false);
  return (
    <span className={cx("photo block overflow-hidden", className)}>
      {/* eslint-disable-next-line @next/next/no-img-element */}
      <img
        src={url}
        alt={alt}
        loading={priority ? "eager" : "lazy"}
        decoding="async"
        draggable={false}
        data-loaded={loaded}
        ref={(el) => {
          if (el?.complete && el.naturalWidth > 0 && !loaded) setLoaded(true);
        }}
        onLoad={() => setLoaded(true)}
        className={cx("size-full object-cover", imgClassName)}
      />
    </span>
  );
}
