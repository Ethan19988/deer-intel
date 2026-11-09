import {
  STAND_BEST_TIME_LABEL,
  STAND_BEST_TIMES,
  STAND_SETUPS,
  STAND_WEAPON_LABEL,
  STAND_WEAPONS,
  shotYardsLabel,
  type Stand,
  type StandBestTime,
  type StandSetup,
  type StandWeapon,
} from "@/types/stand";

// The optional "more details" on a stand (best time, setup, weapon, longest
// shot, height): reading them safely from stored/imported data, and the short
// labels the stand card and AI Scout show. Every field is optional and stays
// absent when unset, so older records keep their exact shape.

export type StandDetails = Pick<
  Stand,
  "bestTime" | "setup" | "weapon" | "maxShotYards" | "heightFeet"
>;

/** Sane bounds: a stand platform is 1–60 ft; a shot is 5–1000 yd. */
export const MIN_HEIGHT_FEET = 1;
export const MAX_HEIGHT_FEET = 60;
const MIN_SHOT_YARDS = 5;
const MAX_SHOT_YARDS = 1000;

function finiteNumber(value: unknown): number | undefined {
  const number =
    typeof value === "number"
      ? value
      : typeof value === "string" && value.trim()
        ? Number(value.trim())
        : NaN;
  return Number.isFinite(number) ? number : undefined;
}

export function isValidHeightFeet(value: number): boolean {
  return Number.isFinite(value) && value >= MIN_HEIGHT_FEET && value <= MAX_HEIGHT_FEET;
}

/**
 * The valid optional details found on a stored record. Unknown or out-of-range
 * values are dropped (treated as unset) rather than guessed at.
 */
export function readStandDetails(record: Record<string, unknown>): StandDetails {
  const details: StandDetails = {};

  if (STAND_BEST_TIMES.includes(record.bestTime as StandBestTime)) {
    details.bestTime = record.bestTime as StandBestTime;
  }

  if (Array.isArray(record.setup)) {
    const setup = STAND_SETUPS.filter((option) =>
      (record.setup as unknown[]).includes(option),
    );
    if (setup.length > 0) details.setup = [...setup] as StandSetup[];
  }

  if (STAND_WEAPONS.includes(record.weapon as StandWeapon)) {
    details.weapon = record.weapon as StandWeapon;
  }

  const shot = finiteNumber(record.maxShotYards);
  if (shot !== undefined && shot >= MIN_SHOT_YARDS && shot <= MAX_SHOT_YARDS) {
    details.maxShotYards = Math.round(shot);
  }

  const height = finiteNumber(record.heightFeet);
  if (height !== undefined && isValidHeightFeet(height)) {
    details.heightFeet = Math.round(height);
  }

  return details;
}

/** True when any optional detail is set. */
export function hasStandDetails(stand: StandDetails): boolean {
  return Boolean(
    stand.bestTime ||
      stand.setup?.length ||
      stand.weapon ||
      stand.maxShotYards ||
      stand.heightFeet,
  );
}

/** Short labeled pieces for the stand card, e.g. ["Morning", "Bow", "30 yd max"]. */
export function standDetailLabels(stand: StandDetails): { label: string; value: string }[] {
  const parts: { label: string; value: string }[] = [];
  if (stand.bestTime) parts.push({ label: "Best time", value: STAND_BEST_TIME_LABEL[stand.bestTime] });
  if (stand.weapon) parts.push({ label: "Weapon", value: STAND_WEAPON_LABEL[stand.weapon] });
  if (stand.maxShotYards) parts.push({ label: "Longest shot", value: shotYardsLabel(stand.maxShotYards) });
  if (stand.heightFeet) parts.push({ label: "Height", value: `${stand.heightFeet} ft` });
  if (stand.setup?.length) parts.push({ label: "Setup", value: stand.setup.join(", ") });
  return parts;
}
