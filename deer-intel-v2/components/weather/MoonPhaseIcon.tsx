import type { MoonPhaseName } from "@/lib/moonPhase";

type MoonPhaseIconProps = {
  /** Share of the disc lit, 0–100. */
  illumination: number;
  /** True when the lit limb is on the right (moon filling toward full). */
  waxing: boolean;
  /** Named phase, used for the accessible label. */
  phase: MoonPhaseName;
  /** Rendered width/height in pixels. */
  size?: number;
};

// The moon is drawn as a light full disc with the un-illuminated portion laid
// over the top as a dark shape sized to the real terminator: a semicircle on
// the shadowed limb joined to a half-ellipse whose horizontal radius shrinks to
// zero at the quarters (straight terminator) and grows to a full circle at the
// new moon. For a waning moon the whole shadow is mirrored so the dark limb sits
// on the right.
const R = 46;
const CENTER = 50;

// Fixed moonlight/shadow colors — the moon reads the same in every app theme,
// so it doesn't recolor with the design tokens. A themed ring keeps the disc
// edge visible on both light and dark surfaces.
const LIT_COLOR = "#f5f0e1";
const SHADOW_COLOR = "#39414f";

export default function MoonPhaseIcon({
  illumination,
  waxing,
  phase,
  size = 44,
}: MoonPhaseIconProps) {
  const lit = Math.max(0, Math.min(100, illumination)) / 100;
  const terminatorRadius = Math.abs(1 - 2 * lit) * R;
  const shadowIsMajority = lit < 0.5;
  const terminatorSweep = shadowIsMajority ? 1 : 0;

  // Shadow drawn on the left limb; mirrored to the right for a waning moon.
  const shadowPath = [
    `M ${CENTER} ${CENTER - R}`,
    `A ${R} ${R} 0 0 0 ${CENTER} ${CENTER + R}`,
    `A ${terminatorRadius} ${R} 0 0 ${terminatorSweep} ${CENTER} ${CENTER - R}`,
    "Z",
  ].join(" ");

  return (
    <svg
      width={size}
      height={size}
      viewBox="0 0 100 100"
      role="img"
      aria-label={`${phase} moon, ${Math.round(illumination)}% illuminated`}
    >
      <circle cx={CENTER} cy={CENTER} r={R} fill={LIT_COLOR} />
      <path
        d={shadowPath}
        fill={SHADOW_COLOR}
        transform={waxing ? undefined : `translate(${2 * CENTER} 0) scale(-1 1)`}
      />
      <circle
        cx={CENTER}
        cy={CENTER}
        r={R}
        fill="none"
        stroke="var(--border-strong)"
        strokeWidth={1.5}
      />
    </svg>
  );
}
