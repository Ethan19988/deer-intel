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
};
