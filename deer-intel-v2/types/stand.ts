export type StandType =
  | "Ladder"
  | "Hang-on"
  | "Saddle"
  | "Blind"
  | "Ground"
  | "Other";

export const STAND_TYPES: StandType[] = [
  "Ladder",
  "Hang-on",
  "Saddle",
  "Blind",
  "Ground",
  "Other",
];

/** When the stand hunts best: mornings, evenings, or any time. */
export type StandBestTime = "am" | "pm" | "all";

export const STAND_BEST_TIMES: StandBestTime[] = ["am", "pm", "all"];

export const STAND_BEST_TIME_LABEL: Record<StandBestTime, string> = {
  am: "Morning",
  pm: "Evening",
  all: "All day",
};

/** The terrain or sign the stand is set up on. */
export const STAND_SETUPS = [
  "Funnel/pinch",
  "Saddle",
  "Bedding edge",
  "Food/field edge",
  "Scrape/rub line",
  "Creek crossing",
  "Bench/ridge",
  "Thick cover",
] as const;

export type StandSetup = (typeof STAND_SETUPS)[number];

export type StandWeapon = "bow" | "gun" | "both";

export const STAND_WEAPONS: StandWeapon[] = ["bow", "gun", "both"];

export const STAND_WEAPON_LABEL: Record<StandWeapon, string> = {
  bow: "Bow",
  gun: "Gun",
  both: "Bow & gun",
};

/** Longest-shot choices in yards; 200 reads "200+". */
export const STAND_SHOT_YARDS = [20, 30, 40, 60, 100, 200] as const;

export function shotYardsLabel(yards: number): string {
  return yards >= 200 ? "200+ yd" : `${yards} yd`;
}

export type Stand = {
  id: string;
  propertyId: string;
  name: string;
  standType: StandType;
  bestWinds: string;
  avoidWinds: string;
  accessRouteNotes: string;
  exitRouteNotes: string;
  notes: string;
  /**
   * Id of the map pin this stand site was promoted from, if any. Lets the hunt
   * log hide an already-converted pin so it can't be saved as a site twice, and
   * lets the store collapse duplicates promoted from the same pin.
   */
  sourcePinId?: string;
  /** Mornings, evenings, or all day. Unset = no preference (never demoted). */
  bestTime?: StandBestTime;
  /** What the stand is set up on (funnel, scrape line, …). */
  setup?: StandSetup[];
  weapon?: StandWeapon;
  /** Longest ethical shot from the stand, in yards (200 = 200+). */
  maxShotYards?: number;
  /** Platform / seat height in feet. */
  heightFeet?: number;
};
