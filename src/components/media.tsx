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
// English and French (the app is used in Cameroon). Order matters: specific
// before general, e.g. "Massage crânien" before the "crâne" (head shave) rule.
const KEYWORDS: [RegExp, string][] = [
  [/massage/i, "massage"],
  [/steam|sauna|vapeur/i, "steam"],
  [/kid|child|boy|junior|enfant|gar[cç]on|b[ée]b[ée]/i, "kids-cut"],
  [/beard\s*shave|shave.*beard|rasage.*barbe|barbe.*rasage/i, "beard-shave"],
  [/beard|moustache|mustache|goatee|barbe|bouc/i, "beard-trim"],
  [/head\s*shave|clean\s*shave|bald|shave|rasage|ras[ée]|cr[aâ]ne|chauve/i, "head-shave"],
  [/line.?up|shape.?up|edge.?up|razor|hair\s*design|contour|tra[cç]age/i, "lineup"],
  [/wash|shampoo|rinse|lavage|shampo|rin[cç]age/i, "hair-wash"],
  [/visage|masque|sourcil|[ée]pilation|gommage|\bpeau\b/i, "facial"],
  [/dye|colou?r|tint|bleach|relax|treatment|scalp|style|teinture|coloration|d[ée]frisage|tresse|natte|tissage|perruque|m[eè]che|brushing|cuir chevelu|soin/i, "salon"],
  [/haircut|hair\s*cut|cut|fade|trim|taper|coupe|d[ée]grad[ée]|taille/i, "haircut"],
  // Pedicure before nails, so "Gel pedicure" and "Callus removal" land here.
  [/callus|spa\s*pedi|foot\s*spa|p[ée]dicure\s*spa|callosit|bain de pieds/i, "pedicure"],
  [/pedi|toe|foot|feet|p[ée]di|orteil|pied/i, "pedicure-polish"],
  [/remov|soak.?off|d[ée]pose|retrait/i, "nail-tools"],
  [/art|design|gel|acrylic|polish|vernis|capsule|faux ongles|acrylique/i, "nail-art"],
  [/repair|file|buff|men'?s\s*mani|r[ée]paration|manucure\s*homme/i, "nails-natural"],
  [/mani|nail|manucure|ongle/i, "manicure"],
  [/facial|face|mask|brow|wax|eyebrow|skin/i, "facial"],
  [/coffee|latte|espresso|cappuccino|americano|caf[ée]/i, "coffee"],
  // Unicode-aware edges: plain \\b treats "é" as a non-letter, so "Thé" would slip past.
  [/\btea\b|chai|(?<!\p{L})th[ée](?!\p{L})|infusion/iu, "tea"],
  [/juice|smoothie|lemonade|\bjus\b|cocktail de fruits/i, "juice"],
  [/energy|red\s*bull|monster|power|[ée]nerg/i, "energy"],
  [/water|h2o|\beau\b|tangui|supermont/i, "water"],
  [/soda|coke|cola|fanta|sprite|pepsi|soft|drink|beer|malt|can|bottle|boisson|bi[eè]re|guinness|top|djino/i, "soda"],
];

const SECTIONS: [RegExp, string][] = [
  [/barb|hair|cut|coiff/i, "haircut"],
  [/mani|nail|manucure|ongle/i, "manicure"],
  [/pedi|foot|p[ée]di|pied/i, "pedicure"],
  [/drink|bever|bar|cafe|café|refresh|boisson/i, "soda"],
  [/spa|facial|massage|beauty|other|autre|soin|beaut/i, "facial"],
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
