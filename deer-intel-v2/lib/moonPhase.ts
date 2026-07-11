// Moon phase math and whitetail-movement guidance, kept framework-neutral (no
// "use client") so it can run in the browser (dashboard, forms) and on the
// server (AI Scout route) from the same source of truth.
//
// One synodic month and a known new-moon reference (2000-01-06 18:14 UTC) are
// enough to name the current phase and its illumination without a network call
// or a library.
const SYNODIC_MONTH_DAYS = 29.530588853;
const REFERENCE_NEW_MOON_MS = Date.UTC(2000, 0, 6, 18, 14, 0);

export type MoonPhaseName =
  | "New"
  | "Waxing crescent"
  | "First quarter"
  | "Waxing gibbous"
  | "Full"
  | "Waning gibbous"
  | "Last quarter"
  | "Waning crescent";

export type MoonPhaseInfo = {
  phase: MoonPhaseName;
  /** Share of the disc lit, 0–100, rounded. */
  illumination: number;
  /** Peak deer-movement guidance a hunter can act on for this phase. */
  movement: string;
};

// How each phase tends to shape whitetail movement timing. Deliberately
// practical ("when to be in the stand") rather than astronomical.
const MOON_MOVEMENT: Record<MoonPhaseName, string> = {
  New: "Dark nights keep deer moving hard at dawn and dusk — prime first- and last-light sits.",
  "Waxing crescent":
    "Building light — reliable dawn and dusk movement; stay tight to the food-source edges.",
  "First quarter":
    "Half-lit evenings pull good afternoon-into-dusk movement; mornings stay steady.",
  "Waxing gibbous":
    "Bright evenings let deer feed after dark — hunt mornings and expect a little midday movement.",
  Full: "Deer feed under the bright moon overnight and often move midday — an all-day or midday sit can beat dawn and dusk.",
  "Waning gibbous":
    "Late-rising bright moon — mornings shine as deer head back to bed, with midday activity too.",
  "Last quarter":
    "Moon overhead near midday drives solid midday and early-morning movement.",
  "Waning crescent":
    "Dark mornings mean strong dawn movement — a classic first-light sit.",
};

/** Age of the moon in days (0 = new, ~14.8 = full) for a given moment. */
function moonAgeDays(timestampMs: number): number {
  const daysSinceReference = (timestampMs - REFERENCE_NEW_MOON_MS) / 86_400_000;

  return (
    ((daysSinceReference % SYNODIC_MONTH_DAYS) + SYNODIC_MONTH_DAYS) %
    SYNODIC_MONTH_DAYS
  );
}

function phaseForAge(age: number): MoonPhaseName {
  if (age < 1.85 || age >= 27.68) return "New";
  if (age < 5.54) return "Waxing crescent";
  if (age < 9.23) return "First quarter";
  if (age < 12.91) return "Waxing gibbous";
  if (age < 16.61) return "Full";
  if (age < 20.3) return "Waning gibbous";
  if (age < 23.99) return "Last quarter";

  return "Waning crescent";
}

/** The named moon phase at a given moment (e.g. "Waning gibbous"). */
export function describeMoonPhase(timestampMs: number): MoonPhaseName {
  return phaseForAge(moonAgeDays(timestampMs));
}

/** Deer-movement guidance for a named phase, for prompts and UI hints. */
export function getMoonMovementInsight(phase: MoonPhaseName): string {
  return MOON_MOVEMENT[phase];
}

/** Phase, illumination, and movement guidance for a given moment. */
export function getMoonPhaseInfo(timestampMs: number): MoonPhaseInfo {
  const age = moonAgeDays(timestampMs);
  const phase = phaseForAge(age);
  const illumination = Math.round(
    ((1 - Math.cos((2 * Math.PI * age) / SYNODIC_MONTH_DAYS)) / 2) * 100,
  );

  return { phase, illumination, movement: MOON_MOVEMENT[phase] };
}
