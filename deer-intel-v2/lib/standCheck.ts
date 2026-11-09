import { getAccessScentCheck, type AccessScentCheck } from "@/lib/accessScent";
import {
  getStandPressure,
  pickRestedStand,
  type StandPressure,
} from "@/lib/standPressure";
import { getStandWindCheck, type StandWindCheck } from "@/lib/standWind";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import { STAND_BEST_TIME_LABEL, type Stand } from "@/types/stand";

// One stand-by-stand read shared by the Today verdict and the Stand check
// panel, so the headline pick and the list underneath can never disagree.

export type StandCheckRow = {
  stand: Stand;
  wind: StandWindCheck;
  pressure: StandPressure;
  scent: AccessScentCheck;
  /**
   * Set only when the sit's period is known and the stand's best time is the
   * other half of the day: the stand isn't picked and sinks in the list.
   */
  timing?: StandTimingMismatch;
};

/** Which sit the check is for; "tomorrow" is tomorrow morning. */
export type StandCheckPeriod = "morning" | "evening" | "tomorrow";

export type StandTimingMismatch = { reason: string };

/**
 * A morning-only stand on an evening sit (or the reverse). Null when the
 * stand's best time is unset or "all day", or the period isn't known.
 */
export function standTimingMismatch(
  stand: Pick<Stand, "bestTime">,
  period: StandCheckPeriod | undefined,
): StandTimingMismatch | null {
  if (!period || !stand.bestTime || stand.bestTime === "all") return null;
  const sit = period === "evening" ? "pm" : "am";
  if (stand.bestTime === sit) return null;
  const sitLabel = sit === "pm" ? "Evening" : "Morning";
  const standLabel = STAND_BEST_TIME_LABEL[stand.bestTime].toLowerCase();
  return { reason: `${sitLabel} sit — this is a ${standLabel} stand` };
}

export type StandCheckResult = {
  rows: StandCheckRow[];
  /** Most-rested stand with a good wind and no walk-in scent risk. */
  pick: StandCheckRow | null;
};

export function buildStandChecks(input: {
  stands: Stand[];
  hunts: HuntLogEntry[];
  pins: MapPin[];
  wind: string | undefined;
  today: string;
  /**
   * The sit being planned. Optional: without it stands' best times are
   * ignored and the result is exactly what it was before best times existed.
   */
  period?: StandCheckPeriod;
}): StandCheckResult {
  const { stands, hunts, pins, wind, today, period } = input;

  const rows: StandCheckRow[] = stands.map((stand) => {
    const timing = standTimingMismatch(stand, period);
    return {
      stand,
      wind: getStandWindCheck(stand, wind),
      pressure: getStandPressure(stand, hunts, today),
      scent: getAccessScentCheck(stand, pins, wind),
      ...(timing ? { timing } : {}),
    };
  });

  const pressureById = new Map(rows.map((row) => [row.stand.id, row.pressure]));
  // A walk in that blows scent into bedding isn't a real pick, even on a good
  // wind at the tree; nor is a morning stand for an evening sit (or reverse).
  const pickable = rows
    .filter(
      (row) =>
        row.wind.status === "good" && row.scent.status !== "risk" && !row.timing,
    )
    .map((row) => row.stand);
  const pickedStand = pickRestedStand(pickable, pressureById);
  const pick = pickedStand
    ? (rows.find((row) => row.stand.id === pickedStand.id) ?? null)
    : null;

  // Best sit first; wrong wind, burned, scent-risk and wrong-time stands sink.
  const rank = (row: StandCheckRow) =>
    (row.stand.id === pick?.stand.id ? 0 : 10) +
    (row.wind.status === "good" ? 0 : row.wind.status === "avoid" ? 4 : 2) +
    (row.pressure.level === "burned" ? 3 : 0) +
    (row.scent.status === "risk" ? 2 : 0) +
    (row.timing ? 3 : 0);

  return { rows: [...rows].sort((a, b) => rank(a) - rank(b)), pick };
}
