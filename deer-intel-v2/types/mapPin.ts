export const PIN_TYPES = [
  "Trail Camera",
  "Treestand",
  "Scrape",
  "Rub",
  "Buck Sighting",
  "Doe Sighting",
  "Vegetation",
  "Bedding Area",
  "Food Source",
  "Water Source",
  "Parking",
  "Access Route",
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
