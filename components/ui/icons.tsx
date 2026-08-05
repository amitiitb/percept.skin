/**
 * The icon set.
 *
 * One system, one grid: every glyph is drawn on the same 24×24 box with a
 * 1.75 stroke, round caps and round joins, and inherits `currentColor`. That
 * consistency is the whole point — the app previously mixed typographic
 * symbols (◍ ≈ ◒ ◇) with emoji (🔒), which render in a different weight, a
 * different colour, and a different font on every platform, so a row of them
 * never lined up.
 *
 * Stroke width is a prop rather than fixed because a 16px icon beside 12px
 * type needs a touch more weight than a 32px one to read at the same density.
 * Size is set in rem so icons scale with the app's fluid root font.
 */

export interface IconProps {
  /** rem, matching the surrounding type scale. */
  size?: number;
  strokeWidth?: number;
  className?: string;
  /** Set when the icon carries meaning on its own; omit when text repeats it. */
  title?: string;
}

function Svg({ size = 1.8, strokeWidth = 1.75, className, title, children }: IconProps & { children: React.ReactNode }) {
  return (
    <svg
      viewBox="0 0 24 24"
      width={`${size}rem`}
      height={`${size}rem`}
      fill="none"
      stroke="currentColor"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeLinejoin="round"
      className={className}
      role={title ? "img" : undefined}
      aria-hidden={title ? undefined : true}
      aria-label={title}
      style={{ display: "block", flexShrink: 0 }}
    >
      {title && <title>{title}</title>}
      {children}
    </svg>
  );
}

/* ── Module icons — one per report tab ──────────────────────────────────── */

/** Skin & face: a face in a scanning reticle. */
export function IconFaceScan(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 8.5V5.8A2.8 2.8 0 0 1 5.8 3H8.5" />
      <path d="M15.5 3h2.7A2.8 2.8 0 0 1 21 5.8v2.7" />
      <path d="M21 15.5v2.7a2.8 2.8 0 0 1-2.8 2.8h-2.7" />
      <path d="M8.5 21H5.8A2.8 2.8 0 0 1 3 18.2v-2.7" />
      <path d="M9 10h.01M15 10h.01" />
      <path d="M9.5 14.8a3.6 3.6 0 0 0 5 0" />
    </Svg>
  );
}

/** Hair: shears. */
export function IconScissors(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="6" cy="18" r="2.6" />
      <circle cx="6" cy="6" r="2.6" />
      <path d="M8 7.8 20 18M20 6 8 16.2M11.4 12.8 8 16.2" />
    </Svg>
  );
}

/** Colour: an artist's palette. */
export function IconPalette(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 21a9 9 0 1 1 9-9c0 1.9-1.6 2.6-3 2.6h-1.6a2 2 0 0 0-1.4 3.4 1.9 1.9 0 0 1-1.4 3.2Z" />
      <path d="M7.6 12.2h.01M9.9 8.3h.01M14.4 8.1h.01M17 11.4h.01" />
    </Svg>
  );
}

/** Frames: eyewear. */
export function IconGlasses(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="6" cy="14" r="3.4" />
      <circle cx="18" cy="14" r="3.4" />
      <path d="M9.4 14a2.9 2.9 0 0 1 5.2 0" />
      <path d="M2.6 12.4 4.4 8.4A2 2 0 0 1 6.2 7.2h1" />
      <path d="M21.4 12.4 19.6 8.4a2 2 0 0 0-1.8-1.2h-1" />
    </Svg>
  );
}

/** Live try-on: a camera with a record dot. */
export function IconLiveCamera(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M3 8.6a2 2 0 0 1 2-2h1.9l1.2-1.9a1.4 1.4 0 0 1 1.2-.7h5.4a1.4 1.4 0 0 1 1.2.7l1.2 1.9H19a2 2 0 0 1 2 2v8.8a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2Z" />
      <circle cx="12" cy="13" r="3.4" />
    </Svg>
  );
}

/** Photo mode: a still image, distinct from the live camera above. */
export function IconPhoto(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="3" y="4.5" width="18" height="15" rx="2.4" />
      <circle cx="8.6" cy="10" r="1.8" />
      <path d="m3.4 17 4.8-4.6a2 2 0 0 1 2.7 0L15 16.6" />
      <path d="m13.6 15.2 2.3-2.2a2 2 0 0 1 2.7 0l2 1.9" />
    </Svg>
  );
}

/* ── State icons ────────────────────────────────────────────────────────── */

export function IconLock(p: IconProps) {
  return (
    <Svg {...p}>
      <rect x="4.2" y="10.4" width="15.6" height="10.4" rx="2.4" />
      <path d="M8 10.4V7.6a4 4 0 0 1 8 0v2.8" />
      <path d="M12 14.6v2.2" />
    </Svg>
  );
}

export function IconCheck(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 12.5 9.5 17.5 19.5 7" />
    </Svg>
  );
}

export function IconClose(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M6 6l12 12M18 6 6 18" />
    </Svg>
  );
}

export function IconSparkle(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3.2 13.9 9 20 10.9 13.9 12.8 12 18.6 10.1 12.8 4 10.9 10.1 9Z" />
      <path d="M18.4 17.2 19.2 19.4 21.4 20.2 19.2 21 18.4 23.2 17.6 21 15.4 20.2 17.6 19.4Z" />
    </Svg>
  );
}

export function IconSun(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="4.2" />
      <path d="M12 2v2.4M12 19.6V22M2 12h2.4M19.6 12H22M4.9 4.9l1.7 1.7M17.4 17.4l1.7 1.7M19.1 4.9l-1.7 1.7M6.6 17.4l-1.7 1.7" />
    </Svg>
  );
}

export function IconMoon(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20.5 14.3A8.5 8.5 0 1 1 9.7 3.5a6.8 6.8 0 0 0 10.8 10.8Z" />
    </Svg>
  );
}

export function IconArrowRight(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M4.5 12h15M13.5 6l6 6-6 6" />
    </Svg>
  );
}

export function IconRefresh(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M20.4 12a8.4 8.4 0 1 1-2.5-6" />
      <path d="M20.6 4.2v5.2h-5.2" />
    </Svg>
  );
}

/* ── Routine icons — the four blocks of a personalised plan ─────────────── */

export function IconMorning(p: IconProps) { return <IconSun {...p} />; }
export function IconEvening(p: IconProps) { return <IconMoon {...p} />; }
export function IconWeekly(p: IconProps) { return <IconSparkle {...p} />; }

/** Hair & scalp routine: a strand-and-follicle mark, not the shears above,
 *  so the routine block does not read as the same thing as the style grid. */
export function IconStrands(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M7 21c-1.4-4.6-1-9.4 1.4-13.2A7.4 7.4 0 0 1 12 4.4" />
      <path d="M12 21c-1-4.8-.3-9.6 2-13.4" />
      <path d="M17 21c-.6-4.7 0-9.3 1.8-13" />
    </Svg>
  );
}

/** Trust badge: a shield, for privacy/security claims. */
export function IconShield(p: IconProps) {
  return (
    <Svg {...p}>
      <path d="M12 3l7 3v5.5c0 4.6-3 8.4-7 9.5-4-1.1-7-4.9-7-9.5V6l7-3z" />
      <path d="M9 12l2 2 4-4" />
    </Svg>
  );
}

/** Trust badge: a clock, for time-to-complete claims. */
export function IconClock(p: IconProps) {
  return (
    <Svg {...p}>
      <circle cx="12" cy="12" r="8.5" />
      <path d="M12 7.5V12l3 2" />
    </Svg>
  );
}
