import { getDeerProfileIntelligence } from "@/lib/deerProfileIntelligence";
import { isActiveDeerProfile } from "@/lib/deerProfiles";
import {
  describeDeerTimeWindow,
  getDeerProfileTimeline,
  MIN_TIMED_FOR_PATTERN,
} from "@/lib/deerProfileTimeline";
import { getPhotoBuckNames, getPhotoDeerProfileIds, photoRecordTime } from "@/lib/photos";
import type { Camera } from "@/types/camera";
import type { CameraCheck } from "@/types/cameraCheck";
import type { DeerProfile } from "@/types/deerProfile";
import type { HuntLogEntry } from "@/types/hunt";
import type { MapPin } from "@/types/mapPin";
import type { PhotoRecord } from "@/types/photo";

// One slide per buck on the hit list for the Today slideshow: the buck's
// newest photo plus the facts that matter when deciding to hunt him.

export type HitListSlide = {
  key: string;
  name: string;
  imageId: string | null;
  age: string;
  lastSeen: string | null;
  usualTime: string | null;
  sightings: number;
  href: string;
};

function newest(photos: PhotoRecord[]): PhotoRecord | undefined {
  return photos
    .filter((photo) => Boolean(photo.imageId))
    .sort((a, b) => photoRecordTime(b) - photoRecordTime(a))[0];
}

function shortDate(photo: PhotoRecord | undefined): string | null {
  const time = photo ? photoRecordTime(photo) : 0;
  return time
    ? new Date(time).toLocaleDateString("en-US", { month: "short", day: "numeric" })
    : null;
}

export function buildHitListSlides(input: {
  propertyId: string;
  propertyName: string;
  profiles: DeerProfile[];
  photos: PhotoRecord[];
  cameras: Camera[];
  cameraChecks: CameraCheck[];
  hunts: HuntLogEntry[];
  pins: MapPin[];
}): HitListSlide[] {
  const { propertyId, propertyName, profiles, photos, cameras } = input;
  const cameraName = (id: string) => cameras.find((camera) => camera.id === id)?.name;
  const propertyPhotos = photos.filter((photo) => photo.propertyId === propertyId);

  const propertyProfiles = profiles.filter((profile) => profile.propertyId === propertyId);
  const usualTimeOf = (profile: DeerProfile): string | null => {
    const { timeWindow } = getDeerProfileTimeline({
      profile,
      photoRecords: input.photos,
      hunts: input.hunts,
      cameras: input.cameras,
    });
    if (!timeWindow || timeWindow.sampleSize < MIN_TIMED_FOR_PATTERN) return null;
    return describeDeerTimeWindow(timeWindow)?.title ?? null;
  };

  const slides: HitListSlide[] = propertyProfiles
    // Harvested or retired bucks are off the hit list.
    .filter(isActiveDeerProfile)
    .map((profile) => {
      const intel = getDeerProfileIntelligence({
        profile,
        propertyName,
        cameras: input.cameras,
        photoRecords: input.photos,
        cameraChecks: input.cameraChecks,
        hunts: input.hunts,
        pins: input.pins,
      });
      const nickname = profile.nickname.trim().toLowerCase();
      const hisPhotos = propertyPhotos.filter(
        (photo) =>
          getPhotoDeerProfileIds(photo).includes(profile.id) ||
          (nickname !== "" &&
            getPhotoBuckNames(photo).some((name) => name.toLowerCase() === nickname)),
      );
      const latest = newest(hisPhotos);
      const where = latest ? cameraName(latest.cameraSiteId) : undefined;
      const when = shortDate(latest);

      return {
        key: profile.id,
        name: profile.nickname.trim() || "Unnamed buck",
        imageId: latest?.imageId ?? null,
        age: profile.estimatedAge.trim(),
        lastSeen: when ? (where ? `${when} on ${where}` : when) : null,
        // Same reading as the buck's card (photos plus sits he was tagged on),
        // and only once there are enough timed sightings to call it "usually".
        usualTime: usualTimeOf(profile),
        sightings: intel.sightingCount,
        href: `/hit-list?buck=${encodeURIComponent(profile.id)}`,
      };
    });

  // Bucks named on photos but never given a profile still belong on the list.
  // Inactive bucks still count as covered, so their photo tags don't come back
  // as name-only slides.
  const covered = new Set(
    propertyProfiles
      .map((profile) => profile.nickname.trim().toLowerCase())
      .filter(Boolean),
  );
  for (const slide of slides) covered.add(slide.name.toLowerCase());
  const byName = new Map<string, PhotoRecord[]>();
  for (const photo of propertyPhotos) {
    for (const name of getPhotoBuckNames(photo)) {
      const key = name.toLowerCase();
      if (covered.has(key)) continue;
      byName.set(key, [...(byName.get(key) ?? []), photo]);
    }
  }
  for (const [key, hisPhotos] of byName) {
    const latest = newest(hisPhotos);
    const where = latest ? cameraName(latest.cameraSiteId) : undefined;
    const when = shortDate(latest);
    slides.push({
      key: `name:${key}`,
      name: getPhotoBuckNames(hisPhotos[0]).find((n) => n.toLowerCase() === key) ?? key,
      imageId: latest?.imageId ?? null,
      age: "",
      lastSeen: when ? (where ? `${when} on ${where}` : when) : null,
      usualTime: null,
      sightings: hisPhotos.length,
      href: "/hit-list",
    });
  }

  // Bucks with a photo first, then most-seen.
  return slides.sort(
    (a, b) =>
      Number(Boolean(b.imageId)) - Number(Boolean(a.imageId)) ||
      b.sightings - a.sightings,
  );
}
