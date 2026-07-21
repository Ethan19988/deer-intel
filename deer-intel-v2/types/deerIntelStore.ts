import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerProfile } from "@/types/deerProfile";
import type { DocumentRecord } from "@/types/document";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";
import type { Property } from "@/types/property";
import type { Stand } from "@/types/stand";
import type { WalkTrack } from "@/types/walkTrack";

export type DeerIntelState = {
  version: 2;
  properties: Property[];
  selectedPropertyId: string;
  cameras: Camera[];
  cameraChecks: CameraCheck[];
  stands: Stand[];
  pins: MapPin[];
  hunts: HuntLogEntry[];
  photoRecords: PhotoRecord[];
  deerProfiles: DeerProfile[];
  walkTracks: WalkTrack[];
  documents: DocumentRecord[];
};
