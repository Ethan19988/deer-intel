// The newest trail-camera photos as strip/grid cards (Today, the property page
// and the Cameras page all show them the same way).
import { isBuckRecord } from "@/lib/hourlyActivity";
import { getPhotoBuckNames, photoRecordTime } from "@/lib/photos";
import type { StripPhoto } from "@/components/CameraPhotoStrip";
import type { Camera } from "@/types/camera";
import type { PhotoRecord } from "@/types/photo";

export function photoDateLabel(photo: PhotoRecord): string {
  const time = photoRecordTime(photo);
  return time
    ? new Date(time).toLocaleDateString(undefined, { month: "short", day: "numeric" })
    : "";
}

/** Photos that have an image, newest first. */
export function recentPhotosWithImages(photoRecords: PhotoRecord[]): PhotoRecord[] {
  return photoRecords
    .filter((photo) => Boolean(photo.imageId))
    .sort((a, b) => photoRecordTime(b) - photoRecordTime(a));
}

export function buildStripPhotos(
  photoRecords: PhotoRecord[],
  cameras: Camera[],
  limit = 8,
): StripPhoto[] {
  const cameraName = (cameraId: string) =>
    cameras.find((camera) => camera.id === cameraId)?.name ?? "Camera";
  return recentPhotosWithImages(photoRecords)
    .slice(0, limit)
    .map((photo) => ({
      id: photo.id,
      imageId: photo.imageId!,
      title: getPhotoBuckNames(photo)[0] ?? (photo.species || "Deer"),
      subtitle: [cameraName(photo.cameraSiteId), photoDateLabel(photo)]
        .filter(Boolean)
        .join(", "),
      dateLabel: photoDateLabel(photo),
      href: `/properties/${photo.propertyId}/assets/${photo.cameraSiteId}#photos`,
      isBuck: isBuckRecord(photo),
    }));
}
