// The app's traditional mark, drawn the modern way. It's built from the lozenge
// and "eye" of Ndop, the royal resist-dyed cloth of Cameroon's Grassfields, but
// reduced to fine brass hairlines on a strict geometry, the way a jeweller or a
// watchmaker would engrave it, instead of a printed textile pattern.

const BRASS = "var(--brass)";

/** The emblem: nested lozenges around a central eye, with engraved tick marks. */
export function Emblem({ size = 28, className }: { size?: number; className?: string }) {
  return (
    <svg width={size} height={size} viewBox="0 0 48 48" fill="none" aria-hidden className={className}>
      {/* About one screen pixel wide at any size. */}
      <g stroke={BRASS} strokeWidth={(1.1 * 48) / size} strokeLinejoin="miter">
        <path d="M24 2 46 24 24 46 2 24Z" opacity="0.55" />
        <path d="M24 9 39 24 24 39 9 24Z" />
        <path d="M24 16 32 24 24 32 16 24Z" opacity="0.8" />
        {/* tick marks on the outer lozenge, like an engraved bezel */}
        <path d="M13 13 14.6 14.6M35 13 33.4 14.6M13 35 14.6 33.4M35 35 33.4 33.4" opacity="0.7" />
      </g>
      <circle cx="24" cy="24" r="2.2" fill={BRASS} />
      <g fill={BRASS}>
        <path d="M24 0.6 25 2 24 3.4 23 2Z" />
        <path d="M24 44.6 25 46 24 47.4 23 46Z" />
        <path d="M0.6 24 2 23 3.4 24 2 25Z" />
        <path d="M44.6 24 46 23 47.4 24 46 25Z" />
      </g>
    </svg>
  );
}

/** A hairline rule that fades in from both ends to the emblem, flanked by two small lozenges. */
export function MotifDivider({ className }: { className?: string }) {
  const line = "h-px flex-1";
  const dot = "size-[5px] rotate-45 bg-[var(--brass)]";
  return (
    <div aria-hidden className={["flex items-center gap-3", className].filter(Boolean).join(" ")}>
      <span className={line} style={{ background: `linear-gradient(90deg, transparent, color-mix(in oklab, ${BRASS} 55%, transparent))` }} />
      <span className={dot} style={{ opacity: 0.6 }} />
      <Emblem size={26} />
      <span className={dot} style={{ opacity: 0.6 }} />
      <span className={line} style={{ background: `linear-gradient(90deg, color-mix(in oklab, ${BRASS} 55%, transparent), transparent)` }} />
    </div>
  );
}
