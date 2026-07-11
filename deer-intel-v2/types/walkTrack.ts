// A recorded walk: the GPS breadcrumb trail the hunter leaves while moving on
// foot. Recording starts when they tap "Start tracking" and each position from
// the device is appended as a point until they tap "Stop tracking", at which
// point the finished trail is saved to the property.

export type WalkTrackPoint = {
  lat: number;
  lng: number;
  // ISO timestamp of when this position was recorded.
  at: string;
};

export type WalkTrack = {
  id: string;
  propertyId: string;
  name: string;
  points: WalkTrackPoint[];
  startedAt: string;
  endedAt: string;
};
