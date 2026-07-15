// Deer movement score — a single 1–5 gut-check for "are deer likely on their
// feet today?" built only from signals Deer Intel already fetches for a
// property (barometric trend, wind, moon phase). It is a practical, rule-based
// first step toward the AI movement predictions on the long-term roadmap: no
// new data sources, no API keys, and every rating comes with a plain-English
// reason so a hunter can trust or overrule it.

import type { PressureTrend } from "@/lib/liveWeather";

export type MovementTone = "good" | "fair" | "slow";

export type MovementInputs = {
  pressureTrend?: PressureTrend;
  /** Current wind speed in mph, or null when unknown. */
  windSpeedMph: number | null;
  /** Share of the moon lit, 0–100, or null when unknown. */
  moonIllumination: number | null;
};

export type MovementScore = {
  /** Whole-number rating from 1 (tough) to 5 (prime). */
  score: number;
  label: string;
  reason: string;
  tone: MovementTone;
};

// Wind bands in mph. Deer use a steady wind to scent danger and move
// confidently; dead-calm air makes them edgy and a gale pins them down.
const WIND_CALM_MPH = 3;
const WIND_IDEAL_MAX_MPH = 15;
const WIND_STRONG_MPH = 25;

// Moon illumination thresholds. A dark moon concentrates movement into the
// dawn/dusk windows a hunter can plan around; a bright moon lets deer feed
// overnight and spreads daytime movement thin.
const MOON_DARK_MAX = 35;
const MOON_BRIGHT_MIN = 65;

export function getMovementScore(inputs: MovementInputs): MovementScore {
  let points = 3;
  const drivers: string[] = [];
  const warnings: string[] = [];

  if (inputs.pressureTrend === "falling") {
    points += 1.5;
    drivers.push("a falling barometer");
  } else if (inputs.pressureTrend === "rising") {
    points += 0.5;
    drivers.push("clearing pressure behind a front");
  }

  if (inputs.windSpeedMph !== null) {
    if (inputs.windSpeedMph < WIND_CALM_MPH) {
      points -= 1;
      warnings.push("dead-calm air");
    } else if (inputs.windSpeedMph <= WIND_IDEAL_MAX_MPH) {
      points += 1;
      drivers.push("a steady, huntable wind");
    } else if (inputs.windSpeedMph > WIND_STRONG_MPH) {
      points -= 1.5;
      warnings.push("strong wind");
    }
  }

  if (inputs.moonIllumination !== null) {
    if (inputs.moonIllumination <= MOON_DARK_MAX) {
      points += 0.25;
      drivers.push("a dark moon tightening dawn and dusk");
    } else if (inputs.moonIllumination >= MOON_BRIGHT_MIN) {
      points -= 0.25;
      warnings.push("a bright moon");
    }
  }

  const score = Math.max(1, Math.min(5, Math.round(points)));

  return {
    score,
    label: labelForScore(score),
    tone: toneForScore(score),
    reason: buildReason(drivers, warnings),
  };
}

function labelForScore(score: number): string {
  switch (score) {
    case 5:
      return "Prime — deer on their feet";
    case 4:
      return "Good movement likely";
    case 3:
      return "Fair — worth a sit";
    case 2:
      return "Slow going";
    default:
      return "Tough sit";
  }
}

function toneForScore(score: number): MovementTone {
  if (score >= 4) return "good";
  if (score === 3) return "fair";
  return "slow";
}

function buildReason(drivers: string[], warnings: string[]): string {
  if (drivers.length > 0) {
    const lead = `${capitalize(joinAnd(drivers))} ${
      drivers.length > 1 ? "are" : "is"
    } working in your favor`;

    if (warnings.length > 0) {
      return `${lead}, though ${joinAnd(warnings)} could hold deer back.`;
    }

    return `${lead}.`;
  }

  if (warnings.length > 0) {
    return `${capitalize(joinAnd(warnings))} ${
      warnings.length > 1 ? "are" : "is"
    } likely to keep deer bedded.`;
  }

  return "Conditions are average — expect deer on their normal dawn and dusk schedule.";
}

function joinAnd(parts: string[]): string {
  if (parts.length <= 1) return parts[0] ?? "";
  if (parts.length === 2) return `${parts[0]} and ${parts[1]}`;

  return `${parts.slice(0, -1).join(", ")}, and ${parts[parts.length - 1]}`;
}

function capitalize(value: string): string {
  return value.charAt(0).toUpperCase() + value.slice(1);
}
