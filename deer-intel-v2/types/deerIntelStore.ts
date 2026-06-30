import type { Camera } from "@/types/camera";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { Property } from "@/types/property";

export type DeerIntelState = {
  version: 1;
  properties: Property[];
  selectedPropertyId: string;
  cameras: Camera[];
  pins: MapPin[];
  hunts: HuntLogEntry[];
};
