export type CameraImportProviderId =
  | "tactacam"
  | "moultrie"
  | "spypoint"
  | "covert"
  | "bushnell";

export type CameraImportProviderStatus = "planned" | "connected";

export type CameraImportProvider = {
  id: CameraImportProviderId;
  name: string;
  status: CameraImportProviderStatus;
  description: string;
};

export const CAMERA_IMPORT_PROVIDERS: CameraImportProvider[] = [
  {
    id: "tactacam",
    name: "Tactacam",
    status: "planned",
    description: "Future support for Reveal account imports.",
  },
  {
    id: "moultrie",
    name: "Moultrie",
    status: "planned",
    description: "Future support for Moultrie Mobile imports.",
  },
  {
    id: "spypoint",
    name: "SPYPOINT",
    status: "planned",
    description: "Future support for SPYPOINT camera libraries.",
  },
  {
    id: "covert",
    name: "Covert",
    status: "planned",
    description: "Future support for Covert camera libraries.",
  },
  {
    id: "bushnell",
    name: "Bushnell",
    status: "planned",
    description: "Future support for Bushnell cellular cameras.",
  },
];
