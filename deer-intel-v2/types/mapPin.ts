export const PIN_TYPES = [
  "Camera Site",
  "Stand",
  "Bedding",
  "Food",
  "Water",
  "Scrape",
  "Rub",
  "Trail",
  "Parking",
  "Gate",
  "Trail Camera",
  "Treestand",
  "Bedding Area",
  "Food Source",
  "Water Source",
  "Rub Line",
  "Access Route",
  "Buck Sighting",
  "Doe Sighting",
  "Vegetation",
] as const;

export type PinType = (typeof PIN_TYPES)[number];

export const PROPERTY_ASSET_PIN_TYPES = [
  "Camera Site",
  "Stand",
  "Bedding",
  "Food",
  "Water",
  "Scrape",
  "Rub",
  "Trail",
  "Parking",
  "Gate",
] as const satisfies readonly PinType[];

export type MapPin = {
  id: string;
  propertyId: string;
  type: PinType;
  lat: number;
  lng: number;
  createdAt: string;
  /** Display name shown as the pin's title; falls back to notes, then type. */
  name: string;
  notes: string;
  /** Compass point a camera pin's lens looks toward (e.g. "NW"); "" unset. */
  facingDirection?: string;
};
