import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerProfile } from "@/types/deerProfile";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";
import type { Property } from "@/types/property";
import type { Stand } from "@/types/stand";

export type DeerIntelState = {
  version: 1;
  properties: Property[];
  selectedPropertyId: string;
  cameras: Camera[];
  cameraChecks: CameraCheck[];
  stands: Stand[];
  pins: MapPin[];
  hunts: HuntLogEntry[];
  photoRecords: PhotoRecord[];
  deerProfiles: DeerProfile[];
};
