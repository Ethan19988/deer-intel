export const PIN_TYPES = [
  "Trail Camera",
  "Treestand",
  "Bedding Area",
  "Food Source",
  "Water Source",
  "Scrape",
  "Rub",
  "Rub Line",
  "Trail",
  "Access Route",
  "Parking",
  "Gate",
  "Buck Sighting",
  "Doe Sighting",
  "Vegetation",
] as const;

export type PinType = (typeof PIN_TYPES)[number];

export type MapPin = {
  id: string;
  propertyId: string;
  type: PinType;
  lat: number;
  lng: number;
  createdAt: string;
  notes: string;
};
