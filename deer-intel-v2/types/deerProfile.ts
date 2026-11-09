/** Where a tracked buck stands: still on the hit list, or off it for good. */
export type DeerProfileStatus = "active" | "harvested" | "retired";

export type DeerProfile = {
  id: string;
  propertyId: string;
  nickname: string;
  estimatedAge: string;
  firstSeen: string;
  lastSeen: string;
  notes: string;
  // Unset (older profiles) reads as "active". A harvested or retired buck
  // moves to the bottom of the hit list and drops out of active counts.
  status?: DeerProfileStatus;
  // "YYYY-MM-DD" the buck was harvested / retired; unset while active.
  statusDate?: string;
};
