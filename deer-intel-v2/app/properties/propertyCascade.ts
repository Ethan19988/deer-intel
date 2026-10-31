import type { DeerIntelState } from "@/types/deerIntelStore";

// What deleting a property takes with it. Pure, so the confirm dialog's counts
// and the delete itself come from one place (and it can be unit-tested).

export type PropertyCascadeCounts = {
  cameras: number;
  cameraChecks: number;
  stands: number;
  pins: number;
  hunts: number;
  photoRecords: number;
  deerProfiles: number;
  walkTracks: number;
  documents: number;
};

export type PropertyCascade = {
  counts: PropertyCascadeCounts;
  /** Stored photo blobs (lib/imageStore) to delete after the records go. */
  imageIds: string[];
  /** Stored document blobs (lib/fileStore) to delete after the records go. */
  fileIds: string[];
};

export function describePropertyCascade(
  state: DeerIntelState,
  propertyId: string,
): PropertyCascade {
  const owned = <T extends { propertyId: string }>(items: T[]) =>
    items.filter((item) => item.propertyId === propertyId);
  const photos = owned(state.photoRecords);
  const documents = owned(state.documents);

  return {
    counts: {
      cameras: owned(state.cameras).length,
      cameraChecks: owned(state.cameraChecks).length,
      stands: owned(state.stands).length,
      pins: owned(state.pins).length,
      hunts: owned(state.hunts).length,
      photoRecords: photos.length,
      deerProfiles: owned(state.deerProfiles).length,
      walkTracks: owned(state.walkTracks).length,
      documents: documents.length,
    },
    imageIds: photos
      .map((photo) => photo.imageId ?? "")
      .filter((imageId) => imageId !== ""),
    fileIds: documents
      .map((document) => document.fileId)
      .filter((fileId) => fileId !== ""),
  };
}

/** The state with the property and everything filed under it removed. */
export function removePropertyFromState(
  state: DeerIntelState,
  propertyId: string,
): DeerIntelState {
  const keep = <T extends { propertyId: string }>(items: T[]) =>
    items.filter((item) => item.propertyId !== propertyId);
  const properties = state.properties.filter(
    (property) => property.id !== propertyId,
  );
  const selectedPropertyExists = properties.some(
    (property) => property.id === state.selectedPropertyId,
  );

  return {
    ...state,
    properties,
    selectedPropertyId: selectedPropertyExists
      ? state.selectedPropertyId
      : (properties[0]?.id ?? ""),
    cameras: keep(state.cameras),
    cameraChecks: keep(state.cameraChecks),
    stands: keep(state.stands),
    pins: keep(state.pins),
    hunts: keep(state.hunts),
    photoRecords: keep(state.photoRecords),
    deerProfiles: keep(state.deerProfiles),
    walkTracks: keep(state.walkTracks),
    documents: keep(state.documents),
  };
}

/** "3 stands, 12 photos and 1 walk track", or "" when nothing else goes. */
export function cascadeSummary(counts: PropertyCascadeCounts): string {
  const parts: Array<[number, string, string]> = [
    [counts.stands, "stand", "stands"],
    [counts.cameras, "camera", "cameras"],
    [counts.cameraChecks, "camera check", "camera checks"],
    [counts.photoRecords, "photo", "photos"],
    [counts.hunts, "logged sit", "logged sits"],
    [counts.deerProfiles, "deer profile", "deer profiles"],
    [counts.pins, "map pin", "map pins"],
    [counts.walkTracks, "walk track", "walk tracks"],
    [counts.documents, "document", "documents"],
  ];
  const labels = parts
    .filter(([count]) => count > 0)
    .map(([count, one, many]) => `${count} ${count === 1 ? one : many}`);

  if (labels.length <= 1) return labels.join("");
  return `${labels.slice(0, -1).join(", ")} and ${labels[labels.length - 1]}`;
}
