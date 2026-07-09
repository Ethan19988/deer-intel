export type HuntAreaPoint = {
  lat: number;
  lng: number;
};

export type Property = {
  id: string;
  name: string;
  county: string;
  acres: string;
  notes: string;
  latitude?: number;
  longitude?: number;
  // Outline of the ground this property covers, drawn on the map and shown as a
  // highlighted region. Needs at least three points to form an area.
  huntArea?: HuntAreaPoint[];
};
