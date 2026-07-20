export type CameraType = "Standard" | "Cellular";

export type CameraStatus = "Active" | "Inactive";

export type Camera = {
  id: string;
  propertyId: string;
  name: string;
  cameraType: CameraType;
  manufacturer: string;
  model: string;
  status: CameraStatus;
  latitude?: number;
  longitude?: number;
  // Compass point the lens looks toward (e.g. "NW"). Lets the AI's "walking
  // left to right" photo reads become real compass headings.
  facingDirection?: string;
  locationNotes: string;
  notes: string;
};
