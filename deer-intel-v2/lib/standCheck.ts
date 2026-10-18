import { getAccessScentCheck, type AccessScentCheck } from "@/lib/accessScent";
import {
  getStandPressure,
  pickRestedStand,
  type StandPressure,
} from "@/lib/standPressure";
import { getStandWindCheck, type StandWindCheck } from "@/lib/standWind";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { Stand } from "@/types/stand";

// One stand-by-stand read shared by the Today verdict and the Stand check
// panel, so the headline pick and the list underneath can never disagree.

export type StandCheckRow = {
  stand: Stand;
  wind: StandWindCheck;
  pressure: StandPressure;
  scent: AccessScentCheck;
};

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
}): StandCheckResult {
  const { stands, hunts, pins, wind, today } = input;

  const rows: StandCheckRow[] = stands.map((stand) => ({
    stand,
    wind: getStandWindCheck(stand, wind),
    pressure: getStandPressure(stand, hunts, today),
    scent: getAccessScentCheck(stand, pins, wind),
  }));

  const pressureById = new Map(rows.map((row) => [row.stand.id, row.pressure]));
  // A walk in that blows scent into bedding isn't a real pick, even on a good
  // wind at the tree.
  const pickable = rows
    .filter((row) => row.wind.status === "good" && row.scent.status !== "risk")
    .map((row) => row.stand);
  const pickedStand = pickRestedStand(pickable, pressureById);
  const pick = pickedStand
    ? (rows.find((row) => row.stand.id === pickedStand.id) ?? null)
    : null;

  // Best sit first; wrong wind, burned, and scent-risk stands sink.
  const rank = (row: StandCheckRow) =>
    (row.stand.id === pick?.stand.id ? 0 : 10) +
    (row.wind.status === "good" ? 0 : row.wind.status === "avoid" ? 4 : 2) +
    (row.pressure.level === "burned" ? 3 : 0) +
    (row.scent.status === "risk" ? 2 : 0);

  return { rows: [...rows].sort((a, b) => rank(a) - rank(b)), pick };
}
