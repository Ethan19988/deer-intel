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
   * log hide an already-converted pin so it can't be saved as a site twice.
   */
  sourcePinId?: string;
};
