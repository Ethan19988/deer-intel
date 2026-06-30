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
  locationNotes: string;
  batteryPercent: string;
  sdCardPercent: string;
  signalStrength?: string;
  carrier?: string;
  lastChecked: string;
  lastTransmission?: string;
  notes: string;
};
