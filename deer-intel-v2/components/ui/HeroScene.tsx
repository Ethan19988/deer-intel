import type { CSSProperties } from "react";

// A small golden-hour vignette tucked into the corner of the Today's Brief
// hero: a low sun, rolling ridgelines, and a lone tree-stand silhouette. Purely
// decorative (aria-hidden) and drawn with the brand accent tokens so it reads
// correctly on the light, dark, and night themes. Hidden on very narrow screens
// by the caller so it never crowds the greeting.
export default function HeroScene({ style }: { style?: CSSProperties }) {
  return (
    <svg
      className="di-hero-scene"
      viewBox="0 0 220 150"
      role="presentation"
      aria-hidden="true"
      style={style}
    >
      {/* low sun */}
      <circle cx="158" cy="52" r="26" fill="var(--accent-2)" opacity="0.85" />
      <circle cx="158" cy="52" r="34" fill="var(--accent-2)" opacity="0.16" />

      {/* far ridge */}
      <path
        d="M0 104 Q46 80 96 98 T220 86 V150 H0 Z"
        fill="var(--accent)"
        opacity="0.45"
      />
      {/* near ridge */}
      <path
        d="M0 124 Q60 100 120 118 T220 108 V150 H0 Z"
        fill="var(--accent-strong)"
        opacity="0.6"
      />

      {/* lone tree-stand on the near ridge */}
      <g
        stroke="var(--camo-fg)"
        strokeWidth="2.4"
        fill="none"
        strokeLinecap="round"
        opacity="0.6"
      >
        <path d="M168 126 V96" />
        <path d="M156 110 h24" />
        <path d="M168 96 L159 83 M168 96 L177 83 M168 90 L162 81 M168 90 L174 81" />
      </g>
    </svg>
  );
}
